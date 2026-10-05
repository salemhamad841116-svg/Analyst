const fs = require('fs');
const path = './src/services/mlForecastEngine.ts';
let code = fs.readFileSync(path, 'utf8');

const searchCall = `  // Call High-Confidence Decision Engine
  return evaluateHighConfidenceDecision({
    symbol,
    timeframe,
    coveragePercentage,
    missingBars,
    providerMatch,
    candles,
    mtfCandlesMap: {}, 
    baseForecast,
    analysisId 
  });`;

const replaceCall = `  // Call High-Confidence Decision Engine
  return evaluateHighConfidenceDecision({
    symbol,
    timeframe,
    coveragePercentage,
    missingBars,
    providerMatch,
    candles,
    mtfCandlesMap: {}, 
    baseForecast,
    analysisId,
    dataset: 'LIVE_MARKET_DATA',
    schema: 'OHLCV_V1',
    sourceHash: analysisId, // We map sourceHash to analysisId for the runtime context
    modelVersion,
    labelPolicyVersion: 'v1.0'
  });`;

code = code.replace(searchCall, replaceCall);
fs.writeFileSync(path, code);
console.log('Patched mlForecastEngine context args.');
