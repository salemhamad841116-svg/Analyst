/**
 * Walk-Forward Optimization Engine (Phase 7)
 * 
 * Splits historical data into Train/OOS windows, optimizes parameters
 * ONLY on the Train window, then validates on OOS. Ensures no data leakage.
 * 
 * Uses a simple grid search + ranking approach (not GP/TPE, since we have
 * no external dependencies). The interface is designed so a Bayesian optimizer
 * can be swapped in later via `OptimizerAdapter`.
 */

import { Program, Stmt, Expr, walkExpr, dottedName } from '../pine/ast';
import { Candle } from '../../../types';
import { PineInterpreter, BacktestTrade } from '../backtest/interpreter';
import { applyCostsToTrade, CostProfile, DEFAULT_PROFILES } from '../backtest/costs';
import { calculatePerformanceMetrics } from './performance';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalkForwardConfig {
  trainRatio: number;       // e.g., 0.7 = 70% train, 30% OOS
  numFolds: number;         // Walk-forward folds (anchored or rolling)
  objectiveMetric: 'sharpeRatio' | 'profitFactor' | 'expectancy' | 'totalNetPnL';
  costProfile: CostProfile;
}

export interface ParameterSpec {
  name: string;
  type: 'int' | 'float' | 'bool';
  defaultValue: number | boolean;
  /** For grid search: min, max, step */
  min?: number;
  max?: number;
  step?: number;
}

export interface WalkForwardFoldResult {
  foldIndex: number;
  trainBars: number;
  oosBars: number;
  bestParams: Record<string, number | boolean>;
  trainMetric: number;
  oosMetric: number;
  oosTrades: number;
  degradation: number; // (train - oos) / train — how much performance dropped
}

export interface WalkForwardResult {
  folds: WalkForwardFoldResult[];
  averageOosMetric: number;
  averageTrainMetric: number;
  averageDegradation: number;
  worstOosFold: number;
  bestParamsOverall: Record<string, number | boolean>;
  dataLeakageDetected: boolean;
  objectiveMetric: string;
  status: 'PASS' | 'FAIL';
  reason: string;
}

// ─── Parameter Extraction from AST ──────────────────────────────────────────

export function extractParameters(program: Program): ParameterSpec[] {
  const params: ParameterSpec[] = [];

  const checkStmt = (stmt: Stmt) => {
    if (stmt.kind === 'VarDecl') {
      walkExpr(stmt.init, (expr: Expr) => {
        if (expr.kind === 'Call') {
          const name = dottedName(expr.callee);
          if (name === 'input.int') {
            const defaultVal = expr.args[0]?.value;
            const numVal = defaultVal?.kind === 'Num' ? defaultVal.value : 10;
            params.push({
              name: stmt.names[0],
              type: 'int',
              defaultValue: numVal,
              min: Math.max(2, Math.floor(numVal * 0.5)),
              max: Math.ceil(numVal * 2),
              step: Math.max(1, Math.floor(numVal * 0.25))
            });
          } else if (name === 'input.float') {
            const defaultVal = expr.args[0]?.value;
            const numVal = defaultVal?.kind === 'Num' ? defaultVal.value : 1.0;
            params.push({
              name: stmt.names[0],
              type: 'float',
              defaultValue: numVal,
              min: numVal * 0.5,
              max: numVal * 2,
              step: numVal * 0.25
            });
          } else if (name === 'input.bool') {
            params.push({
              name: stmt.names[0],
              type: 'bool',
              defaultValue: true
            });
          }
        }
      });
    }
    if (stmt.kind === 'If') {
      stmt.consequent.forEach(checkStmt);
      if (stmt.alternate) stmt.alternate.forEach(checkStmt);
    }
  };

  program.body.forEach(checkStmt);
  return params;
}

// ─── Grid Search (Train-only) ───────────────────────────────────────────────

function generateGrid(params: ParameterSpec[]): Record<string, number | boolean>[] {
  if (params.length === 0) return [{}];

  // For each param, generate candidate values
  const candidatesByParam: { name: string; values: (number | boolean)[] }[] = [];

  for (const p of params) {
    if (p.type === 'bool') {
      candidatesByParam.push({ name: p.name, values: [true, false] });
    } else {
      const min = p.min ?? (typeof p.defaultValue === 'number' ? p.defaultValue * 0.5 : 2);
      const max = p.max ?? (typeof p.defaultValue === 'number' ? p.defaultValue * 2 : 20);
      const step = p.step ?? (typeof p.defaultValue === 'number' ? Math.max(1, p.defaultValue * 0.25) : 1);
      const values: number[] = [];
      for (let v = min; v <= max; v += step) {
        values.push(p.type === 'int' ? Math.round(v) : v);
      }
      if (values.length === 0) values.push(typeof p.defaultValue === 'number' ? p.defaultValue : 10);
      candidatesByParam.push({ name: p.name, values });
    }
  }

  // Cartesian product (capped at 500 combos to prevent explosion)
  let combos: Record<string, number | boolean>[] = [{}];
  for (const cp of candidatesByParam) {
    const newCombos: Record<string, number | boolean>[] = [];
    for (const existing of combos) {
      for (const val of cp.values) {
        newCombos.push({ ...existing, [cp.name]: val });
        if (newCombos.length >= 500) break;
      }
      if (newCombos.length >= 500) break;
    }
    combos = newCombos;
    if (combos.length >= 500) break;
  }

  return combos;
}

