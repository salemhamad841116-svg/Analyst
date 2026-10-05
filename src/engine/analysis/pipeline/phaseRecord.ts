/**
 * Phase / stage audit records and the FINAL VERIFIED guard.
 *
 * Every pipeline stage emits a PhaseRecord bound to (analysisId, strategyHash, datasetHash).
 * FINAL_VERIFIED can only be produced by `evaluateFinalVerification`, and only when
 *   (1) every required stage record is PASS,
 *   (2) every record is bound to the SAME analysisId + strategyHash (zero cross-run contamination),
 *   (3) every record's integrity hash still matches its content.
 */

import { sha256Hex } from '../../../services/pineCompilerEngine';

export type StageStatus = 'PASS' | 'FAIL' | 'PENDING' | 'NOT_APPLICABLE';

export interface PhaseRecord {
  stageId: string;
  stageNumber: number;
  stageName: string;
  analysisId: string;
  strategyHash: string;
  datasetHash: string;
  status: StageStatus;
  /** machine-readable blocking code when status === 'FAIL' */
  blockingCode?: string;
  reason: string;
  metrics: Record<string, unknown>;
  startedAt: string;
  finishedAt: string;
  runtimeMs: number;
  recordHash: string;
}

export interface RecordBinding {
  analysisId: string;
  strategyHash: string;
}

export function computeRecordHash(r: Omit<PhaseRecord, 'recordHash'>): string {
  return sha256Hex(JSON.stringify({
    s: r.stageId, a: r.analysisId, h: r.strategyHash, d: r.datasetHash,
    st: r.status, bc: r.blockingCode ?? null, rs: r.reason, m: r.metrics,
  }));
}

export function makeRecord(input: Omit<PhaseRecord, 'recordHash'>): PhaseRecord {
  return { ...input, recordHash: computeRecordHash(input) };
}

export function verifyRecordIntegrity(r: PhaseRecord): boolean {
  const { recordHash, ...rest } = r;
  return computeRecordHash(rest) === recordHash;
}

/** Number of records that do NOT belong to the expected run (should always be 0). */
export function detectCrossRunContamination(records: PhaseRecord[], expected: RecordBinding): number {
  return records.filter(r => r.analysisId !== expected.analysisId || r.strategyHash !== expected.strategyHash).length;
}

export interface FinalVerification {
  status: 'FINAL_VERIFIED' | 'NOT_VERIFIED' | 'BLOCKED';
  blockingCode?: string;
  reason: string;
  contaminatedRecords: number;
  tamperedRecords: number;
  failedStages: string[];
  pendingStages: string[];
}

export function evaluateFinalVerification(
  records: PhaseRecord[],
  expected: RecordBinding,
  requiredStageIds: string[],
): FinalVerification {
  const contaminated = detectCrossRunContamination(records, expected);
  const tampered = records.filter(r => !verifyRecordIntegrity(r)).length;

  const byId = new Map(records.map(r => [r.stageId, r]));
  const failed: string[] = [];
  const pending: string[] = [];
  for (const id of requiredStageIds) {
    const r = byId.get(id);
    if (!r) { pending.push(id); continue; }
    if (r.status === 'FAIL') failed.push(id);
    else if (r.status === 'PENDING') pending.push(id);
  }

  const base = { contaminatedRecords: contaminated, tamperedRecords: tampered, failedStages: failed, pendingStages: pending };

  if (contaminated > 0) {
    return { ...base, status: 'BLOCKED', blockingCode: 'BLOCKED_CROSS_RUN_CONTAMINATION',
      reason: `${contaminated} record(s) belong to a different analysisId/strategyHash` };
  }
  if (tampered > 0) {
    return { ...base, status: 'BLOCKED', blockingCode: 'BLOCKED_RECORD_INTEGRITY',
      reason: `${tampered} record(s) failed integrity-hash verification` };
  }
  if (failed.length > 0) {
    const first = byId.get(failed[0])!;
    return { ...base, status: 'BLOCKED', blockingCode: first.blockingCode ?? 'BLOCKED_STAGE_FAILED',
      reason: `Stage ${failed[0]} failed: ${first.reason}` };
  }
  if (pending.length > 0) {
    return { ...base, status: 'NOT_VERIFIED', blockingCode: 'PENDING_MANDATORY_STAGES',
      reason: `${pending.length} mandatory stage(s) have not run: ${pending.join(', ')}` };
  }
  return { ...base, status: 'FINAL_VERIFIED', reason: 'All mandatory stages passed for this analysisId/strategyHash' };
}
