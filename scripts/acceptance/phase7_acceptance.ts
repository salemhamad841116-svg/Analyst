import * as fs from 'node:fs';
import * as path from 'node:path';
import { runStaticAnalysisPipeline } from '../../src/engine/analysis/pipeline/analysisPipeline';
import { Candle } from '../../src/types';
import { DEFAULT_PROFILES } from '../../src/engine/analysis/backtest/costs';

const OUT_DIR = path.resolve(process.cwd(), 'audit', 'phase7');
fs.mkdirSync(OUT_DIR, { recursive: true });

const mockCandles: Candle[] = [];
for (let i = 0; i < 300; i++) {
  const price = 100 + Math.sin(i / 5) * 10;
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
strategy("Walk-Forward Test")
fast_len = input.int(5)
slow_len = input.int(10)
fast = ta.sma(close, fast_len)
slow = ta.sma(close, slow_len)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, 1)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

console.log("▶ Running Phase 7 Walk-Forward Optimization Engine...");

const result = runStaticAnalysisPipeline(strategyCode, {
  analysisId: 'ACC-P7-TEST',
  language: 'pine',
  candles: mockCandles,
  costProfile: DEFAULT_PROFILES['DEFAULT']
});

const wfStage = result.stages.find(s => s.stageId === 'OOS_WALK_FORWARD');

fs.writeFileSync(path.join(OUT_DIR, 'P7_REPORT.json'), JSON.stringify(result, null, 2));

console.log("Walk-Forward Stage Status:", wfStage?.status);
console.log("Walk-Forward Stage Reason:", wfStage?.reason);

if (!wfStage || wfStage.status === 'PENDING') {
  console.error("❌ Phase 7 Acceptance Failed: Stage did not execute.");
  process.exit(1);
}

const metrics = wfStage.metrics as any;

const required = ['folds', 'avgTrainMetric', 'avgOosMetric', 'avgDegradation', 'objectiveMetric'];
for (const r of required) {
  if (metrics[r] === undefined) {
    console.error("❌ Missing WF metric: " + r);
    process.exit(1);
  }
}

if (metrics.folds < 1) {
  console.error("❌ No folds were computed");
  process.exit(1);
}

if (metrics.dataLeakageDetected) {
  console.log("⚠️ Data leakage correctly flagged by the engine.");
}

console.log("✅ Phase 7 Acceptance: Walk-Forward Optimization executed correctly.");
console.log("Folds: " + metrics.folds + ", Avg Train: " + metrics.avgTrainMetric.toFixed(2) + ", Avg OOS: " + metrics.avgOosMetric.toFixed(2));
console.log("Avg Degradation: " + (metrics.avgDegradation * 100).toFixed(1) + "%, Best Params: " + JSON.stringify(metrics.bestParams));
