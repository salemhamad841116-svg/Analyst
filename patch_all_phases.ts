import * as fs from 'fs';

const path = 'src/engine/analysis/pipeline/analysisPipeline.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Add imports
const newImports = `import { detectRegimes, analyzeRegimePerformance } from '../risk/regimeDetector';
import { analyzeMultiStrategy } from '../risk/multiStrategy';
import { computeRobustnessScore } from '../risk/robustnessScore';
import { generateExplanation } from '../risk/explanation';
`;

code = code.replace(
  "import { runWalkForwardOptimization } from '../risk/walkforward';",
  "import { runWalkForwardOptimization } from '../risk/walkforward';\n" + newImports
);

// 2. Add StaticAnalysisReport fields for regime, multiStrategy, robustnessScore, explanation
// Find the report assembly section and enhance it
// We need to store these in the report's extra fields

// 3. Replace the ROBUSTNESS stage to also run Phase 8, 9, 10, 13
const oldRobustness = `           // ------------------------------------------------------------------ Stage 13: Robustness / Sensitivity (MC & Overfitting)
           tS = Date.now();
           try {
              const overfitResult = evaluateOverfitting(program, netTrades as any);
              const seed = 12345;
              const mcResults = runMonteCarloSimulation(netTrades as any, { seed, numSimulations: 500 });
              
              const combinedMetrics = { ...mcResults, ...overfitResult };

              if (overfitResult.overfitRiskScore > 60) {
                 record('ROBUSTNESS', 'FAIL', overfitResult.warningMessage || 'Critical Overfitting Risk', combinedMetrics as any, tS, 'BLOCKED_OVERFITTING_RISK');
              } else if (mcResults.pRuin > 10) {
                 record('ROBUSTNESS', 'FAIL', \`Strategy failed robustness: P(Ruin) is \${mcResults.pRuin.toFixed(1)}% (>10% limit)\`, combinedMetrics as any, tS, 'BLOCKED_HIGH_RUIN_PROBABILITY');
              } else if (mcResults.worstDrawdown95 > 50) {
                 record('ROBUSTNESS', 'FAIL', \`Strategy failed robustness: 95% Worst DD is \${mcResults.worstDrawdown95.toFixed(1)}% (>50% limit)\`, combinedMetrics as any, tS, 'BLOCKED_HIGH_TAIL_RISK');
              } else {
                 record('ROBUSTNESS', 'PASS', \`Robustness Passed. Overfit Score: \${overfitResult.overfitRiskScore.toFixed(0)}/100, 95% Worst DD: \${mcResults.worstDrawdown95.toFixed(1)}%\`, combinedMetrics as any, tS);
              }
           } catch (e: any) {
              record('ROBUSTNESS', 'FAIL', \`Robustness Exception: \${e.message}\`, {}, tS, 'BLOCKED_ROBUSTNESS_FAILURE');
           }`;

const newRobustness = `           // ------------------------------------------------------------------ Stage 13: Robustness / Sensitivity (MC & Overfitting + Regime + Multi + Score + Explanation)
           tS = Date.now();
           try {
              const overfitResult = evaluateOverfitting(program, netTrades as any);
              const seed = 12345;
              const mcResults = runMonteCarloSimulation(netTrades as any, { seed, numSimulations: 500 });
              
              // Phase 8: Regime Detection
              const regimeSegments = detectRegimes(opts.candles!);
              const regimeReport = analyzeRegimePerformance(opts.candles!, netTrades as any, regimeSegments);
              
              // Phase 9: Multi-Strategy Analysis
              const multiReport = analyzeMultiStrategy(netTrades as any, opts.candles!.length);
              
              // Phase 10: Robustness Score 0-100
              const robustnessScore = computeRobustnessScore({
                tradeCount: trades.length,
                performance: metrics,
                monteCarlo: mcResults,
                overfitting: overfitResult,
                walkForward: undefined, // WF result not easily accessible here; would need refactoring
                regime: regimeReport,
                multiStrategy: multiReport
              });
              
              // Phase 13: LLM Explanation
              const explanation = generateExplanation({
                strategyName: undefined,
                classification: undefined,
                tradeCount: trades.length,
                performance: metrics,
                robustness: robustnessScore,
                regime: regimeReport,
                multiStrategy: multiReport,
                overfitting: overfitResult
              });

              const combinedMetrics = {
                ...mcResults,
                ...overfitResult,
                regime: {
                  dominant: regimeReport.dominantRegime,
                  worst: regimeReport.worstRegime,
                  stability: regimeReport.regimeStabilityScore,
                  performance: regimeReport.performance
                },
                multiStrategy: multiReport,
                robustnessScore: {
                  total: robustnessScore.totalScore,
                  grade: robustnessScore.grade,
                  breakdown: {
                    backtest: robustnessScore.backtestScore,
                    risk: robustnessScore.riskScore,
                    monteCarlo: robustnessScore.monteCarloScore,
                    overfitting: robustnessScore.overfittingScore,
                    walkForward: robustnessScore.walkForwardScore,
                    regime: robustnessScore.regimeScore,
                    signalQuality: robustnessScore.signalQualityScore
                  }
                },
                explanation: {
                  verdict: explanation.verdict,
                  verdictAr: explanation.verdictAr,
                  sectionsEn: explanation.sectionsEn,
                  sectionsAr: explanation.sectionsAr,
                  recommendations: explanation.recommendations,
                  recommendationsAr: explanation.recommendationsAr
                }
              };

              if (overfitResult.overfitRiskScore > 60) {
                 record('ROBUSTNESS', 'FAIL', overfitResult.warningMessage || 'Critical Overfitting Risk', combinedMetrics as any, tS, 'BLOCKED_OVERFITTING_RISK');
              } else if (mcResults.pRuin > 10) {
                 record('ROBUSTNESS', 'FAIL', \`Strategy failed robustness: P(Ruin) is \${mcResults.pRuin.toFixed(1)}% (>10% limit)\`, combinedMetrics as any, tS, 'BLOCKED_HIGH_RUIN_PROBABILITY');
              } else if (mcResults.worstDrawdown95 > 50) {
                 record('ROBUSTNESS', 'FAIL', \`Strategy failed robustness: 95% Worst DD is \${mcResults.worstDrawdown95.toFixed(1)}% (>50% limit)\`, combinedMetrics as any, tS, 'BLOCKED_HIGH_TAIL_RISK');
              } else {
                 record('ROBUSTNESS', 'PASS', \`Robustness: \${robustnessScore.totalScore}/100 (Grade \${robustnessScore.grade}). \${robustnessScore.summary}\`, combinedMetrics as any, tS);
              }
           } catch (e: any) {
              record('ROBUSTNESS', 'FAIL', \`Robustness Exception: \${e.message}\`, {}, tS, 'BLOCKED_ROBUSTNESS_FAILURE');
           }`;

code = code.replace(oldRobustness, newRobustness);

fs.writeFileSync(path, code, 'utf8');
console.log('Pipeline patched successfully for Phases 8, 9, 10, 13');