function runWithParams(
  program: Program,
  candles: Candle[],
  paramOverrides: Record<string, number | boolean>,
  costProfile: CostProfile
): { metric: (m: string) => number; trades: BacktestTrade[]; netTrades: any[] } {
  const interp = new PineInterpreter(program, candles);

  // Inject parameter overrides into the interpreter's initial variable state
  for (const [k, v] of Object.entries(paramOverrides)) {
    (interp as any).vars.set(k, v);
    (interp as any).varInitialized.add(k);
  }

  interp.run();

  const netTrades = interp.trades.map(t => applyCostsToTrade(t, costProfile));
  const perf = calculatePerformanceMetrics(netTrades as any);

  return {
    metric: (m: string) => (perf as any)[m] ?? 0,
    trades: interp.trades,
    netTrades
  };
}

// ─── Walk-Forward Engine ────────────────────────────────────────────────────

export function runWalkForwardOptimization(
  program: Program,
  candles: Candle[],
  config: Partial<WalkForwardConfig> = {}
): WalkForwardResult {
  const trainRatio = config.trainRatio || 0.7;
  const numFolds = config.numFolds || 3;
  const objectiveMetric = config.objectiveMetric || 'sharpeRatio';
  const costProfile = config.costProfile || DEFAULT_PROFILES['DEFAULT'];

  const params = extractParameters(program);
  const grid = generateGrid(params);

  const totalBars = candles.length;
  const foldSize = Math.floor(totalBars / numFolds);

  if (foldSize < 20) {
    return {
      folds: [],
      averageOosMetric: 0,
      averageTrainMetric: 0,
      averageDegradation: 0,
      worstOosFold: 0,
      bestParamsOverall: {},
      dataLeakageDetected: false,
      objectiveMetric,
      status: 'FAIL',
      reason: `Insufficient data: ${totalBars} bars for ${numFolds} folds = ${foldSize} bars/fold (need ≥20)`
    };
  }

  const folds: WalkForwardFoldResult[] = [];

  for (let f = 0; f < numFolds; f++) {
    const foldStart = f * foldSize;
    const foldEnd = Math.min(foldStart + foldSize, totalBars);
    const trainEnd = foldStart + Math.floor((foldEnd - foldStart) * trainRatio);

    const trainCandles = candles.slice(foldStart, trainEnd);
    const oosCandles = candles.slice(trainEnd, foldEnd);

    if (trainCandles.length < 10 || oosCandles.length < 5) continue;

    // ── Optimize on TRAIN only ──
    let bestTrainMetric = -Infinity;
    let bestParams: Record<string, number | boolean> = {};

    for (const combo of grid) {
      const result = runWithParams(program, trainCandles, combo, costProfile);
      const metricVal = result.metric(objectiveMetric);
      if (metricVal > bestTrainMetric) {
        bestTrainMetric = metricVal;
        bestParams = combo;
      }
    }

    // ── Validate on OOS with winning params ──
    const oosResult = runWithParams(program, oosCandles, bestParams, costProfile);
    const oosMetric = oosResult.metric(objectiveMetric);

    const degradation = bestTrainMetric !== 0
      ? (bestTrainMetric - oosMetric) / Math.abs(bestTrainMetric)
      : 0;

    folds.push({
      foldIndex: f,
      trainBars: trainCandles.length,
      oosBars: oosCandles.length,
      bestParams,
      trainMetric: bestTrainMetric,
      oosMetric,
      oosTrades: oosResult.trades.length,
      degradation
    });
  }

  if (folds.length === 0) {
    return {
      folds: [],
      averageOosMetric: 0,
      averageTrainMetric: 0,
      averageDegradation: 0,
      worstOosFold: 0,
      bestParamsOverall: {},
      dataLeakageDetected: false,
      objectiveMetric,
      status: 'FAIL',
      reason: 'No valid folds could be computed'
    };
  }

  const averageTrainMetric = folds.reduce((s, f) => s + f.trainMetric, 0) / folds.length;
  const averageOosMetric = folds.reduce((s, f) => s + f.oosMetric, 0) / folds.length;
  const averageDegradation = folds.reduce((s, f) => s + f.degradation, 0) / folds.length;
  const worstOosFold = folds.reduce((min, f) => f.oosMetric < min ? f.oosMetric : min, Infinity);

  // Choose the params that performed best across all folds
  const bestFold = folds.reduce((best, f) => f.oosMetric > best.oosMetric ? f : best, folds[0]);

  // Data leakage check: if OOS is consistently BETTER than Train, something is wrong
  const dataLeakageDetected = folds.every(f => f.oosMetric > f.trainMetric * 1.5);

  let status: 'PASS' | 'FAIL' = 'PASS';
  let reason = '';

  if (dataLeakageDetected) {
    status = 'FAIL';
    reason = 'BLOCKED_DATA_LEAKAGE: OOS consistently outperforms Train across all folds, indicating possible look-ahead bias';
  } else if (averageDegradation > 0.8) {
    status = 'FAIL';
    reason = `BLOCKED_SEVERE_DEGRADATION: Avg degradation ${(averageDegradation * 100).toFixed(1)}% (Train→OOS). Strategy likely overfitted.`;
  } else {
    reason = `Walk-Forward OK: ${folds.length} folds, Avg Train ${objectiveMetric}=${averageTrainMetric.toFixed(2)}, Avg OOS=${averageOosMetric.toFixed(2)}, Degradation=${(averageDegradation * 100).toFixed(1)}%`;
  }

  return {
    folds,
    averageOosMetric,
    averageTrainMetric,
    averageDegradation,
    worstOosFold,
    bestParamsOverall: bestFold.bestParams,
    dataLeakageDetected,
    objectiveMetric,
    status,
    reason
  };
}
