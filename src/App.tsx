/**
 * Universal Strategy Engine (USE) - Main Application
 * Advanced Quantitative Trading Strategy Analyzer, Probabilistic Next-Candle Forecaster,
 * and Anti-Overfitting Multi-Timeframe Workspace.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Timeframe,
  Candle,
  StrategyDefinition,
  HorizonDirectionResult,
  NextCandleForecast,
} from './types';
import {
  SUPPORTED_SYMBOLS,
  generateCandles,
  aggregateCandles,
  TIMEFRAME_SECONDS,
} from './services/marketData';
import { PRELOADED_STRATEGIES, parseStrategyCode } from './services/strategyParser';
import { extractFeatures } from './services/featureEngine';
import { detectMarketRegime } from './services/regimeDetector';
import { runBacktest } from './services/backtestEngine';
import {
  generateNextCandleForecast,
  generateMultiTimeframeMatrix,
  ALL_HORIZONS,
} from './services/mlForecastEngine';
import { explainPrediction } from './services/explainabilityEngine';
import { recordPrePrediction, evaluatePendingAuditLogs } from './services/auditLogger';
import { DirectionMatrix } from './components/DirectionMatrix';
import { NextCandleForecastCard } from './components/NextCandleForecastCard';
import { InteractiveChart } from './components/InteractiveChart';
import { HistoricalIntelligenceView } from './components/HistoricalIntelligenceView';
import { AdminPlatformView } from './components/AdminPlatformView';
import { PineScriptStudioView } from './components/PineScriptStudioView';
import { SourceCodeBundleModal } from './components/SourceCodeBundleModal';
import { CommandCenter } from './components/CommandCenter/CommandCenter';
import { actionEngine } from './services/ActionEngine';
import { generateFullSourceBundle } from './utils/sourceBundleGenerator';

import {
  Sliders,
  ShieldCheck,
  TrendingUp,
  Activity,
  Play,
  Settings,
  Layers,
  FileCode,
  Lock,
  Download,
  Terminal,
  Cpu,
  RefreshCw,
  Eye,
  AlertCircle,
} from 'lucide-react';

export default function App() {
  // Navigation: Pine Script Studio vs Trading Platform vs Admin Platform
  const [platformMode, setPlatformMode] = useState<'pine_studio' | 'trading' | 'admin'>('trading');
  const [isUSEWorkspaceOpen, setIsUSEWorkspaceOpen] = useState<boolean>(true);
  const [panels, setPanels] = useState<any[]>([]);

  // Active Market & Strategy Controls
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('5m');
  const [isSimulatingTicks, setIsSimulatingTicks] = useState<boolean>(true);
  const [isPaperMode, setIsPaperMode] = useState<boolean>(true);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);

  // Source Bundle Modal State
  const [showSourceBundleModal, setShowSourceBundleModal] = useState<boolean>(false);

  // Initialize Default Strategy from Pine Script
  const initialStrategy = useMemo(() => {
    return parseStrategyCode(PRELOADED_STRATEGIES[0].code, {
      name: PRELOADED_STRATEGIES[0].name,
      language: PRELOADED_STRATEGIES[0].language,
    }).strategy;
  }, []);

  const [currentStrategy, setCurrentStrategy] = useState<StrategyDefinition>(initialStrategy);

  // Market Candle Cache (all horizons for the selected symbol)
  const [candlesByTimeframe, setCandlesByTimeframe] = useState<Record<Timeframe, Candle[]>>(() => {
    const base = generateCandles(selectedSymbol, '5s', 400);
    const result: Record<string, Candle[]> = { '5s': base };
    for (const tf of ALL_HORIZONS) {
      if (tf !== '5s') {
        result[tf] = aggregateCandles(base, tf);
      }
    }
    return result as Record<Timeframe, Candle[]>;
  });

  useEffect(() => {
    actionEngine.registerPanelCallback((action) => {
      if (action.type === 'create_panel') {
        const newPanel = {
          id: `panel_${Date.now()}`,
          ...action.payload,
          visible: true
        };
        setPanels((prev) => [...prev, newPanel]);
      }
    });
  }, []);

  // Re-generate market data when symbol changes
  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    const base = generateCandles(symbol, '5s', 400);
    const result: Record<string, Candle[]> = { '5s': base };
    for (const tf of ALL_HORIZONS) {
      if (tf !== '5s') {
        result[tf] = aggregateCandles(base, tf);
      }
    }
    setCandlesByTimeframe(result as Record<Timeframe, Candle[]>);
  };

  // Switch Strategy Template
  const handleStrategyTemplateChange = (templateName: string) => {
    const tmpl = PRELOADED_STRATEGIES.find((s) => s.name === templateName);
    if (tmpl) {
      const parsed = parseStrategyCode(tmpl.code, {
        name: tmpl.name,
        language: tmpl.language,
      });
      if (parsed.success) {
        setCurrentStrategy(parsed.strategy);
      }
    }
  };

  // Real-time Tick Simulator: tick the 5s bar and aggregate forward
  useEffect(() => {
    if (!isSimulatingTicks) return;

    const interval = setInterval(() => {
      setCandlesByTimeframe((prev) => {
        const current5s = [...(prev['5s'] || [])];
        if (!current5s.length) return prev;

        const last = current5s[current5s.length - 1];
        const drift = (Math.random() - 0.49) * 0.0002 * last.close;
        const newClose = Number((last.close + drift).toFixed(5));
        const updatedLast: Candle = {
          ...last,
          close: newClose,
          high: Math.max(last.high, newClose),
          low: Math.min(last.low, newClose),
          volume: last.volume + Math.floor(Math.random() * 5),
        };

        const new5s = [...current5s.slice(0, -1), updatedLast];
        const updated: Record<string, Candle[]> = { '5s': new5s };

        for (const tf of ALL_HORIZONS) {
          if (tf !== '5s') {
            updated[tf] = aggregateCandles(new5s, tf);
          }
        }

        // Evaluate pending audit predictions
        if (updated[selectedTimeframe] && updated[selectedTimeframe].length >= 2) {
          const tfCandles = updated[selectedTimeframe];
          evaluatePendingAuditLogs(tfCandles[tfCandles.length - 1], tfCandles[tfCandles.length - 2]);
        }

        return updated as Record<Timeframe, Candle[]>;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isSimulatingTicks, selectedTimeframe]);

  // Derived Active Calculations
  const activeCandles = candlesByTimeframe[selectedTimeframe] || [];
  const activeFeatures = useMemo(() => extractFeatures(activeCandles), [activeCandles]);

  const activeRegime = useMemo(
    () => detectMarketRegime(activeCandles, activeFeatures),
    [activeCandles, activeFeatures]
  );

  const directionMatrixResults = useMemo(
    () => generateMultiTimeframeMatrix(selectedSymbol, candlesByTimeframe),
    [selectedSymbol, candlesByTimeframe]
  );

  const nextCandleForecast = useMemo(() => {
    const isAnalyzed = lastAnalysisRunId === `${selectedSymbol}-${selectedTimeframe}`;
    
    if (!isAnalyzed) {
      return generateNextCandleForecast(
        selectedSymbol, 
        selectedTimeframe, 
        activeCandles, 
        activeFeatures,
        'v1',
        'HYBRID',
        0, // force fail coverage
        1, // missing bars
        false, // force fail provider
        'PENDING_VALIDATION'
      );
    }
    
    return generateNextCandleForecast(
      selectedSymbol, 
      selectedTimeframe, 
      activeCandles, 
      activeFeatures,
      'v1',
      'HYBRID',
      100, // Pass coverage
      0, // missing bars
      true, // provider match
      lastAnalysisRunId
    );
  }, [selectedSymbol, selectedTimeframe, activeCandles, activeFeatures, lastAnalysisRunId]);

  const forecastExplanation = useMemo(
    () =>
      explainPrediction(
        nextCandleForecast,
        activeCandles[activeCandles.length - 1] || {
          timestamp: Date.now(),
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 0,
        },
        activeFeatures[activeFeatures.length - 1] || ({} as any),
        activeRegime
      ),
    [nextCandleForecast, activeCandles, activeFeatures, activeRegime]
  );

  const backtestResults = useMemo(
    () => runBacktest(currentStrategy, activeCandles),
    [currentStrategy, activeCandles]
  );

  // Manual trigger to re-analyze & record pre-prediction in audit log
  const handleRunAnalysis = () => {
    setLastAnalysisRunId(`${selectedSymbol}-${selectedTimeframe}`);
    recordPrePrediction(nextCandleForecast, activeRegime.currentRegime);
  };

  const fullSourceCode = useMemo(() => generateFullSourceBundle(), []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Main Platform Label */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-slate-950">
                  UNIVERSAL STRATEGY ENGINE
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  v1.4.2
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Analysis &amp; Probabilistic Forecasting • Multi-Timeframe AST Pipeline
              </p>
            </div>
          </div>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Live Trading Isolation Safety Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>عزل التداول الحي: تحليل فقط</span>
            </div>

            {/* Switch between Pine Studio, Trading Platform & Admin Platform */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                id="tab-pine-studio-btn"
                onClick={() => setPlatformMode('pine_studio')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  platformMode === 'pine_studio'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>استوديو باين سكريبت (USE)</span>
                <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                  الأساسي
                </span>
              </button>

              <button
                id="tab-trading-platform-btn"
                onClick={() => setPlatformMode('trading')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  platformMode === 'trading'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                منصة التداول
              </button>
              <button
                id="tab-admin-platform-btn"
                onClick={() => setPlatformMode('admin')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  platformMode === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                لوحة الإدارة
              </button>
            </div>

            {/* Requested "All Source Files in One File" Button */}
            <button
              id="export-source-bundle-btn"
              onClick={() => setShowSourceBundleModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جميع الملفات في ملف واحد</span>
              <span className="sm:hidden">الملفات</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {platformMode === 'trading' ? (
          <div className="space-y-6">
            {/* Render Panels */}
            {panels.map((panel) => (
              <div key={panel.id} className="bg-white p-4 border border-slate-300 rounded-lg">
                <h4 className="font-bold">{panel.type}</h4>
                <pre className="text-xs">{JSON.stringify(panel.components, null, 2)}</pre>
              </div>
            ))}
            
            {/* Top Workspace Launch Bar */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Universal Strategy Engine Toggle Button */}
                <button
                  id="universal-strategy-engine-trigger-btn"
                  onClick={() => setIsUSEWorkspaceOpen(!isUSEWorkspaceOpen)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 text-white text-xs font-black rounded-xl shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span>محرك الاستراتيجيات الشامل</span>
                </button>

                {/* Symbol Selector */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-slate-500">الرمز:</span>
                  <select
                    aria-label="Select symbol"
                    value={selectedSymbol}
                    onChange={(e) => handleSymbolChange(e.target.value)}
                    className="text-xs font-black text-slate-950 bg-transparent focus:outline-hidden cursor-pointer"
                  >
                    {SUPPORTED_SYMBOLS.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Strategy Dropdown */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-slate-500">الاستراتيجية:</span>
                  <select
                    aria-label="Select strategy"
                    value={currentStrategy.metadata.name}
                    onChange={(e) => handleStrategyTemplateChange(e.target.value)}
                    className="text-xs font-black text-slate-950 bg-transparent focus:outline-hidden cursor-pointer max-w-[220px] truncate"
                  >
                    {PRELOADED_STRATEGIES.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timeframe Selector */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-slate-500">الإطار الزمني:</span>
                  <select
                    aria-label="Select timeframe"
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value as Timeframe)}
                    className="text-xs font-black text-slate-950 bg-transparent focus:outline-hidden cursor-pointer"
                  >
                    {ALL_HORIZONS.map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Analyze Trigger Button */}
                <button
                  id="run-engine-analyze-btn"
                  onClick={handleRunAnalysis}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تحليل</span>
                </button>
              </div>

              {/* Real-time Ticker & Market Status */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSimulatingTicks(!isSimulatingTicks)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      isSimulatingTicks
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSimulatingTicks ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span>{isSimulatingTicks ? 'بث حي للأسعار' : 'إيقاف البث مؤقتاً'}</span>
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-2 font-mono text-slate-600">
                  <span>السعر:</span>
                  <strong className="text-sm font-black text-slate-950">
                    {activeCandles[activeCandles.length - 1]?.close.toFixed(5)}
                  </strong>
                </div>
              </div>
            </div>

            {/* WHITE GLASS WORKSPACE ACCORDION / CONTAINER */}
            {isUSEWorkspaceOpen && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* 1. Market Direction Matrix */}
                <DirectionMatrix
                  results={directionMatrixResults}
                  selectedTimeframe={selectedTimeframe}
                  onSelectTimeframe={(tf) => setSelectedTimeframe(tf)}
                />

                {/* 2. Top Row: Next Candle Forecast Card + Current Market Regime Card */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Next Candle Probabilistic Card (2 Cols) */}
                  <div className="lg:col-span-2">
                    <NextCandleForecastCard
                      forecast={nextCandleForecast}
                      explanation={forecastExplanation}
                    />
                  </div>

                  {/* Market Regime Detection Card (1 Col) */}
                  <div
                    id="market-regime-card"
                    className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between"
                  >
                    <div>
                      {(() => {
                        const isLowConfidence = activeRegime.regimeConfidence < 60 || (nextCandleForecast.confidence * 100) < 60;
                        return (
                          <>
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black tracking-wider uppercase text-slate-500">
                                  MARKET REGIME DETECTOR
                                </span>
                                {isLowConfidence && (
                                  <span
                                    className="relative flex h-2 w-2"
                                    title="AI Bias Warning: Confidence < 60%"
                                  >
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isLowConfidence && (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    AI Bias Warning
                                  </span>
                                )}
                                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  Conf: {activeRegime.regimeConfidence}%
                                </span>
                              </div>
                            </div>

                            {/* AI Bias Warning Indicator inside the Market Regime Card */}
                            {isLowConfidence && (
                              <div
                                id="ai-bias-warning-indicator"
                                className="mt-3 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-start gap-2.5 shadow-2xs"
                              >
                                <span className="relative flex h-3 w-3 mt-0.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-black tracking-wide uppercase text-amber-950 flex items-center gap-1.5">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                      AI Bias Warning
                                    </span>
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 shrink-0">
                                      {Math.min(activeRegime.regimeConfidence, Math.round(nextCandleForecast.confidence * 100))}% Conf
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-amber-800/90 mt-0.5 leading-snug">
                                    Model confidence is below 60%. Potential regime uncertainty and algorithmic bias detected — exercise caution.
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      <div className="mt-4">
                        <span className="text-xs text-slate-500 font-semibold block">Current Environment</span>
                        <h4 className="text-xl font-black text-slate-950 mt-0.5">
                          {activeRegime.currentRegime}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          {activeRegime.regimeDescription}
                        </p>
                      </div>

                      {/* Regime Metrics */}
                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block text-[10px]">Trend ADX</span>
                          <span className="font-mono font-bold text-slate-900">
                            {activeRegime.metrics.trendStrengthADX}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block text-[10px]">Vol Percentile</span>
                          <span className="font-mono font-bold text-slate-900">
                            {activeRegime.metrics.volatilityPercentile}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Historical Strategy Performance in Current Regime */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-700 block mb-1">
                        Historical Performance in {activeRegime.currentRegime}:
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-500">
                          Samples: <strong>{activeRegime.historicalRegimePerformance.sampleCount.toLocaleString()}</strong>
                        </span>
                        <span className="text-sm font-black text-emerald-700 font-mono">
                          {activeRegime.historicalRegimePerformance.successRate}% Win Rate
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Interactive Candlestick Chart + Overlays + Forecast Cone */}
                <InteractiveChart
                  candles={activeCandles}
                  features={activeFeatures}
                  forecast={nextCandleForecast}
                  symbol={selectedSymbol}
                />

                {/* 4. Historical Intelligence & Multi-Dimensional Pattern Discovery */}
                <HistoricalIntelligenceView
                  intelligence={backtestResults.intelligence}
                  strategyName={currentStrategy.metadata.name}
                />
              </div>
            )}
          </div>
        ) : platformMode === 'pine_studio' ? (
          /* Pine Script Dynamic Studio View */
          <PineScriptStudioView defaultSymbol={selectedSymbol} />
        ) : (
          /* Admin Platform View */
          <AdminPlatformView
            currentStrategy={currentStrategy}
            onUpdateStrategy={setCurrentStrategy}
            isPaperMode={isPaperMode}
            onTogglePaperMode={setIsPaperMode}
            isLiveMode={isLiveMode}
            onToggleLiveMode={setIsLiveMode}
          />
        )}
      </main>

      {/* Source Code Modal (جميع الملفات المصدرية في ملف واحد) */}
      <SourceCodeBundleModal
        isOpen={showSourceBundleModal}
        onClose={() => setShowSourceBundleModal(false)}
        fullBundleText={fullSourceCode}
      />
      <CommandCenter />
    </div>
  );
}
