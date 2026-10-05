export interface AnalysisRuntimeContext {
  analysisId: string;
  coverageReportId: string;
  symbol: string;
  timeframe: string;
  provider: string;
  dataset?: string;
  strategyHash: string;
  indicatorHash: string;
  modelVersion: string;
  labelPolicyVersion: string;
  forecastScopeId: string;
}
