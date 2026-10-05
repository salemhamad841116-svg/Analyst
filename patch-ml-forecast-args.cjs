const fs = require('fs');
const path = './src/services/mlForecastEngine.ts';
let code = fs.readFileSync(path, 'utf8');

const searchArgs = `export function generateNextCandleForecast(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
  features: CalculatedFeatures[],
  modelVersion = 'USE-1.4.2',
  engineMode: 'RULE-BASED' | 'ML MODEL' | 'HYBRID' = 'HYBRID'
): NextCandleForecast {`;

const replaceArgs = `export function generateNextCandleForecast(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
  features: CalculatedFeatures[],
  modelVersion = 'USE-1.4.2',
  engineMode: 'RULE-BASED' | 'ML MODEL' | 'HYBRID' = 'HYBRID',
  coveragePercentage = 100,
  missingBars = 0,
  providerMatch = true,
  analysisId = ''
): NextCandleForecast {`;

code = code.replace(searchArgs, replaceArgs);

const searchCall = `  // Call High-Confidence Decision Engine
  return evaluateHighConfidenceDecision({
    symbol,
    timeframe,
    coveragePercentage: 100, // Normally passed down or calculated
    missingBars: 0,
    providerMatch: true,
    candles,
    mtfCandlesMap: {}, // Pass if available
    baseForecast,
    analysisId: 'ML_ENGINE_ID' // You'd pass the actual analysisId down here
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
    analysisId 
  });`;

code = code.replace(searchCall, replaceCall);
fs.writeFileSync(path, code);
console.log('Patched mlForecastEngine arguments.');
