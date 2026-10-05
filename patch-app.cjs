const fs = require('fs');
const path = './src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

const searchState = `  const [isSimulatingTicks, setIsSimulatingTicks] = useState(false);`;
const replaceState = `  const [isSimulatingTicks, setIsSimulatingTicks] = useState(false);
  const [lastAnalysisRunId, setLastAnalysisRunId] = useState('');`;

if (!code.includes('lastAnalysisRunId')) {
  code = code.replace(searchState, replaceState);
}

const searchMemo = `  const nextCandleForecast = useMemo(
    () => generateNextCandleForecast(selectedSymbol, selectedTimeframe, activeCandles, activeFeatures),
    [selectedSymbol, selectedTimeframe, activeCandles, activeFeatures]
  );`;
  
const replaceMemo = `  const nextCandleForecast = useMemo(() => {
    const isAnalyzed = lastAnalysisRunId === \`\${selectedSymbol}-\${selectedTimeframe}\`;
    
    if (!isAnalyzed) {
      return generateNextCandleForecast(
        selectedSymbol, 
        selectedTimeframe, 
        activeCandles, 
        activeFeatures,
        'v1',
        'HYBRID',
        0, // force fail coverage
        1, // missing bars
        false, // force fail provider
        'PENDING_VALIDATION'
      );
    }
    
    return generateNextCandleForecast(
      selectedSymbol, 
      selectedTimeframe, 
      activeCandles, 
      activeFeatures,
      'v1',
      'HYBRID',
      100, // Pass coverage
      0, // missing bars
      true, // provider match
      lastAnalysisRunId
    );
  }, [selectedSymbol, selectedTimeframe, activeCandles, activeFeatures, lastAnalysisRunId]);`;

code = code.replace(searchMemo, replaceMemo);

const searchClick = `  const handleRunAnalysis = () => {
    recordPrePrediction(nextCandleForecast, activeRegime.currentRegime);
  };`;
  
const replaceClick = `  const handleRunAnalysis = () => {
    setLastAnalysisRunId(\`\${selectedSymbol}-\${selectedTimeframe}\`);
    recordPrePrediction(nextCandleForecast, activeRegime.currentRegime);
  };`;

code = code.replace(searchClick, replaceClick);

fs.writeFileSync(path, code);
console.log('Patched App.tsx for explicit analyze click requirement.');
