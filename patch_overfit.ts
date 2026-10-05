import * as fs from 'fs';
const path = 'src/engine/analysis/risk/overfitting.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace("if (overfitRiskScore > 70) {", "if (overfitRiskScore > 60) {");
fs.writeFileSync(path, code, 'utf8');

const path2 = 'src/engine/analysis/pipeline/analysisPipeline.ts';
let code2 = fs.readFileSync(path2, 'utf8');
code2 = code2.replace("if (overfitResult.overfitRiskScore > 70) {", "if (overfitResult.overfitRiskScore > 60) {");
fs.writeFileSync(path2, code2, 'utf8');
