/**
 * TIMEFRAME-ISOLATED ML EVIDENCE PACK MODAL
 * Universal Strategy Engine - Multi-Timeframe Independent Certification
 */

import React, { useState } from 'react';
import {
  getTimeframeModelProfile,
  RUN_CERTIFICATION,
  uncertifyTimeframeModel,
  CertificationProfile,
  normalizeTimeframeKey,
} from '../services/multiTimeframeCertificationEngine';
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

interface TimeframeEvidencePackModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: 'ar' | 'en';
  activeTimeframe: string;
  symbol: string;
  onTimeframeStateChange?: () => void;
}

export const TimeframeEvidencePackModal: React.FC<TimeframeEvidencePackModalProps> = ({
  isOpen,
  onClose,
  language = 'ar',
  activeTimeframe,
  symbol,
  onTimeframeStateChange,
}) => {
  const [selectedTf, setSelectedTf] = useState<string>(normalizeTimeframeKey(activeTimeframe));
  const [profile, setProfile] = useState<CertificationProfile>(() => {
    const provider = symbol.includes('BTC') ? 'BINANCE' : 'OANDA';
    // This needs modelVersion and labelPolicyVersion as well. For now using defaults.
    return getTimeframeModelProfile(symbol, activeTimeframe, provider, 'v1.0', 'v1');
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'policy' | 'status'>('overview');
  const [isRunningGate, setIsRunningGate] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTfChange = (tf: string) => {
    setSelectedTf(tf);
    const provider = symbol.includes('BTC') ? 'BINANCE' : 'OANDA';
    const p = getTimeframeModelProfile(symbol, tf, provider, 'v1.0', 'v1');
    setProfile(p);
  };

  const handleCertify = () => {
    setIsRunningGate(true);
    setTimeout(() => {
      const provider = symbol.includes('BTC') ? 'BINANCE' : 'OANDA';
      const updated = RUN_CERTIFICATION(
        symbol,
        selectedTf,
        provider,
        profile.modelVersion,
        profile.labelPolicyVersion,
        { oos: profile.oosAccuracyPct, blind: profile.blindAccuracyPct, shadow: profile.liveShadowAccuracyPct }
      );
      setProfile(updated);
      setIsRunningGate(false);
      if (onTimeframeStateChange) onTimeframeStateChange();
    }, 500);
  };

  const handleUncertify = () => {
    const provider = symbol.includes('BTC') ? 'BINANCE' : 'OANDA';
    const updated = uncertifyTimeframeModel(symbol, selectedTf, provider, profile.modelVersion, profile.labelPolicyVersion);
    setProfile(updated);
    if (onTimeframeStateChange) onTimeframeStateChange();
  };

  const isValidated = profile.status === 'VALIDATED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center font-black text-indigo-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  {symbol} • {profile.displayLabel}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-100">
                  {language === 'ar' ? `حزمة تدقيق فريم ${profile.displayLabel}` : `${profile.displayLabel} ML Evidence Pack`}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Model: {profile.modelName} • {profile.modelVersion}
              </p>
            </div>
          </div>

          {/* Timeframe Switcher & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-mono">
              {['1m', '5m', '1h', '1D', '1W', '1M'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTfChange(tf)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTf === tf ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-white'
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
          isValidated
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
        }`}>
          <div className="flex items-center gap-2 font-mono">
            {isValidated ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div>
              <strong className="block text-sm">
                Timeframe Status: {isValidated ? 'VALIDATED ✓' : 'UNVALIDATED ⚠️'}
              </strong>
              <span className="text-[11px] opacity-80">
                {isValidated
                  ? (language === 'ar' ? 'النموذج معتمد بالكامل وتم تفعيل الدمج الهجين (55/45 Final Confluence)' : 'Timeframe model is certified for production. Hybrid Confluence is ACTIVE.')
                  : (language === 'ar' ? 'النموذج غير معتمد لهذا الفريم؛ يتم العمل بالقواعد الفنية فقط (RULE-BASED ONLY)' : 'Model is unvalidated for this timeframe. Inference falls back to RULE-BASED ONLY.')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isValidated ? (
              <button
                disabled={isRunningGate}
                onClick={handleCertify}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunningGate ? 'Certifying...' : (language === 'ar' ? 'تشغيل بوابات الاعتماد' : 'Run Full Certification')}</span>
              </button>
            ) : (
              <button
                onClick={handleUncertify}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Unvalidated</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-2 p-3 bg-slate-950/60 border-b border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'التدقيق الثلاثي المستقل' : '3-Tier Validation'}
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
            onClick={() => setActiveTab('policy')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'policy' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'معادلة الـ Label ومجموعة البيانات' : 'Label Policy & Dataset'}
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'status' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'التوافق وقواعد الدمج' : 'Confluence & Rule Engine'}
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
                    <span className={`font-bold ${isValidated ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isValidated ? 'PASSED ✓' : 'BENCHMARK'}
                    </span>
                  </div>
                  <span className="text-3xl font-black text-emerald-400 block">{profile.oosAccuracyPct}%</span>
                  <span className="text-xs text-slate-400 block">{profile.oosSampleCount.toLocaleString()} Bars Baseline • F1: {profile.oosMacroF1}</span>
                  <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-500 font-sans">
                    Brier Score: {profile.oosBrierScore} • ECE: {profile.multiclassEce}
                  </div>
                </div>

                {/* Blind Holdout */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Layer 2: Blind Holdout</span>
                    <span className={`font-bold ${isValidated ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isValidated ? 'PASSED ✓' : 'BENCHMARK'}
                    </span>
                  </div>
                  <span className="text-3xl font-black text-indigo-300 block">{profile.blindAccuracyPct}%</span>
                  <span className="text-xs text-slate-400 block">{profile.blindSampleCount.toLocaleString()} Bars Forward</span>
                  <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-500 font-sans">
                    Macro F1: {profile.blindMacroF1} • Drift: {profile.blindAccuracyDriftPct}%
                  </div>
                </div>

                {/* Live Shadow */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Layer 3: Live Shadow</span>
                    <span className={`font-bold ${isValidated ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isValidated ? 'PASSED ✓' : 'BENCHMARK'}
                    </span>
                  </div>
                  <span className="text-3xl font-black text-emerald-300 block">{profile.liveShadowAccuracyPct}%</span>
                  <span className="text-xs text-slate-400 block">{profile.liveShadowCount.toLocaleString()} Live Candles</span>
                  <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-500 font-sans">
                    Drift: {profile.liveShadowDriftPct}% • 0 Lookahead
                  </div>
                </div>
              </div>

              {/* SHA-256 Fingerprint */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <Fingerprint className="w-4 h-4" />
                  <span>Timeframe Artifact Cryptographic Fingerprint</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-400 break-all">
                  <p>Dataset: <code className="text-indigo-300">{profile.datasetName}</code> ({profile.historicalBarsCount?.toLocaleString() ?? 0} Bars)</p>
                  <p>Model SHA-256: <code className="text-emerald-400">{profile.modelHashSha256}</code></p>
                  <p>Target Resolution: <code className="text-amber-300">{profile.targetDescriptionEn}</code></p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Matrix & Calibration */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-200">
                  {profile.displayLabel} True OOS Confusion Matrix ({profile.oosSampleCount.toLocaleString()} Bars)
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-center text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Actual \ Predicted</th>
                        <th className="p-2.5 text-emerald-400">Pred BUY</th>
                        <th className="p-2.5 text-rose-400">Pred SELL</th>
                        <th className="p-2.5 text-slate-400">Pred NEUTRAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      <tr>
                        <td className="p-2.5 font-bold text-emerald-400 bg-slate-900/50">Actual BUY</td>
                        <td className="p-2.5 font-bold text-emerald-300 bg-emerald-950/30">{profile.oosConfusionMatrix[0][0]}</td>
                        <td className="p-2.5 text-slate-400">{profile.oosConfusionMatrix[0][1]}</td>
                        <td className="p-2.5 text-slate-400">{profile.oosConfusionMatrix[0][2]}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-rose-400 bg-slate-900/50">Actual SELL</td>
                        <td className="p-2.5 text-slate-400">{profile.oosConfusionMatrix[1][0]}</td>
                        <td className="p-2.5 font-bold text-rose-300 bg-rose-950/30">{profile.oosConfusionMatrix[1][1]}</td>
                        <td className="p-2.5 text-slate-400">{profile.oosConfusionMatrix[1][2]}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-400 bg-slate-900/50">Actual NEUTRAL</td>
                        <td className="p-2.5 text-slate-400">{profile.oosConfusionMatrix[2][0]}</td>
                        <td className="p-2.5 text-slate-400">{profile.oosConfusionMatrix[2][1]}</td>
                        <td className="p-2.5 font-bold text-slate-200 bg-slate-800/40">{profile.oosConfusionMatrix[2][2]}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calibration */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Multiclass ECE</span>
                  <strong className="text-emerald-400 text-base">{profile.multiclassEce}</strong>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Log Loss / NLL</span>
                  <strong className="text-indigo-300 text-base">{profile.logLoss}</strong>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Temperature (T)</span>
                  <strong className="text-amber-400 text-base">{profile.calibrationTemperature}</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Label Policy */}
          {activeTab === 'policy' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Timeframe-Specific Frozen Label Policy</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Formula</span>
                    <strong className="text-indigo-200 text-xs">{profile.labelPolicy.formula}</strong>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Neutral Threshold</span>
                    <strong className="text-emerald-400 text-xs">±{profile.labelPolicy.neutralThreshold} {profile.labelPolicy.neutralThresholdUnit}</strong>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Target Horizon</span>
                    <strong className="text-amber-300 text-xs">+{profile.standardKey} Next Candle</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Status & Confluence */}
          {activeTab === 'status' && (
            <div className="space-y-3">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-200">
                  Confluence Architecture for {profile.displayLabel}
                </h4>
                <div className="space-y-2">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300">ML MODEL:</span>
                    <strong className={isValidated ? 'text-emerald-400' : 'text-amber-400'}>
                      {isValidated ? 'VALIDATED ✓' : 'UNVALIDATED ⚠️'}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300">RULE ENGINE:</span>
                    <strong className="text-emerald-400">ACTIVE ✓</strong>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300">FINAL CONFLUENCE:</span>
                    <strong className={isValidated ? 'text-emerald-300' : 'text-amber-300'}>
                      {isValidated ? 'ACTIVE (55% AI + 45% Rule)' : 'RULE-BASED ONLY (Unvalidated ML Bypassed)'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-mono">
            Timeframe: {profile.displayLabel} • Zero Cross-Timeframe Leakage
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
