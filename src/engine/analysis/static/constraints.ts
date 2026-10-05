/**
 * Logical constraint engine (used by dead-code, contradiction and reachability analysis).
 *
 * Expressions are lowered to a boolean formula whose atoms are either
 *   - order comparisons between opaque "terms" (numeric constants or symbolic series), or
 *   - boolean atoms.
 * Satisfiability is decided exactly over a dense total order:
 *   formula -> DNF -> per-conjunct constraint graph (<=, <) -> SCC check + disequalities.
 *
 * Limits (documented, reported as UNKNOWN rather than guessed):
 *   - arithmetic on non-constant terms is opaque (a+1 is just a new term),
 *   - NaN / na semantics are ignored,
 *   - DNF expansion is capped at MAX_DISJUNCTS.
 */

import { Expr, dottedName, printExpr } from '../pine/ast';
import { SymbolInfo, SymbolTable } from './symbolTable';

export type Term = { k: 'const'; v: number } | { k: 'sym'; key: string };

export type Formula =
  | { t: 'true' }
  | { t: 'false' }
  | { t: 'bool'; key: string }
  | { t: 'cmp'; op: '<' | '<=' | '==' | '!='; l: Term; r: Term }
  | { t: 'not'; f: Formula }
  | { t: 'and'; fs: Formula[] }
  | { t: 'or'; fs: Formula[] };

export type Sat = 'SAT' | 'UNSAT' | 'UNKNOWN';

export interface SatResult {
  result: Sat;
  /** human-readable literals of one satisfying conjunct (when SAT) */
  witness?: string[];
}

const MAX_DISJUNCTS = 512;
const MAX_INLINE_DEPTH = 10;

