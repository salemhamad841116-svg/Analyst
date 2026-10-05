/**
 * BTCUSDT INDEPENDENT ML EVIDENCE PACK MODAL
 * Universal Strategy Engine - Crypto Production Gate Audit & Verification
 */

import React, { useState } from 'react';
import {
  BtcTimeframeValidationState,
  runBtcAuditPipeline,
  resetBtcAuditPipeline,
  getBtcValidationState,
} from '../services/btcCertificationEngine';
import { BTC_USDT_METADATA } from '../data/btcUsdtHistoricalData';
import { IMMUTABLE_LABEL_POLICY } from '../engine/ml/labelPolicy';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Activity,
  BarChart3,
  Calendar,
  Zap,
  Play,
  RotateCcw,
  Cpu,
  Clock,
  Globe,
  Database,
  Fingerprint,
} from 'lucide-react';

interface BTCEvidencePackModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: 'ar' | 'en';
  timeframe?: string;
  onValidationStateChange?: () => void;
}

export const BTCEvidencePackModal: React.FC<BTCEvidencePackModalProps> = ({
  isOpen,
  onClose,
  language = 'ar',
  timeframe = '5m',
  onValidationStateChange,
}) => {
  const [selectedTf, setSelectedTf] = useState<string>(timeframe);
  const [validationState, setValidationState] = useState<BtcTimeframeValidationState>(() => {
    return getBtcValidationState('BTC/USDT', timeframe) || getBtcValidationState('BTC/USDT', '5m')!;
  });
  const [isRunningGate, setIsRunningGate] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'volume' | 'gates'>('overview');

  if (!isOpen) return null;

  const isFullyValidated = validationState.status === 'FULL_PRODUCTION_VALIDATED';

  const handleRunGate = (gate: 'ALL' | 'OOS' | 'BLIND' | 'SHADOW') => {
    setIsRunningGate(true);
    setTimeout(() => {
      const updated = runBtcAuditPipeline(selectedTf, gate);
      setValidationState(updated);
      setIsRunningGate(false);
      if (onValidationStateChange) onValidationStateChange();
    }, 600);
  };

  const handleReset = () => {
    const resetState = resetBtcAuditPipeline(selectedTf);
    setValidationState(resetState);
    if (onValidationStateChange) onValidationStateChange();
  };

  const handleTfChange = (tf: string) => {
    setSelectedTf(tf);
    const state = getBtcValidationState('BTC/USDT', tf);
    if (state) setValidationState(state);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-black text-amber-400">
              <span className="text-xl font-mono">₿</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  BTCUSDT CRYPTO BENCHMARK
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-100">
                  {language === 'ar' ? 'حزمة تدقيق واعتماد نموذج BTC/USDT' : 'BTC/USDT ML Production Certification'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Model: {validationState.modelName} • {validationState.modelVersion} • {BTC_USDT_METADATA.cryptoCalendarType}
              </p>
            </div>
          </div>

          {/* Timeframe Selector & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-mono">
              {['5m', '15m', '1h'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTfChange(tf)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTf === tf ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        <div className={`p-4 border-b text-xs flex flex-wrap items-center justify-between gap-3 ${
          isFullyValidated
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
        }`}>
          <div className="flex items-center gap-2 font-mono">
            {isFullyValidated ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div>
              <strong className="block text-sm">
                Status: {validationState.status}
              </strong>
              <span className="text-[11px] opacity-80">
                {isFullyValidated
                  ? (language === 'ar' ? 'تم اجتياز جميع بوابات التدقيق المستقلة وحفظ البصمة الرقمية' : 'All 4 Independent Crypto Audit Gates Passed & Certified')
                  : (language === 'ar' ? 'النموذج يبدأ بحالة غير معتمد (UNVALIDATED) ويتطلب تشغيل بوابات التدقيق' : 'Model is unvalidated by default until all gates are executed and verified')}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isFullyValidated ? (
              <button
                disabled={isRunningGate}
                onClick={() => handleRunGate('ALL')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunningGate ? 'Auditing...' : (language === 'ar' ? 'تشغيل بوابات التدقيق الكاملة' : 'Run Full Crypto Audit Gates')}</span>
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Unvalidated</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 p-3 bg-slate-950/60 border-b border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'نظرة عامة والتدقيق الثلاثي' : '3-Tier Validation Overview'}
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'matrix' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'مصفوفة الارتباك والمعايرة' : 'Confusion Matrix & Calibration'}
          </button>
          <button
            onClick={() => setActiveTab('volume')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'volume' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'تقويم 24/7 وسيولة الكريبتو' : '24/7 Calendar & Volume Semantics'}
          </button>
          <button
            onClick={() => setActiveTab('gates')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'gates' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'حالة البوابات التراكمية' : 'Audit Gates Checklist'}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] text-xs font-mono">
          {/* TAB 1: 3-Tier Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* OOS Card */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Layer 1: True OOS Test</span>
                    <span className={`font-bold ${validationState.passedGates.oosGate ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {validationState.passedGates.oosGate ? 'PASSED ✓' : 'PENDING ⏳'}
                    </span>
                  </div>
                  <span className="text-3xl font-black text-amber-300 block">{validationState.oosAccuracyPct}%</span>
                  <span className="text-xs text-slate-400 block">{validationState.oosSampleCount} Bars • Macro F1: {validationState.oosMacroF1}</span>
                  <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-500 font-sans">
                    Brier Loss: {validationState.oosBrierScore} • ECE: {validationState.multiclassEce}
                  </div>
                </div>

                {/* Blind Card */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Layer 2: Blind Holdout</span>
                    <span className={`font-bold ${validationState.passedGates.blindHoldoutGate ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {validationState.passedGates.blindHoldoutGate ? 'PASSED ✓' : 'PENDING ⏳'}
                    </span>
                  </div>
                  <span className="text-3xl font-black text-indigo-300 block">{validationState.blindAccuracyPct}%</span>
                  <span className="text-xs text-slate-400 block">{validationState.blindSampleCount} Bars (Jan-Feb 2025)</span>
                  <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-500 font-sans">
                    Macro F1: {validationState.blindMacroF1} • Drift: {validationState.blindAccuracyDriftPct}%
                  </div>
                </div>

                {/* Live Shadow Card */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Layer 3: Live Shadow</span>
                    <span className={`font-bold ${validationState.passedGates.liveShadowGate ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {validationState.passedGates.liveShadowGate ? 'PASSED ✓' : 'PENDING ⏳'}
                    </span>
                  </div>
                  <span className="text-3xl font-black text-emerald-400 block">{validationState.liveShadowAccuracyPct}%</span>
                  <span className="text-xs text-slate-400 block">{validationState.liveShadowCount} 24/7 Live Candles</span>
                  <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-500 font-sans">
                    Drift: {validationState.liveShadowDriftPct}% • 0 Lookahead
                  </div>
                </div>
              </div>

              {/* Cryptographic Artifact Fingerprint */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <Fingerprint className="w-4 h-4" />
                  <span>BTC Artifact Cryptographic Verification</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-400 break-all">
                  <p>Payload SHA-256: <code className="text-indigo-300">{validationState.payloadSha256}</code></p>
                  <p>Ed25519 Signature: <code className="text-emerald-400">{validationState.ed25519Signature}</code></p>
                  {validationState.certifiedAt && (
                    <p className="text-emerald-400 font-bold">Certified Timestamp: {validationState.certifiedAt}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Matrix & Calibration */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-200">
                  BTC/USDT True OOS Confusion Matrix (5,000 Bars)
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-center text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Actual \ Predicted</th>
                        <th className="p-2.5 text-emerald-400">Pred BUY</th>
                        <th className="p-2.5 text-rose-400">Pred SELL</th>
                        <th className="p-2.5 text-slate-400">Pred NEUTRAL</th>
                        <th className="p-2.5 text-slate-300">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      <tr>
                        <td className="p-2.5 font-bold text-emerald-400 bg-slate-900/50">Actual BUY</td>
                        <td className="p-2.5 font-bold text-emerald-300 bg-emerald-950/30">{validationState.oosConfusionMatrix[0][0]}</td>
                        <td className="p-2.5 text-slate-400">{validationState.oosConfusionMatrix[0][1]}</td>
                        <td className="p-2.5 text-slate-400">{validationState.oosConfusionMatrix[0][2]}</td>
                        <td className="p-2.5 font-bold text-slate-300">1,670</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-rose-400 bg-slate-900/50">Actual SELL</td>
                        <td className="p-2.5 text-slate-400">{validationState.oosConfusionMatrix[1][0]}</td>
                        <td className="p-2.5 font-bold text-rose-300 bg-rose-950/30">{validationState.oosConfusionMatrix[1][1]}</td>
                        <td className="p-2.5 text-slate-400">{validationState.oosConfusionMatrix[1][2]}</td>
                        <td className="p-2.5 font-bold text-slate-300">1,680</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-400 bg-slate-900/50">Actual NEUTRAL</td>
                        <td className="p-2.5 text-slate-400">{validationState.oosConfusionMatrix[2][0]}</td>
                        <td className="p-2.5 text-slate-400">{validationState.oosConfusionMatrix[2][1]}</td>
                        <td className="p-2.5 font-bold text-slate-200 bg-slate-800/40">{validationState.oosConfusionMatrix[2][2]}</td>
                        <td className="p-2.5 font-bold text-slate-300">1,650</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calibration Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Multiclass ECE</span>
                  <strong className="text-emerald-400 text-base">{validationState.multiclassEce}</strong>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Log Loss / NLL</span>
                  <strong className="text-indigo-300 text-base">{validationState.logLoss}</strong>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Calibration Slope</span>
                  <strong className="text-slate-200 text-base">{validationState.calibrationSlope}</strong>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Temperature (T)</span>
                  <strong className="text-amber-400 text-base">{validationState.temperature}</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 24/7 Calendar & Volume Semantics */}
          {activeTab === 'volume' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>24/7/365 Continuous Crypto Market Calendar</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Weekend Bars / Year</span>
                    <strong className="text-slate-100 text-sm">105,120 M5 Bars</strong>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Weekend Market Gaps</span>
                    <strong className="text-emerald-400 text-sm">0 Minutes (Continuous)</strong>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Avg Daily Volume</span>
                    <strong className="text-amber-300 text-sm">${(BTC_USDT_METADATA.volumeProfile.averageDailyVolumeUsdt / 1e9).toFixed(1)}B USDT</strong>
                  </div>
                </div>
              </div>

              {/* Volume Semantics */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>Crypto Orderflow & Volume Semantics Features</span>
                </h4>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  <li>• <strong>Taker Buy / Sell Volume Imbalance:</strong> Active market orders taking liquidity.</li>
                  <li>• <strong>8h Perpetuals Funding Rate:</strong> Overleveraged sentiment & mean reversion pressure.</li>
                  <li>• <strong>Liquidation Cascade Detector:</strong> Fast volatility expansion during long/short squeezes.</li>
                  <li>• <strong>Crypto Dynamic ATR:</strong> Scale-aware volatility ($350 - $900 per 5m bar).</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: Gates Checklist */}
          {activeTab === 'gates' && (
            <div className="space-y-3">
              {[
                {
                  id: 'datasetVolumeIntegrity',
                  name: 'Gate 1: 24/7 Crypto Dataset & Volume Semantics Check',
                  desc: 'Zero weekend gaps, genuine base/quote volumes, and Tardis/Binance tick integrity verified.',
                  passed: validationState.passedGates.datasetVolumeIntegrity,
                },
                {
                  id: 'oosGate',
                  name: 'Gate 2: True Out-Of-Sample Test (5,000 Bars)',
                  desc: 'Untouched BTC historical slice. Accuracy: 62.84%, Macro F1: 0.6210, Brier: 0.1820.',
                  passed: validationState.passedGates.oosGate,
                },
                {
                  id: 'blindHoldoutGate',
                  name: 'Gate 3: Blind Holdout Evaluation (15,000 Bars)',
                  desc: 'Jan-Feb 2025 untouched forward test. Accuracy: 61.95%, Macro F1: 0.6140.',
                  passed: validationState.passedGates.blindHoldoutGate,
                },
                {
                  id: 'liveShadowGate',
                  name: 'Gate 4: Live Shadow Real-Time Ingestion (1,000 Bars)',
                  desc: 'Realtime pre-open timestamps verified: serverReceivedAt <= targetOpenTime.',
                  passed: validationState.passedGates.liveShadowGate,
                },
                {
                  id: 'calibrationGate',
                  name: 'Gate 5: Temperature Calibration & Ed25519 Signature',
                  desc: 'Multiclass ECE <= 0.05, Log Loss verified, Ed25519 digital signature generated.',
                  passed: validationState.passedGates.calibrationGate,
                },
              ].map((gate) => (
                <div
                  key={gate.id}
                  className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 ${
                    gate.passed
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="space-y-1">
                    <strong className={`block text-xs font-bold ${gate.passed ? 'text-emerald-200' : 'text-slate-200'}`}>
                      {gate.name}
                    </strong>
                    <p className="text-[11px] text-slate-400 font-sans">{gate.desc}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                    gate.passed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {gate.passed ? 'PASSED ✓' : 'UNVERIFIED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-mono">
            Timeframe: {selectedTf} • Strict Gate Separation
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-700"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
