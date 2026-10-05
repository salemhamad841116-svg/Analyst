/**
 * Control-flow graph construction (Stage 5), dead-code and unreachable-condition detection.
 *
 * One CFG unit per scope (main program + each user function). Branch edges whose
 * guard conditions are unsatisfiable (decided by the constraint engine, not by text)
 * are marked infeasible and pruned before reachability is computed.
 */

import { Expr, FuncDef, Loc, Program, Stmt, printExpr } from '../pine/ast';
import { FormulaBuilder, guardsFormula, satisfiable } from './constraints';
import { GuardTerm, SymbolTable } from './symbolTable';
import { walkStmts } from './walk';

export type EdgeLabel = 'next' | 'true' | 'false' | 'loop' | 'break' | 'continue';

export interface CfgNode {
  id: number;
  kind: 'entry' | 'exit' | 'block' | 'branch' | 'loop';
  label: string;
  stmtIds: number[];
  loc?: Loc;
}

export interface CfgEdge {
  from: number;
  to: number;
  label: EdgeLabel;
  infeasible: boolean;
}

export interface CfgUnit {
  name: string;
  nodes: CfgNode[];
  edges: CfgEdge[];
  entry: number;
  exit: number;
  reachable: number[];
}

export interface DeadRegion {
  unit: string;
  loc: Loc;
  stmtIds: number[];
  reason: string;
}

export interface UnreachableCondition {
  unit: string;
  loc: Loc;
  text: string;
  kind: 'always-false' | 'always-true';
  detail: string;
}

export interface CfgReport {
  units: CfgUnit[];
  deadRegions: DeadRegion[];
  unreachableConditions: UnreachableCondition[];
  /** ids of statements that can never execute (consumed by reachability analysis) */
  deadStmtIds: Set<number>;
  stats: { units: number; nodes: number; edges: number; branches: number; loops: number; deadBlocks: number };
}

interface End {
  node: number;
  label: EdgeLabel;
  infeasible: boolean;
}

const trunc = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

class UnitBuilder {
  nodes: CfgNode[] = [];
  edges: CfgEdge[] = [];
  entry = 0;
  exit = 0;
  private guards: GuardTerm[] = [];
  private loops: { head: number; breaks: End[]; continues: End[] }[] = [];

  constructor(
    private name: string,
    private fb: FormulaBuilder,
    private unreachableConditions: UnreachableCondition[],
  ) {}

  private node(kind: CfgNode['kind'], label: string, loc?: Loc): CfgNode {
    const n: CfgNode = { id: this.nodes.length, kind, label, stmtIds: [], loc };
    this.nodes.push(n);
    return n;
  }

  private connect(ends: End[], to: number): void {
    for (const e of ends) this.edges.push({ from: e.node, to, label: e.label, infeasible: e.infeasible });
  }

  private feasible(expr: Expr, negated: boolean): boolean {
    const f = guardsFormula(this.fb, [...this.guards, { expr, negated }]);
    return satisfiable(f).result !== 'UNSAT';
  }

  build(stmts: Stmt[]): void {
    const entry = this.node('entry', 'ENTRY');
    const exit = this.node('exit', 'EXIT');
    this.entry = entry.id;
    this.exit = exit.id;
    const ends = this.seq(stmts, [{ node: entry.id, label: 'next', infeasible: false }]);
    this.connect(ends, exit.id);
  }

