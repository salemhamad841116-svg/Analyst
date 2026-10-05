/**
 * Automatic strategy classification (Stage 7).
 *
 * Rule-based, AST-driven: evidence is collected from real calls, comparisons and
 * declared identifiers (never from raw text search). Each evidence item carries a
 * weight, a reason and a source location, so the classification is fully explainable.
 * The weights are classification rules — they are NOT performance metrics.
 */

import { Expr, Loc, dottedName, printExpr, walkExpr } from '../pine/ast';
import { SymbolTable } from './symbolTable';
import { walkAllExprs } from './walk';
import { Program } from '../pine/ast';

export type StrategyClass =
  | 'Trend Following' | 'Momentum' | 'Mean Reversion' | 'Breakout'
  | 'Scalping' | 'Pivot/Level Based' | 'Volatility' | 'Hybrid' | 'Unclassified';

type BaseClass = Exclude<StrategyClass, 'Hybrid' | 'Unclassified'>;

export interface ClassEvidence {
  category: BaseClass;
  weight: number;
  reason: string;
  loc?: Loc;
  snippet?: string;
}

export interface ClassificationResult {
  primary: StrategyClass;
  hybridOf: BaseClass[];
  scores: { category: BaseClass; score: number; share: number }[];
  evidence: ClassEvidence[];
  rationale: string;
}

const MIN_SCORE = 3;
const HYBRID_RATIO = 0.6;
const trunc = (s: string, n = 80) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const MA_FUNCS = ['ema', 'sma', 'wma', 'hma', 'vwma', 'rma', 'swma'];
const FIB = [0.236, 0.382, 0.5, 0.618, 0.786, 0.1905, 0.3886, 0.6476, 0.8133];

function strip(name: string): string {
  return name.startsWith('ta.') ? name.slice(3) : name;
}

