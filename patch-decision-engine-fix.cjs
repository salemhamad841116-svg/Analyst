const fs = require('fs');
const path = './src/engine/ml/highConfidenceDecisionEngine.ts';
let code = fs.readFileSync(path, 'utf8');

const search = `const regimeInfo = detectMarketRegime(latestCandles);`;
const replace = `const regimeInfo = detectMarketRegime(latestCandles, []);`;

code = code.replace(search, replace);
fs.writeFileSync(path, code);
console.log('Fixed regimeDetector call in highConfidenceDecisionEngine.ts.');
