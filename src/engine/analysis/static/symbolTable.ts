/**
 * Symbol table & name resolution (Stage 2) + semantic validation (Stage 3).
 *
 * Resolution follows Pine's declaration-before-use rule: an identifier that is not
 * declared at the point of use is *unresolved*, even if declared later in the file.
 */

import {
  BlockExpr, Call, Diagnostic, Expr, FuncDef, Loc, Program, Stmt, VarDecl, dottedName, printExpr,
} from '../pine/ast';
import {
  ARITY, GLOBAL_SCOPE_ONLY, STRATEGY_ORDER_CALLS, isKnownBuiltinRoot, isKnownNamespaceMember, isNamespaceRoot,
} from '../pine/builtins';
import { walkStmts } from './walk';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface GuardTerm {
  expr: Expr;
  negated: boolean;
}

export type SymbolKind = 'variable' | 'input' | 'param' | 'function' | 'loopVar' | 'tupleElem';

export interface Def {
  symbolId: number;
  expr: Expr;
  node: VarDecl;
  reassign: boolean;
  guards: GuardTerm[];
  funcName: string | null;
  tupleIndex?: number;
  scopeId: number;
}

export interface SymbolInfo {
  id: number;
  name: string;
  kind: SymbolKind;
  scopeId: number;
  declLoc: Loc;
  declKind?: 'plain' | 'var' | 'varip';
  typeName?: string;
  inputType?: string;
  inputDefault?: string;
  refCount: number;
  reassignCount: number;
  defs: Def[];
  funcNode?: FuncDef;
  paramCount?: number;
  minArgs?: number;
}

export interface ScopeInfo {
  id: number;
  parent: number | null;
  kind: 'global' | 'function' | 'block' | 'loop';
  owner?: string;
  symbols: Map<string, number>;
}

export interface CallSite {
  node: Call;
  name: string | null;
  guards: GuardTerm[];
  funcName: string | null;
  stmtId: number;
  loc: Loc;
  scopeKind: 'global' | 'local';
}

export interface UnresolvedRef {
  name: string;
  loc: Loc;
  code: 'UNRESOLVED_IDENTIFIER' | 'FORWARD_REFERENCE' | 'UNDECLARED_REASSIGNMENT';
}

export interface SymbolTable {
  symbols: SymbolInfo[];
  scopes: ScopeInfo[];
  /** Ident node id -> symbol id (user-defined only) */
  refs: Map<number, number>;
  unresolved: UnresolvedRef[];
  calls: CallSite[];
  defs: Def[];
  diagnostics: Diagnostic[];
  funcNames: Set<string>;
  /** caller function name -> callee function names (includes forward/recursive references) */
  funcCallEdges: Map<string, Set<string>>;
  recursiveCalls: string[];
  usedBuiltinRoots: Set<string>;
}

// ----------------------------------------------------------------------------
// Resolver
// ----------------------------------------------------------------------------

class Resolver {
  symbols: SymbolInfo[] = [];
  scopes: ScopeInfo[] = [];
  refs = new Map<number, number>();
  unresolved: UnresolvedRef[] = [];
  calls: CallSite[] = [];
  defs: Def[] = [];
  diagnostics: Diagnostic[] = [];
  funcNames = new Set<string>();
  funcCallEdges = new Map<string, Set<string>>();
  recursiveCalls: string[] = [];
  usedBuiltinRoots = new Set<string>();

  private guardStack: GuardTerm[] = [];
  private funcStack: string[] = [];
  private loopDepth = 0;
  private curStmtId = 0;
  private selfRefSuppress: number | null = null;

  constructor(private program: Program) {}

  run(): void {
    this.collectFuncNames(this.program.body);
    const g = this.newScope(null, 'global');
    this.walkStmtList(this.program.body, g);
    this.reportUnused();
  }

  private collectFuncNames(stmts: Stmt[]): void {
    walkStmts(stmts, s => {
      if (s.kind === 'FuncDef') this.funcNames.add(s.name);
    });
  }

