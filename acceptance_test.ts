import { evaluateHighConfidenceDecision } from './src/engine/ml/highConfidenceDecisionEngine';

const mockCandles = Array.from({ length: 500 }).map((_, i) => {
  const noise = (Math.random() - 0.5) * 0.0020;
  // A clean cycle (sine wave) for FFT to pick up, plus a trend for HMM
  const cycle = Math.sin((i / 50) * Math.PI * 2) * 0.0050;
  const trend = i * 0.00005;
  return {
    timestamp: Date.now() - (500 - i) * 60000,
    open: 1.1000 + noise + cycle + trend,
    high: 1.1010 + noise + cycle + trend,
    low: 1.0990 + noise + cycle + trend,
    close: 1.1005 + noise + cycle + trend,
    volume: 1000,
  };
});

const baseForecast: any = {
  symbol: 'EUR/USD',
  timeframe: '5m',
  direction: 'BULLISH',
  forecastSignal: 'NEXT BUY',
  bullishProbability: 0.8,
  bearishProbability: 0.2,
  neutralProbability: 0.0
};

const result = evaluateHighConfidenceDecision({
  symbol: 'EUR/USD',
  timeframe: '5m',
  coveragePercentage: 100,
  missingBars: 0,
  providerMatch: true,
  candles: mockCandles,
  mtfCandlesMap: {},
  baseForecast,
  analysisId: 'ANALYSIS_QUANT',
  dataset: 'TEST_DS_QUANT',
  schema: 'OHLCV_V2',
  sourceHash: 'HASH_QUANT',
  modelVersion: 'V_HYBRID',
  labelPolicyVersion: 'V_2'
});

console.log("=== HYBRID ENGINE EVIDENCE REPORT ===");
console.log("Layer 1: Quantitative Mathematics");
console.log(`- HMM Detected Regime: ${result.detectedRegime}`);
console.log(`- Monte Carlo Risk Bounds: SL: ${result.stopLoss}, TP: ${result.takeProfit}`);
console.log(`- Position Sizing: ${result.positionSizePct}%`);
console.log("");
console.log("Layer 2: Advanced Machine Learning");
console.log(`- Final Signal: ${result.forecastSignal}`);
console.log(`- Final Direction: ${result.direction}`);
console.log(`- Model Agreement: ${result.modelAgreementScore} (Logistic, MLP, LSTM)`);
console.log(`- Calibrated Confidence: ${result.calibratedConfidence || 'UNVALIDATED'}`);
console.log(`- OOS Accuracy: ${result.oosAccuracy || 'UNVALIDATED'}`);
console.log(`- Blind Accuracy: ${result.blindAccuracy || 'UNVALIDATED'}`);
console.log(`- Abstention Reason: ${result.abstentionReason || 'N/A'}`);
console.log("=====================================");
