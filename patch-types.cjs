const fs = require('fs');
const path = './src/types/index.ts';
let code = fs.readFileSync(path, 'utf8');

const search = `  liveShadowAccuracy?: number;`;
const replace = `  liveShadowAccuracy?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSizePct?: number;`;

if (!code.includes('stopLoss?')) {
  code = code.replace(search, replace);
  fs.writeFileSync(path, code);
  console.log('Patched types/index.ts with Risk Management properties.');
}
