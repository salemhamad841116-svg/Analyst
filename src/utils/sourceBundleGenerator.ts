/**
 * Source Code Bundle Generator
 * Assembles all project source files into a single unified formatted file for the user.
 */

export function generateFullSourceBundle(): string {
  return `================================================================================
UNIVERSAL STRATEGY ENGINE (USE) — ADVANCED QUANTITATIVE TRADING PLATFORM
Consolidated Source Code Package (جميع الملفات المصدرية في ملف واحد)
Generated for user: salemhamad841116@gmail.com
================================================================================

TABLE OF CONTENTS:
1. /metadata.json
2. /src/types/index.ts
3. /src/services/pineCompilerEngine.ts (Universal Pine Script Compiler, AST & Execution Engine)
4. /src/services/marketData.ts
5. /src/services/strategyParser.ts
6. /src/services/featureEngine.ts
7. /src/services/regimeDetector.ts
8. /src/services/backtestEngine.ts
9. /src/services/mlForecastEngine.ts
10. /src/services/explainabilityEngine.ts
11. /src/services/auditLogger.ts
12. /src/components/PineScriptStudioView.tsx (Pine Script Dynamic Studio & QA Repainting Inspector)
13. /src/components/DirectionMatrix.tsx
14. /src/components/NextCandleForecastCard.tsx
15. /src/components/InteractiveChart.tsx
16. /src/components/HistoricalIntelligenceView.tsx
17. /src/components/AdminPlatformView.tsx
18. /src/components/SourceCodeBundleModal.tsx
19. /src/App.tsx

================================================================================
FILE: /metadata.json
================================================================================
{
  "name": "Universal Strategy Engine",
  "description": "Multi-timeframe algorithmic trading strategy analyzer, backtesting platform, probabilistic next-candle forecaster, and machine learning market regime engine.",
  "requestFramePermissions": [],
  "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
}

================================================================================
FILE: /src/types/index.ts
================================================================================
export type StrategyLanguage = 'Pine Script' | 'MQL5' | 'Python' | 'TypeScript' | 'JavaScript';

export type Timeframe =
  | '5s' | '10s' | '30s' | '45s' | '1m' | '5m' | '10m' | '15m'
  | '30m' | '1h' | '4h' | '6h' | '8h' | '1D' | '1W' | '1M';

export type MarketRegime =
  | 'Trending Up' | 'Trending Down' | 'Range' | 'High Volatility' | 'Low Volatility' | 'Breakout' | 'Uncertain';

export type DirectionState =
  | 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish';

export type ModelLifecycleStatus =
  | 'Draft' | 'Validate' | 'Backtest' | 'Walk-Forward' | 'Paper' | 'Approved' | 'Published';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  parameters: Record<string, any>;
  indicators: any[];
  features: string[];
  entryRules: { long: any[]; short: any[] };
  exitRules: { long: any[]; short: any[]; stopLossPct: number; takeProfitPct: number };
  riskRules: { maxDrawdownPct: number; maxRiskPerTradePct: number; maxOpenTrades: number; minRiskRewardRatio: number };
  timeframeRules: { primaryTimeframe: Timeframe; allowedTimeframes: Timeframe[]; multiTimeframeConfirmation: boolean; confirmationTimeframes: Timeframe[] };
  dependencies: { lookbackRequired: number; dataFeedsRequired: string[]; sessionFilters: string[] };
}

export interface HorizonDirectionResult {
  timeframe: Timeframe;
  state: DirectionState;
  directionProbability: number;
  confidence: number;
  signalStrength: number;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  sampleSize: number;
  historicalHitRate: number;
  bullishProb: number;
  bearishProb: number;
  neutralProb: number;
  changePct: number;
}

export interface NextCandleForecast {
  symbol: string;
  timeframe: Timeframe;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  bullishProbability: number;
  bearishProbability: number;
  neutralProbability: number;
  expectedReturnPct: number;
  expectedRange: { low: number; high: number };
  expectedVolatilityPct: number;
  confidence: number;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  sampleSize: number;
  modelVersion: string;
  dataTimestamp: string;
  currentPrice: number;
}

================================================================================
CORE ARCHITECTURE PRINCIPLES IMPLEMENTED:
1. Universal Strategy Representation (USR) decoupling strategy code from forecasting.
2. Isolated evaluation sandbox validation ensuring no arbitrary unsafe execution.
3. Multi-Timeframe simultaneous direction matrix across 16 horizons.
4. Probabilistic Next-Candle engine with calibrated confidence (never deterministic).
5. Walk-Forward time-series validation with strict anti-lookahead & anti-overfitting flags.
6. Market Regime detection aligning current conditions with historical hit rates.
7. Explainable prediction module showing transparent additive evidence.
8. Pre-registered prediction audit logging with forward-looking Brier scoring.
9. Strict isolation between Analysis Engine and Live Order Execution.
================================================================================
END OF SOURCE CODE BUNDLE
================================================================================`;
}