  // ----- scopes / symbols -------------------------------------------------
  private newScope(parent: number | null, kind: ScopeInfo['kind'], owner?: string): number {
    const id = this.scopes.length;
    this.scopes.push({ id, parent, kind, owner, symbols: new Map() });
    return id;
  }

  private lookup(name: string, scopeId: number): SymbolInfo | null {
    let cur: number | null = scopeId;
    while (cur !== null) {
      const sc: ScopeInfo = this.scopes[cur];
      const sid = sc.symbols.get(name);
      if (sid !== undefined) return this.symbols[sid];
      cur = sc.parent;
    }
    return null;
  }

  private declare(name: string, kind: SymbolKind, scopeId: number, loc: Loc, extra: Partial<SymbolInfo> = {}): SymbolInfo {
    const sym: SymbolInfo = {
      id: this.symbols.length, name, kind, scopeId, declLoc: loc,
      refCount: 0, reassignCount: 0, defs: [], ...extra,
    };
    this.symbols.push(sym);
    this.scopes[scopeId].symbols.set(name, sym.id);
    return sym;
  }

  private diag(severity: Diagnostic['severity'], code: string, message: string, loc: Loc | undefined, stage: string): void {
    this.diagnostics.push({ severity, code, message, loc, stage });
  }

  // ----- statements -------------------------------------------------------
  private walkStmtList(stmts: Stmt[], scope: number): void {
    for (const s of stmts) this.walkStmt(s, scope);
  }

  private walkStmt(s: Stmt, scope: number): void {
    switch (s.kind) {
      case 'VarDecl': this.handleVarDecl(s, scope); break;
      case 'ExprStmt':
        this.curStmtId = s.id;
        this.walkExpr(s.expr, scope);
        break;
      case 'If': {
        this.curStmtId = s.id;
        this.walkExpr(s.test, scope);
        this.guardStack.push({ expr: s.test, negated: false });
        const cs = this.newScope(scope, 'block');
        this.walkStmtList(s.consequent, cs);
        this.guardStack.pop();
        if (s.alternate) {
          this.guardStack.push({ expr: s.test, negated: true });
          const as = this.newScope(scope, 'block');
          this.walkStmtList(s.alternate, as);
          this.guardStack.pop();
        }
        break;
      }
      case 'For': {
        this.curStmtId = s.id;
        this.walkExpr(s.from, scope);
        this.walkExpr(s.to, scope);
        if (s.by) this.walkExpr(s.by, scope);
        const ls = this.newScope(scope, 'loop');
        this.declare(s.variable, 'loopVar', ls, s.loc);
        this.loopDepth++;
        this.walkStmtList(s.body, ls);
        this.loopDepth--;
        break;
      }
      case 'ForIn': {
        this.curStmtId = s.id;
        this.walkExpr(s.iterable, scope);
        const ls = this.newScope(scope, 'loop');
        for (const v of s.variables) this.declare(v, 'loopVar', ls, s.loc);
        this.loopDepth++;
        this.walkStmtList(s.body, ls);
        this.loopDepth--;
        break;
      }
      case 'While': {
        this.curStmtId = s.id;
        this.walkExpr(s.test, scope);
        this.guardStack.push({ expr: s.test, negated: false });
        const ls = this.newScope(scope, 'loop');
        this.loopDepth++;
        this.walkStmtList(s.body, ls);
        this.loopDepth--;
        this.guardStack.pop();
        break;
      }
      case 'Switch': {
        this.curStmtId = s.id;
        if (s.subject) this.walkExpr(s.subject, scope);
        const earlier: Expr[] = [];
        for (const c of s.cases) {
          if (c.test) this.walkExpr(c.test, scope);
          const pushed: GuardTerm[] = [];
          if (c.test) {
            const g: Expr = s.subject
              ? { kind: 'Binary', id: 0, loc: c.loc, op: '==', left: s.subject, right: c.test }
              : c.test;
            pushed.push({ expr: g, negated: false });
          } else {
            for (const prev of earlier) pushed.push({ expr: prev, negated: true });
          }
          this.guardStack.push(...pushed);
          const cs = this.newScope(scope, 'block');
          this.walkStmtList(c.body, cs);
          for (let i = 0; i < pushed.length; i++) this.guardStack.pop();
          if (c.test) {
            earlier.push(
              s.subject
                ? { kind: 'Binary', id: 0, loc: c.loc, op: '==', left: s.subject, right: c.test }
                : c.test,
            );
          }
        }
        break;
      }
      case 'FuncDef': this.handleFuncDef(s, scope); break;
      case 'Break':
      case 'Continue':
        if (this.loopDepth === 0) {
          this.diag('error', 'JUMP_OUTSIDE_LOOP', `'${s.kind.toLowerCase()}' used outside of a loop`, s.loc, 'SEMANTIC');
        }
        break;
    }
  }

