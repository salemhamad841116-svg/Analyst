const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add Dual Mode states
const statesSearch = `const [pineCode, setPineCode] = useState<string>('//@version=6\\nstrategy("Test", overlay=true)\\nfast = ta.ema(close, 9)');`;
const statesReplace = `const [pineCode, setPineCode] = useState<string>('//@version=6\\nstrategy("Test", overlay=true)\\nfast = ta.ema(close, 9)');
  const [isDualMode, setIsDualMode] = useState<boolean>(false);
  const [combineMode, setCombineMode] = useState<'COMPARE' | 'CONFLUENCE' | 'COMBINE'>('CONFLUENCE');
  const [pineCodeB, setPineCodeB] = useState<string>('//@version=6\\nstrategy("Code B", overlay=true)\\nslow = ta.ema(close, 21)\\nlongCondition = close > slow\\nif (longCondition)\\n    strategy.entry("Long", strategy.long)');`;
code = code.replace(statesSearch, statesReplace);

// 2. Add compiled strategies and hashes
const compiledSearch = `const compiledStrategy = useMemo(() => compilePineScript(pineCode), [pineCode]);

  // Active Strategy Code Hash
  const activeCodeHash = useMemo(() => sha256Hex(pineCode), [pineCode]);`;
const compiledReplace = `const compiledStrategy = useMemo(() => compilePineScript(pineCode), [pineCode]);
  const compiledStrategyB = useMemo(() => compilePineScript(pineCodeB), [pineCodeB]);

  // Active Strategy Code Hash
  const activeCodeHash = useMemo(() => sha256Hex(pineCode), [pineCode]);
  const activeCodeHashB = useMemo(() => sha256Hex(pineCodeB), [pineCodeB]);

  const combinedSourceHash = useMemo(() => {
    if (!isDualMode) return activeCodeHash;
    return sha256Hex(activeCodeHash + activeCodeHashB + combineMode);
  }, [isDualMode, activeCodeHash, activeCodeHashB, combineMode]);`;
code = code.replace(compiledSearch, compiledReplace);

// 3. Update Run Isolation
const isolationSearch = `const prevCodeHashRef = useRef<string>(activeCodeHash);
  useEffect(() => {
    if (prevCodeHashRef.current !== activeCodeHash) {
      prevCodeHashRef.current = activeCodeHash;
      if (hasAnalyzed || executionResults) {
        setHasAnalyzed(false);
        setExecutionResults(null);
        setAnalysisStatus('IDLE');
        setAnalysisProgress({ id: '', startTime: null, step: '' });
      }
    }
  }, [activeCodeHash, hasAnalyzed, executionResults]);`;
const isolationReplace = `const prevCombinedHashRef = useRef<string>(combinedSourceHash);
  useEffect(() => {
    if (prevCombinedHashRef.current !== combinedSourceHash) {
      prevCombinedHashRef.current = combinedSourceHash;
      if (hasAnalyzed || executionResults) {
        setHasAnalyzed(false);
        setExecutionResults(null);
        setAnalysisStatus('IDLE');
        setAnalysisProgress({ id: '', startTime: null, step: '' });
      }
    }
  }, [combinedSourceHash, hasAnalyzed, executionResults]);`;
code = code.replace(isolationSearch, isolationReplace);

fs.writeFileSync(path, code);
console.log('Patched states and hashes.');
