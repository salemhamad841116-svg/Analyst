const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

const search = `new Date(diagnosticState.verificationStarted).toLocaleTimeString()`;
const replace = `formatDubaiTime(diagnosticState.verificationStarted, { showSeconds: true })`;

code = code.replace(search, replace);

const search2 = `new Date(diagnosticState.verificationStarted).toISOString().slice(0, 10)`;
const replace2 = `formatDubaiTime(diagnosticState.verificationStarted, { formatDate: true }).split(' ')[0]`;

code = code.replace(search2, replace2);

fs.writeFileSync(path, code);
console.log('Patched PineScriptStudioView');
