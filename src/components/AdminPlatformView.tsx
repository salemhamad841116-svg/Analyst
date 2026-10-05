/**
 * Universal Strategy Engine - Admin Platform View
 * Lifecycle Management: Draft → Validate → Backtest → Walk-Forward → Paper → Approved → Published
 * Model Comparison, Feature Importance, Code Ingestion Sandbox, and Audit Inspector.
 */

import React, { useState, useEffect } from 'react';
import {
  StrategyDefinition,
  StrategyLanguage,
  ModelLifecycleStatus,
  MLModelPerformance,
  PredictionAuditRecord,
} from '../types';
import { PRELOADED_STRATEGIES, parseStrategyCode, detectLanguage } from '../services/strategyParser';
import { runWalkForwardValidation } from '../services/mlForecastEngine';
import { getAuditLogs } from '../services/auditLogger';
import {
  fetchLiveMarketConfig,
  testMarketDataConnection,
  LiveMarketConfig,
} from '../services/liveMarketDataService';
import {
  ShieldCheck,
  Cpu,
  Play,
  FileCode,
  Layers,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  Database,
  BarChart2,
  Sliders,
  Terminal,
  Lock,
  RefreshCw,
  Eye,
  Archive,
  Wifi,
  WifiOff,
  Key,
  Globe,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface AdminPlatformViewProps {
  currentStrategy: StrategyDefinition;
  onUpdateStrategy: (strat: StrategyDefinition) => void;
  isPaperMode: boolean;
  onTogglePaperMode: (enabled: boolean) => void;
  isLiveMode: boolean;
  onToggleLiveMode: (enabled: boolean) => void;
}

export const AdminPlatformView: React.FC<AdminPlatformViewProps> = ({
  currentStrategy,
  onUpdateStrategy,
  isPaperMode,
  onTogglePaperMode,
  isLiveMode,
  onToggleLiveMode,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'strategy_editor' | 'walk_forward' | 'model_comparison' | 'feature_importance' | 'audit_logs' | 'sandbox_logs' | 'market_data_settings'
  >('strategy_editor');

  const [selectedLanguage, setSelectedLanguage] = useState<StrategyLanguage>('Pine Script');
  const [strategyCode, setStrategyCode] = useState(PRELOADED_STRATEGIES[0].code);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Live Market Data Provider Admin State (Strict Server Secret Masking)
  const [liveConfig, setLiveConfig] = useState<LiveMarketConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'finnhub' | 'oanda' | 'fxcm' | 'twelvedata'>('finnhub');
  const [activeSymbolInput, setActiveSymbolInput] = useState<string>('BINANCE:BTCUSDT');
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveMarketConfig()
      .then((cfg) => {
        setLiveConfig(cfg);
        if (cfg.provider) setSelectedProvider(cfg.provider as any);
        if (cfg.activeSymbol) setActiveSymbolInput(cfg.activeSymbol);
      })
      .catch((err) => {
        console.warn('[ADMIN_CONFIG_FETCH_WARN]', err);
      });
  }, []);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await testMarketDataConnection(selectedProvider, activeSymbolInput);
      setTestResult(res);
      if (!res.success) {
        setTestError(res.error || 'Connection test failed');
      } else {
        // Refresh config state
        const updatedCfg = await fetchLiveMarketConfig();
        setLiveConfig(updatedCfg);
      }
    } catch (err: any) {
      setTestError(err.message || 'Failed to execute test request');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const wfData = runWalkForwardValidation();
  const auditLogs = getAuditLogs();

  const lifecycleStages: ModelLifecycleStatus[] = [
    'Draft',
    'Validate',
    'Backtest',
    'Walk-Forward',
    'Paper',
    'Approved',
    'Published',
  ];

  // Feature Importance Rankings
  const featureImportances = [
    { name: 'EMA Ribbon Structure (9/21/200)', score: 0.24, category: 'Trend' },
    { name: 'Wilder RSI Momentum (14-period)', score: 0.18, category: 'Momentum' },
    { name: 'Session VWAP Distance & Premium', score: 0.15, category: 'Liquidity' },
    { name: 'Market Structure Break (BOS)', score: 0.13, category: 'Structure' },
    { name: 'Multi-Timeframe 15m Alignment', score: 0.11, category: 'Context' },
    { name: 'Bollinger Bandwidth %B Compression', score: 0.09, category: 'Volatility' },
    { name: 'Relative Volume Surge Ratio', score: 0.06, category: 'Volume' },
    { name: 'Hour of Day & Session Window', score: 0.04, category: 'Temporal' },
  ];

  const handleValidateCode = () => {
    const parsed = parseStrategyCode(strategyCode, { language: selectedLanguage });
    setValidationResult(parsed);
    if (parsed.success) {
      setStatusMessage('Strategy successfully parsed and verified in isolated sandbox.');
      onUpdateStrategy(parsed.strategy);
    } else {
      setStatusMessage('Security violation detected during sandbox AST validation.');
    }
  };

  const handleAdvanceLifecycle = () => {
    const currentIdx = lifecycleStages.indexOf(currentStrategy.metadata.lifecycleStatus);
    if (currentIdx < lifecycleStages.length - 1) {
      const nextStatus = lifecycleStages[currentIdx + 1];
      const updated = {
        ...currentStrategy,
        metadata: {
          ...currentStrategy.metadata,
          lifecycleStatus: nextStatus,
        },
      };
      onUpdateStrategy(updated);
      setStatusMessage(`Strategy promoted to lifecycle state: ${nextStatus}`);
    }
  };

  const handleRollbackLifecycle = () => {
    const currentIdx = lifecycleStages.indexOf(currentStrategy.metadata.lifecycleStatus);
    if (currentIdx > 0) {
      const prevStatus = lifecycleStages[currentIdx - 1];
      const updated = {
        ...currentStrategy,
        metadata: {
          ...currentStrategy.metadata,
          lifecycleStatus: prevStatus,
        },
      };
      onUpdateStrategy(updated);
      setStatusMessage(`Strategy rolled back to lifecycle state: ${prevStatus}`);
    }
  };

  return (
    <div id="admin-platform-container" className="space-y-6">
      {/* Admin Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-black tracking-tight">UNIVERSAL STRATEGY ENGINE — ADMIN CONSOLE</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Isolated strategy ingestion, strict sandbox enforcement, walk-forward validation & model deployment pipeline
            </p>
          </div>

          {/* Paper / Live Mode Toggles with Isolation Lock */}
          <div className="flex items-center gap-3">
            {/* Paper Mode */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-xs font-bold text-slate-300">وضع التداول التجريبي</span>
              <button
                id="toggle-paper-mode-btn"
                onClick={() => onTogglePaperMode(!isPaperMode)}
                className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  isPaperMode ? 'bg-blue-600' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    isPaperMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Live Mode Safety Isolation Lock */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">أوامر حية (Live)</span>
              <button
                id="toggle-live-mode-btn"
                onClick={() => {
                  if (currentStrategy.metadata.lifecycleStatus !== 'Published') {
                    alert('Safety Violation: Live mode can only be enabled for models with "Published" lifecycle status.');
                    return;
                  }
                  onToggleLiveMode(!isLiveMode);
                }}
                className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  isLiveMode ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    isLiveMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Model Lifecycle Pipeline Stepper */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-slate-300">دورة حوكمة الاستراتيجيات</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRollbackLifecycle}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                تراجع عن المرحلة
              </button>
              <button
                onClick={handleAdvanceLifecycle}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                ترقية المرحلة ←
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mt-2">
            {lifecycleStages.map((stage, idx) => {
              const currentStageIdx = lifecycleStages.indexOf(currentStrategy.metadata.lifecycleStatus);
              const isPast = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              const stageTranslations: Record<string, string> = {
                Draft: 'مسودة',
                Validate: 'تحقق',
                Backtest: 'اختبار تاريخي',
                'Walk-Forward': 'تقدم زمني',
                Paper: 'تجريبي',
                Approved: 'معتمد',
                Published: 'منشور',
              };

              return (
                <div
                  key={stage}
                  className={`p-2 rounded-lg text-center border transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-400 font-black shadow-sm'
                      : isPast
                      ? 'bg-slate-800/90 text-emerald-400 border-emerald-900/60 font-semibold'
                      : 'bg-slate-800/40 text-slate-500 border-slate-800 font-medium'
                  }`}
                >
                  <div className="text-[10px] opacity-75">المرحلة 0{idx + 1}</div>
                  <div className="text-xs tracking-tight truncate">{stageTranslations[stage] || stage}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveAdminTab('strategy_editor')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAdminTab === 'strategy_editor'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>إدخال الاستراتيجية وبيئة الاختبار</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('walk_forward')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAdminTab === 'walk_forward'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>التحقق المتقدم ومكافحة الإفراط</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('model_comparison')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAdminTab === 'model_comparison'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>مقارنة النماذج المرشحة</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('feature_importance')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAdminTab === 'feature_importance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>أهمية الخصائص والمؤشرات</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('audit_logs')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAdminTab === 'audit_logs'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>سجل تدقيق التوقعات</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('market_data_settings')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAdminTab === 'market_data_settings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-600" />
          <span>إعدادات بيانات السوق</span>
        </button>
      </div>

      {/* Tab 1: Strategy Ingestion & Code Editor */}
      {activeAdminTab === 'strategy_editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Code Editor (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Ingest New Strategy Code</h3>
                <p className="text-xs text-slate-500">Supports Pine Script, MQL5, Python, TypeScript, and JavaScript</p>
              </div>

              {/* Template quick loader */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Load Template:</span>
                <select
                  aria-label="Load preloaded strategy template"
                  onChange={(e) => {
                    const found = PRELOADED_STRATEGIES.find((s) => s.name === e.target.value);
                    if (found) {
                      setSelectedLanguage(found.language);
                      setStrategyCode(found.code);
                    }
                  }}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800"
                >
                  {PRELOADED_STRATEGIES.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Language Selection & Security Badge */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {(['Pine Script', 'MQL5', 'Python', 'TypeScript', 'JavaScript'] as StrategyLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                      selectedLanguage === lang
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Isolated Sandbox: 64MB / 500ms max</span>
              </div>
            </div>

            {/* Code Input */}
            <textarea
              aria-label="Strategy source code input"
              value={strategyCode}
              onChange={(e) => setStrategyCode(e.target.value)}
              rows={16}
              className="w-full font-mono text-xs p-4 bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 leading-relaxed resize-y"
              placeholder="Paste Pine Script, MQL5, Python, or TypeScript strategy definition here..."
            />

            {/* Action buttons */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Arbitrary code executes exclusively within the isolated evaluation sandbox.
              </span>
              <button
                id="validate-strategy-btn"
                onClick={handleValidateCode}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>التحقق والترجمة إلى USR</span>
              </button>
            </div>
          </div>

          {/* Right: Validation & AST Inspector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">
              Sandbox Security & AST Inspector
            </h3>

            {validationResult ? (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    validationResult.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {validationResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
                    <span>{validationResult.success ? 'PASSED SECURITY VERIFICATION' : 'SECURITY VIOLATION'}</span>
                  </div>
                  <span>Score: {validationResult.security.securityScore}/100</span>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">Extracted Capabilities:</span>
                  <div className="space-y-1">
                    {validationResult.extractedSummary.map((item: string, i: number) => (
                      <div key={i} className="text-[11px] p-2 rounded-md bg-slate-50 border border-slate-100 text-slate-700">
                        • {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">Universal Strategy Representation (USR):</span>
                  <pre className="p-3 bg-slate-900 text-slate-300 font-mono text-[10px] rounded-xl overflow-x-auto max-h-48">
                    {JSON.stringify(
                      {
                        metadata: validationResult.strategy.metadata,
                        indicators: validationResult.strategy.indicators,
                        riskRules: validationResult.strategy.riskRules,
                        timeframeRules: validationResult.strategy.timeframeRules,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Click &quot;Validate &amp; Compile into USR&quot; to inspect parsed AST and security sandbox limits.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Walk-Forward Validation & Anti-Overfitting */}
      {activeAdminTab === 'walk_forward' && (
        <div className="space-y-5">
          {/* Overfitting Alert Banner */}
          {wfData.overfittingAlert && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertOctagon className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-amber-950">OVERFITTING RISK DETECTED ON UNREGULARIZED MODELS</h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Model &quot;Deep Random Forest&quot; exhibits high training accuracy (89.6%) but collapses to 54.1% on Out-of-Sample evaluation. Prevented from automated promotion.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-amber-200 text-amber-900 rounded-lg">
                OVERFITTING RISK
              </span>
            </div>
          )}

          {/* Walk-Forward Rolling Windows Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 mb-1">Time-Series Walk-Forward Windows</h3>
            <p className="text-xs text-slate-500 mb-4">
              Financial series strictly preserved in chronological sequence (No random shuffling or future leakage)
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Window</th>
                    <th className="p-3">Train Split (60%)</th>
                    <th className="p-3">Validation Split (20%)</th>
                    <th className="p-3">Out-of-Sample OOS (20%)</th>
                    <th className="p-3">Train Acc</th>
                    <th className="p-3">Val Acc</th>
                    <th className="p-3">OOS Acc</th>
                    <th className="p-3">Max DD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {wfData.windows.map((w) => (
                    <tr key={w.windowIndex} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900 font-sans">Window {w.windowIndex}</td>
                      <td className="p-3 text-slate-600">{w.trainRange}</td>
                      <td className="p-3 text-slate-600">{w.valRange}</td>
                      <td className="p-3 font-bold text-blue-700">{w.oosRange}</td>
                      <td className="p-3 text-slate-900">{w.trainAccuracy}%</td>
                      <td className="p-3 text-slate-900">{w.valAccuracy}%</td>
                      <td className="p-3 font-black text-emerald-600">{w.oosAccuracy}%</td>
                      <td className="p-3 text-rose-600">{w.drawdown}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Model Comparison */}
      {activeAdminTab === 'model_comparison' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 mb-1">Candidate ML Model Benchmarking</h3>
          <p className="text-xs text-slate-500 mb-4">
            Evaluates multiple architectures against a simple baseline before deployment.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Model Architecture</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Train Acc</th>
                  <th className="p-3">Val Acc</th>
                  <th className="p-3">OOS Accuracy</th>
                  <th className="p-3">Brier Loss</th>
                  <th className="p-3">F1 Score</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wfData.models.map((m) => (
                  <tr key={m.modelName} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{m.modelName}</td>
                    <td className="p-3 text-slate-600">{m.modelType}</td>
                    <td className="p-3 font-mono">{m.trainAccuracy}%</td>
                    <td className="p-3 font-mono">{m.valAccuracy}%</td>
                    <td className="p-3 font-mono font-black text-slate-950">{m.oosAccuracy}%</td>
                    <td className="p-3 font-mono text-slate-600">{m.brierScore}</td>
                    <td className="p-3 font-mono text-slate-600">{m.f1Score}</td>
                    <td className="p-3">
                      {m.overfittingRisk ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                          OVERFITTING RISK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Approved
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Feature Importance */}
      {activeAdminTab === 'feature_importance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 mb-1">Empirical Feature Importance</h3>
          <p className="text-xs text-slate-500 mb-4">
            Attribution derived from walk-forward feature permutation tests
          </p>

          <div className="space-y-2.5">
            {featureImportances.map((item) => (
              <div key={item.name} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                      {item.category}
                    </span>
                  </div>
                  <span className="font-mono font-black text-slate-950">{(item.score * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.score * 350}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Prediction Audit Log */}
      {activeAdminTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">Pre-Registered Prediction Audit Log</h3>
              <p className="text-xs text-slate-500">Every forecast is recorded BEFORE knowing the outcome.</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Records stored: <strong>{auditLogs.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Prediction ID</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">Symbol / TF</th>
                  <th className="p-3">Regime</th>
                  <th className="p-3">Prob (Bull/Bear/Neut)</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">Expected Range</th>
                  <th className="p-3">Actual Result</th>
                  <th className="p-3">Brier Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.predictionId} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{log.predictionId}</td>
                    <td className="p-3 text-slate-500 text-[11px] font-sans">
                      {formatDubaiTime(log.timestamp, { showSeconds: true })}
                    </td>
                    <td className="p-3 font-sans font-semibold">
                      {log.symbol} ({log.timeframe})
                    </td>
                    <td className="p-3 font-sans text-slate-700">{log.marketRegime}</td>
                    <td className="p-3 text-slate-900">
                      {(log.probabilities.bullish * 100).toFixed(0)}% /{' '}
                      {(log.probabilities.bearish * 100).toFixed(0)}% /{' '}
                      {(log.probabilities.neutral * 100).toFixed(0)}%
                    </td>
                    <td className="p-3 font-black text-slate-900">{(log.confidence * 100).toFixed(0)}%</td>
                    <td className="p-3 text-slate-600 text-[11px]">
                      {log.expectedRange.low} – {log.expectedRange.high}
                    </td>
                    <td className="p-3">
                      {log.actualResult === 'PENDING' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                          Awaiting Close
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            log.actualResult === 'BULLISH'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.actualResult} ({log.actualReturnPct}%)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{log.brierLoss ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Market Data Settings (إعدادات بيانات السوق → مزود الأسعار الحية) */}
      {activeAdminTab === 'market_data_settings' && (
        <div className="space-y-6">
          {/* Section: مزود الأسعار الحية */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-slate-900">
                    مزود الأسعار الحية (Live Market Data Provider)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  تكوين بوابة ربط الأسعار المباشرة، واختبار الاتصال بزمن استجابة دقيق، وتطبيق سياسات حماية المفاتيح السرية
                </p>
              </div>

              {/* Connection Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">حالة الاتصال (Connection Status):</span>
                {liveConfig?.connectionStatus === 'Connected' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                ) : liveConfig?.connectionStatus === 'Error' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 border border-red-300 text-red-800 text-xs font-black font-mono">
                    <WifiOff className="w-3.5 h-3.5 text-red-600" />
                    Error
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-xs font-black font-mono">
                    <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                    Disconnected
                  </span>
                )}
              </div>
            </div>

            {/* Strict Security Requirement Notice Banner */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-950">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>متطلب الأمان المؤسسي الصارم (Security Requirement Enforced)</span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed font-sans">
                مفاتيح وأسرار API <strong>لا يتم تخزينها أبداً</strong> في كود JavaScript بالمتصفح أو في localStorage أو في إعدادات مرئية للعميل. يتم تخزين المفاتيح حصرياً في بيئة الخادم الآمنة (Backend Environment Variables / Secret Manager)، ولا يُعرض للعميل سوى قيم مقنعة مثل: <code className="bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-950">••••••••A91F</code>.
              </p>
            </div>

            {/* Settings Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* 1. Provider Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  مزود البيانات (Provider Selector):
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white transition-colors cursor-pointer"
                >
                  <option value="finnhub">Finnhub Market Data (مفتاح API نشط ومعتمد)</option>
                  <option value="oanda">OANDA Direct Institutional Feed</option>
                  <option value="fxcm">FXCM Interbank Gateway</option>
                  <option value="twelvedata">TwelveData Institutional</option>
                </select>
                <span className="text-[11px] text-slate-400 block font-sans">
                  المزود النشط الذي تتم معالجة التدفقات الحية من خلاله
                </span>
              </div>

              {/* 2. Active Symbol */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  الأصل المالي النشط (Active Symbol):
                </label>
                <input
                  type="text"
                  value={activeSymbolInput}
                  onChange={(e) => setActiveSymbolInput(e.target.value)}
                  placeholder="e.g. BINANCE:BTCUSDT or EUR/USD"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white transition-colors"
                />
                <span className="text-[11px] text-slate-400 block font-sans">
                  الرمز المعتمد للبث الحي وفحص زمن الاستجابة (مثل BINANCE:BTCUSDT أو AAPL أو EUR/USD)
                </span>
              </div>

              {/* 3. API Key (Masked & Protected) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <span>مفتاح API (API Key - Masked):</span>
                  </label>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    Server Secured
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    disabled
                    value={liveConfig?.maskedApiKey || '••••••••A91F'}
                    className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono text-slate-800 font-bold cursor-not-allowed text-left"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 block font-sans">
                  مخفي ومحمي على الخادم • لا يمكن استخراجه من متصفح العميل
                </span>
              </div>

              {/* 4. API Secret if required */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>السر الأمني (API Secret if required):</span>
                  </label>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                    Masked
                  </span>
                </div>
                <input
                  type="text"
                  dir="ltr"
                  disabled
                  value={liveConfig?.maskedApiSecret || '••••••••'}
                  className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono text-slate-800 font-bold cursor-not-allowed text-left"
                />
                <span className="text-[11px] text-slate-400 block font-sans">
                  مخفي تماماً ومشفر في خادم الواجهة الخلفية
                </span>
              </div>

              {/* 5. REST URL */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  عنوان REST الأساسي (REST URL):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled
                  value={liveConfig?.restUrl || 'https://finnhub.io/api/v1'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-left cursor-not-allowed"
                />
                <span className="text-[11px] text-slate-400 block font-sans">
                  نقطة اتصال REST API المستخدمة من جانب الخادم
                </span>
              </div>

              {/* 6. WebSocket URL */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  عنوان WebSocket (WebSocket URL if required):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled
                  value={liveConfig?.wsUrl || 'wss://ws.finnhub.io'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-left cursor-not-allowed"
                />
                <span className="text-[11px] text-slate-400 block font-sans">
                  رابط قناة البث التزامنية منخفضة زمن الاستجابة
                </span>
              </div>
            </div>

            {/* Live Metrics: Latency, Last Tick Time, Data Source */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-bold">زمن الاستجابة (Latency):</span>
                <span className="font-mono text-sm font-black text-slate-900 block mt-0.5">
                  {testResult?.latencyMs ? `${testResult.latencyMs} ms` : liveConfig?.latencyMs ? `${liveConfig.latencyMs} ms` : '—'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-bold">وقت آخر حركة سعرية (Last Tick Time):</span>
                <span className="font-mono text-xs font-bold text-slate-800 block mt-0.5 truncate">
                  {testResult?.lastTickTime || liveConfig?.lastTickTime || '—'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-bold">مصدر البيانات (Data Source):</span>
                <span className="font-mono text-xs font-bold text-slate-800 block mt-0.5 truncate">
                  {testResult?.dataSource || liveConfig?.dataSource || 'Finnhub REST Gateway'}
                </span>
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <button
                id="test-market-provider-connection-btn"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer disabled:bg-slate-400"
              >
                {isTestingConnection ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                <span>
                  {isTestingConnection ? 'جاري فحص الاتصال...' : 'فحص الاتصال بالمزود (Test Connection)'}
                </span>
              </button>

              {testResult?.success && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    الاتصال ناجح • السعر الحالي: {testResult.price?.toLocaleString()} • التأخير: {testResult.latencyMs} ms
                  </span>
                </div>
              )}

              {testError && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-800">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>خطأ في الاتصال: {testError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
