import * as fs from 'node:fs';
import * as path from 'node:path';
import { runStaticAnalysisPipeline } from '../../src/engine/analysis/pipeline/analysisPipeline';
import { Candle } from '../../src/types';

const OUT_DIR = path.resolve(process.cwd(), 'audit', 'phase3');
fs.mkdirSync(OUT_DIR, { recursive: true });

const mockCandles: Candle[] = [];
let price = 100;
for(let i=0; i<100; i++) {
  mockCandles.push({
    timestamp: 1600000000000 + i * 3600000,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price + (Math.random() > 0.5 ? 0.5 : -0.5),
    volume: 1000
  });
  price = mockCandles[i].close;
}

const strategyCode = `
//@version=6
strategy("Crossover Test")
fast = ta.sma(close, 5)
slow = ta.sma(close, 10)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, 1)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

console.log("▶ Running Phase 3 Backtest Engine...");

import { DEFAULT_PROFILES } from '../../src/engine/analysis/backtest/costs';

const result = runStaticAnalysisPipeline(strategyCode, {
  analysisId: 'ACC-P3-TEST',
  language: 'pine',
  candles: mockCandles,
  costProfile: DEFAULT_PROFILES['EURUSD']
});

const backtestStage = result.stages.find(s => s.stageId === 'BACKTEST');
const costStage = result.stages.find(s => s.stageId === 'COST_ADJUSTMENT');

fs.writeFileSync(path.join(OUT_DIR, 'P3_REPORT.json'), JSON.stringify(result, null, 2));

console.log("Backtest Stage:", backtestStage?.status, backtestStage?.reason);
console.log("Cost Stage:", costStage?.status, costStage?.reason);

if (backtestStage?.status !== 'PASS' || costStage?.status !== 'PASS') {
  console.error("❌ Phase 3 Acceptance Failed.");
  process.exit(1);
}

const metrics = costStage.metrics as any;
if (metrics.netPnL === undefined || metrics.grossPnL === undefined || metrics.netPnL === metrics.grossPnL) {
  console.error("❌ Cost adjustment didn't modify PnL or failed.");
  process.exit(1);
}

console.log("✅ Phase 3 Acceptance: 1/1 checks passed.");
console.log(`Gross PnL: ${metrics.grossPnL.toFixed(4)}, Net PnL: ${metrics.netPnL.toFixed(4)}`);
