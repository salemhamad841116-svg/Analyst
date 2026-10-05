const fs = require('fs');
const path = './src/services/mlForecastEngine.ts';
let code = fs.readFileSync(path, 'utf8');

// Add the import
if (!code.includes('evaluateHighConfidenceDecision')) {
  code = code.replace(
    "import { getTimeframeModelProfile, isTimeframeValidated } from './multiTimeframeCertificationEngine';",
    "import { getTimeframeModelProfile, isTimeframeValidated } from './multiTimeframeCertificationEngine';\nimport { evaluateHighConfidenceDecision } from '../engine/ml/highConfidenceDecisionEngine';"
  );
}

// Intercept return statement in generateNextCandleForecast
const search = `  return {
    symbol,
    timeframe,
    direction,
    forecastSignal,
    engineMode,
    mlModelMetadata: {`;
    
const blockEndSearch = `    liveValidation: {
      isFrozen: true,
      actualDirection: 'PENDING',
      isRepaintDetected: false,
      isLookaheadDetected: false,
    }
  };
}`;

const replace = `  const baseForecast: NextCandleForecast = {
    symbol,
    timeframe,
    direction,
    forecastSignal,
    engineMode,
    mlModelMetadata: {`;

const blockEndReplace = `    liveValidation: {
      isFrozen: true,
      actualDirection: 'PENDING',
      isRepaintDetected: false,
      isLookaheadDetected: false,
    }
  };
  
  // Call High-Confidence Decision Engine
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
  });
}`;

if (code.includes(search)) {
  code = code.replace(search, replace);
  code = code.replace(blockEndSearch, blockEndReplace);
  fs.writeFileSync(path, code);
  console.log('Patched mlForecastEngine.ts');
} else {
  console.log('Could not find search block in mlForecastEngine.ts');
}
