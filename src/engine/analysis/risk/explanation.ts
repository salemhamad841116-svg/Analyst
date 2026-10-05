/**
 * Phase 13 — LLM Explanation Engine
 * Generates a human-readable, structured explanation of the strategy analysis.
 * Does NOT change PASS/FAIL results — purely informational.
 */

import { PerformanceMetrics } from './performance';
import { RobustnessScoreBreakdown } from './robustnessScore';
import { RegimeReport } from './regimeDetector';
import { MultiStrategyReport } from './multiStrategy';
import { OverfittingReport } from './overfitting';

export interface StrategyExplanation {
  titleAr: string;
  titleEn: string;
  sectionsAr: string[];
  sectionsEn: string[];
  verdict: string;
  verdictAr: string;
  recommendations: string[];
  recommendationsAr: string[];
}

export function generateExplanation(inputs: {
  strategyName?: string;
  classification?: string;
  tradeCount: number;
  performance?: PerformanceMetrics;
  robustness?: RobustnessScoreBreakdown;
  regime?: RegimeReport;
  multiStrategy?: MultiStrategyReport;
  overfitting?: OverfittingReport;
}): StrategyExplanation {
  const name = inputs.strategyName || 'Unnamed Strategy';
  const sectionsEn: string[] = [];
  const sectionsAr: string[] = [];
  const recommendations: string[] = [];
  const recommendationsAr: string[] = [];

  // ── Section 1: Overview ──
  sectionsEn.push(
    `Strategy "${name}" was analyzed through a 14-stage institutional-grade pipeline. ` +
    `Classification: ${inputs.classification || 'Unknown'}. ` +
    `Total trades executed: ${inputs.tradeCount}.`
  );
  sectionsAr.push(
    `تم تحليل الاستراتيجية "${name}" عبر خط أنابيب مؤسسي من 14 مرحلة. ` +
    `التصنيف: ${inputs.classification || 'غير محدد'}. ` +
    `إجمالي الصفقات المنفذة: ${inputs.tradeCount}.`
  );

  // ── Section 2: Performance ──
  if (inputs.performance) {
    const p = inputs.performance;
    sectionsEn.push(
      `Performance: Win Rate ${p.winRate.toFixed(1)}%, Profit Factor ${p.profitFactor.toFixed(2)}, ` +
      `Max Drawdown ${p.maxDrawdownPct.toFixed(1)}%, Sharpe ${p.sharpeRatio.toFixed(2)}, ` +
      `Sortino ${p.sortinoRatio.toFixed(2)}. Net PnL: ${p.totalNetPnL.toFixed(2)}.`
    );
    sectionsAr.push(
      `الأداء: نسبة النجاح ${p.winRate.toFixed(1)}%، عامل الربح ${p.profitFactor.toFixed(2)}، ` +
      `أقصى تراجع ${p.maxDrawdownPct.toFixed(1)}%، شارب ${p.sharpeRatio.toFixed(2)}، ` +
      `سورتينو ${p.sortinoRatio.toFixed(2)}. صافي الربح: ${p.totalNetPnL.toFixed(2)}.`
    );

    if (p.maxDrawdownPct > 25) {
      recommendations.push('Reduce position size or add stop-loss logic to limit drawdowns below 25%.');
      recommendationsAr.push('قلل حجم المركز أو أضف وقف خسارة للحد من التراجع تحت 25%.');
    }
    if (p.winRate < 40) {
      recommendations.push('Win rate is below 40%. Consider tightening entry conditions or adding confirmation filters.');
      recommendationsAr.push('نسبة النجاح أقل من 40%. يُفضل تشديد شروط الدخول أو إضافة فلاتر تأكيد.');
    }
  }

  // ── Section 3: Robustness ──
  if (inputs.robustness) {
    const r = inputs.robustness;
    sectionsEn.push(
      `Robustness Score: ${r.totalScore}/100 (Grade: ${r.grade}). ${r.summary}`
    );
    sectionsAr.push(
      `نقاط المتانة: ${r.totalScore}/100 (الدرجة: ${r.grade}). ${r.summary}`
    );

    if (r.totalScore < 50) {
      recommendations.push('Strategy fails robustness checks. Do NOT deploy to live trading without fundamental improvements.');
      recommendationsAr.push('الاستراتيجية فشلت في اختبارات المتانة. لا تُنشر في التداول الحي بدون تحسينات جذرية.');
    }
  }

  // ── Section 4: Overfitting ──
  if (inputs.overfitting) {
    const o = inputs.overfitting;
    sectionsEn.push(
      `Overfitting Risk Score: ${o.overfitRiskScore.toFixed(0)}/100. ` +
      `Parameters: ${o.parameterCount}, Trades: ${o.tradeCount}. ` +
      `Time Stability: ${(o.timeStabilityScore * 100).toFixed(0)}%.`
    );
    sectionsAr.push(
      `نقاط خطر الإفراط في الملاءمة: ${o.overfitRiskScore.toFixed(0)}/100. ` +
      `عدد الإعدادات: ${o.parameterCount}، الصفقات: ${o.tradeCount}. ` +
      `الاستقرار الزمني: ${(o.timeStabilityScore * 100).toFixed(0)}%.`
    );

    if (o.overfitRiskScore > 60) {
      recommendations.push('High overfitting risk. Reduce the number of optimizable parameters or increase the dataset size.');
      recommendationsAr.push('خطر عالٍ من الإفراط في الملاءمة. قلل عدد الإعدادات القابلة للتحسين أو زِد حجم البيانات.');
    }
  }

  // ── Section 5: Regime ──
  if (inputs.regime) {
    const rg = inputs.regime;
    sectionsEn.push(
      `Dominant Market Regime: ${rg.dominantRegime}. ` +
      `Worst Performing Regime: ${rg.worstRegime || 'N/A'}. ` +
      `Regime Stability: ${(rg.regimeStabilityScore * 100).toFixed(0)}%.`
    );
    sectionsAr.push(
      `النظام السائد للسوق: ${rg.dominantRegime}. ` +
      `أسوأ نظام أداءً: ${rg.worstRegime || 'غير متوفر'}. ` +
      `استقرار الأنظمة: ${(rg.regimeStabilityScore * 100).toFixed(0)}%.`
    );
  }

  // ── Section 6: Signal Quality ──
  if (inputs.multiStrategy) {
    const ms = inputs.multiStrategy;
    sectionsEn.push(
      `Signal Quality Score: ${ms.signalQualityScore.toFixed(0)}/100. ` +
      `Max Consecutive Wins: ${ms.maxConsecutiveWins}, Losses: ${ms.maxConsecutiveLosses}. ` +
      `Trade Frequency: ${ms.tradeFrequency.toFixed(1)} per 100 bars.`
    );
    sectionsAr.push(
      `نقاط جودة الإشارة: ${ms.signalQualityScore.toFixed(0)}/100. ` +
      `أقصى سلسلة انتصارات: ${ms.maxConsecutiveWins}، خسائر: ${ms.maxConsecutiveLosses}. ` +
      `تكرار التداول: ${ms.tradeFrequency.toFixed(1)} لكل 100 شمعة.`
    );
  }

  // ── Verdict ──
  const grade = inputs.robustness?.grade || 'F';
  let verdict: string;
  let verdictAr: string;

  if (grade === 'A') {
    verdict = 'APPROVED FOR LIVE DEPLOYMENT — Strategy passes all institutional checks.';
    verdictAr = 'مُعتمد للنشر الحي — الاستراتيجية اجتازت جميع الاختبارات المؤسسية.';
  } else if (grade === 'B') {
    verdict = 'CONDITIONALLY APPROVED — Minor weaknesses detected. Monitor closely.';
    verdictAr = 'معتمد بشروط — تم اكتشاف نقاط ضعف طفيفة. يُراقب عن كثب.';
  } else if (grade === 'C') {
    verdict = 'NEEDS WORK — Strategy has significant issues. Do not deploy without fixes.';
    verdictAr = 'يحتاج تحسين — الاستراتيجية بها مشاكل جوهرية. لا تُنشر بدون إصلاحات.';
  } else {
    verdict = 'REJECTED — Strategy fails institutional-grade robustness requirements.';
    verdictAr = 'مرفوض — الاستراتيجية فشلت في متطلبات المتانة المؤسسية.';
  }

  return {
    titleEn: `Analysis Report: ${name}`,
    titleAr: `تقرير التحليل: ${name}`,
    sectionsEn,
    sectionsAr,
    verdict,
    verdictAr,
    recommendations,
    recommendationsAr
  };
}
