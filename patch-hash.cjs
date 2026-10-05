const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

const search = `        setExecutionResults({
          ...results,
          isDualMode,
          combineMode,
          resultsB,
          dualExecutionTraces,`;
          
const replace = `        setExecutionResults({
          ...results,
          isDualMode,
          combineMode,
          resultsB,
          dualExecutionTraces,
          evidencePack: {
            ...results.evidencePack,
            codeHash: isDualMode ? combinedSourceHash : results.evidencePack?.codeHash,
          },`;

code = code.replace(search, replace);

// Also replace activeCodeHash with combinedSourceHash in activeRunVerification dependencies and return
// It's line 188-310. I can just string replace `activeCodeHash` with `combinedSourceHash` inside activeRunVerification block.
const blockStart = 'const activeRunVerification = useMemo(() => {';
const blockEnd = '}, [hasAnalyzed, executionResults, analysisStatus, analysisProgress.id, activeCodeHash]);';
const blockEndReplace = '}, [hasAnalyzed, executionResults, analysisStatus, analysisProgress.id, combinedSourceHash]);';

code = code.replace(blockEnd, blockEndReplace);

// We need to replace activeCodeHash inside the block. 
// A simple way is to find the block, replace inside it, then put it back.
const startIndex = code.indexOf(blockStart);
const endIndex = code.indexOf(blockEndReplace) + blockEndReplace.length;
let block = code.substring(startIndex, endIndex);
block = block.replace(/activeCodeHash/g, 'combinedSourceHash');
code = code.substring(0, startIndex) + block + code.substring(endIndex);

fs.writeFileSync(path, code);
console.log('Patched activeRunVerification hash.');
