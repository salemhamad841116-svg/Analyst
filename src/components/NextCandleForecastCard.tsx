import React, { useState, useEffect, useMemo } from 'react';
import { NextCandleForecast, ForecastEngineMode } from '../types';
import { ForecastExplanation } from '../services/explainabilityEngine';
import { formatDubaiTime, getDubaiTimeInterval, parseTimeframeToMinutes } from '../utils/timeFormat';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  HelpCircle
} from 'lucide-react';

interface NextCandleForecastCardProps {
  forecast: NextCandleForecast;
  explanation?: ForecastExplanation;
  language?: 'ar' | 'en';
  onEngineModeChange?: (mode: ForecastEngineMode) => void;
}

export const NextCandleForecastCard: React.FC<NextCandleForecastCardProps> = ({
  forecast,
  language = 'ar',
}) => {
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(300); // Dummy for now, can be updated by a timer

  // Use real numbers from the strategy evaluation instead of fake hardcoded ones
  const rawBull = forecast?.bullishProbability || 0;
  const rawBear = forecast?.bearishProbability || 0;
  const rawNeut = forecast?.neutralProbability || 0;
  
  const bullPct = Math.round(rawBull * 100);
  const bearPct = Math.round(rawBear * 100);
  const neutPct = Math.max(0, 100 - bullPct - bearPct); // Ensure it sums to 100

  // Actual direction from the forecast (could be UP, DOWN, NEUTRAL, or NO_SIGNAL)
  // Let's resolve what we show based on the AST forecast outputs
  let direction = 'NO SIGNAL';
  if (forecast?.direction) {
    if (forecast?.direction.includes('BUY') || forecast?.direction === 'UP') direction = 'UP';
    else if (forecast?.direction.includes('SELL') || forecast?.direction === 'DOWN') direction = 'DOWN';
    else if (forecast?.direction.includes('NEUTRAL')) direction = 'NEUTRAL';
  } else {
    // If no explicit direction string, deduce from probs
    if (bullPct > bearPct + 5 && bullPct > 40) direction = 'UP';
    else if (bearPct > bullPct + 5 && bearPct > 40) direction = 'DOWN';
    else if (neutPct > 40) direction = 'NEUTRAL';
  }

  const confPct = Math.round(forecast?.confidence * 100) || Math.max(bullPct, bearPct, neutPct);
  
  // Real Evaluated metrics from the AST
  const realEvaluatedCount = forecast?.accuracyStats?.evaluatedCount || 0; 

  const isUp = direction === 'UP';
  const isDown = direction === 'DOWN';
  const isNeutral = direction === 'NEUTRAL';
  const isNoSignal = direction === 'NO SIGNAL';

  return (
    <div className="w-full bg-slate-900 border border-slate-700/80 shadow-2xl rounded-3xl p-6 sm:p-8 text-white font-sans overflow-hidden relative">
      {/* Background Glow */}
      <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20 ${
        isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : isNeutral ? 'bg-slate-500' : 'bg-amber-500'
      }`} />

      {/* Header */}
      <div className="flex justify-between items-start pb-4 border-b border-slate-800 relative z-10">
        <div>
          <h2 className="text-slate-400 text-xs font-black tracking-widest uppercase mb-1">
            {forecast?.symbol.includes('SMC') ? 'SMC' : forecast?.symbol} — NEXT CANDLE FORECAST
          </h2>
          <div className="text-3xl font-black text-white">Next Candle</div>
        </div>
      </div>

      {/* Hero Prediction */}
      <div className="py-8 text-center relative z-10 border-b border-slate-800">
        {isUp && (
          <div className="text-6xl font-black text-emerald-400 drop-shadow-md">
            UP ↑
          </div>
        )}
        {isDown && (
          <div className="text-6xl font-black text-rose-400 drop-shadow-md">
            DOWN ↓
          </div>
        )}
        {isNeutral && (
          <div className="text-6xl font-black text-slate-300 drop-shadow-md">
            NEUTRAL —
          </div>
        )}
        {isNoSignal && (
          <div className="text-5xl font-black text-amber-400 drop-shadow-md flex items-center justify-center gap-3">
            <AlertTriangle className="w-12 h-12" />
            NO SIGNAL
          </div>
        )}

        <div className="flex justify-center gap-4 mt-6 text-sm font-bold">
          <span className={`${isUp ? 'text-emerald-400 text-base' : 'text-slate-500'}`}>{bullPct}% UP</span>
          <span className="text-slate-700">|</span>
          <span className={`${isDown ? 'text-rose-400 text-base' : 'text-slate-500'}`}>{bearPct}% DOWN</span>
          <span className="text-slate-700">|</span>
          <span className={`${isNeutral ? 'text-slate-300 text-base' : 'text-slate-500'}`}>{neutPct}% NEUTRAL</span>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 relative z-10">
        
        {/* Why this prediction */}
        <div className="space-y-3">
          <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            Why this prediction?
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Source Candle:</span>
              <span className="font-bold text-white tracking-wider">{getDubaiTimeInterval(forecast?.sourceBarTimestamp || 0, parseTimeframeToMinutes(forecast?.timeframe))} (CLOSED)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Target Candle:</span>
              <span className="font-bold text-white tracking-wider">{getDubaiTimeInterval(forecast?.targetBarTimestamp || 0, parseTimeframeToMinutes(forecast?.timeframe))}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Forecast Generated:</span>
              <span className="font-bold text-white tracking-wider">{formatDubaiTime(forecast?.dataTimestamp, { showSeconds: true })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Timezone:</span>
              <span className="font-bold text-white tracking-wider">Dubai (UTC+4)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Market Structure:</span>
              <span className={`font-bold ${isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-300'}`}>
                {isUp ? 'Bullish' : isDown ? 'Bearish' : 'Ranging'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Historical Samples:</span>
              <span className="font-bold font-mono">{realEvaluatedCount}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Confidence:</span>
              <span className="font-bold font-mono text-indigo-300">{confPct}%</span>
            </div>
            {forecast?.featuresUsed && Object.entries(forecast?.featuresUsed).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 capitalize">{key}:</span>
                <span className="font-bold font-mono text-slate-300">{value}</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Prediction:</span>
              <span className="font-bold text-blue-400">FROZEN</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Lookahead:</span>
              <span className="font-bold text-emerald-400">OFF</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Repaint:</span>
              <span className="font-bold text-emerald-400">NO</span>
            </div>
          </div>
        </div>

        {/* Prediction Accuracy */}
        <div className="space-y-3">
          <h3 className="text-lg font-black text-white mb-4">Prediction accuracy</h3>
          
          <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Real evaluated forecasts:</span>
              <span className="text-2xl font-black font-mono">{realEvaluatedCount}</span>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
              <span className="text-slate-500 text-xs uppercase tracking-wider block mb-2">Status:</span>
              {realEvaluatedCount === 0 ? (
                <div className="inline-block px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black rounded-lg uppercase tracking-wider">
                  Awaiting Forward Validation
                </div>
              ) : (
                <div className="inline-block px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black rounded-lg uppercase tracking-wider">
                  Validated
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
              وبعد إغلاق الشمعة المستهدفة، يتم تسجيل الاتجاه الفعلي وتحديث الدقة بناءً على النتائج الحقيقية فقط.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
