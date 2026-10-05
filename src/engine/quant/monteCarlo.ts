/**
 * Monte Carlo Simulation using Geometric Brownian Motion
 * Simulates 1000 possible paths for the next candle.
 */
export class MonteCarloEngine {
  static simulateNextCandle(
    currentPrice: number, 
    returns: number[], 
    simulations = 1000
  ): { expectedClose: number, lowerBound: number, upperBound: number, variance: number } {
    if (returns.length < 2) return { expectedClose: currentPrice, lowerBound: currentPrice, upperBound: currentPrice, variance: 0 };

    let sum = 0;
    for (const r of returns) sum += r;
    const mu = sum / returns.length; // drift

    let sqSum = 0;
    for (const r of returns) sqSum += (r - mu) ** 2;
    const variance = sqSum / returns.length;
    const sigma = Math.sqrt(variance); // volatility

    const finalPrices: number[] = [];

    // Simulate S_T = S_0 * exp((mu - sigma^2 / 2) + sigma * Z)
    for (let i = 0; i < simulations; i++) {
      // Box-Muller transform for normally distributed random number Z
      const u1 = Math.random();
      const u2 = Math.random();
      const Z = Math.sqrt(-2.0 * Math.log(u1 || 1e-9)) * Math.cos(2.0 * Math.PI * u2);

      const driftTerm = mu - (variance / 2);
      const shockTerm = sigma * Z;
      const nextPrice = currentPrice * Math.exp(driftTerm + shockTerm);
      
      finalPrices.push(nextPrice);
    }

    finalPrices.sort((a, b) => a - b);
    
    // 95% Confidence Interval
    const lowerBound = finalPrices[Math.floor(simulations * 0.025)];
    const upperBound = finalPrices[Math.floor(simulations * 0.975)];
    const expectedClose = finalPrices[Math.floor(simulations * 0.5)]; // Median

    return { expectedClose, lowerBound, upperBound, variance };
  }
}
