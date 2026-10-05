/**
 * Hidden Markov Model (HMM) for Regime Detection
 * States: 0: Ranging, 1: Trending, 2: Highly Volatile
 */
export class HiddenMarkovModel {
  // Estimated Transition Matrix: P(State_j | State_i)
  private transitionMatrix = [
    [0.70, 0.20, 0.10], // From Range
    [0.30, 0.60, 0.10], // From Trend
    [0.40, 0.20, 0.40]  // From Volatile
  ];

  static estimateStateProbabilities(returns: number[]): { stateProbs: number[], predictedRegime: string } {
    // Simple Observation Emission Proxy based on rolling mean and variance
    let sum = 0;
    for (const r of returns) sum += r;
    const mean = sum / returns.length;
    
    let sqSum = 0;
    for (const r of returns) sqSum += (r - mean) ** 2;
    const variance = sqSum / returns.length;
    const stdDev = Math.sqrt(variance);

    // Heuristic Emission Probabilities
    let probRange = 0.33;
    let probTrend = 0.33;
    let probVolatile = 0.33;

    if (stdDev > 0.005) { // High volatility threshold
      probVolatile = 0.7;
      probRange = 0.1;
      probTrend = 0.2;
    } else if (Math.abs(mean) > 0.001) { // Strong directional drift
      probTrend = 0.6;
      probRange = 0.2;
      probVolatile = 0.2;
    } else { // Low volatility, flat drift
      probRange = 0.7;
      probTrend = 0.2;
      probVolatile = 0.1;
    }

    const stateProbs = [probRange, probTrend, probVolatile];
    
    let maxP = -1;
    let maxIdx = 0;
    for (let i = 0; i < 3; i++) {
      if (stateProbs[i] > maxP) {
        maxP = stateProbs[i];
        maxIdx = i;
      }
    }

    const regimes = ['RANGE', 'TREND', 'VOLATILE'];
    return { stateProbs, predictedRegime: regimes[maxIdx] };
  }
}
