import crypto from 'crypto';
import type { AnalysisRuntimeContext } from '../types/runtimeContext';

export interface ForecastScopePayload {
  symbol: string;
  timeframe: string;
  provider: string;
  modelVersion: string;
  labelPolicyVersion: string;
  sourceHash: string;
}

/**
 * Canonicalize raw values: uppercase symbol, trim spaces, normalise provider IDs.
 */
export function canonicalizePayload(input: Partial<ForecastScopePayload>): ForecastScopePayload {
  const symbol = (input.symbol ?? '').replace(/\//g, '').toUpperCase();
  const timeframe = (input.timeframe ?? '').trim();
  const provider = (input.provider ?? '').trim().toLowerCase();
  const modelVersion = (input.modelVersion ?? '').trim();
  const labelPolicyVersion = (input.labelPolicyVersion ?? '').trim();
  const sourceHash = (input.sourceHash ?? '').trim();
  return { symbol, timeframe, provider, modelVersion, labelPolicyVersion, sourceHash };
}

/** Deterministic SHA‑256 hash of the stable JSON payload */
export function computeForecastScopeId(payload: ForecastScopePayload): string {
  // Stable order: symbol, timeframe, provider, modelVersion, labelPolicyVersion, sourceHash
  const json = JSON.stringify(payload);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/** Helper to build full AnalysisRuntimeContext */
export function buildRuntimeContext(params: {
  symbol: string;
  timeframe: string;
  provider: string;
  dataset?: string;
  strategyHash: string;
  indicatorHash: string;
  modelVersion: string;
  labelPolicyVersion: string;
  sourceHash: string;
}): AnalysisRuntimeContext {
  const analysisId = crypto.randomUUID();
  const coverageReportId = crypto.randomUUID();
  const canonical = canonicalizePayload({
    symbol: params.symbol,
    timeframe: params.timeframe,
    provider: params.provider,
    modelVersion: params.modelVersion,
    labelPolicyVersion: params.labelPolicyVersion,
    sourceHash: params.sourceHash,
  });
  const forecastScopeId = computeForecastScopeId(canonical);
  return {
    analysisId,
    coverageReportId,
    symbol: canonical.symbol,
    timeframe: canonical.timeframe,
    provider: canonical.provider,
    dataset: params.dataset,
    strategyHash: params.strategyHash,
    indicatorHash: params.indicatorHash,
    modelVersion: canonical.modelVersion,
    labelPolicyVersion: canonical.labelPolicyVersion,
    forecastScopeId,
  };
}