  private isInputCall(e: Expr): { type: string; def?: string } | null {
    if (e.kind !== 'Call') return null;
    const n = dottedName(e.callee);
    if (!n) return null;
    if (n === 'input' || n.startsWith('input.')) {
      const first = e.args.find(a => !a.name) ?? e.args.find(a => a.name === 'defval');
      return { type: n === 'input' ? 'auto' : n.slice(6), def: first ? printExpr(first.value) : undefined };
    }
    return null;
  }

  private handleVarDecl(d: VarDecl, scope: number): void {
    this.curStmtId = d.id;
    const guards = [...this.guardStack];
    const funcName = this.funcStack.length ? this.funcStack[this.funcStack.length - 1] : null;

    if (d.op === ':=') {
      const target = d.names.length === 1 ? this.lookup(d.names[0], scope) : null;
      if (target) this.selfRefSuppress = target.id;
      this.walkInit(d.init, scope);
      this.selfRefSuppress = null;
      d.names.forEach((name, idx) => {
        const sym = this.lookup(name, scope);
        if (!sym) {
          this.unresolved.push({ name, loc: d.nameLocs[idx] ?? d.loc, code: 'UNDECLARED_REASSIGNMENT' });
          return;
        }
        sym.reassignCount++;
        const def: Def = { symbolId: sym.id, expr: d.init, node: d, reassign: true, guards, funcName, tupleIndex: d.isTuple ? idx : undefined, scopeId: scope };
        sym.defs.push(def);
        this.defs.push(def);
        if (sym.kind === 'input') {
          this.diag('warning', 'REASSIGNED_INPUT', `Input '${name}' is reassigned with ':='`, d.loc, 'SEMANTIC');
        }
      });
      return;
    }

    this.walkInit(d.init, scope);
    const inputInfo = d.isTuple ? null : this.isInputCall(d.init);

    d.names.forEach((name, idx) => {
      const loc = d.nameLocs[idx] ?? d.loc;
      const existingHere = this.scopes[scope].symbols.get(name);
      if (existingHere !== undefined && this.symbols[existingHere].kind !== 'function') {
        this.diag('error', 'REDECLARED_VARIABLE',
          `Variable '${name}' is already declared in this scope (use ':=' to reassign)`, loc, 'SEMANTIC');
      } else if (existingHere === undefined && this.scopes[scope].kind !== 'global') {
        const outer = this.scopes[scope].parent !== null ? this.lookup(name, this.scopes[scope].parent as number) : null;
        if (outer && outer.kind !== 'function' && this.scopes[scope].kind !== 'function') {
          this.diag('warning', 'SHADOWED_ASSIGNMENT',
            `'${name}' declared in a nested block shadows the outer '${name}' — if you meant to update it use ':='`,
            loc, 'SEMANTIC');
        }
      }
      const sym = this.declare(name, inputInfo ? 'input' : d.isTuple ? 'tupleElem' : 'variable', scope, loc, {
        declKind: d.declKind, typeName: d.typeName,
        inputType: inputInfo?.type, inputDefault: inputInfo?.def,
      });
      const def: Def = { symbolId: sym.id, expr: d.init, node: d, reassign: false, guards, funcName, tupleIndex: d.isTuple ? idx : undefined, scopeId: scope };
      sym.defs.push(def);
      this.defs.push(def);
    });
  }

