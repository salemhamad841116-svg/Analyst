import { STAGES as ANALYSIS_STAGES } from "../engine/analysis/pipeline/analysisPipeline";

export type GateStatus =
  | "PASS"
  | "FAIL"
  | "PENDING"
  | "BLOCKED";

export interface GateResult {
  id: string;
  status: GateStatus;
  reason: string;
  name: string;
  nameAr: string;
}

export interface VerificationInput {
  primaryProvider?: string | null;
  providerChanges?: number | null;

  expectedBars?: number | null;
  loadedBars?: number | null;
  missingBars?: number | null;
  coveragePercent?: number | null;

  strategyHashMatch?: boolean | null;

  rawFullPrecisionDelta?: number | null;
  invalidParityValues?: number | null;

  groundTruthEvaluated?: boolean;
  groundTruthPass?: boolean | null;

  mismatchMissing?: number | null;
  mismatchExtra?: number | null;
  mismatchDirection?: number | null;
}

const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function buildVerificationGates(input: VerificationInput): GateResult[] {
  const providerAvailable =
    typeof input.primaryProvider === "string" &&
    input.primaryProvider.trim().length > 0 &&
    input.primaryProvider !== "Unavailable";

  const providerGate: GateResult =
    !providerAvailable
      ? {
          id: "PASS_PROVIDER_MATCH",
          name: "Single-Provider Match",
          nameAr: "اتساق المزود الفردي وعدم دمج المصادر",
          status: "FAIL",
          reason: `Primary provider unavailable (received: "${input.primaryProvider ?? 'null'}")`,
        }
      : (input.providerChanges ?? 0) !== 0
      ? {
          id: "PASS_PROVIDER_MATCH",
          name: "Single-Provider Match",
          nameAr: "اتساق المزود الفردي وعدم دمج المصادر",
          status: "FAIL",
          reason: `Provider changes = ${input.providerChanges ?? "unknown"}`,
        }
      : {
          id: "PASS_PROVIDER_MATCH",
          name: "Single-Provider Match",
          nameAr: "اتساق المزود الفردي وعدم دمج المصادر",
          status: "PASS",
          reason: `Provider: ${input.primaryProvider}`,
        };

  const coverageEvaluated =
    validNumber(input.expectedBars) &&
    input.expectedBars > 0 &&
    validNumber(input.loadedBars) &&
    validNumber(input.missingBars) &&
    validNumber(input.coveragePercent);

  const coverageGate: GateResult =
    !coverageEvaluated
      ? {
          id: "PASS_COMPLETE_HISTORICAL_COVERAGE",
          name: "100% Complete Historical Coverage",
          nameAr: "التغطية التاريخية الكاملة 100% وبدون بارات مفقودة",
          status: "BLOCKED",
          reason: `Historical coverage has not been evaluated (expected=${input.expectedBars} loaded=${input.loadedBars} missing=${input.missingBars} coverage=${input.coveragePercent})`,
        }
      : input.coveragePercent! >= 100 &&
        input.missingBars === 0 &&
        input.loadedBars! >= input.expectedBars!
      ? {
          id: "PASS_COMPLETE_HISTORICAL_COVERAGE",
          name: "100% Complete Historical Coverage",
          nameAr: "التغطية التاريخية الكاملة 100% وبدون بارات مفقودة",
          status: "PASS",
          reason: `${input.loadedBars}/${input.expectedBars} bars (${input.coveragePercent}%)`,
        }
      : {
          id: "PASS_COMPLETE_HISTORICAL_COVERAGE",
          name: "100% Complete Historical Coverage",
          nameAr: "التغطية التاريخية الكاملة 100% وبدون بارات مفقودة",
          status: "FAIL",
          reason: `Coverage=${input.coveragePercent}% Loaded=${input.loadedBars}/${input.expectedBars} Missing=${input.missingBars}`,
        };

  const hashGate: GateResult =
    input.strategyHashMatch == null
      ? {
          id: "PASS_STRATEGY_HASH_MATCH",
          name: "Strategy Code Hash Match",
          nameAr: "تطابق بصمة كود الاستراتيجية الحالية SHA-256",
          status: "PENDING",
          reason: "Hash not evaluated",
        }
      : input.strategyHashMatch
      ? {
          id: "PASS_STRATEGY_HASH_MATCH",
          name: "Strategy Code Hash Match",
          nameAr: "تطابق بصمة كود الاستراتيجية الحالية SHA-256",
          status: "PASS",
          reason: "Strategy SHA-256 matches",
        }
      : {
          id: "PASS_STRATEGY_HASH_MATCH",
          name: "Strategy Code Hash Match",
          nameAr: "تطابق بصمة كود الاستراتيجية الحالية SHA-256",
          status: "FAIL",
          reason: "Strategy SHA-256 mismatch",
        };

  const canRunParity = coverageGate.status === "PASS";

  const parityGate: GateResult =
    !canRunParity
      ? {
          id: "PASS_NUMERICAL_PARITY",
          name: "TradingView Numerical Parity",
          nameAr: "التكافؤ الرقمي التام (Zero Numerical Delta)",
          status: "BLOCKED",
          reason: "Historical coverage must pass first",
        }
      : !validNumber(input.rawFullPrecisionDelta) || !validNumber(input.invalidParityValues)
      ? {
          id: "PASS_NUMERICAL_PARITY",
          name: "TradingView Numerical Parity",
          nameAr: "التكافؤ الرقمي التام (Zero Numerical Delta)",
          status: "PENDING",
          reason: "Parity not evaluated",
        }
      : input.rawFullPrecisionDelta === 0 && input.invalidParityValues === 0
      ? {
          id: "PASS_NUMERICAL_PARITY",
          name: "TradingView Numerical Parity",
          nameAr: "التكافؤ الرقمي التام (Zero Numerical Delta)",
          status: "PASS",
          reason: "Raw delta = 0",
        }
      : {
          id: "PASS_NUMERICAL_PARITY",
          name: "TradingView Numerical Parity",
          nameAr: "التكافؤ الرقمي التام (Zero Numerical Delta)",
          status: "FAIL",
          reason: `Raw delta=${input.rawFullPrecisionDelta}, invalid=${input.invalidParityValues}`,
        };

  const groundTruthGate: GateResult =
    parityGate.status !== "PASS"
      ? {
          id: "PASS_GROUND_TRUTH",
          name: "TV Ground-Truth Validation",
          nameAr: "التحقق المرجعي مع TradingView Ground-Truth",
          status: "BLOCKED",
          reason: "Numerical parity must pass first",
        }
      : !input.groundTruthEvaluated
      ? {
          id: "PASS_GROUND_TRUTH",
          name: "TV Ground-Truth Validation",
          nameAr: "التحقق المرجعي مع TradingView Ground-Truth",
          status: "PENDING",
          reason: "Ground truth not evaluated",
        }
      : input.groundTruthPass
      ? {
          id: "PASS_GROUND_TRUTH",
          name: "TV Ground-Truth Validation",
          nameAr: "التحقق المرجعي مع TradingView Ground-Truth",
          status: "PASS",
          reason: "Ground truth verified",
        }
      : {
          id: "PASS_GROUND_TRUTH",
          name: "TV Ground-Truth Validation",
          nameAr: "التحقق المرجعي مع TradingView Ground-Truth",
          status: "FAIL",
          reason: "Ground truth mismatch",
        };

  const mismatchEvaluated =
    groundTruthGate.status === "PASS" &&
    validNumber(input.mismatchMissing) &&
    validNumber(input.mismatchExtra) &&
    validNumber(input.mismatchDirection);

  const mismatchGate: GateResult =
    groundTruthGate.status !== "PASS"
      ? {
          id: "SIGNAL_MISMATCH_COUNT",
          name: "Zero Signal Mismatches",
          nameAr: "صفر فروقات إشارية (SIGNAL_MISMATCH_COUNT = 0)",
          status: "BLOCKED",
          reason: "Ground truth verification is required",
        }
      : !mismatchEvaluated
      ? {
          id: "SIGNAL_MISMATCH_COUNT",
          name: "Zero Signal Mismatches",
          nameAr: "صفر فروقات إشارية (SIGNAL_MISMATCH_COUNT = 0)",
          status: "PENDING",
          reason: "Signal comparison not evaluated",
        }
      : input.mismatchMissing === 0 && input.mismatchExtra === 0 && input.mismatchDirection === 0
      ? {
          id: "SIGNAL_MISMATCH_COUNT",
          name: "Zero Signal Mismatches",
          nameAr: "صفر فروقات إشارية (SIGNAL_MISMATCH_COUNT = 0)",
          status: "PASS",
          reason: "Signal mismatch count = 0",
        }
      : {
          id: "SIGNAL_MISMATCH_COUNT",
          name: "Zero Signal Mismatches",
          nameAr: "صفر فروقات إشارية (SIGNAL_MISMATCH_COUNT = 0)",
          status: "FAIL",
          reason: `Missing=${input.mismatchMissing}, Extra=${input.mismatchExtra}, Direction=${input.mismatchDirection}`,
        };

  const prerequisiteGates = [providerGate, coverageGate, hashGate, parityGate, groundTruthGate, mismatchGate];

  const verificationComplete = prerequisiteGates.every(gate => gate.status === "PASS");

  const completeGate: GateResult = {
    id: "VERIFICATION_COMPLETE",
    name: "Complete Institutional Verification",
    nameAr: "اكتمال التحقق المؤسسي الشامل (VERIFICATION_COMPLETE = true)",
    status: verificationComplete ? "PASS" : "BLOCKED",
    reason: verificationComplete ? "All mandatory verification gates passed" : "One or more mandatory gates are not PASS",
  };

  return [...prerequisiteGates, completeGate];
}

