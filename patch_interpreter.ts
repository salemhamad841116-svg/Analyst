import * as fs from 'fs';

const path = 'src/engine/analysis/backtest/interpreter.ts';
let code = fs.readFileSync(path, 'utf8');

const oldCall = `    if (callee.startsWith('plot') || callee.startsWith('alert')) {
      return null;
    }`;

const newCall = `    if (callee.startsWith('input')) {
      return args.length > 0 ? args[0] : null;
    }
    
    if (callee.startsWith('plot') || callee.startsWith('alert')) {
      return null;
    }`;

code = code.replace(oldCall, newCall);

fs.writeFileSync(path, code, 'utf8');
