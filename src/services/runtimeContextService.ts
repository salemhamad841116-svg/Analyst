import admin from 'firebase-admin';
import { AnalysisRuntimeContext } from '../types/runtimeContext';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const collection = db.collection('analysisRuntimeContexts');

/**
 * Persist a new immutable runtime context.
 * The document ID is the analysisId (UUID) to guarantee uniqueness.
 */
export async function createRuntimeContext(context: AnalysisRuntimeContext): Promise<void> {
  const docRef = collection.doc(context.analysisId);
  await docRef.set(context, { merge: false });
}

/** Retrieve a stored context by analysisId */
export async function getRuntimeContext(analysisId: string): Promise<AnalysisRuntimeContext | null> {
  const snapshot = await collection.doc(analysisId).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as AnalysisRuntimeContext;
}

/**
 * Invalidate the current context by creating a fresh one when any watched field changes.
 * Returns the newly created context.
 */
export async function invalidateAndCreateNewContext(
  oldContext: AnalysisRuntimeContext,
  changedFields: Partial<Pick<AnalysisRuntimeContext, 'symbol' | 'timeframe' | 'provider' | 'strategyHash' | 'indicatorHash' | 'modelVersion' | 'labelPolicyVersion'>>,
): Promise<AnalysisRuntimeContext> {
  // Generate fresh IDs
  const analysisId = crypto.randomUUID();
  const coverageReportId = crypto.randomUUID();
  // Merge changes
  const merged = { ...oldContext, ...changedFields, analysisId, coverageReportId } as AnalysisRuntimeContext;
  // Compute forecastScopeId using utility (will be imported by caller)
  // Assume caller sets forecastScopeId correctly before calling this.
  await createRuntimeContext(merged);
  return merged;
}

export { admin };
