import * as fs from 'fs';

const path = 'scripts/acceptance/phase6_acceptance.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("if (metrics.parameterCount !== 4) {", "if (metrics.parameterCount !== 8) {");
code = code.replace("p4 = input.bool(true)", "p4 = input.bool(true)\\np5=input.int(1)\\np6=input.int(2)\\np7=input.int(3)\\np8=input.int(4)");

fs.writeFileSync(path, code, 'utf8');
