const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add generateNextCandleForecast import
if (!code.includes('generateNextCandleForecast')) {
  code = code.replace(
    "import { SignalCodeGenerator } from './SignalCodeGenerator';",
    "import { SignalCodeGenerator } from './SignalCodeGenerator';\nimport { generateNextCandleForecast } from '../services/mlForecastEngine';"
  );
}

// 2. We need to generate the forecast inside PineScriptStudioView.
// We can use a useMemo that depends on executionResults, selectedSymbol, baseTimeframe, combinedSourceHash.
// Wait, executionResults might not exist until they click Run.
const searchMemo = `  const [activePipelineTab, setActivePipelineTab] = useState('data');`;
const replaceMemo = `  const [activePipelineTab, setActivePipelineTab] = useState('data');

  const studioNextCandleForecast = useMemo(() => {
    if (!executionResults || verificationStatus !== 'PASS') {
      return generateNextCandleForecast(
        selectedSymbol,
        baseTimeframe,
        [], // empty candles
        [], // empty features
        'v1',
        'HYBRID',
        0, // coverage
        10, // missing bars (forces failure)
        false,
        combinedSourceHash
      );
    }
    
    // Use candles from the evidence pack
    const candles = executionResults.evidencePack.datasets[0].candles || [];
    const features = []; // Features are handled inside mlForecastEngine if we pass them, or it might re-calculate
    
    return generateNextCandleForecast(
      selectedSymbol,
      baseTimeframe,
      candles,
      features,
      'v1',
      'HYBRID',
      executionResults.evidencePack.metrics.coveragePercentage,
      executionResults.evidencePack.metrics.missingBars,
      true, // provider match
      combinedSourceHash
    );
  }, [executionResults, verificationStatus, selectedSymbol, baseTimeframe, combinedSourceHash]);`;

if (!code.includes('studioNextCandleForecast')) {
  code = code.replace(searchMemo, replaceMemo);
}

// 3. Pass it to NextCandleForecastTracker
const searchTracker = `<NextCandleForecastTracker
            activeSymbol={selectedSymbol}
            activeTimeframe={baseTimeframe}
            language={language}
          />`;
const replaceTracker = `<NextCandleForecastTracker
            activeSymbol={selectedSymbol}
            activeTimeframe={baseTimeframe}
            language={language}
            currentForecast={studioNextCandleForecast}
          />`;
          
code = code.replace(searchTracker, replaceTracker);

fs.writeFileSync(path, code);
console.log('Patched PineScriptStudioView with forecast tracker.');
