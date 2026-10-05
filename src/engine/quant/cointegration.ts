/**
 * Statistical Z-Score for Mean Reversion
 */
export class CointegrationMath {
  static getZScore(prices: number[], currentPrice: number): number {
    if (prices.length === 0) return 0;
    
    let sum = 0;
    for (const p of prices) sum += p;
    const mean = sum / prices.length;

    let sqSum = 0;
    for (const p of prices) sqSum += (p - mean) ** 2;
    const stdDev = Math.sqrt(sqSum / prices.length);

    if (stdDev === 0) return 0;
    
    return (currentPrice - mean) / stdDev;
  }
}
