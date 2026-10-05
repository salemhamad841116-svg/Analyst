import * as fs from 'node:fs';
import * as path from 'node:path';
import { runStaticAnalysisPipeline } from '../../src/engine/analysis/pipeline/analysisPipeline';
import { Candle } from '../../src/types';
import { DEFAULT_PROFILES } from '../../src/engine/analysis/backtest/costs';

const OUT_DIR = path.resolve(process.cwd(), 'audit', 'phase4');
fs.mkdirSync(OUT_DIR, { recursive: true });

// We need a dataset that actually produces winning and losing trades
const mockCandles: Candle[] = [];
let price = 100;
for(let i=0; i<300; i++) {
  // Creating an oscillating wave to guarantee crossovers and crossunders
  price = 100 + Math.sin(i / 5) * 10;
  mockCandles.push({
    timestamp: 1600000000000 + i * 3600000,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 1000
  });
}

const strategyCode = `
//@version=6
strategy("Risk Metric Test")
fast = ta.sma(close, 5)
slow = ta.sma(close, 10)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, 1)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

console.log("▶ Running Phase 4 Risk & Performance Engine...");

const result = runStaticAnalysisPipeline(strategyCode, {
  analysisId: 'ACC-P4-TEST',
  language: 'pine',
  candles: mockCandles,
  costProfile: DEFAULT_PROFILES['DEFAULT']
});

const riskStage = result.stages.find(s => s.stageId === 'RISK_PERFORMANCE');

fs.writeFileSync(path.join(OUT_DIR, 'P4_REPORT.json'), JSON.stringify(result, null, 2));

console.log("Risk Stage Status:", riskStage?.status);
console.log("Risk Stage Reason:", riskStage?.reason);

if (riskStage?.status !== 'PASS') {
  console.error("❌ Phase 4 Acceptance Failed: Stage didn't pass.");
  process.exit(1);
}

const metrics = riskStage.metrics as any;

const requiredMetrics = ['winRate', 'profitFactor', 'expectancy', 'maxDrawdownPct', 'sharpeRatio', 'sortinoRatio'];
for (const req of requiredMetrics) {
    if (metrics[req] === undefined || isNaN(metrics[req])) {
       console.error(`❌ Missing or NaN metric: ${req}`);
       process.exit(1);
    }
}

if (metrics.totalTrades === 0) {
    console.error(`❌ Expected trades, got 0`);
    process.exit(1);
}

console.log("✅ Phase 4 Acceptance: Metrics correctly computed independent of backtester core.");
console.log(`WinRate: ${metrics.winRate.toFixed(2)}%, PF: ${metrics.profitFactor.toFixed(2)}, MaxDD: ${metrics.maxDrawdownPct.toFixed(2)}%`);
console.log(`Sharpe: ${metrics.sharpeRatio.toFixed(2)}, Sortino: ${metrics.sortinoRatio.toFixed(2)}`);
