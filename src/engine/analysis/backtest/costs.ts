import { BacktestTrade } from './interpreter';

export interface CostProfile {
  spread: number;         // e.g., 0.0001 for EURUSD
  commission: number;     // e.g., 2.0 per lot or flat
  commissionType: 'FLAT' | 'PERCENT' | 'PER_UNIT';
  slippageTicks: number;  // e.g., 1 tick of slippage
  tickSize: number;       // e.g., 0.00001
  contractMultiplier: number; // e.g., 100000 for standard lot
}

export const DEFAULT_PROFILES: Record<string, CostProfile> = {
  'EURUSD': { spread: 0.0001, commission: 2.0, commissionType: 'PER_UNIT', slippageTicks: 2, tickSize: 0.00001, contractMultiplier: 100000 },
  'BTCUSDT': { spread: 0.1, commission: 0.04, commissionType: 'PERCENT', slippageTicks: 1, tickSize: 0.01, contractMultiplier: 1 },
  'DEFAULT': { spread: 0, commission: 0, commissionType: 'FLAT', slippageTicks: 0, tickSize: 0.01, contractMultiplier: 1 },
};

export function applyCostsToTrade(trade: BacktestTrade, profile: CostProfile): BacktestTrade {
  const slippageValue = profile.slippageTicks * profile.tickSize;
  const spreadValue = profile.spread;
  
  // Apply spread and slippage to entry/exit prices
  let actualEntry = trade.entryPrice;
  let actualExit = trade.exitPrice;
  
  if (trade.direction === 'LONG') {
    actualEntry += (spreadValue / 2) + slippageValue;
    actualExit -= (spreadValue / 2) + slippageValue;
  } else {
    actualEntry -= (spreadValue / 2) + slippageValue;
    actualExit += (spreadValue / 2) + slippageValue;
  }
  
  // Recalculate gross based on actual prices
  const priceDiff = trade.direction === 'LONG' ? actualExit - actualEntry : actualEntry - actualExit;
  let netPnL = priceDiff * trade.qty * profile.contractMultiplier;
  
  // Apply commission
  let comm = 0;
  if (profile.commissionType === 'FLAT') {
    comm = profile.commission * 2; // In and Out
  } else if (profile.commissionType === 'PER_UNIT') {
    comm = profile.commission * trade.qty * 2;
  } else if (profile.commissionType === 'PERCENT') {
    const entryVal = actualEntry * trade.qty * profile.contractMultiplier;
    const exitVal = actualExit * trade.qty * profile.contractMultiplier;
    comm = (entryVal * (profile.commission / 100)) + (exitVal * (profile.commission / 100));
  }
  
  netPnL -= comm;
  
  return {
    ...trade,
    entryPrice: actualEntry,
    exitPrice: actualExit,
    grossPnL: trade.grossPnL, // Keep original gross for comparison
    netPnL: netPnL
  } as BacktestTrade & { netPnL: number };
}