  private walkInit(e: Expr, scope: number): void {
    if (e.kind === 'BlockExpr') {
      const bs = this.newScope(scope, 'block');
      this.walkStmt((e as BlockExpr).stmt, bs);
    } else {
      this.walkExpr(e, scope);
    }
  }

  private handleFuncDef(f: FuncDef, scope: number): void {
    this.curStmtId = f.id;
    const existing = this.scopes[scope].symbols.get(f.name);
    if (existing !== undefined) {
      this.diag('error', 'REDECLARED_FUNCTION', `Function '${f.name}' is already declared in this scope`, f.loc, 'SEMANTIC');
    }
    for (const p of f.params) if (p.default) this.walkExpr(p.default, scope);

    const fs = this.newScope(scope, 'function', f.name);
    for (const p of f.params) {
      this.declare(p.name, 'param', fs, p.loc);
    }

    const savedGuards = this.guardStack;
    const savedLoop = this.loopDepth;
    this.guardStack = [];
    this.loopDepth = 0;
    this.funcStack.push(f.name);
    this.walkStmtList(f.body, fs);
    this.funcStack.pop();
    this.guardStack = savedGuards;
    this.loopDepth = savedLoop;

    this.declare(f.name, 'function', scope, f.loc, {
      funcNode: f,
      paramCount: f.params.length,
      minArgs: f.params.filter(p => !p.default).length,
    });
  }

  // ----- expressions ------------------------------------------------------
  private rootIdent(e: Expr): Expr | null {
    let cur = e;
    while (cur.kind === 'Member') cur = cur.object;
    return cur.kind === 'Ident' ? cur : null;
  }

  private resolveIdent(name: string, id: number, loc: Loc, scope: number, asCallee: boolean): void {
    const sym = this.lookup(name, scope);
    if (sym) {
      if (this.selfRefSuppress !== sym.id) sym.refCount++;
      this.refs.set(id, sym.id);
      if (sym.kind === 'function' && this.funcStack.length) this.addFuncEdge(this.funcStack[this.funcStack.length - 1], name);
      return;
    }
    if (isKnownBuiltinRoot(name)) {
      this.usedBuiltinRoots.add(name);
      return;
    }
    // recursion: calling the function currently being defined
    if (asCallee && this.funcStack.includes(name)) {
      this.recursiveCalls.push(name);
      this.addFuncEdge(this.funcStack[this.funcStack.length - 1], name);
      this.diag('error', 'RECURSION_NOT_ALLOWED', `Function '${name}' calls itself — recursion is not allowed in Pine`, loc, 'AST_SYMBOLS');
      return;
    }
    // forward reference to a function declared later in the file
    if (asCallee && this.funcNames.has(name)) {
      if (this.funcStack.length) this.addFuncEdge(this.funcStack[this.funcStack.length - 1], name);
      this.unresolved.push({ name, loc, code: 'FORWARD_REFERENCE' });
      return;
    }
    this.unresolved.push({ name, loc, code: 'UNRESOLVED_IDENTIFIER' });
  }

  private addFuncEdge(from: string, to: string): void {
    if (!this.funcCallEdges.has(from)) this.funcCallEdges.set(from, new Set());
    this.funcCallEdges.get(from)!.add(to);
  }