  private seq(stmts: Stmt[], preds: End[]): End[] {
    let cur = preds;
    let block: CfgNode | null = null;

    const ensureBlock = (s: Stmt): CfgNode => {
      if (!block) {
        block = this.node('block', `block@${s.loc.line}`, s.loc);
        this.connect(cur, block.id);
        cur = [{ node: block.id, label: 'next', infeasible: false }];
      }
      return block;
    };

    for (const s of stmts) {
      switch (s.kind) {
        case 'VarDecl':
        case 'ExprStmt':
        case 'FuncDef':
          ensureBlock(s).stmtIds.push(s.id);
          break;

        case 'Break': {
          const b = ensureBlock(s);
          b.stmtIds.push(s.id);
          const loop = this.loops[this.loops.length - 1];
          if (loop) loop.breaks.push({ node: b.id, label: 'break', infeasible: false });
          cur = [];
          block = null;
          break;
        }
        case 'Continue': {
          const b = ensureBlock(s);
          b.stmtIds.push(s.id);
          const loop = this.loops[this.loops.length - 1];
          if (loop) loop.continues.push({ node: b.id, label: 'continue', infeasible: false });
          cur = [];
          block = null;
          break;
        }

        case 'If': {
          block = null;
          const br = this.node('branch', `if ${trunc(printExpr(s.test))}`, s.loc);
          br.stmtIds.push(s.id);
          this.connect(cur, br.id);

          const tOk = this.feasible(s.test, false);
          const fOk = this.feasible(s.test, true);
          const ctxOk = tOk || fOk;
          const text = trunc(printExpr(s.test));
          if (ctxOk && !tOk) {
            this.unreachableConditions.push({
              unit: this.name, loc: s.loc, text, kind: 'always-false',
              detail: 'Condition can never be true — the "then" branch is unreachable',
            });
          }
          if (ctxOk && !fOk) {
            this.unreachableConditions.push({
              unit: this.name, loc: s.loc, text, kind: 'always-true',
              detail: s.alternate
                ? 'Condition is always true — the "else" branch is unreachable'
                : 'Condition is always true — the check is redundant',
            });
          }

          this.guards.push({ expr: s.test, negated: false });
          const thenEnds = this.seq(s.consequent, [{ node: br.id, label: 'true', infeasible: !tOk }]);
          this.guards.pop();

          let elseEnds: End[];
          if (s.alternate) {
            this.guards.push({ expr: s.test, negated: true });
            elseEnds = this.seq(s.alternate, [{ node: br.id, label: 'false', infeasible: !fOk }]);
            this.guards.pop();
          } else {
            elseEnds = [{ node: br.id, label: 'false', infeasible: !fOk }];
          }
          cur = [...thenEnds, ...elseEnds];
          break;
        }

        case 'For':
        case 'ForIn':
        case 'While': {
          block = null;
          const head = this.node('loop', s.kind === 'While' ? `while ${trunc(printExpr(s.test))}` : `${s.kind.toLowerCase()} loop`, s.loc);
          head.stmtIds.push(s.id);
          this.connect(cur, head.id);

          let bodyOk = true;
          let exitOk = true;
          if (s.kind === 'While') {
            bodyOk = this.feasible(s.test, false);
            exitOk = this.feasible(s.test, true);
            const text = trunc(printExpr(s.test));
            if (!bodyOk && exitOk) {
              this.unreachableConditions.push({
                unit: this.name, loc: s.loc, text, kind: 'always-false',
                detail: 'Loop condition can never be true — the loop body never executes',
              });
            }
          }

          const loop = { head: head.id, breaks: [] as End[], continues: [] as End[] };
          this.loops.push(loop);
          if (s.kind === 'While') this.guards.push({ expr: s.test, negated: false });
          const bodyEnds = this.seq(s.body, [{ node: head.id, label: 'true', infeasible: !bodyOk }]);
          if (s.kind === 'While') this.guards.pop();
          this.loops.pop();

          this.connect(bodyEnds, head.id);
          this.connect(loop.continues, head.id);
          // back edges are labelled 'loop'
          for (let i = this.edges.length - 1; i >= 0 && this.edges[i].to === head.id; i--) {
            if (this.edges[i].label === 'next') this.edges[i].label = 'loop';
          }
          cur = [{ node: head.id, label: 'false', infeasible: !exitOk }, ...loop.breaks];
          break;
        }

        case 'Switch': {
          block = null;
          const br = this.node('branch', `switch${s.subject ? ' ' + trunc(printExpr(s.subject)) : ''}`, s.loc);
          br.stmtIds.push(s.id);
          this.connect(cur, br.id);
          const ends: End[] = [];
          const earlier: Expr[] = [];
          let hasDefault = false;
          for (const c of s.cases) {
            const caseExpr: Expr | null = c.test
              ? s.subject
                ? { kind: 'Binary', id: 0, loc: c.loc, op: '==', left: s.subject, right: c.test }
                : c.test
              : null;
            const pushed: GuardTerm[] = [];
            if (caseExpr) pushed.push({ expr: caseExpr, negated: false });
            else {
              hasDefault = true;
              for (const p of earlier) pushed.push({ expr: p, negated: true });
            }
            this.guards.push(...pushed);
            const ok = satisfiable(guardsFormula(this.fb, this.guards)).result !== 'UNSAT';
            const caseEnds = this.seq(c.body, [{ node: br.id, label: 'true', infeasible: !ok }]);
            for (let i = 0; i < pushed.length; i++) this.guards.pop();
            ends.push(...caseEnds);
            if (caseExpr) earlier.push(caseExpr);
          }
          if (!hasDefault) ends.push({ node: br.id, label: 'false', infeasible: false });
          cur = ends;
          break;
        }
      }
    }
    return cur;
  }
}

