export class AIRiskManager {
  static calculateDynamicRisk(
    currentPrice: number,
    direction: 'BULLISH' | 'BEARISH',
    confidence: number,
    monteCarloBounds: { lowerBound: number, upperBound: number, variance: number },
    hmmRegime: string
  ): { stopLoss: number, takeProfit: number, positionSizePct: number, riskExplanation: string } {
    
    // Institutional Limits
    const ACCOUNT_RISK_LIMIT = 0.05; // 5% max global exposure
    const MAX_RISK_PER_TRADE = 0.02; // 2% max per trade
    
    const spread = (monteCarloBounds.upperBound - monteCarloBounds.lowerBound) / 2;
    
    let stopLoss = direction === 'BULLISH' 
      ? monteCarloBounds.lowerBound - (spread * 0.1)
      : monteCarloBounds.upperBound + (spread * 0.1);
      
    let takeProfit = direction === 'BULLISH'
      ? monteCarloBounds.upperBound
      : monteCarloBounds.lowerBound;

    const minDistance = currentPrice * 0.0010;
    if (Math.abs(currentPrice - stopLoss) < minDistance) {
      stopLoss = direction === 'BULLISH' ? currentPrice - minDistance : currentPrice + minDistance;
    }
    
    // Base Risk 1%
    let baseRisk = 0.01;
    let explanation = `Base Risk set to 1.00%. `;
    
    if (confidence > 80) { baseRisk += 0.005; explanation += `+0.50% due to high confidence (${confidence.toFixed(1)}%). `; }
    else if (confidence < 60) { baseRisk -= 0.005; explanation += `-0.50% due to low confidence (${confidence.toFixed(1)}%). `; }

    if (hmmRegime === 'VOLATILE') {
      baseRisk -= 0.005; 
      explanation += `-0.50% due to VOLATILE regime (high noise/uncertainty). `;
    } else if (hmmRegime === 'TREND') {
      baseRisk += 0.005; 
      explanation += `+0.50% due to TREND regime (high edge). `;
    } else if (hmmRegime === 'RANGE') {
      explanation += `+0.00% due to RANGE regime. `;
    }

    baseRisk = Math.min(baseRisk, MAX_RISK_PER_TRADE);
    const positionSizePct = Math.max(0.1, baseRisk * 100);

    explanation += `SL placed at ${stopLoss.toFixed(5)} (Monte Carlo variance boundary). `;
    explanation += `TP placed at ${takeProfit.toFixed(5)} (Monte Carlo expected value).`;

    return { 
      stopLoss: parseFloat(stopLoss.toFixed(5)), 
      takeProfit: parseFloat(takeProfit.toFixed(5)), 
      positionSizePct: parseFloat(positionSizePct.toFixed(2)),
      riskExplanation: explanation
    };
  }
}
