import { BacktestTrade } from '../backtest/interpreter';

export interface MonteCarloConfig {
  numSimulations: number;
  initialCapital: number;
  ruinThresholdPct: number; // e.g., 0.5 for a 50% loss equating to "ruin"
  seed: number;
}

export interface MonteCarloResult {
  pLoss: number;           // Probability of ending in a loss
  pRuin: number;           // Probability of hitting the ruin threshold
  medianDrawdown: number;  // Median Max Drawdown across simulations
  worstDrawdown95: number; // 95th percentile Worst Max Drawdown
  medianProfit: number;
  seedUsed: number;
}

// Simple Linear Congruential Generator for reproducible PRNG
class LCG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min) + min);
  }
}

export function runMonteCarloSimulation(
  trades: BacktestTrade[], 
  config: Partial<MonteCarloConfig> = {}
): MonteCarloResult {
  const numSimulations = config.numSimulations || 1000;
  const initialCapital = config.initialCapital || 10000;
  const ruinThresholdPct = config.ruinThresholdPct || 0.5;
  const seed = config.seed || Date.now();
  
  if (!trades || trades.length === 0) {
    return { pLoss: 0, pRuin: 0, medianDrawdown: 0, worstDrawdown95: 0, medianProfit: 0, seedUsed: seed };
  }

  const rng = new LCG(seed);
  const pnlList = trades.map(t => (t as any).netPnL || t.grossPnL);
  const tradeCount = pnlList.length;
  
  let lossCount = 0;
  let ruinCount = 0;
  const maxDrawdowns: number[] = [];
  const finalProfits: number[] = [];

  const ruinLevel = initialCapital * (1 - ruinThresholdPct);

  for (let s = 0; s < numSimulations; s++) {
    let currentCapital = initialCapital;
    let peakCapital = initialCapital;
    let simMaxDD = 0;
    let ruined = false;

    for (let i = 0; i < tradeCount; i++) {
      // Bootstrap with replacement
      const randomIdx = rng.nextInt(0, tradeCount);
      const tradePnL = pnlList[randomIdx];

      currentCapital += tradePnL;

      if (currentCapital < ruinLevel && !ruined) {
        ruined = true;
      }

      if (currentCapital > peakCapital) {
        peakCapital = currentCapital;
      }

      const dd = peakCapital - currentCapital;
      const ddPct = dd / peakCapital;
      if (ddPct > simMaxDD) {
        simMaxDD = ddPct;
      }
    }

    if (ruined) ruinCount++;
    if (currentCapital < initialCapital) lossCount++;
    
    maxDrawdowns.push(simMaxDD);
    finalProfits.push(currentCapital - initialCapital);
  }

  // Calculate statistics
  const pLoss = (lossCount / numSimulations) * 100;
  const pRuin = (ruinCount / numSimulations) * 100;
  
  maxDrawdowns.sort((a, b) => a - b);
  finalProfits.sort((a, b) => a - b);
  
  const medianDrawdown = maxDrawdowns[Math.floor(numSimulations * 0.5)] || 0;
  const worstDrawdown95 = maxDrawdowns[Math.floor(numSimulations * 0.95)] || 0;
  const medianProfit = finalProfits[Math.floor(numSimulations * 0.5)] || 0;

  return {
    pLoss,
    pRuin,
    medianDrawdown: medianDrawdown * 100,
    worstDrawdown95: worstDrawdown95 * 100,
    medianProfit,
    seedUsed: seed
  };
}
