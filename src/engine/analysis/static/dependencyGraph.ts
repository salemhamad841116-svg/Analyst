/**
 * Dependency graph (Stage 2): which symbol depends on which, with cycle detection.
 */

import { Expr, Program, walkExpr } from '../pine/ast';
import { SymbolTable } from './symbolTable';
import { walkAllExprs } from './walk';

export interface DepEdge {
  from: number;
  to: number;
  kind: 'data' | 'control' | 'call';
  viaHistory: boolean;
  reassign: boolean;
}

export interface DependencyGraph {
  nodes: { id: number; name: string; kind: string }[];
  edges: DepEdge[];
  adj: Map<number, DepEdge[]>;
  /** each cycle is a list of names (variables or functions) */
  cycles: { kind: 'variable' | 'function'; members: string[] }[];
  /** symbols in declaration order (valid evaluation order for a Pine script) */
  topoOrder: string[];
}

export interface RefInfo {
  symbolId: number;
  viaHistory: boolean;
}

/** All user-symbol references inside an expression; `viaHistory` marks `x[n]` accesses. */
export function refsInExpr(table: SymbolTable, expr: Expr): RefInfo[] {
  const out: RefInfo[] = [];
  const visit = (e: Expr, hist: boolean) => {
    if (e.kind === 'Ident') {
      const sid = table.refs.get(e.id);
      if (sid !== undefined) out.push({ symbolId: sid, viaHistory: hist });
      return;
    }
    if (e.kind === 'Index') {
      visit(e.object, true);
      visit(e.index, hist);
      return;
    }
    if (e.kind === 'BlockExpr') {
      walkAllExprs([e.stmt], n => {
        if (n.kind === 'Ident') {
          const sid = table.refs.get(n.id);
          if (sid !== undefined) out.push({ symbolId: sid, viaHistory: hist });
        }
      });
      return;
    }
    switch (e.kind) {
      case 'Member': visit(e.object, hist); break;
      case 'Call': visit(e.callee, hist); e.args.forEach(a => visit(a.value, hist)); break;
      case 'Unary': visit(e.arg, hist); break;
      case 'Binary': visit(e.left, hist); visit(e.right, hist); break;
      case 'Ternary': visit(e.test, hist); visit(e.cons, hist); visit(e.alt, hist); break;
      case 'Tuple': e.elements.forEach(x => visit(x, hist)); break;
      default: break;
    }
  };
  visit(expr, false);
  return out;
}

/** Tarjan strongly-connected components. */
function tarjan(nodes: number[], neighbours: (n: number) => number[]): number[][] {
  let index = 0;
  const idx = new Map<number, number>();
  const low = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const result: number[][] = [];

  const strong = (v: number) => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of neighbours(v)) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: number[] = [];
      let w: number;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      result.push(comp);
    }
  };
  for (const n of nodes) if (!idx.has(n)) strong(n);
  return result;
}

function isScopeInside(table: SymbolTable, scopeId: number, ancestorScopeId: number): boolean {
  let cur: number | null = scopeId;
  while (cur !== null) {
    if (cur === ancestorScopeId) return true;
    cur = table.scopes[cur].parent;
  }
  return false;
}

export function buildDependencyGraph(program: Program, table: SymbolTable): DependencyGraph {
  const edges: DepEdge[] = [];
  const addEdge = (e: DepEdge) => {
    if (e.from === e.to && e.reassign) return; // x := x + 1 reads the previous value, not a cycle
    edges.push(e);
  };

  // Variable / input definitions
  for (const def of table.defs) {
    for (const r of refsInExpr(table, def.expr)) {
      const target = table.symbols[r.symbolId];
      addEdge({
        from: def.symbolId, to: r.symbolId,
        kind: target.kind === 'function' ? 'call' : 'data',
        viaHistory: r.viaHistory, reassign: def.reassign,
      });
    }
    for (const g of def.guards) {
      for (const r of refsInExpr(table, g.expr)) {
        addEdge({ from: def.symbolId, to: r.symbolId, kind: 'control', viaHistory: r.viaHistory, reassign: def.reassign });
      }
    }
  }

  // Function bodies: function -> external symbols it reads
  for (const sym of table.symbols) {
    if (sym.kind !== 'function' || !sym.funcNode) continue;
    const fnScope = table.scopes.find(s => s.kind === 'function' && s.owner === sym.name);
    const seen = new Set<number>();
    walkAllExprs(sym.funcNode.body, e => {
      if (e.kind !== 'Ident') return;
      const sid = table.refs.get(e.id);
      if (sid === undefined || seen.has(sid)) return;
      const target = table.symbols[sid];
      if (fnScope && isScopeInside(table, target.scopeId, fnScope.id)) return;
      seen.add(sid);
      addEdge({
        from: sym.id, to: sid,
        kind: target.kind === 'function' ? 'call' : 'data',
        viaHistory: false, reassign: false,
      });
    });
  }

  const adj = new Map<number, DepEdge[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e);
  }

  // --- Cycle detection ------------------------------------------------------
  const cycles: DependencyGraph['cycles'] = [];

  // Variables: only same-bar data edges that are not reassignments or history reads
  const varNodes = table.symbols.filter(s => s.kind !== 'function').map(s => s.id);
  const varNeighbours = (n: number) =>
    (adj.get(n) ?? [])
      .filter(e => e.kind === 'data' && !e.viaHistory && !e.reassign && table.symbols[e.to].kind !== 'function')
      .map(e => e.to);
  for (const comp of tarjan(varNodes, varNeighbours)) {
    const selfLoop = comp.length === 1 && varNeighbours(comp[0]).includes(comp[0]);
    if (comp.length > 1 || selfLoop) {
      cycles.push({ kind: 'variable', members: comp.map(i => table.symbols[i].name) });
    }
  }

  // Functions: call graph by name (includes recursive and forward references)
  const fnNames = [...new Set([...table.funcNames, ...table.funcCallEdges.keys()])];
  const nameToIdx = new Map(fnNames.map((n, i) => [n, i]));
  const fnNeighbours = (i: number) =>
    [...(table.funcCallEdges.get(fnNames[i]) ?? [])].map(n => nameToIdx.get(n)).filter((x): x is number => x !== undefined);
  for (const comp of tarjan(fnNames.map((_, i) => i), fnNeighbours)) {
    const selfLoop = comp.length === 1 && fnNeighbours(comp[0]).includes(comp[0]);
    if (comp.length > 1 || selfLoop) {
      cycles.push({ kind: 'function', members: comp.map(i => fnNames[i]) });
    }
  }

  return {
    nodes: table.symbols.map(s => ({ id: s.id, name: s.name, kind: s.kind })),
    edges,
    adj,
    cycles,
    topoOrder: table.symbols.filter(s => s.defs.length > 0 || s.kind === 'function').map(s => s.name),
  };
}

/** Every symbol a given symbol transitively depends on (all edge kinds). */
export function transitiveDeps(graph: DependencyGraph, symbolId: number): Set<number> {
  const seen = new Set<number>();
  const queue = [symbolId];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const e of graph.adj.get(cur) ?? []) {
      if (!seen.has(e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return seen;
}

// Re-exported for convenience in other passes
export { walkExpr };
