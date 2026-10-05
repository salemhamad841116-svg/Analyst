import * as fs from 'fs';

const path = 'src/engine/analysis/pipeline/analysisPipeline.ts';
let code = fs.readFileSync(path, 'utf8');

const imports = `import { PineInterpreter, BacktestTrade } from '../backtest/interpreter';\nimport { applyCostsToTrade, DEFAULT_PROFILES } from '../backtest/costs';\n`;
code = code.replace("import { ClassificationResult, classifyStrategy } from '../static/classifier';", "import { ClassificationResult, classifyStrategy } from '../static/classifier';\n" + imports);

// Fix TS types for reduce/map
code = code.replace(/let trades = \[\];/, 'let trades: BacktestTrade[] = [];');
code = code.replace(/trades.reduce\(\(sum, t\) =>/g, 'trades.reduce((sum: number, t: BacktestTrade) =>');
code = code.replace(/trades.map\(t =>/g, 'trades.map((t: BacktestTrade) =>');
code = code.replace(/netTrades.reduce\(\(sum, t\) =>/g, 'netTrades.reduce((sum: number, t: any) =>');

fs.writeFileSync(path, code, 'utf8');
