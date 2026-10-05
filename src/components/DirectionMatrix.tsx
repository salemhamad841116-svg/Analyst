/**
 * Market Direction Matrix Component
 * Displays all horizons simultaneously (5s through 1M)
 * White Glass UI with high-contrast black numbers and subtle green/red directional indicators.
 */

import React from 'react';
import { Timeframe, HorizonDirectionResult } from '../types';
import { ArrowUp, ArrowDown, ArrowRight, Activity, Database, CheckCircle2 } from 'lucide-react';

interface DirectionMatrixProps {
  results: HorizonDirectionResult[];
  selectedTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
}

export const DirectionMatrix: React.FC<DirectionMatrixProps> = ({
  results,
  selectedTimeframe,
  onSelectTimeframe,
}) => {
  return (
    <div id="direction-matrix-card" className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs p-5 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-800" />
            <h3 className="text-base font-bold tracking-tight text-slate-900">مصفوفة اتجاه السوق (Market Direction Matrix)</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            محاذاة متزامنة للأطر الزمنية المتعددة • اضغط على أي إطار زمني للاستعراض المباشر
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>16 إطار زمني نشط</span>
        </div>
      </div>

      {/* Grid of horizons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
        {results.map((item) => {
          const isSelected = item.timeframe === selectedTimeframe;
          const isBull = item.state.includes('Bullish');
          const isBear = item.state.includes('Bearish');

          return (
            <button
              key={item.timeframe}
              id={`matrix-btn-${item.timeframe}`}
              onClick={() => onSelectTimeframe(item.timeframe)}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-150 relative cursor-pointer group ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                  : 'bg-white hover:bg-slate-50 border-slate-200/70 hover:border-slate-300'
              }`}
            >
              {/* Header: Timeframe + Arrow */}
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className={`text-xs font-bold ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>
                  {item.timeframe}
                </span>

                <div className="flex items-center">
                  {isBull && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600">
                      <ArrowUp className="w-3.5 h-3.5 stroke-[2.8]" />
                    </span>
                  )}
                  {isBear && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/15 text-rose-600">
                      <ArrowDown className="w-3.5 h-3.5 stroke-[2.8]" />
                    </span>
                  )}
                  {!isBull && !isBear && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200/80 text-slate-600">
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </span>
                  )}
                </div>
              </div>

              {/* Main Probability Number: Black, Bold & Readable */}
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-xl font-extrabold tracking-tight ${isSelected ? 'text-white' : 'text-slate-950'}`}>
                  {(item.directionProbability * 100).toFixed(0)}%
                </span>
                <span className={`text-[10px] uppercase font-semibold ${
                  isSelected ? 'text-slate-300' : isBull ? 'text-emerald-700 font-bold' : isBear ? 'text-rose-700 font-bold' : 'text-slate-500'
                }`}>
                  {item.state.replace('Strong ', '')}
                </span>
              </div>

              {/* Footer mini stats */}
              <div className="mt-2 pt-1.5 border-t border-slate-100/20 flex items-center justify-between text-[10px]">
                <span className={`${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                  ثقة {(item.confidence * 100).toFixed(0)}%
                </span>
                <span className={`font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  دقة {(item.historicalHitRate * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Timeframe Deep Insight Summary Strip */}
      {selectedTimeframe && (
        <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">الإطار الزمني النشط:</span>
            <span className="px-2 py-0.5 font-bold rounded-md bg-white border border-slate-300 text-slate-900">
              {selectedTimeframe}
            </span>
            <span className="text-slate-500">
              حجم العينة: {results.find((r) => r.timeframe === selectedTimeframe)?.sampleSize.toLocaleString()} شمعة
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>جودة البيانات:</span>
              <span className="font-semibold text-slate-900">
                {results.find((r) => r.timeframe === selectedTimeframe)?.dataQuality}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>دقة الاختبار الخارجي (OOS):</span>
              <span className="font-semibold text-slate-900">
                {((results.find((r) => r.timeframe === selectedTimeframe)?.historicalHitRate || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
