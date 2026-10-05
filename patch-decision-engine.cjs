const fs = require('fs');
const path = './src/engine/ml/highConfidenceDecisionEngine.ts';

const code = `import { Candle, Timeframe, NextCandleForecast } from '../../types';
import { detectMarketRegime } from '../../services/regimeDetector';

export interface DecisionEngineContext {
  symbol: string;
  timeframe: Timeframe;
  coveragePercentage: number;
  missingBars: number;
  providerMatch: boolean;
  candles: Candle[];
  mtfCandlesMap: Record<string, Candle[]>;
  baseForecast: NextCandleForecast;
  analysisId: string;
  
  // Strict Invalidation Context
  dataset: string;
  schema: string;
  sourceHash: string;
  modelVersion: string;
  labelPolicyVersion: string;
}

export function evaluateHighConfidenceDecision(ctx: DecisionEngineContext): NextCandleForecast {
  const { 
    coveragePercentage, 
    missingBars, 
    providerMatch, 
    candles, 
    baseForecast 
  } = ctx;

  const result = { ...baseForecast };
  
  // 1. Strict Data Quality Gate
  if (coveragePercentage < 100 || missingBars > 0 || !providerMatch) {
    result.forecastSignal = 'NO SIGNAL';
    result.direction = 'NEUTRAL';
    result.abstentionReason = 'DATA_INTEGRITY_FAIL';
    result.validationStatus = 'UNVALIDATED';
    return result;
  }

  // 2. Regime Detector
  const latestCandles = candles.slice(-50);
  const regimeInfo = detectMarketRegime(latestCandles);
  result.detectedRegime = regimeInfo.regime === 'TRENDING_UP' ? 'TREND_BULL' : 
                          regimeInfo.regime === 'TRENDING_DOWN' ? 'TREND_BEAR' : 
                          regimeInfo.regime === 'VOLATILE' ? 'HIGH_VOLATILITY' : 'RANGE';

  // 3. Real ML Ensemble Check (User Request: "إذا كانت النماذج حاليًا simulated، غيّر الحالة إلى: ML ENSEMBLE = NOT IMPLEMENTED")
  // Since we do not have a real Logistic/XGBoost/KNN backend providing real probabilistic tensors here,
  // we MUST comply and mark it as NOT IMPLEMENTED rather than faking 4/4 agreement.
  result.modelAgreementScore = 'ML ENSEMBLE NOT IMPLEMENTED';
  result.forecastSignal = 'NO SIGNAL';
  result.direction = 'NEUTRAL';
  result.abstentionReason = 'ML_ENSEMBLE_NOT_IMPLEMENTED';
  result.uncertaintyLevel = 'CRITICAL';
  result.validationStatus = 'UNVALIDATED';
  
  // Strip hardcoded metrics
  result.calibratedConfidence = 0;
  result.edgeMargin = 0;
  result.oosAccuracy = 0;
  result.blindAccuracy = 0;
  result.liveShadowAccuracy = 0;
  
  // 4. Strict Runtime Invalidation Identity
  // The system must explicitly track this identity to avoid mixing context.
  const runtimeIdentity = [
    ctx.symbol,
    ctx.timeframe,
    ctx.providerMatch ? 'MATCH' : 'MISMATCH',
    ctx.dataset,
    ctx.schema,
    ctx.sourceHash,
    ctx.modelVersion,
    ctx.labelPolicyVersion
  ].join('|');
  
  // (In a real system, we'd hash runtimeIdentity and strictly match it against the PredictionLedger)
  
  return result;
}
`;

fs.writeFileSync(path, code);
console.log('Patched highConfidenceDecisionEngine.ts for Real ML Verification.');
