/**
 * Phase 8 — Regime Detection Engine
 * Detects market regimes (Trending, Ranging, HighVol, LowVol, Breakout)
 * using simple statistical methods, then computes per-regime performance.
 */

import { Candle } from '../../../types';
import { BacktestTrade } from '../backtest/interpreter';

export type RegimeType = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'HIGH_VOL' | 'LOW_VOL' | 'BREAKOUT';

export interface RegimeSegment {
  regime: RegimeType;
  startIdx: number;
  endIdx: number;
  startTime: number;
  endTime: number;
  bars: number;
}

export interface RegimePerformance {
  regime: RegimeType;
  trades: number;
  netPnL: number;
  winRate: number;
  avgPnL: number;
}

export interface RegimeReport {
  segments: RegimeSegment[];
  regimeCounts: Record<string, number>;
  performance: RegimePerformance[];
  dominantRegime: RegimeType;
  worstRegime: RegimeType | null;
  regimeStabilityScore: number; // 0-1: how consistent is performance across regimes
}

function sma(arr: number[], period: number, idx: number): number | null {
  if (idx < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += arr[idx - i];
  return sum / period;
}

function stddev(arr: number[], period: number, idx: number): number | null {
  const mean = sma(arr, period, idx);
  if (mean === null) return null;
  let sumSq = 0;
  for (let i = 0; i < period; i++) sumSq += Math.pow(arr[idx - i] - mean, 2);
  return Math.sqrt(sumSq / period);
}

import { HiddenMarkovModel } from '../../quant/hmm';

export function detectRegimes(candles: Candle[], lookback: number = 20): RegimeSegment[] {
  const closes = candles.map(c => c.close);
  const segments: RegimeSegment[] = [];
  let currentRegime: RegimeType = 'RANGING';
  let segStart = 0;

  for (let i = lookback; i < candles.length; i++) {
    const returns: number[] = [];
    for(let j = i - lookback + 1; j <= i; j++) {
       returns.push((closes[j] - closes[j-1]) / closes[j-1]);
    }
    
    const hmmResult = HiddenMarkovModel.estimateStateProbabilities(returns);
    let regime: RegimeType = 'RANGING';

    if (hmmResult.predictedRegime === 'VOLATILE') {
      regime = 'HIGH_VOL';
    } else if (hmmResult.predictedRegime === 'TREND') {
      const shortSma = sma(closes, 5, i);
      const longSma = sma(closes, lookback, i);
      if (shortSma !== null && longSma !== null && shortSma > longSma) {
        regime = 'TRENDING_UP';
      } else {
        regime = 'TRENDING_DOWN';
      }
    } else {
      regime = 'RANGING';
    }

    // Breakout heuristic
    const vol = stddev(closes, lookback, i);
    const longSma = sma(closes, lookback, i);
    if (vol !== null && longSma !== null) {
      const upperBand = longSma + 2 * vol;
      const lowerBand = longSma - 2 * vol;
      if (closes[i] > upperBand || closes[i] < lowerBand) {
        regime = 'BREAKOUT';
      }
    }

    if (regime !== currentRegime || i === lookback) {
      if (i > lookback) {
        segments.push({
          regime: currentRegime,
          startIdx: segStart,
          endIdx: i - 1,
          startTime: candles[segStart].timestamp,
          endTime: candles[i - 1].timestamp,
          bars: i - segStart
        });
      }
      currentRegime = regime;
      segStart = i;
    }
  }

  // Close final segment
  segments.push({
    regime: currentRegime,
    startIdx: segStart,
    endIdx: candles.length - 1,
    startTime: candles[segStart].timestamp,
    endTime: candles[candles.length - 1].timestamp,
    bars: candles.length - segStart
  });

  return segments;
}

export function analyzeRegimePerformance(
  candles: Candle[],
  trades: BacktestTrade[],
  segments: RegimeSegment[]
): RegimeReport {
  // Map each trade to the regime it occurred in
  const regimePerf: Map<RegimeType, { pnls: number[] }> = new Map();

  for (const trade of trades) {
    const pnl = (trade as any).netPnL ?? trade.grossPnL;
    // Find regime at exit time
    const exitIdx = candles.findIndex(c => c.timestamp >= trade.exitTime);
    if (exitIdx < 0) continue;

    const segment = segments.find(s => exitIdx >= s.startIdx && exitIdx <= s.endIdx);
    const regime = segment?.regime || 'RANGING';

    if (!regimePerf.has(regime)) regimePerf.set(regime, { pnls: [] });
    regimePerf.get(regime)!.pnls.push(pnl);
  }

  const performance: RegimePerformance[] = [];
  for (const [regime, data] of regimePerf) {
    const wins = data.pnls.filter(p => p > 0).length;
    const total = data.pnls.length;
    const netPnL = data.pnls.reduce((a, b) => a + b, 0);
    performance.push({
      regime,
      trades: total,
      netPnL,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      avgPnL: total > 0 ? netPnL / total : 0
    });
  }

  const regimeCounts: Record<string, number> = {};
  for (const s of segments) {
    regimeCounts[s.regime] = (regimeCounts[s.regime] || 0) + s.bars;
  }

  const dominantRegime = Object.entries(regimeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as RegimeType || 'RANGING';

  const worstPerf = performance.length > 0
    ? performance.reduce((w, p) => p.avgPnL < w.avgPnL ? p : w, performance[0])
    : null;

  // Regime stability: how consistent is avg PnL across regimes (lower CV = more stable)
  let regimeStabilityScore = 1;
  if (performance.length > 1) {
    const avgPnLs = performance.map(p => p.avgPnL);
    const mean = avgPnLs.reduce((a, b) => a + b, 0) / avgPnLs.length;
    if (mean !== 0) {
      const variance = avgPnLs.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / avgPnLs.length;
      const cv = Math.sqrt(variance) / Math.abs(mean);
      regimeStabilityScore = Math.max(0, 1 - cv / 3);
    }
  }

  return {
    segments,
    regimeCounts,
    performance,
    dominantRegime,
    worstRegime: worstPerf?.regime || null,
    regimeStabilityScore
  };
}