  private walkExpr(e: Expr, scope: number): void {
    switch (e.kind) {
      case 'Num': case 'Str': case 'Bool': case 'Na': return;
      case 'Ident':
        this.resolveIdent(e.name, e.id, e.loc, scope, false);
        return;
      case 'Member': {
        const root = this.rootIdent(e);
        if (root && root.kind === 'Ident' && !this.lookup(root.name, scope) && isNamespaceRoot(root.name)) {
          this.usedBuiltinRoots.add(root.name);
          if (e.object.kind === 'Ident' && !isKnownNamespaceMember(root.name, e.prop)) {
            this.diag('warning', 'UNKNOWN_BUILTIN_MEMBER', `'${root.name}.${e.prop}' is not a known Pine builtin`, e.loc, 'AST_SYMBOLS');
          }
          return;
        }
        this.walkExpr(e.object, scope);
        return;
      }
      case 'Call': {
        const name = dottedName(e.callee);
        this.calls.push({
          node: e, name, guards: [...this.guardStack],
          funcName: this.funcStack.length ? this.funcStack[this.funcStack.length - 1] : null,
          stmtId: this.curStmtId, loc: e.loc,
          scopeKind: scope === 0 ? 'global' : 'local',
        });
        if (e.callee.kind === 'Ident') {
          this.resolveIdent(e.callee.name, e.callee.id, e.callee.loc, scope, true);
        } else {
          this.walkExpr(e.callee, scope);
        }
        for (const a of e.args) this.walkExpr(a.value, scope);
        this.validateCall(e, name, scope);
        return;
      }
      case 'Index':
        this.walkExpr(e.object, scope);
        this.walkExpr(e.index, scope);
        return;
      case 'Unary': this.walkExpr(e.arg, scope); return;
      case 'Binary': this.walkExpr(e.left, scope); this.walkExpr(e.right, scope); return;
      case 'Ternary':
        this.walkExpr(e.test, scope); this.walkExpr(e.cons, scope); this.walkExpr(e.alt, scope);
        return;
      case 'Tuple': for (const x of e.elements) this.walkExpr(x, scope); return;
      case 'BlockExpr': {
        const bs = this.newScope(scope, 'block');
        this.walkStmt(e.stmt, bs);
        return;
      }
    }
  }

  private validateCall(e: Call, name: string | null, scope: number): void {
    if (!name) return;
    const root = name.split('.')[0];
    const shadowed = this.lookup(root, scope);

    if (!shadowed && ARITY[name]) {
      const [min, max] = ARITY[name];
      const n = e.args.length;
      if (n < min || n > max) {
        this.diag('error', 'WRONG_ARITY',
          `${name}() expects ${min === max ? min : `${min}–${max}`} argument(s) but got ${n}`, e.loc, 'SEMANTIC');
      }
    }

    if (e.callee.kind === 'Ident' && shadowed && shadowed.kind === 'function') {
      const n = e.args.length;
      if (n > (shadowed.paramCount ?? 0)) {
        this.diag('error', 'WRONG_ARITY', `${name}() takes at most ${shadowed.paramCount} argument(s) but got ${n}`, e.loc, 'SEMANTIC');
      } else if (n < (shadowed.minArgs ?? 0)) {
        this.diag('error', 'WRONG_ARITY', `${name}() requires at least ${shadowed.minArgs} argument(s) but got ${n}`, e.loc, 'SEMANTIC');
      }
    }

    if (!shadowed && (name === 'request.security' || name === 'security')) {
      if (e.args.length < 3) {
        this.diag('error', 'WRONG_ARITY', `${name}() expects at least 3 arguments (symbol, timeframe, expression)`, e.loc, 'SEMANTIC');
      }
      const la = e.args.find(a => a.name === 'lookahead');
      if (la && printExpr(la.value).includes('lookahead_on')) {
        this.diag('warning', 'REPAINT_RISK_LOOKAHEAD_ON', `${name}() uses lookahead_on — results can repaint / leak future data`, e.loc, 'SEMANTIC');
      }
    }
  }

  // ----- unused detection -------------------------------------------------
  private reportUnused(): void {
    for (const s of this.symbols) {
      if (s.refCount > 0 || s.name.startsWith('_')) continue;
      if (s.kind === 'param' || s.kind === 'loopVar') continue;
      const code =
        s.kind === 'input' ? 'UNUSED_INPUT' : s.kind === 'function' ? 'UNUSED_FUNCTION' : 'UNUSED_VARIABLE';
      this.diag('warning', code, `${s.kind === 'input' ? 'Input' : s.kind === 'function' ? 'Function' : 'Variable'} '${s.name}' is declared but never used`, s.declLoc, 'AST_SYMBOLS');
    }
  }
}

