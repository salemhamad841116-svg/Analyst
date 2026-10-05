/**
 * Universal Strategy Engine (USE) - Types & Schemas
 */

export type StrategyLanguage = 'Pine Script' | 'MQL5' | 'Python' | 'TypeScript' | 'JavaScript';

export type Timeframe =
  | '5s'
  | '10s'
  | '30s'
  | '45s'
  | '1m'
  | '5m'
  | '10m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '6h'
  | '8h'
  | '1D'
  | '1W'
  | '1M';

export type TimeframeAggregation = 'Second' | 'Minute' | 'Hour' | 'Day' | 'Week' | 'Month' | 'Year';

export type MarketRegime =
  | 'Trending Up'
  | 'Trending Down'
  | 'Range'
  | 'High Volatility'
  | 'Low Volatility'
  | 'Breakout'
  | 'Uncertain';

export type DirectionState =
  | 'Strong Bullish'
  | 'Bullish'
  | 'Neutral'
  | 'Bearish'
  | 'Strong Bearish';

export type ModelLifecycleStatus =
  | 'Draft'
  | 'Validate'
  | 'Backtest'
  | 'Walk-Forward'
  | 'Paper'
  | 'Approved'
  | 'Published';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorConfig {
  id: string;
  type: string; // 'EMA' | 'SMA' | 'RSI' | 'MACD' | 'ATR' | 'Bollinger' | 'VWAP' | 'ADX' | 'Supertrend'
  params: Record<string, number | string | boolean>;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3';
}

export interface RuleCondition {
  id: string;
  leftOperand: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | 'crosses_above' | 'crosses_below';
  rightOperand: string | number;
  description: string;
}

export interface StrategyDefinition {
  metadata: {
    id: string;
    name: string;
    version: string;
    author: string;
    language: StrategyLanguage;
    description: string;
    createdDate: string;
    lifecycleStatus: ModelLifecycleStatus;
    tags: string[];
  };
  parameters: Record<string, {
    name: string;
    type: 'number' | 'boolean' | 'string';
    defaultValue: number | boolean | string;
    currentValue: number | boolean | string;
    min?: number;
    max?: number;
    step?: number;
  }>;
  indicators: IndicatorConfig[];
  features: string[];
  entryRules: {
    long: RuleCondition[];
    short: RuleCondition[];
  };
  exitRules: {
    long: RuleCondition[];
    short: RuleCondition[];
    stopLossPct: number;
    takeProfitPct: number;
    trailingStopPct?: number;
    timeStopCandles?: number;
  };
  riskRules: {
    maxDrawdownPct: number;
    maxRiskPerTradePct: number;
    maxOpenTrades: number;
    minRiskRewardRatio: number;
  };
  timeframeRules: {
    primaryTimeframe: Timeframe;
    allowedTimeframes: Timeframe[];
    multiTimeframeConfirmation: boolean;
    confirmationTimeframes: Timeframe[];
  };
  dependencies: {
    lookbackRequired: number;
    dataFeedsRequired: string[];
    sessionFilters: string[]; // e.g. '08:00-16:00 UTC'
  };
}

export interface SecurityValidationResult {
  passed: boolean;
  securityScore: number; // 0-100
  sanitized: boolean;
  warnings: string[];
  errors: string[];
  sandboxLimits: {
    maxMemoryMb: number;
    maxCpuTimeMs: number;
    networkAccess: boolean;
    filesystemAccess: boolean;
  };
}

export interface HorizonDirectionResult {
  timeframe: Timeframe;
  state: DirectionState;
  directionProbability: number; // 0.0 - 1.0
  confidence: number; // 0.0 - 1.0
  signalStrength: number; // 0 - 100
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  sampleSize: number;
  historicalHitRate: number; // 0.0 - 1.0
  bullishProb: number;
  bearishProb: number;
  neutralProb: number;
  changePct: number;
}

export type ForecastEngineMode = 'RULE-BASED' | 'ML MODEL' | 'HYBRID';

