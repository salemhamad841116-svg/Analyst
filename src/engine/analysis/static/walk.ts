/**
 * Statement-level traversal helpers shared by the static-analysis passes.
 */

import { Expr, Stmt, walkExpr } from '../pine/ast';

/** Direct statement children (blocks) of a statement. */
export function childBlocks(s: Stmt): Stmt[][] {
  switch (s.kind) {
    case 'If': return s.alternate ? [s.consequent, s.alternate] : [s.consequent];
    case 'For':
    case 'ForIn':
    case 'While': return [s.body];
    case 'FuncDef': return [s.body];
    case 'Switch': return s.cases.map(c => c.body);
    default: return [];
  }
}

/** Expressions that belong directly to a statement (not to nested blocks). */
export function stmtExprs(s: Stmt): Expr[] {
  switch (s.kind) {
    case 'VarDecl': return [s.init];
    case 'ExprStmt': return [s.expr];
    case 'If': return [s.test];
    case 'For': return s.by ? [s.from, s.to, s.by] : [s.from, s.to];
    case 'ForIn': return [s.iterable];
    case 'While': return [s.test];
    case 'Switch': {
      const out: Expr[] = [];
      if (s.subject) out.push(s.subject);
      for (const c of s.cases) if (c.test) out.push(c.test);
      return out;
    }
    case 'FuncDef': return s.params.filter(p => p.default).map(p => p.default as Expr);
    default: return [];
  }
}

/** Visit every statement (pre-order), including statements nested in BlockExpr initialisers. */
export function walkStmts(stmts: Stmt[], fn: (s: Stmt, depth: number) => void, depth = 0): void {
  for (const s of stmts) {
    fn(s, depth);
    for (const e of stmtExprs(s)) {
      walkExpr(e, n => {
        if (n.kind === 'BlockExpr') walkStmts([n.stmt], fn, depth + 1);
      });
    }
    for (const b of childBlocks(s)) walkStmts(b, fn, depth + 1);
  }
}

/** Visit every expression node in a statement list (descending through nested blocks). */
export function walkAllExprs(stmts: Stmt[], fn: (e: Expr) => void): void {
  walkStmts(stmts, s => {
    for (const e of stmtExprs(s)) walkExpr(e, fn);
  });
}
