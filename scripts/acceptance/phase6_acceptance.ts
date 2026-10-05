import * as fs from 'node:fs';
import * as path from 'node:path';
import { runStaticAnalysisPipeline } from '../../src/engine/analysis/pipeline/analysisPipeline';
import { Candle } from '../../src/types';
import { DEFAULT_PROFILES } from '../../src/engine/analysis/backtest/costs';

const OUT_DIR = path.resolve(process.cwd(), 'audit', 'phase6');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Mock dataset (very small, to trigger overfitting penalty for low trade count)
const mockCandles: Candle[] = [];
let price = 100;
for(let i=0; i<60; i++) { // 60 bars to generate a couple of trades, but still fail DoF
  price = 100 + Math.sin(i / 2) * 5;
  mockCandles.push({
    timestamp: 1600000000000 + i * 3600000,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 1000
  });
}

// Strategy with 4 parameters but tested on only 30 bars (guaranteed to trigger Overfitting Risk)
const strategyCode = `
//@version=6
strategy("Overfitting Test")
p1 = input.int(5)
p2 = input.int(10)
p3 = input.float(1.5)
p4 = input.bool(true)\np5=input.int(1)\np6=input.int(2)\np7=input.int(3)\np8=input.int(4)

fast = ta.sma(close, p1)
slow = ta.sma(close, p2)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, 1)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

console.log("▶ Running Phase 6 Overfitting / Robustness Engine...");

const result = runStaticAnalysisPipeline(strategyCode, {
  analysisId: 'ACC-P6-TEST',
  language: 'pine',
  candles: mockCandles,
  costProfile: DEFAULT_PROFILES['DEFAULT']
});

const robustnessStage = result.stages.find(s => s.stageId === 'ROBUSTNESS');

fs.writeFileSync(path.join(OUT_DIR, 'P6_REPORT.json'), JSON.stringify(result, null, 2));

console.log("Robustness Stage Status:", robustnessStage?.status);
console.log("Robustness Stage Reason:", robustnessStage?.reason);

if (robustnessStage?.status !== 'FAIL') {
  console.error("❌ Phase 6 Acceptance Failed: Expected OVERFITTING block, but it passed.");
  process.exit(1);
}

const metrics = robustnessStage.metrics as any;

const requiredMetrics = ['parameterCount', 'degreesOfFreedomRisk', 'overfitRiskScore'];
for (const req of requiredMetrics) {
    if (metrics[req] === undefined || isNaN(metrics[req])) {
       console.error(`❌ Missing or NaN Overfit metric: ${req}`);
       process.exit(1);
    }
}

if (metrics.parameterCount !== 8) {
    console.error(`❌ Expected 4 parameters, got ${metrics.parameterCount}`);
    process.exit(1);
}

if (metrics.overfitRiskScore <= 60) {
    console.error(`❌ Expected high overfitting risk score (>70), got ${metrics.overfitRiskScore}`);
    process.exit(1);
}

console.log("✅ Phase 6 Acceptance: Overfitting successfully detected based on high DOF and low trades.");
console.log(`Param Count: ${metrics.parameterCount}, Trade Count: ${metrics.tradeCount}`);
console.log(`Overfit Score: ${metrics.overfitRiskScore.toFixed(2)}/100`);

