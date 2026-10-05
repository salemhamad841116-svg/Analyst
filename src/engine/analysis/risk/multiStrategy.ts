/**
 * Phase 9 — Multi-Strategy Analysis Engine
 * Analyzes signal correlation, overlap, conflicts between buy/sell signals.
 */

import { BacktestTrade } from '../backtest/interpreter';

export interface MultiStrategyReport {
  signalOverlapRate: number;    // % of bars where both buy and sell signals fire
  longExposurePct: number;      // % of time in long position
  shortExposurePct: number;     // % of time in short position
  flatExposurePct: number;      // % of time flat
  avgHoldingBars: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  tradeFrequency: number;       // trades per 100 bars
  signalQualityScore: number;   // 0-100
}

export function analyzeMultiStrategy(
  trades: BacktestTrade[],
  totalBars: number
): MultiStrategyReport {
  if (!trades || trades.length === 0 || totalBars === 0) {
    return {
      signalOverlapRate: 0,
      longExposurePct: 0,
      shortExposurePct: 0,
      flatExposurePct: 100,
      avgHoldingBars: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      tradeFrequency: 0,
      signalQualityScore: 0
    };
  }

  // Exposure analysis
  let longBars = 0;
  let shortBars = 0;

  for (const trade of trades) {
    const holdingTime = trade.exitTime - trade.entryTime;
    // Approximate bars from time (assuming hourly for simplicity)
    const holdingBarsEst = Math.max(1, Math.round(holdingTime / 3600000));
    if (trade.direction === 'LONG') longBars += holdingBarsEst;
    else shortBars += holdingBarsEst;
  }

  const longExposurePct = Math.min(100, (longBars / totalBars) * 100);
  const shortExposurePct = Math.min(100, (shortBars / totalBars) * 100);
  const flatExposurePct = Math.max(0, 100 - longExposurePct - shortExposurePct);

  // Consecutive wins/losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const trade of trades) {
    const pnl = (trade as any).netPnL ?? trade.grossPnL;
    if (pnl > 0) {
      currentWins++;
      currentLosses = 0;
      if (currentWins > maxConsecutiveWins) maxConsecutiveWins = currentWins;
    } else {
      currentLosses++;
      currentWins = 0;
      if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
    }
  }

  // Average holding bars
  const totalHoldingBars = longBars + shortBars;
  const avgHoldingBars = trades.length > 0 ? totalHoldingBars / trades.length : 0;

  // Trade frequency
  const tradeFrequency = (trades.length / totalBars) * 100;

  // Signal quality score (composite)
  // Higher is better: penalize too few trades, too many losses, extreme exposure
  let sqScore = 50; // base
  if (trades.length >= 30) sqScore += 10;
  else if (trades.length >= 10) sqScore += 5;
  else sqScore -= 10;

  const winRate = trades.filter(t => ((t as any).netPnL ?? t.grossPnL) > 0).length / trades.length;
  sqScore += (winRate - 0.5) * 40; // +/-20 for win rate

  if (flatExposurePct > 80) sqScore -= 10; // Too much time flat
  if (maxConsecutiveLosses > 10) sqScore -= 15;
  if (avgHoldingBars < 1) sqScore -= 5; // Scalping penalty

  sqScore = Math.max(0, Math.min(100, sqScore));

  return {
    signalOverlapRate: 0, // Would need bar-level signal data for this
    longExposurePct,
    shortExposurePct,
    flatExposurePct,
    avgHoldingBars,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    tradeFrequency,
    signalQualityScore: sqScore
  };
}