export function buildSymbolTable(program: Program): SymbolTable {
  const r = new Resolver(program);
  r.run();
  return {
    symbols: r.symbols,
    scopes: r.scopes,
    refs: r.refs,
    unresolved: r.unresolved,
    calls: r.calls,
    defs: r.defs,
    diagnostics: r.diagnostics,
    funcNames: r.funcNames,
    funcCallEdges: r.funcCallEdges,
    recursiveCalls: r.recursiveCalls,
    usedBuiltinRoots: r.usedBuiltinRoots,
  };
}

// ----------------------------------------------------------------------------
// Stage 3 — Semantic validation
// ----------------------------------------------------------------------------

export type ScriptKind = 'strategy' | 'indicator' | 'library' | 'unknown';

export interface SemanticResult {
  scriptKind: ScriptKind;
  version: number | null;
  declarationLoc?: Loc;
  declarationArgs: Record<string, string>;
  diagnostics: Diagnostic[];
}

export function validateSemantics(program: Program, table: SymbolTable): SemanticResult {
  const diagnostics: Diagnostic[] = [];
  const push = (severity: Diagnostic['severity'], code: string, message: string, loc?: Loc) =>
    diagnostics.push({ severity, code, message, loc, stage: 'SEMANTIC' });

  // Script declaration
  const decls: { kind: ScriptKind; call: Call; index: number }[] = [];
  program.body.forEach((s, index) => {
    if (s.kind === 'ExprStmt' && s.expr.kind === 'Call' && s.expr.callee.kind === 'Ident' &&
        ['indicator', 'strategy', 'library'].includes(s.expr.callee.name)) {
      decls.push({ kind: s.expr.callee.name as ScriptKind, call: s.expr, index });
    }
  });

  let scriptKind: ScriptKind = 'unknown';
  let declarationLoc: Loc | undefined;
  const declarationArgs: Record<string, string> = {};

  if (decls.length === 0) {
    push('error', 'MISSING_SCRIPT_DECLARATION', 'Script must declare indicator(), strategy() or library()');
  } else {
    scriptKind = decls[0].kind;
    declarationLoc = decls[0].call.loc;
    decls[0].call.args.forEach((a, i) => {
      declarationArgs[a.name ?? `arg${i}`] = printExpr(a.value);
    });
    if (decls.length > 1) {
      push('error', 'DUPLICATE_SCRIPT_DECLARATION', 'Only one indicator()/strategy()/library() declaration is allowed', decls[1].call.loc);
    }
    if (decls[0].index !== 0) {
      push('warning', 'DECLARATION_NOT_FIRST', 'Script declaration should be the first statement', decls[0].call.loc);
    }
  }

  if (program.version === null) {
    push('warning', 'MISSING_VERSION', "No '//@version=N' directive found");
  } else if (program.version < 4 || program.version > 6) {
    push('warning', 'UNSUPPORTED_VERSION', `Pine version ${program.version} is outside the supported range (4–6)`);
  }

  for (const c of table.calls) {
    if (!c.name) continue;
    if (scriptKind === 'indicator' && STRATEGY_ORDER_CALLS.has(c.name)) {
      push('error', 'STRATEGY_CALL_IN_INDICATOR', `${c.name}() can only be used in strategy() scripts`, c.loc);
    }
    if (c.scopeKind === 'local' && GLOBAL_SCOPE_ONLY.has(c.name) &&
        !['indicator', 'strategy', 'library'].includes(c.name)) {
      push('error', 'GLOBAL_CALL_IN_LOCAL_SCOPE', `${c.name}() cannot be called from a local scope (if/for/function)`, c.loc);
    }
    if ((c.name === 'strategy.entry' || c.name === 'strategy.order')) {
      const hasDirection = c.node.args.length >= 2 || c.node.args.some(a => a.name === 'direction');
      if (!hasDirection) push('error', 'WRONG_ARITY', `${c.name}() requires (id, direction, ...)`, c.loc);
    }
  }

  return { scriptKind, version: program.version, declarationLoc, declarationArgs, diagnostics };
}
