import * as fs from 'fs';

const path = 'src/engine/analysis/pipeline/analysisPipeline.ts';
let code = fs.readFileSync(path, 'utf8');

// Add import
const imports = `import { evaluateOverfitting } from '../risk/overfitting';\n`;
code = code.replace("import { runMonteCarloSimulation }", imports + "import { runMonteCarloSimulation }");

// Enhance Phase 13 block
const oldBlock = `           // ------------------------------------------------------------------ Stage 13: Robustness / Sensitivity (Monte Carlo)
           tS = Date.now();
           try {
              const seed = 12345; // Fixed seed for reproducibility in pipeline
              const mcResults = runMonteCarloSimulation(netTrades as any, { seed, numSimulations: 500 });
              
              if (mcResults.pRuin > 10) {
                 record('ROBUSTNESS', 'FAIL', \`Strategy failed robustness: P(Ruin) is \${mcResults.pRuin.toFixed(1)}% (>10% limit)\`, mcResults as any, tS, 'BLOCKED_HIGH_RUIN_PROBABILITY');
              } else if (mcResults.worstDrawdown95 > 50) {
                 record('ROBUSTNESS', 'FAIL', \`Strategy failed robustness: 95% Worst DD is \${mcResults.worstDrawdown95.toFixed(1)}% (>50% limit)\`, mcResults as any, tS, 'BLOCKED_HIGH_TAIL_RISK');
              } else {
                 record('ROBUSTNESS', 'PASS', \`Monte Carlo (500 runs): P(Loss) \${mcResults.pLoss.toFixed(1)}%, 95% Worst DD: \${mcResults.worstDrawdown95.toFixed(1)}%\`, mcResults as any, tS);
              }
           } catch (e: any) {
              record('ROBUSTNESS', 'FAIL', \`MC Runtime Exception: \${e.message}\`, {}, tS, 'BLOCKED_MONTE_CARLO_FAILURE');
           }`;

const newBlock = `           // ------------------------------------------------------------------ Stage 13: Robustness / Sensitivity (MC & Overfitting)
           tS = Date.now();
           try {
              const overfitResult = evaluateOverfitting(program, netTrades as any);
              const seed = 12345;
              const mcResults = runMonteCarloSimulation(netTrades as any, { seed, numSimulations: 500 });
              
              const combinedMetrics = { ...mcResults, ...overfitResult };

              if (overfitResult.overfitRiskScore > 70) {
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

code = code.replace(oldBlock, newBlock);

fs.writeFileSync(path, code, 'utf8');
