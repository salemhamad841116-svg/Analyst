import * as fs from 'node:fs';
import * as path from 'node:path';
import { runStaticAnalysisPipeline } from '../../src/engine/analysis/pipeline/analysisPipeline';
import { Candle } from '../../src/types';
import { DEFAULT_PROFILES } from '../../src/engine/analysis/backtest/costs';

const OUT_DIR = path.resolve(process.cwd(), 'audit', 'phases8-13');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Generate 300 bars of mixed-regime data
const mockCandles: Candle[] = [];
for (let i = 0; i < 300; i++) {
  // Mix trending + volatile + ranging segments
  let price: number;
  if (i < 100) {
    price = 100 + i * 0.2 + Math.sin(i / 3) * 2; // Trending up
  } else if (i < 200) {
    price = 120 + Math.sin(i / 5) * 8; // Ranging with high vol
  } else {
    price = 120 - (i - 200) * 0.1 + Math.sin(i / 4) * 3; // Trending down
  }
  mockCandles.push({
    timestamp: 1600000000000 + i * 3600000,
    open: price,
    high: price + 1.5,
    low: price - 1.5,
    close: price + (Math.random() > 0.5 ? 0.5 : -0.5),
    volume: 1000 + Math.random() * 500
  });
}

const strategyCode = `
//@version=6
strategy("Full Pipeline Test")
fast_len = input.int(5)
slow_len = input.int(10)
fast = ta.sma(close, fast_len)
slow = ta.sma(close, slow_len)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, 1)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

console.log("▶ Running Phases 8, 9, 10, 13 — Full Pipeline Test...\n");

const result = runStaticAnalysisPipeline(strategyCode, {
  analysisId: 'ACC-P8-13-TEST',
  language: 'pine',
  candles: mockCandles,
  costProfile: DEFAULT_PROFILES['DEFAULT']
});

fs.writeFileSync(path.join(OUT_DIR, 'FULL_REPORT.json'), JSON.stringify(result, null, 2));

let passed = 0;
let total = 0;

// ── Check Phase 8: Regime Detection ──
total++;
const robustnessStage = result.stages.find(s => s.stageId === 'ROBUSTNESS');
const robMetrics = robustnessStage?.metrics as any;

if (robMetrics?.regime?.dominant) {
  console.log("✅ Phase 8 (Regime Detection): Dominant regime = " + robMetrics.regime.dominant);
  console.log("   Worst regime = " + robMetrics.regime.worst);
  console.log("   Stability = " + (robMetrics.regime.stability * 100).toFixed(0) + "%");
  console.log("   Per-regime performance entries = " + robMetrics.regime.performance.length);
  passed++;
} else {
  console.log("❌ Phase 8 (Regime Detection): Missing regime data in robustness metrics");
}

// ── Check Phase 9: Multi-Strategy Analysis ──
total++;
if (robMetrics?.multiStrategy?.signalQualityScore !== undefined) {
  console.log("\n✅ Phase 9 (Multi-Strategy): Signal Quality = " + robMetrics.multiStrategy.signalQualityScore.toFixed(0) + "/100");
  console.log("   Long Exposure = " + robMetrics.multiStrategy.longExposurePct.toFixed(1) + "%");
  console.log("   Max Consecutive Wins = " + robMetrics.multiStrategy.maxConsecutiveWins);
  console.log("   Max Consecutive Losses = " + robMetrics.multiStrategy.maxConsecutiveLosses);
  passed++;
} else {
  console.log("\n❌ Phase 9 (Multi-Strategy): Missing multiStrategy data");
}

// ── Check Phase 10: Robustness Score ──
total++;
if (robMetrics?.robustnessScore?.total !== undefined && robMetrics?.robustnessScore?.grade) {
  console.log("\n✅ Phase 10 (Robustness Score): " + robMetrics.robustnessScore.total + "/100 (Grade " + robMetrics.robustnessScore.grade + ")");
  const bd = robMetrics.robustnessScore.breakdown;
  console.log("   Breakdown: Backtest=" + bd.backtest + "/20, Risk=" + bd.risk + "/20, MC=" + bd.monteCarlo + "/15, Overfit=" + bd.overfitting + "/15, WF=" + bd.walkForward + "/15, Regime=" + bd.regime + "/10, Signal=" + bd.signalQuality + "/5");
  passed++;
} else {
  console.log("\n❌ Phase 10 (Robustness Score): Missing robustness score data");
}

// ── Check Phase 13: LLM Explanation ──
total++;
if (robMetrics?.explanation?.verdict && robMetrics?.explanation?.sectionsAr?.length > 0) {
  console.log("\n✅ Phase 13 (LLM Explanation):");
  console.log("   Verdict: " + robMetrics.explanation.verdict);
  console.log("   Verdict (AR): " + robMetrics.explanation.verdictAr);
  console.log("   English sections: " + robMetrics.explanation.sectionsEn.length);
  console.log("   Arabic sections: " + robMetrics.explanation.sectionsAr.length);
  console.log("   Recommendations: " + robMetrics.explanation.recommendations.length);
  passed++;
} else {
  console.log("\n❌ Phase 13 (LLM Explanation): Missing explanation data");
}

console.log("\n" + "═".repeat(60));
console.log("RESULT: " + passed + "/" + total + " phases passed.");

if (passed < total) {
  console.error("❌ Some phases failed acceptance.");
  process.exit(1);
}

console.log("✅ ALL PHASES (8, 9, 10, 13) ACCEPTANCE PASSED.");
