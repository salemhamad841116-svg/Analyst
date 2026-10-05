const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

const search = `            codeHash: isDualMode ? combinedSourceHash : results.evidencePack?.codeHash,
          },`;
          
const replace = `            codeHash: isDualMode ? combinedSourceHash : results.evidencePack?.codeHash,
            verificationStatus: isDualMode 
              ? (results.verificationStatus === 'PASS_ZERO_DELTA' && resultsB.verificationStatus === 'PASS_ZERO_DELTA' ? 'PASS_ZERO_DELTA' : 'FAILED')
              : results.verificationStatus,
          },`;

code = code.replace(search, replace);
fs.writeFileSync(path, code);
console.log('Patched verification status.');