export interface MLModelMetadata {
  modelName: string;
  modelVersion: string;
  trainingSamples: number;
  outOfSampleAccuracyPct: number;
  lastTrainingDate: string;
  splitInfo: string;
  featuresUsedCount: number;
  brierLossScore: number;
  rawMLPrediction: {
    bullishProb: number;
    bearishProb: number;
    neutralProb: number;
    confidence: number;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  rawRulePrediction: {
    bullishScore: number;
    bearishScore: number;
    neutralScore: number;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
}

export interface NextCandleForecast {
  symbol: string;
  timeframe: Timeframe;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  forecastSignal?: 'NEXT BUY' | 'NEXT SELL' | 'NEXT NEUTRAL' | 'NO TRADE / LOW CONFIDENCE';
  engineMode?: ForecastEngineMode;
  mlModelMetadata?: MLModelMetadata;
  targetCandleWindow?: string;
  targetIntervalFormatted?: string;
  targetBarTimestamp?: number;
  sourceBarTimestamp?: number;
  sourceTimeFormatted?: string;
  sourceBarIndex?: number;
  targetBarIndex?: number;
  bullishProbability: number;
  bearishProbability: number;
  neutralProbability: number;
  expectedReturnPct: number;
  expectedRange: {
    low: number;
    high: number;
  };
  expectedVolatilityPct: number;
  confidence: number;
  isLowConfidence?: boolean;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  sampleSize: number;
  modelVersion: string;
  labelPolicyVersion?: string;
  dataTimestamp: string;
  currentPrice: number;
  accuracyStats?: {
    last50: { accuracyPct: number; wins: number; total: number };
    last100: { accuracyPct: number; wins: number; total: number };
    last500: { accuracyPct: number; wins: number; total: number };
    buyAccuracy: { accuracyPct: number; wins: number; total: number };
    sellAccuracy: { accuracyPct: number; wins: number; total: number };
    lastResult: 'WIN' | 'LOSS' | 'NEUTRAL';
    lastPredictedDir?: 'BUY' | 'SELL' | 'NEUTRAL';
    lastActualDir?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  verificationFlags?: {
    sourceCandle: 'CLOSED';
    targetCandle: 'NEXT UNOPENED';
    forecastFrozen: 'YES';
    lookahead: 'OFF';
    repaint: 'NO';
  };
  featuresUsed?: {
    pivot?: number;
    state?: number;
    zone?: number;
    r1?: number;
    s1?: number;
    atr?: number;
    rsi?: number;
    regime?: string;
    momentum?: string;
  };
}

export interface ExplainableFactor {
  factor: string;
  contribution: number; // e.g. +18 or -9
  type: 'supporting' | 'contradicting';
  description: string;
}

export interface Trade {
  id: string;
  type: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  pnlPct: number;
  mfePct: number; // Maximum Favorable Excursion
  maePct: number; // Maximum Adverse Excursion
  holdingCandles: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_EXIT' | 'TIME_STOP';
  timeframe: Timeframe;
  regime: MarketRegime;
}

export interface HistoricalIntelligence {
  totalObservations: number;
  totalTrades: number;
  winRate: number;
  lossRate: number;
  expectancy: number;
  profitFactor: number;
  maxDrawdownPct: number;
  avgReturnPct: number;
  avgMfePct: number;
  avgMaePct: number;
  avgTimeToTargetCandles: number;
  avgTimeToFailureCandles: number;
  longPerformance: {
    trades: number;
    winRate: number;
    pnlPct: number;
  };
  shortPerformance: {
    trades: number;
    winRate: number;
    pnlPct: number;
  };
  performanceByHour: { hour: number; winRate: number; trades: number; pnlPct: number }[];
  performanceByWeekday: { day: string; winRate: number; trades: number; pnlPct: number }[];
  performanceByMonth: { month: string; winRate: number; trades: number; pnlPct: number }[];
  performanceByRegime: { regime: MarketRegime; winRate: number; trades: number; pnlPct: number }[];
  patternDiscoveries: {
    bestHours: string;
    bestWeekdays: string;
    bestRegimes: string;
    failureConditions: string;
    indicatorSynergies: string;
  };
}

export interface WalkForwardWindow {
  windowIndex: number;
  trainRange: string;
  valRange: string;
  oosRange: string;
  trainAccuracy: number;
  valAccuracy: number;
  oosAccuracy: number;
  drawdown: number;
}

export interface MLModelPerformance {
  modelName: string;
  modelType: 'Baseline' | 'Logistic Regression' | 'Gradient Boost' | 'Random Forest' | 'Ensemble';
  trainAccuracy: number;
  valAccuracy: number;
  oosAccuracy: number;
  brierScore: number;
  f1Score: number;
  overfittingRisk: boolean;
  status: 'Candidate' | 'Active' | 'Archived';
}

export interface PredictionAuditRecord {
  predictionId: string;
  timestamp: number;
  predictionTime?: string;
  targetBarTime?: string;
  targetBarTimestamp?: number;
  symbol: string;
  timeframe: Timeframe;
  strategyVersion: string;
  modelVersion: string;
  inputDataVersion: string;
  marketRegime: MarketRegime;
  direction?: 'NEXT BUY' | 'NEXT SELL' | 'NEXT NEUTRAL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  probabilities: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  confidence: number;
  expectedRange: {
    low: number;
    high: number;
  };
  inputFeatures?: Record<string, any>;
  actualResult: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'PENDING' | 'WIN' | 'LOSS';
  evaluationStatus: 'EVALUATED' | 'AWAITING_CLOSE' | 'EXPIRED';
  actualReturnPct?: number;
  brierLoss?: number;
}

// ----------------------------------------------------------------------------
// Pine Script Real Executable Engine Types
// ----------------------------------------------------------------------------

export interface ParsedInputParam {
  id: string;
  name: string;
  type: 'int' | 'float' | 'bool' | 'string' | 'source';
  defaultValue: any;
  currentValue: any;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  line: number;
}

export interface ParsedSecurityRequest {
  id: string;
  symbol: string;
  timeframe: string;
  expressionStr: string;
  lookahead: 'lookahead_off' | 'lookahead_on';
  gaps?: 'gaps_off' | 'gaps_on';
  line: number;
}

export interface UnsupportedFeature {
  line: number;
  codeSnippet: string;
  featureName: string;
  reason: string;
  impact: 'BLOCKED' | 'WARNING' | 'SKIPPED';
}

export interface StrategyOrderAction {
  id: string;
  action: 'ENTRY_LONG' | 'ENTRY_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'EXIT';
  whenExpr?: string;
  line: number;
  comment?: string;
  limit?: number | string;
  stop?: number | string;
}

export interface ExecutedTradeDetail {
  id: string;
  tradeNumber: number;
  type: 'LONG' | 'SHORT';
  entryBar: number;
  entryTimestamp: number;
  entryPrice: number;
  exitBar: number;
  exitTimestamp: number;
  exitPrice: number;
  exitReason: 'SIGNAL_EXIT' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIME_STOP' | 'REVERSE';
  sizePct: number;
  pnlDollar: number;
  pnlPct: number;
  mfePct: number;
  maePct: number;
  holdingBars: number;
  entryConditionsMet: string[];
}

export interface BarExecutionTrace {
  barIndex: number;
  timestamp: number;
  timeFormatted: string;
  open: number;
  high: number;
  low: number;
  close: number;
  variables: Record<string, number | boolean | string>;
  longCondition: boolean;
  shortCondition: boolean;
  actionTaken?: string;
  positionState: 'FLAT' | 'LONG' | 'SHORT';
}

export interface QAReport {
  lookaheadBiasFree: boolean;
  lookaheadNotes: string[];
  repaintingRisk: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  candleStateLogic: 'CLOSED_BAR_CONFIRMED' | 'INTRA_BAR_UNCONFIRMED';
  unsupportedFeatures: UnsupportedFeature[];
  totalBarsEvaluated: number;
  evaluationDurationMs: number;
  barTraces: BarExecutionTrace[];
}

export type PineScriptVersion = 'v4' | 'v5' | 'v6';
export type PineScriptKind = 'strategy' | 'indicator';
export type PineExecutionMode = 'SOURCE_FAITHFUL' | 'ANTI_REPAINT_AUDIT';

export interface TradingViewSignalRecord {
  barIndex: number;
  timeFormatted: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  price: number;
  reason?: string;
}

export interface TradingViewExternalValidation {
  symbol: string;
  timeframe: string;
  timezone: string;
  dateRange: {
    start: string;
    end: string;
  };
  inputs: Record<string, any>;
  expectedSignals: TradingViewSignalRecord[];
  useSignals: TradingViewSignalRecord[];
  missingCount: number;
  missingSignals: TradingViewSignalRecord[];
  extraCount: number;
  extraSignals: TradingViewSignalRecord[];
  directionMismatchCount: number;
  directionMismatches: {
    barIndex: number;
    timeFormatted: string;
    expected: 'BUY' | 'SELL';
    actual: 'BUY' | 'SELL';
  }[];
  unsupportedFeaturesCount: number;
  unsupportedFeatures: UnsupportedFeature[];
  deltaCount: number;
  validationStatus: 'PASS_ZERO_DELTA' | 'KNOWN_DATA_DIFFERENCE' | 'FAIL';
  documentedDifferences: string[];
}

export interface CandleComparisonItem {
  barIndex: number;
  timestamp: number;
  timeFormatted: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tvSignal?: 'BUY' | 'SELL';
  useSignal?: 'BUY' | 'SELL';
  deltaStatus: 'MATCH' | 'DISCREPANCY';
}

export interface StateLogicVerification {
  greenCondition: string;
  redCondition: string;
  neutralCondition: string;
  uninitializedCondition: string;
  zoneFormulasUsed: string[];
  isExactConditionTree: boolean;
  rejectReason?: string;
}

export interface AstUsrSummary {
  detectedCalculateState: boolean;
  detectedPivotOpen: boolean;
  detectedAtrNowOffset1: boolean;
  detectedStateZoneReturn: boolean;
  detectedSecurityCallsCount: number;
  detectedSecurityTimeframes: string[];
  detectedPivotFormulas: {
    distanceFormula: string;
    pivotFormula: string;
    highEdgeFormula: string;
    lowEdgeFormula: string;
    fullRangeFormula?: string;
    r1Formula: string;
    r2Formula: string;
    r3Formula: string;
    s1Formula: string;
    s2Formula: string;
    s3Formula: string;
  };
  stateLogicVerification: StateLogicVerification;
  hasExactFormulas: boolean;
  hasPhantomLogic: boolean;
  phantomLogicDetails: string[];
}

export interface PreTestIntegrityGate {
  uploadedSourceHash: string;
  parsedSourceHash: string;
  executedSourceHash: string;
  hashesMatch: boolean;
  astLogicVerified: boolean;
  status: 'PASSED' | 'BLOCKED';
  gateMessage: string;
  timestamp: string;
  astSummary: AstUsrSummary;
}

export interface AtrWarmupReport {
  d1WarmupBarsLoaded: number;
  h4WarmupBarsLoaded: number;
  h1WarmupBarsLoaded: number;
  m15WarmupBarsLoaded: number;
  m5WarmupBarsLoaded: number;
  m1WarmupBarsLoaded: number;
  isAtrInitialized: boolean;
  warmupExcludedFromEvaluation: boolean;
  warmupStatus: 'PASS' | 'BLOCKED_INSUFFICIENT_WARMUP';
  details: string;
}

export interface RawDataCoverageReport {
  baseDataTimeframe: 'M1';
  m1FirstRawCandle: string;
  m1LastRawCandle: string;
  m1BarsLoaded: number;
  d1WarmupStart: string;
  requestedAnalysisStart: string;
  requestedAnalysisEnd: string;
  actualAnalysisStart: string;
  actualAnalysisEnd: string;
  missingM1Bars: number;
  missingM1BarPercentage: string;
  expectedTradableM1Bars: number;
  actualM1Bars: number;
  coveragePercentage?: number;
  unexpectedMissingM1Bars: number;
  weekendMarketClosedMinutesExcluded: number;
  holidayMarketClosedMinutesExcluded?: number;
  expectedBarsCalculationMethod?: string;
  calculationDetails?: string;
  primaryDataProvider?: string;
  providerChanges?: number;
  singleProviderConsistent?: boolean;
  providerBoundaries?: Array<{
    chunkIndex: number;
    timestamp: string;
    fromProvider: string;
    toProvider: string;
    reason: string;
  }>;
  dstTransitionsEncountered?: string[];
  holidaysEncountered?: string[];
  m1DataCoverageStatus: 'PASS' | 'PARTIAL_DATA_VERIFICATION' | 'BLOCKED_M1_DATA_UNAVAILABLE' | 'BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE' | 'BLOCKED_PROVIDER_MISMATCH';
}

export interface DataCalendarReport {
  firstWarmupD1Candle: string;
  lastWarmupD1Candle: string;
  actualD1WarmupBarCount: number;
  weekendBarsIncluded: 'No' | 'Yes';
  expectedTradableM1Bars: number;
  actualM1Bars: number;
  unexpectedMissingM1Bars: number;
  weekendMarketClosedMinutesExcluded: number;
  tradingViewSymbol: string;
  tradingViewExchange: string;
  tradingViewSessionTimezone: string;
  d1SessionBoundary: string;
  h4SessionBoundary: string;
  calendarStatus: 'PASS' | 'FAIL';
  details: string;
}

export interface NumericalParityFieldComparison {
  field: string;
  formula: string;
  rawTradingView: number;
  rawUse: number;
  rawTradingViewString: string; // 17 significant digits lossless serialization
  rawUseString: string;         // 17 significant digits lossless serialization
  fullPrecisionDelta: number;
  absoluteDelta: number;
  relativeDelta: number;
  absoluteTolerance: number;
  relativeTolerance: number;
  effectiveTolerance: number;
  scale: number;
  allowedTolerance: number;
  isNumericValid: boolean;
  tickSize: number;
  displayRoundedValue: {
    tradingView: string;
    use: string;
  };
  parityStatus: 'PASS' | 'FAIL' | 'NUMERICAL_PARITY_INVALID_VALUE';
}

export interface NumericalParitySampleBar {
  barIndex: number;
  timestamp: number;
  timeStr: string;
  comparisons: Record<string, NumericalParityFieldComparison>;
  tradingView: {
    atr14: number;
    distance: number;
    pivotOpen: number;
    highEdge: number;
    lowEdge: number;
    fullRange: number;
    r3: number;
    r2: number;
    r1: number;
    s1: number;
    s2: number;
    s3: number;
    state: number;
    signal?: string;
  };
  useEngine: {
    atr14: number;
    distance: number;
    pivotOpen: number;
    highEdge: number;
    lowEdge: number;
    fullRange: number;
    r3: number;
    r2: number;
    r1: number;
    s1: number;
    s2: number;
    s3: number;
    state: number;
    signal?: string;
  };
  deltas: {
    atr14: number;
    distance: number;
    pivotOpen: number;
    highEdge: number;
    lowEdge: number;
    fullRange: number;
    r3: number;
    r2: number;
    r1: number;
    s1: number;
    s2: number;
    s3: number;
    stateMatch: boolean;
    signalMatch: boolean;
    maxDelta: number;
  };
  parityStatus: 'EXACT_MATCH' | 'DISCREPANCY';
}

export interface NumericalParityReport {
  sampledBars: NumericalParitySampleBar[];
  sampledCount: number;
  verificationPrecisionMode: 'FULL_PRECISION';
  rawSerializationPrecision: number; // 17 significant digits (IEEE 754 lossless round-trip)
  absoluteTolerance: number;         // e.g. 1e-10
  relativeTolerance: number;         // e.g. 1e-10
  numericTolerance: number;          // primary tolerance threshold
  invalidNumericCount: number;       // count of NaN, Infinity, null, undefined, or missing values
  displayPrecision: number;
  tickSize: number;
  maxFullPrecisionDelta: number;
  meanFullPrecisionDelta: number;
  worstMatchingField: string;
  worstMatchingBarTimestamp: string;
  maxAbsoluteDelta: number;
  numericParityStatus: 'PASS' | 'NUMERICAL_PARITY_FAIL' | 'NUMERICAL_PARITY_INVALID_VALUE';
  atrParityPassed: boolean;
  distanceParityPassed: boolean;
  pivotParityPassed: boolean;
  highEdgeParityPassed: boolean;
  lowEdgeParityPassed: boolean;
  fullRangeParityPassed: boolean;
  r3ParityPassed: boolean;
  r2ParityPassed: boolean;
  r1ParityPassed: boolean;
  s1ParityPassed: boolean;
  s2ParityPassed: boolean;
  s3ParityPassed: boolean;
  resistanceLevelsParityPassed: boolean;
  supportLevelsParityPassed: boolean;
  stateParityPassed: boolean;
}

export interface VerificationEvidencePack {
  analysisId?: string;
  strategyCodeHash: string;
  parserVersion: string;
  usrVersion: string;
  executionEngineVersion: string;
  executionMode: PineExecutionMode;
  dataProvider: string;
  primaryDataProvider?: string;
  providerChanges?: number;
  providerBoundaries?: Array<{
    chunkIndex: number;
    timestamp: string;
    fromProvider: string;
    toProvider: string;
    reason: string;
  }>;
  expectedBarsCalculationMethod?: string;
  singleProviderConsistent?: boolean;
  coveragePercentage?: number;
  databentoDataset?: string;
  databentoSchema?: string;
  missingRequestedBars?: number;
  loadedRecords?: number;
  rawProviderSymbol: string;
  rawSymbol: string;
  timezone: string;
  firstCandle: string;
  lastCandle: string;
  requestedPeriod: string;
  actualPeriod: string;
  ohlcSource: string;
  missingBars: number;
  missingBarPercentage: string;
  tradingViewSignalCount: number;
  useSignalCount: number;
  signalDiscrepancies: {
    missing: number;
    extra: number;
    directionMismatch: number;
  };
  stateLogic: {
    green: string;
    red: string;
    neutral: string;
    uninitialized: string;
    verified: boolean;
  };
  rawDataCoverage?: RawDataCoverageReport;
  atrWarmup?: AtrWarmupReport;
  dataCalendar?: DataCalendarReport;
  numericalParity?: NumericalParityReport;
  unsupportedFeatures: UnsupportedFeature[];
  candleByCandleComparison: CandleComparisonItem[];
  integrityGate: PreTestIntegrityGate;
  astUsrSummary?: AstUsrSummary;
  signedOffAt: string;
  verificationStatus:
    | 'PRODUCTION_VERIFIED'
    | 'PASS_ZERO_DELTA'
    | 'PARTIAL_DATA_VERIFICATION'
    | 'BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE'
    | 'BLOCKED_PROVIDER_MISMATCH'
    | 'NUMERICAL_PARITY_FAIL'
    | 'NUMERICAL_PARITY_INVALID_VALUE'
    | 'BLOCKED_M1_DATA_UNAVAILABLE'
    | 'BLOCKED_INSUFFICIENT_WARMUP'
    | 'BLOCKED_MARKET_DATA_UNAVAILABLE'
    | 'BLOCKED_INTEGRITY_FAIL'
    | 'FAIL';
  productionBadge: string;
  auditChecksum: string;
}

export interface CompiledPineStrategy {
  title: string;
  version: PineScriptVersion;
  scriptKind: PineScriptKind;
  overlay: boolean;
  processOrdersOnClose: boolean;
  calcOnEveryTick: boolean;
  initialCapital: number;
  inputs: ParsedInputParam[];
  indicators: IndicatorConfig[];
  securityRequests: ParsedSecurityRequest[];
  entryActions: StrategyOrderAction[];
  exitActions: StrategyOrderAction[];
  detectedTimeframes: string[];
  unsupportedFeatures: UnsupportedFeature[];
  rawCode: string;
  compiledAt: string;
  astUsrSummary: AstUsrSummary;
  integrityGate: PreTestIntegrityGate;
  execute: (
    candles: Candle[],
    mtfCandles?: Record<string, Candle[]>,
    inputOverrides?: Record<string, any>,
    mode?: PineExecutionMode,
    realMarketMetadata?: any
  ) => {
    trades: ExecutedTradeDetail[];
    equityCurve: { timestamp: number; equity: number; drawdownPct: number; barIndex: number }[];
    seriesValues: Record<string, number[]>;
    qaReport: QAReport;
    auditComparison?: {
      mode: PineExecutionMode;
      sourceFaithfulTradesCount: number;
      antiRepaintTradesCount: number;
      repaintedTradesCount: number;
      lookaheadProfitInflationPct: number;
      timingShiftBarsCount: number;
      notes: string[];
    };
    externalValidation?: TradingViewExternalValidation;
    evidencePack?: VerificationEvidencePack;
    metrics: {
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      winRate: number;
      profitFactor: number;
      netProfitDollar: number;
      netProfitPct: number;
      maxDrawdownPct: number;
      avgTradePct: number;
      expectancy: number;
    };
  };
}


export type DualCombineMode = 'COMPARE' | 'CONFLUENCE' | 'COMBINE';

export interface DualStrategyEvaluation {
  isDualMode: boolean;
  combineMode: DualCombineMode;
  sourceHashA?: string;
  sourceHashB?: string;
  combinedSourceHash?: string;
  syntaxErrorsA: number;
  syntaxErrorsB: number;
  unresolvedIdentifiersA: number;
  unresolvedIdentifiersB: number;
  verificationAPass: boolean;
  verificationBPass: boolean;
  combinedValidationPass: boolean;
}

export interface DualExecutionTrace {
  barIndex: number;
  timestamp: number;
  timeFormatted: string;
  price: number;
  signalA: 'BUY' | 'SELL' | 'NEUTRAL';
  signalB: 'BUY' | 'SELL' | 'NEUTRAL';
  confidenceA?: number;
  confidenceB?: number;
  finalSignal: 'BUY' | 'SELL' | 'NEUTRAL' | 'NO SIGNAL';
  finalConfidence?: number;
}