export function classifyStrategy(program: Program, table: SymbolTable): ClassificationResult {
  const evidence: ClassEvidence[] = [];
  const add = (category: BaseClass, weight: number, reason: string, loc?: Loc, snippet?: string) =>
    evidence.push({ category, weight, reason, loc, snippet: snippet ? trunc(snippet) : undefined });

  // Which symbols hold which indicator calls (so comparisons on variables can be interpreted)
  const indicatorOfSymbol = new Map<number, string>();
  for (const d of table.defs) {
    if (d.reassign || d.expr.kind !== 'Call') continue;
    const n = dottedName(d.expr.callee);
    if (n) indicatorOfSymbol.set(d.symbolId, strip(n));
  }
  const indicatorOf = (e: Expr): string | null => {
    if (e.kind === 'Ident') {
      const sid = table.refs.get(e.id);
      return sid !== undefined ? indicatorOfSymbol.get(sid) ?? null : null;
    }
    if (e.kind === 'Call') {
      const n = dottedName(e.callee);
      return n ? strip(n) : null;
    }
    return null;
  };

  const seenCalls = new Set<string>();
  const maCrossovers: Loc[] = [];

  for (const c of table.calls) {
    if (!c.name) continue;
    const n = strip(c.name);
    const key = `${n}`;
    const first = !seenCalls.has(key);
    seenCalls.add(key);

    if (['crossover', 'crossunder', 'cross'].includes(n) && c.node.args.length >= 2) {
      const a = indicatorOf(c.node.args[0].value);
      const b = indicatorOf(c.node.args[1].value);
      if (a && b && MA_FUNCS.includes(a) && MA_FUNCS.includes(b)) {
        add('Trend Following', 3, `Moving-average crossover (${a} × ${b})`, c.loc, printExpr(c.node));
        maCrossovers.push(c.loc);
      }
      continue;
    }
    if (!first) continue;
    if (MA_FUNCS.includes(n) && c.name.startsWith('ta.')) add('Trend Following', 1, `Uses moving average ta.${n}()`, c.loc);
    switch (n) {
      case 'macd': add('Trend Following', 2, 'Uses MACD (trend/momentum hybrid indicator)', c.loc); add('Momentum', 1.5, 'MACD histogram measures momentum', c.loc); break;
      case 'supertrend': add('Trend Following', 3, 'Uses Supertrend', c.loc); break;
      case 'adx': case 'dmi': add('Trend Following', 2, 'Uses ADX/DMI trend-strength', c.loc); break;
      case 'sar': add('Trend Following', 2, 'Uses Parabolic SAR', c.loc); break;
      case 'rsi': add('Momentum', 1.5, 'Uses RSI oscillator', c.loc); break;
      case 'mom': case 'roc': case 'tsi': case 'cmo': add('Momentum', 2.5, `Uses momentum indicator ta.${n}()`, c.loc); break;
      case 'stoch': case 'cci': add('Momentum', 1.5, `Uses oscillator ta.${n}()`, c.loc); break;
      case 'bb': case 'bbw': add('Mean Reversion', 1.5, 'Uses Bollinger Bands', c.loc); if (n === 'bbw') add('Volatility', 2, 'Uses Bollinger bandwidth', c.loc); break;
      case 'stdev': add('Mean Reversion', 1, 'Uses standard deviation (z-score/band building block)', c.loc); add('Volatility', 1, 'Uses standard deviation', c.loc); break;
      case 'highest': case 'lowest': add('Breakout', 1.5, `Uses ta.${n}() (range extremes)`, c.loc); break;
      case 'pivothigh': case 'pivotlow': add('Pivot/Level Based', 2.5, `Uses ta.${n}()`, c.loc); add('Breakout', 1, `Pivot structure (${n})`, c.loc); break;
      case 'atr': add('Volatility', 1, 'Uses ATR', c.loc); break;
      case 'tr': case 'kc': case 'kcw': add('Volatility', 1.5, `Uses ta.${n}()`, c.loc); break;
      case 'vwap': add('Mean Reversion', 1, 'Uses VWAP (mean-anchored level)', c.loc); break;
      case 'security': add('Trend Following', 0.5, 'Multi-timeframe confirmation via request.security()', c.loc); break;
      default: break;
    }
    if (c.name === 'request.security') add('Trend Following', 0.5, 'Multi-timeframe confirmation via request.security()', c.loc);
    if (c.name === 'time' || c.name === 'session.ismarket' || c.name.startsWith('session.')) {
      add('Scalping', 1.5, 'Session/time-of-day filter', c.loc);
    }
    if (c.name === 'strategy.exit') {
      const tight = c.node.args.filter(a => a.name && /^(profit|loss|stop|limit)$/.test(a.name));
      for (const t of tight) {
        if (t.value.kind === 'Num' && t.value.value <= 20) add('Scalping', 2, `Very tight ${t.name} exit (${t.value.value} ticks)`, c.loc);
      }
    }
  }

  // Comparisons / thresholds
  walkAllExprs(program.body, e => {
    if (e.kind !== 'Binary' || !['>', '<', '>=', '<='].includes(e.op)) return;
    const li = indicatorOf(e.left);
    const ri = indicatorOf(e.right);
    const lc = e.left.kind === 'Num' ? e.left.value : null;
    const rc = e.right.kind === 'Num' ? e.right.value : null;
    const text = printExpr(e);

    // RSI vs extreme thresholds => mean reversion;  RSI vs mid-line / trend side => momentum
    const rsiSide = li === 'rsi' ? rc : ri === 'rsi' ? lc : null;
    if (rsiSide !== null) {
      if (rsiSide >= 65 || rsiSide <= 35) add('Mean Reversion', 3, `RSI compared to extreme threshold ${rsiSide}`, e.loc, text);
      else if (rsiSide >= 45 && rsiSide <= 55) add('Momentum', 2, `RSI compared to mid-line ${rsiSide}`, e.loc, text);
    }

    // Breakout: price vs highest/lowest
    const brk = [li, ri].find(x => x === 'highest' || x === 'lowest');
    const priceSide = [e.left, e.right].some(x => x.kind === 'Ident' && ['close', 'high', 'low'].includes(x.name));
    if (brk && priceSide) add('Breakout', 3, `Price compared to ta.${brk}() range extreme`, e.loc, text);

    // Price vs moving average => trend filter
    const ma = [li, ri].find(x => x && MA_FUNCS.includes(x));
    if (ma && priceSide) add('Trend Following', 1.5, `Price compared to moving average (${ma})`, e.loc, text);

    // Price vs bollinger / vwap => mean reversion
    const rev = [li, ri].find(x => x === 'bb' || x === 'vwap');
    if (rev && priceSide) add('Mean Reversion', 2, `Price compared to ${rev}`, e.loc, text);

    // ATR vs its own average => volatility regime
    if ((li === 'atr' && ri && MA_FUNCS.includes(ri)) || (ri === 'atr' && li && MA_FUNCS.includes(li))) {
      add('Volatility', 3, 'ATR compared to its moving average (volatility regime filter)', e.loc, text);
    }
  });

  // Pivot / level identifiers and Fibonacci constants
  const levelNames = table.symbols.filter(s => /^(pivot|r[1-6]|s[1-6]|support|resistance|highEdge|lowEdge|level\w*)$/i.test(s.name));
  if (levelNames.length >= 3) {
    add('Pivot/Level Based', Math.min(6, levelNames.length), `Declares support/resistance level variables (${levelNames.slice(0, 6).map(s => s.name).join(', ')})`, levelNames[0].declLoc);
  }
  const fibHits = new Set<number>();
  walkAllExprs(program.body, e => {
    if (e.kind === 'Num' && FIB.some(f => Math.abs(f - e.value) < 1e-9)) fibHits.add(e.value);
  });
  if (fibHits.size >= 2) add('Pivot/Level Based', 2, `Uses Fibonacci-style ratios (${[...fibHits].join(', ')})`);
  if (table.funcNames.has('calculateState')) add('Pivot/Level Based', 1, 'Defines calculateState() level/zone function');

  // Aggregate
  const cats: BaseClass[] = ['Trend Following', 'Momentum', 'Mean Reversion', 'Breakout', 'Scalping', 'Pivot/Level Based', 'Volatility'];
  const totals = cats.map(category => ({
    category,
    score: Number(evidence.filter(e => e.category === category).reduce((a, e) => a + e.weight, 0).toFixed(2)),
  }));
  const sum = totals.reduce((a, t) => a + t.score, 0);
  const scores = totals
    .map(t => ({ ...t, share: sum > 0 ? Number((t.score / sum).toFixed(3)) : 0 }))
    .sort((a, b) => b.score - a.score);

  const top = scores[0];
  let primary: StrategyClass = 'Unclassified';
  let hybridOf: BaseClass[] = [];
  let rationale = 'No indicator or condition pattern reached the minimum evidence threshold.';

  if (top && top.score >= MIN_SCORE) {
    const strong = scores.filter(s => s.score >= MIN_SCORE && s.score >= top.score * HYBRID_RATIO);
    if (strong.length >= 2) {
      primary = 'Hybrid';
      hybridOf = strong.map(s => s.category);
      rationale = `Multiple strategy styles have comparable evidence: ${strong.map(s => `${s.category} (${s.score})`).join(', ')}.`;
    } else {
      primary = top.category;
      rationale = `${top.category} has the strongest evidence (score ${top.score}, ${(top.share * 100).toFixed(0)}% of total evidence).`;
    }
  }

  return { primary, hybridOf, scores, evidence, rationale };
}

void walkExpr;
