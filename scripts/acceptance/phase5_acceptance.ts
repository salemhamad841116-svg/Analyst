import * as fs from 'node:fs';
import * as path from 'node:path';
import { runStaticAnalysisPipeline } from '../../src/engine/analysis/pipeline/analysisPipeline';
import { Candle } from '../../src/types';
import { DEFAULT_PROFILES } from '../../src/engine/analysis/backtest/costs';

const OUT_DIR = path.resolve(process.cwd(), 'audit', 'phase5');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Create a challenging dataset that leads to some losses to test Monte Carlo tail risk
const mockCandles: Candle[] = [];
let price = 100;
for(let i=0; i<300; i++) {
  // Oscillation + Random walk to cause some wins and losses
  price = 100 + Math.sin(i / 5) * 10 + (Math.random() * 5 - 2.5);
  mockCandles.push({
    timestamp: 1600000000000 + i * 3600000,
    open: price,
    high: price + 2,
    low: price - 2,
    close: price + (Math.random() > 0.5 ? 1 : -1),
    volume: 1000
  });
}

const strategyCode = `
//@version=6
strategy("Monte Carlo Test")
fast = ta.sma(close, 2)
slow = ta.sma(close, 5)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, 100)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

console.log("▶ Running Phase 5 Monte Carlo Simulation Engine...");

const result = runStaticAnalysisPipeline(strategyCode, {
  analysisId: 'ACC-P5-TEST',
  language: 'pine',
  candles: mockCandles,
  costProfile: DEFAULT_PROFILES['DEFAULT']
});

const robustnessStage = result.stages.find(s => s.stageId === 'ROBUSTNESS');

fs.writeFileSync(path.join(OUT_DIR, 'P5_REPORT.json'), JSON.stringify(result, null, 2));

console.log("Robustness Stage Status:", robustnessStage?.status);
console.log("Robustness Stage Reason:", robustnessStage?.reason);

if (robustnessStage?.status !== 'PASS' && robustnessStage?.status !== 'FAIL') {
  console.error("❌ Phase 5 Acceptance Failed: Stage did not run properly (Got PENDING or undefined).");
  process.exit(1);
}

const metrics = robustnessStage.metrics as any;

const requiredMetrics = ['pLoss', 'pRuin', 'medianDrawdown', 'worstDrawdown95', 'seedUsed'];
for (const req of requiredMetrics) {
    if (metrics[req] === undefined || isNaN(metrics[req])) {
       console.error(`❌ Missing or NaN MC metric: ${req}`);
       process.exit(1);
    }
}

console.log("✅ Phase 5 Acceptance: Monte Carlo Metrics correctly generated via Bootstrap Simulation.");
console.log(`P(Loss): ${metrics.pLoss.toFixed(1)}%, P(Ruin): ${metrics.pRuin.toFixed(1)}%`);
console.log(`Median DD: ${metrics.medianDrawdown.toFixed(1)}%, 95% Worst DD: ${metrics.worstDrawdown95.toFixed(1)}%`);
console.log(`Seed: ${metrics.seedUsed}`);