const termText = (t: Term): string => (t.k === 'const' ? String(t.v) : t.key.replace(/#\d+/g, ''));

// ----------------------------------------------------------------------------
// Expression -> Formula
// ----------------------------------------------------------------------------

export class FormulaBuilder {
  private inlining = new Set<number>();

  constructor(private table: SymbolTable) {}

  private symbolOf(e: Expr): SymbolInfo | null {
    if (e.kind !== 'Ident') return null;
    const sid = this.table.refs.get(e.id);
    return sid === undefined ? null : this.table.symbols[sid];
  }

  /** Canonical printing with user identifiers disambiguated by symbol id. */
  canon(e: Expr): string {
    switch (e.kind) {
      case 'Ident': {
        const s = this.symbolOf(e);
        return s ? `${s.name}#${s.id}` : e.name;
      }
      case 'Member': return `${this.canon(e.object)}.${e.prop}`;
      case 'Call': return `${this.canon(e.callee)}(${e.args.map(a => (a.name ? a.name + '=' : '') + this.canon(a.value)).join(',')})`;
      case 'Index': return `${this.canon(e.object)}[${this.canon(e.index)}]`;
      case 'Unary': return e.op === 'not' ? `not ${this.canon(e.arg)}` : `${e.op}${this.canon(e.arg)}`;
      case 'Binary': return `(${this.canon(e.left)}${e.op}${this.canon(e.right)})`;
      case 'Ternary': return `(${this.canon(e.test)}?${this.canon(e.cons)}:${this.canon(e.alt)})`;
      case 'Tuple': return `[${e.elements.map(x => this.canon(x)).join(',')}]`;
      default: return printExpr(e);
    }
  }

  /** Single plain definition that is safe to substitute (not var/varip, not reassigned, not an input). */
  private inlinableDef(s: SymbolInfo): Expr | null {
    if (s.kind !== 'variable') return null;
    if (s.declKind && s.declKind !== 'plain') return null;
    if (s.reassignCount > 0 || s.defs.length !== 1) return null;
    const d = s.defs[0];
    if (d.reassign || d.node.isTuple) return null;
    if (d.expr.kind === 'BlockExpr') return null;
    return d.expr;
  }

  private isBooleanExpr(e: Expr, depth: number): boolean {
    switch (e.kind) {
      case 'Bool': return true;
      case 'Unary': return e.op === 'not';
      case 'Binary': return ['and', 'or', '==', '!=', '<', '>', '<=', '>='].includes(e.op);
      case 'Ternary': return this.isBooleanExpr(e.cons, depth) && this.isBooleanExpr(e.alt, depth);
      case 'Call': {
        const n = dottedName(e.callee);
        return !!n && ['ta.crossover', 'ta.crossunder', 'ta.cross', 'crossover', 'crossunder', 'cross', 'ta.rising', 'ta.falling'].includes(n);
      }
      case 'Ident': {
        const s = this.symbolOf(e);
        if (!s || depth > MAX_INLINE_DEPTH) return false;
        const def = this.inlinableDef(s);
        return !!def && this.isBooleanExpr(def, depth + 1);
      }
      default: return false;
    }
  }

  term(e: Expr): Term {
    switch (e.kind) {
      case 'Num': return { k: 'const', v: e.value };
      case 'Unary': {
        if (e.op === '-' || e.op === '+') {
          const t = this.term(e.arg);
          if (t.k === 'const') return { k: 'const', v: e.op === '-' ? -t.v : t.v };
        }
        return { k: 'sym', key: this.canon(e) };
      }
      case 'Binary': {
        if (['+', '-', '*', '/', '%'].includes(e.op)) {
          const l = this.term(e.left);
          const r = this.term(e.right);
          if (l.k === 'const' && r.k === 'const') {
            switch (e.op) {
              case '+': return { k: 'const', v: l.v + r.v };
              case '-': return { k: 'const', v: l.v - r.v };
              case '*': return { k: 'const', v: l.v * r.v };
              case '/': if (r.v !== 0) return { k: 'const', v: l.v / r.v }; break;
              case '%': if (r.v !== 0) return { k: 'const', v: l.v % r.v }; break;
            }
          }
        }
        return { k: 'sym', key: this.canon(e) };
      }
      case 'Ident': {
        const s = this.symbolOf(e);
        if (s && !this.inlining.has(s.id)) {
          const def = this.inlinableDef(s);
          if (def && this.inlining.size < MAX_INLINE_DEPTH) {
            this.inlining.add(s.id);
            const t = this.term(def);
            this.inlining.delete(s.id);
            if (t.k === 'const') return t;
          }
        }
        return { k: 'sym', key: this.canon(e) };
      }
      default:
        return { k: 'sym', key: this.canon(e) };
    }
  }

  private prev(t: Term): Term {
    return t.k === 'const' ? t : { k: 'sym', key: `${t.key}[1]` };
  }

  private cmp(op: '<' | '<=' | '==' | '!=', l: Term, r: Term): Formula {
    return { t: 'cmp', op, l, r };
  }

  formula(e: Expr): Formula {
    switch (e.kind) {
      case 'Bool': return { t: e.value ? 'true' : 'false' };
      case 'Unary':
        if (e.op === 'not') return { t: 'not', f: this.formula(e.arg) };
        return { t: 'bool', key: this.canon(e) };
      case 'Binary': {
        switch (e.op) {
          case 'and': return { t: 'and', fs: [this.formula(e.left), this.formula(e.right)] };
          case 'or': return { t: 'or', fs: [this.formula(e.left), this.formula(e.right)] };
          case '>': return this.cmp('<', this.term(e.right), this.term(e.left));
          case '>=': return this.cmp('<=', this.term(e.right), this.term(e.left));
          case '<': return this.cmp('<', this.term(e.left), this.term(e.right));
          case '<=': return this.cmp('<=', this.term(e.left), this.term(e.right));
          case '==': return this.cmp('==', this.term(e.left), this.term(e.right));
          case '!=': return this.cmp('!=', this.term(e.left), this.term(e.right));
          default: return { t: 'bool', key: this.canon(e) };
        }
      }
      case 'Ternary':
        return {
          t: 'or',
          fs: [
            { t: 'and', fs: [this.formula(e.test), this.formula(e.cons)] },
            { t: 'and', fs: [{ t: 'not', f: this.formula(e.test) }, this.formula(e.alt)] },
          ],
        };
      case 'Ident': {
        const s = this.symbolOf(e);
        if (s && !this.inlining.has(s.id) && this.inlining.size < MAX_INLINE_DEPTH) {
          const def = this.inlinableDef(s);
          if (def && this.isBooleanExpr(def, 0)) {
            this.inlining.add(s.id);
            const f = this.formula(def);
            this.inlining.delete(s.id);
            return f;
          }
        }
        return { t: 'bool', key: this.canon(e) };
      }
      case 'Call': {
        const n = dottedName(e.callee);
        const a = e.args[0];
        const b = e.args[1];
        if (n && a && b && ['ta.crossover', 'crossover', 'ta.crossunder', 'crossunder', 'ta.cross', 'cross'].includes(n)) {
          const ta = this.term(a.value);
          const tb = this.term(b.value);
          const over: Formula = { t: 'and', fs: [this.cmp('<', tb, ta), this.cmp('<=', this.prev(ta), this.prev(tb))] };
          const under: Formula = { t: 'and', fs: [this.cmp('<', ta, tb), this.cmp('<=', this.prev(tb), this.prev(ta))] };
          if (n.endsWith('crossover')) return over;
          if (n.endsWith('crossunder')) return under;
          return { t: 'or', fs: [over, under] };
        }
        return { t: 'bool', key: this.canon(e) };
      }
      default:
        return { t: 'bool', key: this.canon(e) };
    }
  }
}

// ----------------------------------------------------------------------------
// Formula -> DNF
// ----------------------------------------------------------------------------

type Lit =
  | { kind: 'cmp'; op: '<' | '<=' | '==' | '!='; l: Term; r: Term }
  | { kind: 'bool'; key: string; pos: boolean };

class TooComplex extends Error {}

function product(a: Lit[][], b: Lit[][]): Lit[][] {
  const out: Lit[][] = [];
  for (const x of a) {
    for (const y of b) {
      out.push([...x, ...y]);
      if (out.length > MAX_DISJUNCTS) throw new TooComplex();
    }
  }
  return out;
}

function dnf(f: Formula, neg: boolean): Lit[][] {
  switch (f.t) {
    case 'true': return neg ? [] : [[]];
    case 'false': return neg ? [[]] : [];
    case 'bool': return [[{ kind: 'bool', key: f.key, pos: !neg }]];
    case 'cmp': {
      if (!neg) return [[{ kind: 'cmp', op: f.op, l: f.l, r: f.r }]];
      switch (f.op) {
        case '<': return [[{ kind: 'cmp', op: '<=', l: f.r, r: f.l }]];
        case '<=': return [[{ kind: 'cmp', op: '<', l: f.r, r: f.l }]];
        case '==': return [[{ kind: 'cmp', op: '!=', l: f.l, r: f.r }]];
        case '!=': return [[{ kind: 'cmp', op: '==', l: f.l, r: f.r }]];
      }
      return [];
    }
    case 'not': return dnf(f.f, !neg);
    case 'and': {
      if (!neg) return f.fs.reduce<Lit[][]>((acc, x) => product(acc, dnf(x, false)), [[]]);
      const out: Lit[][] = [];
      for (const x of f.fs) {
        out.push(...dnf(x, true));
        if (out.length > MAX_DISJUNCTS) throw new TooComplex();
      }
      return out;
    }
    case 'or': {
      if (!neg) {
        const out: Lit[][] = [];
        for (const x of f.fs) {
          out.push(...dnf(x, false));
          if (out.length > MAX_DISJUNCTS) throw new TooComplex();
        }
        return out;
      }
      return f.fs.reduce<Lit[][]>((acc, x) => product(acc, dnf(x, true)), [[]]);
    }
  }
}

// ----------------------------------------------------------------------------
// Conjunct satisfiability
// ----------------------------------------------------------------------------

function sccIds(n: number, adj: number[][]): number[] {
  let index = 0;
  const idx = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const on = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  const comp = new Array<number>(n).fill(-1);
  let compCount = 0;
  const strong = (v: number) => {
    idx[v] = low[v] = index++;
    stack.push(v);
    on[v] = true;
    for (const w of adj[v]) {
      if (idx[w] === -1) { strong(w); low[v] = Math.min(low[v], low[w]); }
      else if (on[w]) low[v] = Math.min(low[v], idx[w]);
    }
    if (low[v] === idx[v]) {
      let w: number;
      do { w = stack.pop()!; on[w] = false; comp[w] = compCount; } while (w !== v);
      compCount++;
    }
  };
  for (let v = 0; v < n; v++) if (idx[v] === -1) strong(v);
  return comp;
}

function conjunctSat(lits: Lit[]): boolean {
  // boolean atoms
  const polarity = new Map<string, boolean>();
  for (const l of lits) {
    if (l.kind !== 'bool') continue;
    const p = polarity.get(l.key);
    if (p !== undefined && p !== l.pos) return false;
    polarity.set(l.key, l.pos);
  }

  // order constraints
  const nodeId = new Map<string, number>();
  const consts: { v: number; id: number }[] = [];
  const node = (t: Term): number => {
    const key = t.k === 'const' ? `c:${t.v}` : `s:${t.key}`;
    let id = nodeId.get(key);
    if (id === undefined) {
      id = nodeId.size;
      nodeId.set(key, id);
      if (t.k === 'const') consts.push({ v: t.v, id });
    }
    return id;
  };

  const edges: { a: number; b: number; strict: boolean }[] = [];
  const neqs: { a: number; b: number }[] = [];
  for (const l of lits) {
    if (l.kind !== 'cmp') continue;
    const a = node(l.l);
    const b = node(l.r);
    switch (l.op) {
      case '<': edges.push({ a, b, strict: true }); break;
      case '<=': edges.push({ a, b, strict: false }); break;
      case '==': edges.push({ a, b, strict: false }, { a: b, b: a, strict: false }); break;
      case '!=': neqs.push({ a, b }); break;
    }
  }

  consts.sort((x, y) => x.v - y.v);
  for (let i = 0; i + 1 < consts.length; i++) {
    if (consts[i].v < consts[i + 1].v) edges.push({ a: consts[i].id, b: consts[i + 1].id, strict: true });
  }

  const n = nodeId.size;
  if (n === 0) return true;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) adj[e.a].push(e.b);
  const comp = sccIds(n, adj);

  for (const e of edges) if (e.strict && comp[e.a] === comp[e.b]) return false;
  for (const q of neqs) if (comp[q.a] === comp[q.b]) return false;
  return true;
}

function describeLit(l: Lit): string {
  if (l.kind === 'bool') return l.pos ? l.key.replace(/#\d+/g, '') : `not ${l.key.replace(/#\d+/g, '')}`;
  return `${termText(l.l)} ${l.op} ${termText(l.r)}`;
}

export function satisfiable(f: Formula): SatResult {
  let disjuncts: Lit[][];
  try {
    disjuncts = dnf(f, false);
  } catch (e) {
    if (e instanceof TooComplex) return { result: 'UNKNOWN' };
    throw e;
  }
  if (disjuncts.length === 0) return { result: 'UNSAT' };
  for (const c of disjuncts) {
    if (conjunctSat(c)) return { result: 'SAT', witness: c.map(describeLit) };
  }
  return { result: 'UNSAT' };
}

/** Conjunction of guard terms (with polarity) and optional extra conditions. */
export function guardsFormula(
  builder: FormulaBuilder,
  guards: { expr: Expr; negated: boolean }[],
  extra: Expr[] = [],
): Formula {
  const fs: Formula[] = guards.map(g => {
    const f = builder.formula(g.expr);
    return g.negated ? { t: 'not', f } as Formula : f;
  });
  for (const x of extra) fs.push(builder.formula(x));
  return fs.length === 0 ? { t: 'true' } : { t: 'and', fs };
}

export function andFormula(...fs: Formula[]): Formula {
  return { t: 'and', fs };
}
