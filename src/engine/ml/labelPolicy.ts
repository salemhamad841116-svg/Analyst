/**
 * IMMUTABLE LABEL POLICY - SINGLE SOURCE OF TRUTH
 * Universal Strategy Engine - Production ML Certification
 *
 * Defines the exact mathematical formula and frozen threshold for directional labels:
 * BUY: normalizedMove > +0.12
 * SELL: normalizedMove < -0.12
 * NEUTRAL: -0.12 <= normalizedMove <= +0.12
 * where normalizedMove = (closeT1 - closeT) / atr14T
 */

export type Direction = "BUY" | "SELL" | "NEUTRAL";

export interface LabelPolicyDefinition {
  formula: string;
  neutralThreshold: number;
  neutralThresholdUnit: "ATR_14_UNIT";
  pipEquivalentAt10PipATR: number;
  thresholdSource: "TRAIN_ONLY";
  frozenAfterTraining: true;
  labelExplanation: string;
  classify: (normalizedMove: number) => Direction;
}

export const IMMUTABLE_LABEL_POLICY = {
  formula: "(closeT1 - closeT) / atr14T",

  neutralThreshold: 0.12,
  neutralThresholdUnit: "ATR_14_UNIT" as const,
  pipEquivalentAt10PipATR: 1.2,
  thresholdSource: "TRAIN_ONLY" as const,
  frozenAfterTraining: true as const,
  labelExplanation: "BUY: normalizedMove > +0.12 | SELL: normalizedMove < -0.12 | NEUTRAL: -0.12 <= normalizedMove <= +0.12",

  classify(normalizedMove: number): Direction {
    if (normalizedMove > 0.12) return "BUY";
    if (normalizedMove < -0.12) return "SELL";
    return "NEUTRAL";
  },
} as const;

export function assertLabelPolicyIntegrity(candidateThreshold: number, candidateUnit?: string): boolean {
  if (candidateThreshold !== IMMUTABLE_LABEL_POLICY.neutralThreshold) {
    throw new Error(
      `Label Threshold Mismatch! Expected frozen ${IMMUTABLE_LABEL_POLICY.neutralThreshold}, got: ${candidateThreshold}`
    );
  }
  if (candidateUnit && candidateUnit !== IMMUTABLE_LABEL_POLICY.neutralThresholdUnit) {
    throw new Error(
      `Label Unit Mismatch! Expected frozen ${IMMUTABLE_LABEL_POLICY.neutralThresholdUnit}, got: ${candidateUnit}`
    );
  }
  return true;
}

export function checkLabelConsensus(
  uiThreshold: number,
  auditThreshold: number,
  inferenceThreshold: number
): "CERTIFIED" | "PENDING_AUDIT" {
  if (
    uiThreshold !== IMMUTABLE_LABEL_POLICY.neutralThreshold ||
    auditThreshold !== IMMUTABLE_LABEL_POLICY.neutralThreshold ||
    inferenceThreshold !== IMMUTABLE_LABEL_POLICY.neutralThreshold
  ) {
    return "PENDING_AUDIT";
  }
  return "CERTIFIED";
}
