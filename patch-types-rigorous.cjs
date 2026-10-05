const fs = require('fs');
const path = './src/types/index.ts';
let code = fs.readFileSync(path, 'utf8');

const search = `  positionSizePct?: number;`;
const replace = `  positionSizePct?: number;
  riskExplanation?: string;
  individualModelPredictions?: {
    lstm: string;
    mlp: string;
    logistic: string;
  };
  metrics?: {
    lstm: any;
    mlp: any;
    logistic: any;
    ensemble: any;
    trainingDetails: any;
  };`;

if (!code.includes('riskExplanation?')) {
  code = code.replace(search, replace);
  fs.writeFileSync(path, code);
  console.log('Patched types/index.ts with Rigorous metrics properties.');
}
