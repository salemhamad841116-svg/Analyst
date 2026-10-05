import * as fs from 'fs';

const path = 'src/engine/analysis/pipeline/analysisPipeline.ts';
let code = fs.readFileSync(path, 'utf8');

// Add import
const imports = `import { runMonteCarloSimulation } from '../risk/montecarlo';\n`;
code = code.replace("import { calculatePerformanceMetrics }", imports + "import { calculatePerformanceMetrics }");

// Replace Phase 12 block with Phase 12 + Phase 13
const oldBlock = `           // Remaining Stage 13
           pendingRest(12, 'NOT_IMPLEMENTED_IN_PHASE_4 — scheduled for a later phase');
        }
      } catch (e: any) {
        record('RISK_PERFORMANCE', 'FAIL', \`Runtime Exception: \${e.message}\`, {}, tS, 'BLOCKED_RISK_CALC_FAILURE');
        pendingRest(12, 'Not executed: Risk calculation failed');
      }`;

const newBlock = `           // ------------------------------------------------------------------ Stage 13: Robustness / Sensitivity (Monte Carlo)
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
           }

        }
      } catch (e: any) {
        record('RISK_PERFORMANCE', 'FAIL', \`Runtime Exception: \${e.message}\`, {}, tS, 'BLOCKED_RISK_CALC_FAILURE');
        pendingRest(12, 'Not executed: Risk calculation failed');
      }`;

code = code.replace(oldBlock, newBlock);

fs.writeFileSync(path, code, 'utf8');
