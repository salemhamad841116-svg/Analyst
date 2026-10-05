/**
 * Data-flow analysis (Stage 4):
 *   Market data -> Indicators -> Conditions -> BUY / SELL / EXIT sinks
 *
 * Sinks are found from the AST call sites (strategy.entry / exit / close, alertcondition,
 * plotshape ...). For every sink we trace the symbols its condition depends on (through the
 * dependency graph, including function bodies) and report the concrete path.
 */

import { Diagnostic, Expr, Loc, dottedName, printExpr, walkExpr } from '../pine/ast';
import { LEGACY_FUNCTIONS, MARKET_SERIES } from '../pine/builtins';
import { DependencyGraph, refsInExpr, transitiveDeps } from './dependencyGraph';
import { CallSite, GuardTerm, ScriptKind, SymbolTable } from './symbolTable';
import { walkAllExprs } from './walk';

export type Direction = 'BUY' | 'SELL' | 'EXIT' | 'UNKNOWN';
export type SinkRole = 'ENTRY' | 'EXIT' | 'SIGNAL';

export interface Sink {
  id: number;
  callee: string;
  role: SinkRole;
  direction: Direction;
  directionSource: string;
  loc: Loc;
  stmtId: number;
  funcName: string | null;
  guards: GuardTerm[];
  conditionExprs: Expr[];
  text: string;
  hasBracketExit?: boolean;
}

export interface IndicatorUse {
  name: string;
  args: string;
  via: string;
}

export interface FlowPath {
  sinkId: number;
  direction: Direction;
  callee: string;
  loc: Loc;
  conditionText: string;
  marketSources: string[];
  indicators: IndicatorUse[];
  conditionSymbols: string[];
  inputs: string[];
  chain: string[];
  pathText: string;
  reachesMarketData: boolean;
}

export interface DataFlowReport {
  sinks: Sink[];
  paths: FlowPath[];
  signalMode: 'EXPLICIT' | 'NONE';
  entrySinkCount: number;
  exitSinkCount: number;
  buyCount: number;
  sellCount: number;
  diagnostics: Diagnostic[];
}

const trunc = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const BUY_HINT = /buy|long|bull|triangleup|belowbar|arrowup|labelup|\bup\b/i;
const SELL_HINT = /sell|short|bear|triangledown|abovebar|arrowdown|labeldown|\bdown\b/i;
const EXIT_HINT = /exit|flat|\bclose\b|cover/i;

function argOf(call: CallSite, name: string, position: number): Expr | undefined {
  const named = call.node.args.find(a => a.name === name);
  if (named) return named.value;
  const positional = call.node.args.filter(a => !a.name);
  return positional[position]?.value;
}

function looksBoolean(e: Expr): boolean {
  switch (e.kind) {
    case 'Bool': return true;
    case 'Unary': return e.op === 'not';
    case 'Binary': return ['and', 'or', '==', '!=', '<', '>', '<=', '>='].includes(e.op);
    case 'Call': {
      const n = dottedName(e.callee);
      return !!n && /(^|\.)(crossover|crossunder|cross|rising|falling)$/.test(n);
    }
    default: return false;
  }
}

