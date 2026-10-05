/**
 * Phase 10 — Robustness Score Engine (0–100)
 * Combines all previous phase results into a single composite score.
 */

import { PerformanceMetrics } from './performance';
import { MonteCarloResult } from './montecarlo';
import { OverfittingReport } from './overfitting';
import { WalkForwardResult } from './walkforward';
import { RegimeReport } from './regimeDetector';
import { MultiStrategyReport } from './multiStrategy';

export interface RobustnessScoreBreakdown {
  backtestScore: number;        // 0-20
  riskScore: number;            // 0-20
  monteCarloScore: number;      // 0-15
  overfittingScore: number;     // 0-15
  walkForwardScore: number;     // 0-15
  regimeScore: number;          // 0-10
  signalQualityScore: number;   // 0-5
  totalScore: number;           // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
}

export function computeRobustnessScore(inputs: {
  tradeCount: number;
  performance?: PerformanceMetrics;
  monteCarlo?: MonteCarloResult;
  overfitting?: OverfittingReport;
  walkForward?: WalkForwardResult;
  regime?: RegimeReport;
  multiStrategy?: MultiStrategyReport;
}): RobustnessScoreBreakdown {
  let backtestScore = 0;
  let riskScore = 0;
  let monteCarloScore = 0;
  let overfittingScore = 0;
  let walkForwardScore = 0;
  let regimeScore = 0;
  let signalQualityScore = 0;

  // ── 1. Backtest Score (0-20) ──
  if (inputs.tradeCount > 0) {
    backtestScore += 5; // Strategy produces trades
    if (inputs.tradeCount >= 30) backtestScore += 5;
    else if (inputs.tradeCount >= 10) backtestScore += 3;

    if (inputs.performance) {
      if (inputs.performance.totalNetPnL > 0) backtestScore += 5;
      if (inputs.performance.profitFactor > 1.5) backtestScore += 5;
      else if (inputs.performance.profitFactor > 1.0) backtestScore += 3;
    }
  }

  // ── 2. Risk Score (0-20) ──
  if (inputs.performance) {
    const p = inputs.performance;
    if (p.winRate > 55) riskScore += 5;
    else if (p.winRate > 45) riskScore += 3;

    if (p.maxDrawdownPct < 10) riskScore += 5;
    else if (p.maxDrawdownPct < 25) riskScore += 3;
    else if (p.maxDrawdownPct < 50) riskScore += 1;

    if (p.sharpeRatio > 1.5) riskScore += 5;
    else if (p.sharpeRatio > 0.5) riskScore += 3;
    else if (p.sharpeRatio > 0) riskScore += 1;

    if (p.sortinoRatio > 2) riskScore += 5;
    else if (p.sortinoRatio > 1) riskScore += 3;
    else if (p.sortinoRatio > 0) riskScore += 1;
  }

  // ── 3. Monte Carlo Score (0-15) ──
  if (inputs.monteCarlo) {
    const mc = inputs.monteCarlo;
    if (mc.pRuin === 0) monteCarloScore += 5;
    else if (mc.pRuin < 5) monteCarloScore += 3;
    else if (mc.pRuin < 10) monteCarloScore += 1;

    if (mc.worstDrawdown95 < 15) monteCarloScore += 5;
    else if (mc.worstDrawdown95 < 30) monteCarloScore += 3;
    else if (mc.worstDrawdown95 < 50) monteCarloScore += 1;

    if (mc.pLoss < 10) monteCarloScore += 5;
    else if (mc.pLoss < 30) monteCarloScore += 3;
    else if (mc.pLoss < 50) monteCarloScore += 1;
  }

  // ── 4. Overfitting Score (0-15) ──
  if (inputs.overfitting) {
    const of_ = inputs.overfitting;
    const invScore = 100 - of_.overfitRiskScore; // Invert: low overfit = good
    overfittingScore = Math.round((invScore / 100) * 15);
  }

  // ── 5. Walk-Forward Score (0-15) ──
  if (inputs.walkForward) {
    const wf = inputs.walkForward;
    if (wf.status === 'PASS') {
      walkForwardScore += 8;
      if (wf.averageDegradation < 0.3) walkForwardScore += 7;
      else if (wf.averageDegradation < 0.5) walkForwardScore += 4;
      else walkForwardScore += 2;
    } else if (wf.folds.length > 0) {
      walkForwardScore += 3; // At least it ran
    }
  }

  // ── 6. Regime Score (0-10) ──
  if (inputs.regime) {
    regimeScore = Math.round(inputs.regime.regimeStabilityScore * 10);
  }

  // ── 7. Signal Quality Score (0-5) ──
  if (inputs.multiStrategy) {
    signalQualityScore = Math.round((inputs.multiStrategy.signalQualityScore / 100) * 5);
  }

  const totalScore = Math.min(100, backtestScore + riskScore + monteCarloScore +
    overfittingScore + walkForwardScore + regimeScore + signalQualityScore);

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let summary: string;

  if (totalScore >= 80) {
    grade = 'A';
    summary = 'Institutional Grade: Strategy demonstrates strong risk-adjusted returns, robust OOS performance, and stable regime behavior.';
  } else if (totalScore >= 65) {
    grade = 'B';
    summary = 'Production Ready: Strategy shows acceptable performance but may have minor weaknesses in some dimensions.';
  } else if (totalScore >= 50) {
    grade = 'C';
    summary = 'Needs Improvement: Strategy has significant gaps — review overfitting, drawdown, or regime sensitivity.';
  } else if (totalScore >= 35) {
    grade = 'D';
    summary = 'High Risk: Strategy fails multiple robustness checks. Not recommended for live deployment.';
  } else {
    grade = 'F';
    summary = 'Critical Failure: Strategy is likely overfitted, produces excessive drawdowns, or has insufficient trade history.';
  }

  return {
    backtestScore,
    riskScore,
    monteCarloScore,
    overfittingScore,
    walkForwardScore,
    regimeScore,
    signalQualityScore,
    totalScore,
    grade,
    summary
  };
}
