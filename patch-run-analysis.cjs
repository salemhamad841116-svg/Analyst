const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

const executeSearch = `        const results = compiledStrategy.execute(
          marketData.candles,
          marketData.mtfCandlesMap,
          {}, // inputOverrides
          executionMode,
          marketData.metadata
        );`;
const executeReplace = `        const results = compiledStrategy.execute(
          marketData.candles,
          marketData.mtfCandlesMap,
          {}, // inputOverrides
          executionMode,
          marketData.metadata
        );

        let resultsB = null;
        let dualExecutionTraces = [];
        if (isDualMode) {
          resultsB = compiledStrategyB.execute(
            marketData.candles,
            marketData.mtfCandlesMap,
            {},
            executionMode,
            marketData.metadata
          );
          
          const signalsA = results.externalValidation?.expectedSignals || [];
          const signalsB = resultsB.externalValidation?.expectedSignals || [];
          
          for (let i = 0; i < marketData.candles.length; i++) {
            const c = marketData.candles[i];
            const sigA = signalsA.find(s => s.timestamp === c.timestamp);
            const sigB = signalsB.find(s => s.timestamp === c.timestamp);
            
            const aDir = sigA?.direction === 'LONG' ? 'BUY' : sigA?.direction === 'SHORT' ? 'SELL' : 'NO SIGNAL';
            const bDir = sigB?.direction === 'LONG' ? 'BUY' : sigB?.direction === 'SHORT' ? 'SELL' : 'NO SIGNAL';
            
            let finalSignal = 'NO SIGNAL';
            if (combineMode === 'COMPARE') {
              finalSignal = 'NEUTRAL';
            } else if (combineMode === 'CONFLUENCE' || combineMode === 'COMBINE') {
              if (aDir === 'BUY' && bDir === 'BUY') finalSignal = 'BUY';
              else if (aDir === 'SELL' && bDir === 'SELL') finalSignal = 'SELL';
              else finalSignal = 'NEUTRAL';
            }
            
            dualExecutionTraces.push({
              barIndex: i,
              timestamp: c.timestamp,
              timeFormatted: c.timeFormatted,
              price: c.close,
              signalA: aDir,
              signalB: bDir,
              confidenceA: sigA?.confidence,
              confidenceB: sigB?.confidence,
              finalSignal
            });
          }
        }`;
code = code.replace(executeSearch, executeReplace);

const setExecutionResultsSearch = `        setExecutionResults({
          ...results,`;
const setExecutionResultsReplace = `        setExecutionResults({
          ...results,
          isDualMode,
          combineMode,
          resultsB,
          dualExecutionTraces,`;
code = code.replace(setExecutionResultsSearch, setExecutionResultsReplace);

const runAnalysisSyntaxSearch = `    if (compiledStrategy.astUsrSummary.syntaxErrors.length > 0 || compiledStrategy.astUsrSummary.unresolvedIdentifiers.length > 0) {
      setAnalysisError(language === 'ar' ? 'قم بحل الأخطاء البرمجية في الكود (أ) أولاً' : 'Fix syntax errors in Code A first');
      return;
    }`;
const runAnalysisSyntaxReplace = `    if (compiledStrategy.astUsrSummary.syntaxErrors.length > 0 || compiledStrategy.astUsrSummary.unresolvedIdentifiers.length > 0) {
      setAnalysisError(language === 'ar' ? 'قم بحل الأخطاء البرمجية في الكود (أ) أولاً' : 'Fix syntax errors in Code A first');
      return;
    }
    if (isDualMode && compiledStrategyB.astUsrSummary) {
      if (compiledStrategyB.astUsrSummary.syntaxErrors.length > 0 || compiledStrategyB.astUsrSummary.unresolvedIdentifiers.length > 0) {
        setAnalysisError(language === 'ar' ? 'قم بحل الأخطاء البرمجية في الكود (ب) أولاً' : 'Fix syntax errors in Code B first');
        return;
      }
    }`;
code = code.replace(runAnalysisSyntaxSearch, runAnalysisSyntaxReplace);

fs.writeFileSync(path, code);
console.log('Patched execute block and setExecutionResults.');
