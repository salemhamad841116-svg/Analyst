import { BacktestTrade } from '../backtest/interpreter';

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  var95: number;
  cvar95: number;
  skewness: number;
  kurtosis: number;
  totalNetPnL: number;
  grossProfit: number;
  grossLoss: number;
}

export function calculatePerformanceMetrics(trades: (BacktestTrade & { netPnL: number })[], initialCapital: number = 10000): PerformanceMetrics {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0, winRate: 0, profitFactor: 0, expectancy: 0,
      maxDrawdown: 0, maxDrawdownPct: 0, sharpeRatio: 0, sortinoRatio: 0,
      var95: 0, cvar95: 0, skewness: 0, kurtosis: 0,
      totalNetPnL: 0, grossProfit: 0, grossLoss: 0
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let cumulativePnL = 0;
  let peakCumulative = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  
  const returns: number[] = [];
  const pctReturns: number[] = [];
  
  let currentCapital = initialCapital;

  for (const trade of trades) {
    const pnl = trade.netPnL;
    cumulativePnL += pnl;
    returns.push(pnl);
    
    const pctReturn = pnl / currentCapital;
    pctReturns.push(pctReturn);
    
    currentCapital += pnl;

    if (pnl > 0) {
      grossProfit += pnl;
      wins++;
    } else {
      grossLoss += Math.abs(pnl);
    }

    if (cumulativePnL > peakCumulative) {
      peakCumulative = cumulativePnL;
    }
    
    const drawdown = peakCumulative - cumulativePnL;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = maxDrawdown / (initialCapital + peakCumulative);
    }
  }

  const totalTrades = trades.length;
  const winRate = (wins / totalTrades) * 100;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;
  const expectancy = cumulativePnL / totalTrades;
  
  // Statistical Metrics (based on Trade Returns)
  const meanReturn = pctReturns.reduce((sum, r) => sum + r, 0) / totalTrades;
  const variance = pctReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / totalTrades;
  const stdDev = Math.sqrt(variance);
  
  // Downside deviation for Sortino
  const downsideReturns = pctReturns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 0 
    ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / totalTrades 
    : 0;
  const downsideStdDev = Math.sqrt(downsideVariance);

  // Approximate Annualization factor for Sharpe/Sortino 
  // (Assuming trade returns. If we want true annualized, we need daily returns. We use trade-level proxy).
  const sharpeRatio = stdDev === 0 ? 0 : meanReturn / stdDev;
  const sortinoRatio = downsideStdDev === 0 ? (meanReturn > 0 ? 999 : 0) : meanReturn / downsideStdDev;

  // VaR and CVaR (95% confidence)
  const sortedReturns = [...pctReturns].sort((a, b) => a - b);
  const varIndex = Math.floor(totalTrades * 0.05);
  const var95 = sortedReturns[varIndex] || 0;
  
  const tailReturns = sortedReturns.slice(0, varIndex + 1);
  const cvar95 = tailReturns.length > 0 ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;

  // Skewness & Kurtosis
  let skewness = 0;
  let kurtosis = 0;
  if (stdDev > 0 && totalTrades > 2) {
    const n = totalTrades;
    const m3 = pctReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 3), 0) / n;
    const m4 = pctReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 4), 0) / n;
    skewness = m3 / Math.pow(stdDev, 3);
    kurtosis = (m4 / Math.pow(stdDev, 4)) - 3; // Excess kurtosis
  }

  return {
    totalTrades,
    winRate,
    profitFactor,
    expectancy,
    maxDrawdown,
    maxDrawdownPct: maxDrawdownPct * 100,
    sharpeRatio,
    sortinoRatio,
    var95: var95 * 100,
    cvar95: cvar95 * 100,
    skewness,
    kurtosis,
    totalNetPnL: cumulativePnL,
    grossProfit,
    grossLoss
  };
}