// ----------------------------------------------------------------------------
// Static-analysis gates (additive, opt-in). They are NOT merged into
// buildVerificationGates' VERIFICATION_COMPLETE computation: callers decide
// whether to enforce them. Stage 14 is never PASS unless every stage passed.
// ----------------------------------------------------------------------------

export interface StaticStageLike {
  stageId: string;
  stageNumber: number;
  stageName: string;
  status: string;
  reason: string;
  blockingCode?: string;
}

export function buildStaticAnalysisGates(stages: StaticStageLike[]): GateResult[] {
  return [...stages]
    .sort((a, b) => a.stageNumber - b.stageNumber)
    .map(s => {
      const def = ANALYSIS_STAGES.find(x => x.id === s.stageId);
      const status: GateStatus =
        s.status === "PASS" || s.status === "NOT_APPLICABLE" ? "PASS"
        : s.status === "FAIL" ? "FAIL"
        : "PENDING";
      return {
        id: s.blockingCode && s.status === "FAIL" ? s.blockingCode : `STAGE_${s.stageId}`,
        name: `${s.stageNumber}. ${def?.name ?? s.stageName}`,
        nameAr: `${s.stageNumber}. ${def?.nameAr ?? s.stageName}`,
        status,
        reason: s.status === "NOT_APPLICABLE" ? `N/A — ${s.reason}` : s.reason,
      };
    });
}
