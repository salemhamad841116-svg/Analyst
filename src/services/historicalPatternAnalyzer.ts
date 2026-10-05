import { BarExecutionTrace } from '../types';

export interface PatternAnalysisParams {
  sourceCondition: string; // e.g. "touch_R3" or "close_above_R3"
  targetCondition: string; // e.g. "touch_S1" or "close_below_S1"
  maxDurationBars: number; // e.g. 12 bars (1 hour on 5min)
}

export interface PatternAnalysisResult {
  totalOccurrences: number;
  successfulOccurrences: number;
  failedOccurrences: number;
  successRatePct: number;
  averageDurationBars: number;
  totalBarsEvaluated: number;
  samples: Array<{
    sourceTimeStr: string;
    targetTimeStr?: string;
    success: boolean;
    durationBars: number;
  }>;
}

// Simple parser for conditions like "touch_R3"
function evaluateCondition(trace: BarExecutionTrace, condition: string): boolean {
  const vars = trace.variables;
  const high = trace.high;
  const low = trace.low;
  const close = trace.close;

  // Very naive parser for demo/POC. In reality, you'd parse expressions safely.
  if (condition.includes('touch_R3') || condition.includes('touch R3')) {
    const r3 = vars['r3'] as number;
    return r3 !== undefined && high >= r3;
  }
  if (condition.includes('touch_S1') || condition.includes('touch S1')) {
    const s1 = vars['s1'] as number;
    return s1 !== undefined && low <= s1;
  }
  if (condition.includes('touch_R1') || condition.includes('touch R1')) {
    const r1 = vars['r1'] as number;
    return r1 !== undefined && high >= r1;
  }
  if (condition.includes('touch_S3') || condition.includes('touch S3')) {
    const s3 = vars['s3'] as number;
    return s3 !== undefined && low <= s3;
  }

  // Fallback
  return false;
}

export function analyzeHistoricalPattern(
  barTraces: BarExecutionTrace[],
  params: PatternAnalysisParams
): PatternAnalysisResult {
  let totalOccurrences = 0;
  let successfulOccurrences = 0;
  let failedOccurrences = 0;
  let totalDurationBars = 0;

  const samples: PatternAnalysisResult['samples'] = [];

  for (let i = 0; i < barTraces.length; i++) {
    const trace = barTraces[i];
    
    // Does it hit the source condition?
    if (evaluateCondition(trace, params.sourceCondition)) {
      totalOccurrences++;
      
      let success = false;
      let duration = 0;
      let targetTimeStr = undefined;

      // Look forward maxDurationBars
      for (let j = 1; j <= params.maxDurationBars && i + j < barTraces.length; j++) {
        const futureTrace = barTraces[i + j];
        if (evaluateCondition(futureTrace, params.targetCondition)) {
          success = true;
          duration = j;
          targetTimeStr = futureTrace.timeFormatted;
          break;
        }
      }

      if (success) {
        successfulOccurrences++;
        totalDurationBars += duration;
      } else {
        failedOccurrences++;
        duration = params.maxDurationBars;
      }

      // Record sample (keep last 100 for memory)
      if (samples.length < 100) {
        samples.push({
          sourceTimeStr: trace.timeFormatted,
          targetTimeStr,
          success,
          durationBars: duration
        });
      }
    }
  }

  const successRatePct = totalOccurrences > 0 
    ? Math.round((successfulOccurrences / totalOccurrences) * 100) 
    : 0;
  
  const averageDurationBars = successfulOccurrences > 0 
    ? Math.round(totalDurationBars / successfulOccurrences) 
    : 0;

  return {
    totalOccurrences,
    successfulOccurrences,
    failedOccurrences,
    successRatePct,
    averageDurationBars,
    totalBarsEvaluated: barTraces.length,
    samples
  };
}