function reachableSet(unit: { nodes: CfgNode[]; edges: CfgEdge[]; entry: number }): Set<number> {
  const out = new Map<number, number[]>();
  for (const e of unit.edges) {
    if (e.infeasible) continue;
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from)!.push(e.to);
  }
  const seen = new Set<number>([unit.entry]);
  const q = [unit.entry];
  while (q.length) {
    const c = q.pop()!;
    for (const n of out.get(c) ?? []) {
      if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return seen;
}

export function buildCfg(program: Program, table: SymbolTable): CfgReport {
  const fb = new FormulaBuilder(table);
  const unreachableConditions: UnreachableCondition[] = [];
  const units: CfgUnit[] = [];
  const deadRegions: DeadRegion[] = [];
  const deadStmtIds = new Set<number>();

  const buildUnit = (name: string, body: Stmt[]) => {
    const b = new UnitBuilder(name, fb, unreachableConditions);
    b.build(body);
    const reach = reachableSet(b);
    units.push({ name, nodes: b.nodes, edges: b.edges, entry: b.entry, exit: b.exit, reachable: [...reach] });

    for (const n of b.nodes) {
      if (reach.has(n.id) || n.kind === 'entry' || n.kind === 'exit') continue;
      if (n.stmtIds.length === 0) continue;
      for (const id of n.stmtIds) deadStmtIds.add(id);
      if (n.kind !== 'block') continue; // nested blocks report their own dead code
      const incoming = b.edges.filter(e => e.to === n.id);
      const reason =
        incoming.length === 0
          ? 'No control-flow path reaches this code (it follows break/continue or an unreachable construct)'
          : incoming.every(e => e.infeasible)
            ? 'Guarded by a condition that can never hold'
            : 'Reachable only from dead code';
      deadRegions.push({ unit: name, loc: n.loc ?? { line: 0, col: 0 }, stmtIds: n.stmtIds, reason });
    }
  };

  buildUnit('<main>', program.body);
  walkStmts(program.body, s => {
    if (s.kind === 'FuncDef') buildUnit((s as FuncDef).name, (s as FuncDef).body);
  });

  const stats = {
    units: units.length,
    nodes: units.reduce((a, u) => a + u.nodes.length, 0),
    edges: units.reduce((a, u) => a + u.edges.length, 0),
    branches: units.reduce((a, u) => a + u.nodes.filter(n => n.kind === 'branch').length, 0),
    loops: units.reduce((a, u) => a + u.nodes.filter(n => n.kind === 'loop').length, 0),
    deadBlocks: deadRegions.length,
  };

  return { units, deadRegions, unreachableConditions, deadStmtIds, stats };
}
