/**
 * Historical Intelligence & Pattern Discovery Component
 * Multi-period analysis (Year, Month, Week, Day, Hour, Minute, Second),
 * Excursions (MFE/MAE), Expectancy, Drawdown, and Pattern Discovery.
 */

import React, { useState } from 'react';
import { HistoricalIntelligence, TimeframeAggregation } from '../types';
import {
  Clock,
  Calendar,
  Zap,
  TrendingUp,
  AlertTriangle,
  Award,
  Layers,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

interface HistoricalIntelligenceViewProps {
  intelligence: HistoricalIntelligence;
  strategyName: string;
}

export const HistoricalIntelligenceView: React.FC<HistoricalIntelligenceViewProps> = ({
  intelligence,
  strategyName,
}) => {
  const [activeAggregation, setActiveAggregation] = useState<TimeframeAggregation>('Hour');
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'patterns' | 'breakdowns'>('metrics');

  const aggregations: TimeframeAggregation[] = ['Year', 'Month', 'Week', 'Day', 'Hour', 'Minute', 'Second'];

  return (
    <div
      id="historical-intelligence-card"
      className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs p-5 transition-all"
    >
      {/* Header & Aggregation Horizon Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-800" />
            <h3 className="text-base font-black tracking-tight text-slate-900">
              HISTORICAL INTELLIGENCE & PATTERN DISCOVERY
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical distribution analysis, adverse excursions, and multi-temporal performance metrics
          </p>
        </div>

        {/* Horizon Filter Tabs (Year to Second) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {aggregations.map((agg) => {
            const aggLabels: Record<string, string> = {
              Year: 'سنة',
              Month: 'شهر',
              Week: 'أسبوع',
              Day: 'يوم',
              Hour: 'ساعة',
              Minute: 'دقيقة',
              Second: 'ثانية',
            };
            return (
              <button
                key={agg}
                id={`agg-btn-${agg.toLowerCase()}`}
                onClick={() => setActiveAggregation(agg)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeAggregation === agg
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {aggLabels[agg] || agg}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 my-4 border-b border-slate-100 pb-2">
        <button
          onClick={() => setActiveSubTab('metrics')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'metrics'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          مقاييس التنفيذ الأساسية
        </button>
        <button
          onClick={() => setActiveSubTab('patterns')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'patterns'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          اكتشاف الأنماط والإخفاقات
        </button>
        <button
          onClick={() => setActiveSubTab('breakdowns')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'breakdowns'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          تفاصيل الفترات وحالة السوق
        </button>
      </div>

      {/* Tab 1: Core Metrics Grid */}
      {activeSubTab === 'metrics' && (
        <div className="space-y-4">
          {/* Main KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 block">Win Rate</span>
              <span className="text-xl font-black text-slate-950 mt-1 block">
                {intelligence.winRate}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {intelligence.totalTrades} sample trades
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 block">Profit Factor</span>
              <span className="text-xl font-black text-slate-950 mt-1 block">
                {intelligence.profitFactor.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">Positive edge</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 block">Expectancy (E)</span>
              <span className="text-xl font-black text-slate-950 mt-1 block">
                +{intelligence.expectancy}%
              </span>
              <span className="text-[10px] text-slate-500">Per trade average</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 block">Max Drawdown</span>
              <span className="text-xl font-black text-rose-700 mt-1 block">
                {intelligence.maxDrawdownPct}%
              </span>
              <span className="text-[10px] text-slate-400">Peak-to-trough</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 block">Avg MFE (Favorable)</span>
              <span className="text-xl font-black text-slate-950 mt-1 block">
                +{intelligence.avgMfePct}%
              </span>
              <span className="text-[10px] text-slate-500">Avg run before exit</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 block">Avg MAE (Adverse)</span>
              <span className="text-xl font-black text-slate-950 mt-1 block">
                -{intelligence.avgMaePct}%
              </span>
              <span className="text-[10px] text-slate-500">Avg dip before target</span>
            </div>
          </div>

          {/* Secondary Details: Excursion times & Directional Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {/* Long vs Short Performance */}
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                Directional Performance Split
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-800">LONG EXECUTIONS</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-black text-slate-900">
                      {intelligence.longPerformance.winRate}% WR
                    </span>
                    <span className="text-xs text-slate-500">({intelligence.longPerformance.trades} trades)</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 block mt-0.5">
                    Net PnL: +{intelligence.longPerformance.pnlPct}%
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-rose-50/50 border border-rose-100">
                  <span className="text-xs font-bold text-rose-800">SHORT EXECUTIONS</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-black text-slate-900">
                      {intelligence.shortPerformance.winRate}% WR
                    </span>
                    <span className="text-xs text-slate-500">({intelligence.shortPerformance.trades} trades)</span>
                  </div>
                  <span className="text-xs font-semibold text-rose-700 block mt-0.5">
                    Net PnL: +{intelligence.shortPerformance.pnlPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Time to Target vs Time to Failure */}
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                Execution Duration Profiles
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Average Time to Target (Wins)</span>
                    <strong className="text-slate-900">{intelligence.avgTimeToTargetCandles} candles</strong>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '65%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Average Time to Failure (Losses)</span>
                    <strong className="text-slate-900">{intelligence.avgTimeToFailureCandles} candles</strong>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-rose-500 h-2 rounded-full" style={{ width: '35%' }} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Fast failure cutoff signature confirms stop-losses cut tail risk early while winners develop smoothly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Pattern Discovery */}
      {activeSubTab === 'patterns' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Which hours historically performed best?
              </h4>
              <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
                {intelligence.patternDiscoveries.bestHours}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Which weekdays performed best?
              </h4>
              <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
                {intelligence.patternDiscoveries.bestWeekdays}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Which months and market regimes performed best?
              </h4>
              <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
                {intelligence.patternDiscoveries.bestRegimes}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-950">
                Under which volatility conditions does the strategy fail?
              </h4>
              <p className="text-xs text-rose-900/90 mt-1 font-medium leading-relaxed">
                {intelligence.patternDiscoveries.failureConditions}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-start gap-3">
            <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                Which combinations of indicators historically improve results?
              </h4>
              <p className="text-xs text-emerald-900/90 mt-1 font-medium leading-relaxed">
                {intelligence.patternDiscoveries.indicatorSynergies}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Temporal & Regime Breakdowns */}
      {activeSubTab === 'breakdowns' && (
        <div className="space-y-4">
          {/* Performance by Regime Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Performance by Market Regime
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Market Regime</th>
                    <th className="p-3">Sample Trades</th>
                    <th className="p-3">Win Rate</th>
                    <th className="p-3">Net Return PnL</th>
                    <th className="p-3">Suitability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {intelligence.performanceByRegime.map((item) => (
                    <tr key={item.regime} className="hover:bg-slate-50/60">
                      <td className="p-3 font-bold text-slate-900">{item.regime}</td>
                      <td className="p-3 text-slate-600">{item.trades}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{item.winRate}%</td>
                      <td
                        className={`p-3 font-mono font-bold ${
                          item.pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {item.pnlPct >= 0 ? '+' : ''}
                        {item.pnlPct}%
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.winRate >= 60
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.winRate >= 50
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.winRate >= 60 ? 'Optimal' : item.winRate >= 50 ? 'Neutral' : 'High Risk'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance by Weekday */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Performance by Day of Week
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {intelligence.performanceByWeekday.map((d) => (
                <div key={d.day} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <span className="text-xs font-bold text-slate-600 block">{d.day}</span>
                  <span className="text-base font-black text-slate-900 block mt-1">{d.winRate}%</span>
                  <span className="text-[10px] text-slate-400 block">{d.trades} trades</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