export function analyzeDataFlow(
  table: SymbolTable,
  graph: DependencyGraph,
  scriptKind: ScriptKind,
): DataFlowReport {
  const diagnostics: Diagnostic[] = [];
  const sinks: Sink[] = [];

  const resolveDirectionExpr = (e: Expr | undefined): { dir: Direction; src: string } => {
    if (!e) return { dir: 'UNKNOWN', src: 'direction argument missing' };
    let text = printExpr(e);
    if (e.kind === 'Ident') {
      const sid = table.refs.get(e.id);
      if (sid !== undefined && table.symbols[sid].defs.length === 1) text = printExpr(table.symbols[sid].defs[0].expr);
    }
    if (text === 'strategy.long') return { dir: 'BUY', src: 'strategy.long' };
    if (text === 'strategy.short') return { dir: 'SELL', src: 'strategy.short' };
    return { dir: 'UNKNOWN', src: `dynamic direction (${trunc(text, 40)})` };
  };

  const hintDirection = (call: CallSite): { dir: Direction; src: string } => {
    const parts: string[] = [];
    for (const a of call.node.args) {
      if (a.name && ['title', 'style', 'location', 'text', 'message'].includes(a.name)) parts.push(printExpr(a.value));
    }
    const titlePos = call.name === 'alertcondition' ? call.node.args.filter(x => !x.name)[1]?.value : undefined;
    if (titlePos) parts.push(printExpr(titlePos));
    const condExpr = argOf(call, call.name === 'alertcondition' ? 'condition' : 'series', 0);
    if (condExpr) {
      if (condExpr.kind === 'Ident') parts.push(condExpr.name);
      if (condExpr.kind === 'Member') parts.push(condExpr.prop);
    }
    const hay = parts.join(' ');
    const b = BUY_HINT.test(hay);
    const s = SELL_HINT.test(hay);
    const x = EXIT_HINT.test(hay);
    if (b && !s && !x) return { dir: 'BUY', src: `name/style hint (${trunc(hay, 50)})` };
    if (s && !b && !x) return { dir: 'SELL', src: `name/style hint (${trunc(hay, 50)})` };
    if (x && !b && !s) return { dir: 'EXIT', src: `name/style hint (${trunc(hay, 50)})` };
    return { dir: 'UNKNOWN', src: 'no direction hint' };
  };

  for (const c of table.calls) {
    if (!c.name) continue;
    const mk = (role: SinkRole, direction: Direction, directionSource: string, cond: (Expr | undefined)[], extra: Partial<Sink> = {}) => {
      sinks.push({
        id: sinks.length + 1, callee: c.name!, role, direction, directionSource, loc: c.loc, stmtId: c.stmtId,
        funcName: c.funcName, guards: c.guards,
        conditionExprs: cond.filter((x): x is Expr => !!x),
        text: trunc(printExpr(c.node)), ...extra,
      });
    };

    switch (c.name) {
      case 'strategy.entry':
      case 'strategy.order': {
        const r = resolveDirectionExpr(argOf(c, 'direction', 1));
        mk('ENTRY', r.dir, r.src, [argOf(c, 'when', 99)]);
        break;
      }
      case 'strategy.exit': {
        const bracket = c.node.args.some(a => a.name && /^(profit|loss|stop|limit|trail_.*)$/.test(a.name));
        mk('EXIT', 'EXIT', 'strategy.exit', [argOf(c, 'when', 99)], { hasBracketExit: bracket });
        break;
      }
      case 'strategy.close':
      case 'strategy.close_all':
        mk('EXIT', 'EXIT', c.name, [argOf(c, 'when', 99)]);
        break;
      case 'alertcondition': {
        const r = hintDirection(c);
        mk('SIGNAL', r.dir, r.src, [argOf(c, 'condition', 0)]);
        break;
      }
      case 'plotshape':
      case 'plotchar':
      case 'plotarrow': {
        const r = hintDirection(c);
        mk('SIGNAL', r.dir, r.src, [argOf(c, 'series', 0)]);
        break;
      }
      case 'alert': {
        const r = hintDirection(c);
        mk('SIGNAL', r.dir, r.src, []);
        break;
      }
      default: break;
    }
  }

  // ---- paths ---------------------------------------------------------------
  const paths: FlowPath[] = [];

  const collectFromExpr = (
    e: Expr,
    via: string,
    market: Set<string>,
    inds: IndicatorUse[],
  ) => {
    walkExpr(e, n => {
      if (n.kind === 'Ident' && !table.refs.has(n.id) && MARKET_SERIES.has(n.name)) market.add(n.name);
      if (n.kind === 'Call') {
        const name = dottedName(n.callee);
        if (name && (name.startsWith('ta.') || LEGACY_FUNCTIONS.has(name) || name === 'request.security')) {
          const sig = `${name}(${n.args.map(a => printExpr(a.value)).join(', ')})`;
          if (!inds.some(i => i.name === name && i.args === sig && i.via === via)) {
            inds.push({ name, args: trunc(sig, 70), via });
          }
        }
      }
    });
  };

  for (const sink of sinks) {
    const market = new Set<string>();
    const indicators: IndicatorUse[] = [];
    const rootSyms = new Set<number>();

    const exprs: Expr[] = [...sink.conditionExprs, ...sink.guards.map(g => g.expr)];
    for (const e of exprs) {
      for (const r of refsInExpr(table, e)) rootSyms.add(r.symbolId);
      collectFromExpr(e, '(condition)', market, indicators);
    }

    const all = new Set<number>(rootSyms);
    for (const r of rootSyms) for (const d of transitiveDeps(graph, r)) all.add(d);

    const conditionSymbols: string[] = [];
    const inputs: string[] = [];
    const chain: string[] = [];

    const ordered = [...all].sort((a, b) => a - b);
    for (const sid of ordered) {
      const s = table.symbols[sid];
      if (s.kind === 'input') {
        inputs.push(s.name);
        continue;
      }
      if (s.kind === 'function' && s.funcNode) {
        walkAllExprs(s.funcNode.body, e => collectFromExpr(e, `${s.name}()`, market, indicators));
        chain.push(`${s.name}() [function]`);
        continue;
      }
      if (s.kind === 'param' || s.kind === 'loopVar') continue;
      for (const d of s.defs) {
        collectFromExpr(d.expr, s.name, market, indicators);
      }
      if (s.defs.length > 0) {
        const d0 = s.defs[0];
        chain.push(`${s.name} ${d0.reassign ? ':=' : '='} ${trunc(printExpr(d0.expr), 80)}`);
        if (looksBoolean(d0.expr)) conditionSymbols.push(s.name);
      }
    }

    const marketList = [...market].sort();
    const condText = sink.conditionExprs.length
      ? sink.conditionExprs.map(e => trunc(printExpr(e))).join(' and ')
      : sink.guards.length
        ? sink.guards.map(g => `${g.negated ? 'not ' : ''}${trunc(printExpr(g.expr), 60)}`).join(' and ')
        : '(unconditional)';

    const indNames = [...new Set(indicators.map(i => i.name))];
    const dir = sink.direction === 'UNKNOWN' ? 'SIGNAL' : sink.direction;
    const pathText = [
      `Market[${marketList.join(',') || '—'}]`,
      indNames.length ? indNames.join(', ') : '(no indicators)',
      conditionSymbols.length ? conditionSymbols.join(', ') : '(inline condition)',
      `${sink.callee} → ${dir}`,
    ].join(' → ');

    paths.push({
      sinkId: sink.id,
      direction: sink.direction,
      callee: sink.callee,
      loc: sink.loc,
      conditionText: condText,
      marketSources: marketList,
      indicators,
      conditionSymbols,
      inputs: [...new Set(inputs)],
      chain: [...chain, `${sink.text}`],
      pathText,
      reachesMarketData: marketList.length > 0 || indicators.length > 0,
    });

    if ((sink.role === 'ENTRY') && !(marketList.length > 0 || indicators.length > 0)) {
      diagnostics.push({
        severity: 'warning', code: 'SIGNAL_NOT_DERIVED_FROM_MARKET_DATA', stage: 'DATA_FLOW', loc: sink.loc,
        message: `${sink.callee}() condition does not depend on any market-data series or indicator`,
      });
    }
  }

  const entries = sinks.filter(s => s.role === 'ENTRY');
  const exits = sinks.filter(s => s.role === 'EXIT');
  const buyCount = sinks.filter(s => s.direction === 'BUY').length;
  const sellCount = sinks.filter(s => s.direction === 'SELL').length;

  if (scriptKind === 'strategy' && entries.length === 0) {
    diagnostics.push({
      severity: 'error', code: 'NO_ENTRY_ORDERS', stage: 'DATA_FLOW',
      message: 'strategy() script never calls strategy.entry()/strategy.order() — it can never open a position',
    });
  }
  for (const s of entries) {
    if (s.direction === 'UNKNOWN') {
      diagnostics.push({
        severity: 'warning', code: 'DIRECTION_UNRESOLVED', stage: 'DATA_FLOW', loc: s.loc,
        message: `Direction of ${s.callee}() could not be resolved statically (${s.directionSource})`,
      });
    }
  }

  return {
    sinks,
    paths,
    signalMode: sinks.some(s => (s.role === 'ENTRY' || s.role === 'SIGNAL') && (s.direction === 'BUY' || s.direction === 'SELL'))
      ? 'EXPLICIT'
      : 'NONE',
    entrySinkCount: entries.length,
    exitSinkCount: exits.length,
    buyCount,
    sellCount,
    diagnostics,
  };
}
