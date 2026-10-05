/**
 * Pine Script AST — node definitions.
 * Every node has a unique numeric `id` (per parse) and a source location.
 */

export interface Loc {
  line: number;
  col: number;
}

export interface BaseNode {
  id: number;
  loc: Loc;
}

// ----------------------------------------------------------------------------
// Expressions
// ----------------------------------------------------------------------------

export interface NumLit extends BaseNode { kind: 'Num'; value: number; raw: string }
export interface StrLit extends BaseNode { kind: 'Str'; value: string; isColor?: boolean }
export interface BoolLit extends BaseNode { kind: 'Bool'; value: boolean }
export interface NaLit extends BaseNode { kind: 'Na' }
export interface Ident extends BaseNode { kind: 'Ident'; name: string }
export interface Member extends BaseNode { kind: 'Member'; object: Expr; prop: string }
export interface Arg { name?: string; value: Expr }
export interface Call extends BaseNode { kind: 'Call'; callee: Expr; args: Arg[] }
export interface IndexExpr extends BaseNode { kind: 'Index'; object: Expr; index: Expr }
export interface Unary extends BaseNode { kind: 'Unary'; op: '-' | '+' | 'not'; arg: Expr }
export interface Binary extends BaseNode { kind: 'Binary'; op: string; left: Expr; right: Expr }
export interface Ternary extends BaseNode { kind: 'Ternary'; test: Expr; cons: Expr; alt: Expr }
export interface TupleExpr extends BaseNode { kind: 'Tuple'; elements: Expr[] }
/** `if` / `switch` / `for` / `while` used on the right-hand side of an assignment */
export interface BlockExpr extends BaseNode { kind: 'BlockExpr'; stmt: Stmt }

export type Expr =
  | NumLit | StrLit | BoolLit | NaLit | Ident | Member | Call
  | IndexExpr | Unary | Binary | Ternary | TupleExpr | BlockExpr;

// ----------------------------------------------------------------------------
// Statements
// ----------------------------------------------------------------------------

export interface VarDecl extends BaseNode {
  kind: 'VarDecl';
  names: string[];
  nameLocs: Loc[];
  isTuple: boolean;
  /** '=' declares, ':=' reassigns */
  op: '=' | ':=';
  compound?: boolean;
  declKind: 'plain' | 'var' | 'varip';
  typeName?: string;
  init: Expr;
}
export interface ExprStmt extends BaseNode { kind: 'ExprStmt'; expr: Expr }
export interface IfStmt extends BaseNode { kind: 'If'; test: Expr; consequent: Stmt[]; alternate: Stmt[] | null }
export interface ForStmt extends BaseNode { kind: 'For'; variable: string; from: Expr; to: Expr; by?: Expr; body: Stmt[] }
export interface ForInStmt extends BaseNode { kind: 'ForIn'; variables: string[]; iterable: Expr; body: Stmt[] }
export interface WhileStmt extends BaseNode { kind: 'While'; test: Expr; body: Stmt[] }
export interface FuncParam { name: string; default?: Expr; loc: Loc }
export interface FuncDef extends BaseNode { kind: 'FuncDef'; name: string; params: FuncParam[]; body: Stmt[]; isMethod?: boolean }
export interface SwitchCase { test?: Expr; body: Stmt[]; loc: Loc }
export interface SwitchStmt extends BaseNode { kind: 'Switch'; subject?: Expr; cases: SwitchCase[] }
export interface BreakStmt extends BaseNode { kind: 'Break' }
export interface ContinueStmt extends BaseNode { kind: 'Continue' }

export type Stmt =
  | VarDecl | ExprStmt | IfStmt | ForStmt | ForInStmt | WhileStmt
  | FuncDef | SwitchStmt | BreakStmt | ContinueStmt;

export type Node = Expr | Stmt;

export interface Program {
  version: number | null;
  body: Stmt[];
}

// ----------------------------------------------------------------------------
// Diagnostics (shared by every analysis stage)
// ----------------------------------------------------------------------------

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  loc?: Loc;
  stage: string;
}

// ----------------------------------------------------------------------------
// Generic traversal helpers
// ----------------------------------------------------------------------------

export function childExprs(e: Expr): Expr[] {
  switch (e.kind) {
    case 'Member': return [e.object];
    case 'Call': return [e.callee, ...e.args.map(a => a.value)];
    case 'Index': return [e.object, e.index];
    case 'Unary': return [e.arg];
    case 'Binary': return [e.left, e.right];
    case 'Ternary': return [e.test, e.cons, e.alt];
    case 'Tuple': return e.elements;
    default: return [];
  }
}

/** Depth-first walk over an expression tree (does not descend into BlockExpr statements). */
export function walkExpr(e: Expr, fn: (n: Expr) => void): void {
  fn(e);
  for (const c of childExprs(e)) walkExpr(c, fn);
}

/** Flattens `a.b.c` member chains / identifiers to dotted text. Returns null if not a pure chain. */
export function dottedName(e: Expr): string | null {
  if (e.kind === 'Ident') return e.name;
  if (e.kind === 'Member') {
    const base = dottedName(e.object);
    return base ? `${base}.${e.prop}` : null;
  }
  return null;
}

/** Canonical, deterministic source rendering of an expression (used for hashing / term keys). */
export function printExpr(e: Expr): string {
  switch (e.kind) {
    case 'Num': return String(e.value);
    case 'Str': return JSON.stringify(e.value);
    case 'Bool': return e.value ? 'true' : 'false';
    case 'Na': return 'na';
    case 'Ident': return e.name;
    case 'Member': return `${printExpr(e.object)}.${e.prop}`;
    case 'Call': return `${printExpr(e.callee)}(${e.args.map(a => (a.name ? `${a.name}=` : '') + printExpr(a.value)).join(', ')})`;
    case 'Index': return `${printExpr(e.object)}[${printExpr(e.index)}]`;
    case 'Unary': return e.op === 'not' ? `not ${printExpr(e.arg)}` : `${e.op}${printExpr(e.arg)}`;
    case 'Binary': return `(${printExpr(e.left)} ${e.op} ${printExpr(e.right)})`;
    case 'Ternary': return `(${printExpr(e.test)} ? ${printExpr(e.cons)} : ${printExpr(e.alt)})`;
    case 'Tuple': return `[${e.elements.map(printExpr).join(', ')}]`;
    case 'BlockExpr': return `<block@${e.loc.line}>`;
  }
}
