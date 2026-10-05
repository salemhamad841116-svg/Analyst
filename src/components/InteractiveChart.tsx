/**
 * Interactive Price & Candlestick Chart Component
 * High-performance Canvas/SVG rendering with indicators:
 * EMAs (9, 21), VWAP, Bollinger Bands, Support/Resistance, and Next-Candle Forecast (bar_index + 1).
 */

import React, { useRef, useState } from 'react';
import { Candle, NextCandleForecast } from '../types';
import { CalculatedFeatures } from '../services/featureEngine';
import { Eye, Layers, Maximize2, Sparkles, Clock, Lock } from 'lucide-react';

interface InteractiveChartProps {
  candles: Candle[];
  features: CalculatedFeatures[];
  forecast: NextCandleForecast;
  symbol: string;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  candles,
  features,
  forecast,
  symbol,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showOverlays, setShowOverlays] = useState({
    ema: true,
    vwap: true,
    bollinger: false,
    forecastCone: true,
  });

  const displayCount = 60;
  const sliceCandles = candles.slice(-displayCount);
  const sliceFeatures = features.slice(-displayCount);

  if (!sliceCandles.length) {
    return (
      <div className="h-72 flex items-center justify-center bg-white/80 rounded-2xl border border-slate-200">
        <span className="text-slate-400 text-xs">Loading market candles...</span>
      </div>
    );
  }

  // Calculate high and low for viewport
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let maxVol = 0;

  for (const c of sliceCandles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    if (c.volume > maxVol) maxVol = c.volume;
  }

  // Include forecast range in viewport bounds
  if (forecast?.expectedRange) {
    if (forecast?.expectedRange.low < minPrice) minPrice = forecast?.expectedRange.low;
    if (forecast?.expectedRange.high > maxPrice) maxPrice = forecast?.expectedRange.high;
  }

  // Add margin
  const priceMargin = (maxPrice - minPrice) * 0.12 || 0.001;
  minPrice -= priceMargin;
  maxPrice += priceMargin;
  const priceRange = maxPrice - minPrice || 1;

  // Canvas coordinates helper
  const svgWidth = 840;
  const svgHeight = 340;
  const paddingRight = 95; // Extra space on right for bar_index + 1 forecast
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingRight;
  const plotHeight = svgHeight - paddingBottom;

  const candleWidth = Math.max(3, (plotWidth / sliceCandles.length) * 0.7);
  const getX = (index: number) => (index / (sliceCandles.length - 1)) * (plotWidth - 30) + 15;
  const getY = (price: number) => plotHeight - ((price - minPrice) / priceRange) * plotHeight;

  const activeCandle = hoverIndex !== null ? sliceCandles[hoverIndex] : sliceCandles[sliceCandles.length - 1];

  const forecastSignal =
    forecast?.forecastSignal ||
    (forecast?.bullishProbability > forecast?.bearishProbability + 0.08
      ? 'NEXT BUY'
      : forecast?.bearishProbability > forecast?.bullishProbability + 0.08
      ? 'NEXT SELL'
      : 'NEXT NEUTRAL');

  return (
    <div
      id="interactive-chart-container"
      ref={containerRef}
      className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs p-5 transition-all space-y-3"
    >
      {/* Chart Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-black tracking-tight text-slate-950">{symbol}</h3>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
            {forecast?.timeframe}
          </span>
          {activeCandle && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-500">
                O: <strong className="text-slate-900">{activeCandle.open}</strong>
              </span>
              <span className="text-slate-500">
                H: <strong className="text-slate-900">{activeCandle.high}</strong>
              </span>
              <span className="text-slate-500">
                L: <strong className="text-slate-900">{activeCandle.low}</strong>
              </span>
              <span className="text-slate-500">
                C: <strong className="text-slate-950 font-black">{activeCandle.close}</strong>
              </span>
              <span className="text-slate-500">
                Vol: <strong className="text-slate-700">{activeCandle.volume.toLocaleString()}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowOverlays((p) => ({ ...p, ema: !p.ema }))}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              showOverlays.ema ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            EMA (9/21)
          </button>
          <button
            onClick={() => setShowOverlays((p) => ({ ...p, vwap: !p.vwap }))}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              showOverlays.vwap ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            VWAP
          </button>
          <button
            onClick={() => setShowOverlays((p) => ({ ...p, bollinger: !p.bollinger }))}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              showOverlays.bollinger ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Bollinger (20,2)
          </button>
          <button
            onClick={() => setShowOverlays((p) => ({ ...p, forecastCone: !p.forecastCone }))}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
              showOverlays.forecastCone ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next Candle Forecast (bar_index + 1)</span>
          </button>
        </div>
      </div>

      {/* SVG Chart Plot */}
      <div className="relative w-full overflow-hidden mt-2 select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            const idx = Math.min(
              sliceCandles.length - 1,
              Math.max(0, Math.round((relX / (plotWidth - 30)) * (sliceCandles.length - 1)))
            );
            setHoverIndex(idx);
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Background Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => {
            const y = plotHeight * ratio;
            const p = maxPrice - ratio * priceRange;
            return (
              <g key={i}>
                <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={svgWidth - 65} y={y - 3} fill="#94a3b8" fontSize="9" fontFamily="monospace">
                  {p.toFixed(5)}
                </text>
              </g>
            );
          })}

          {/* Target Candle Zone Grid Column (bar_index + 1) */}
          {(() => {
            const lastX = getX(sliceCandles.length - 1);
            const nextX = lastX + (plotWidth / sliceCandles.length) * 1.6;
            return (
              <g>
                <rect
                  x={lastX + 5}
                  y={0}
                  width={svgWidth - lastX - 5}
                  height={plotHeight}
                  fill="#6366f1"
                  opacity="0.04"
                />
                <line
                  x1={nextX}
                  y1={0}
                  x2={nextX}
                  y2={plotHeight}
                  stroke="#6366f1"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.4"
                />
                <text
                  x={nextX}
                  y={14}
                  fill="#6366f1"
                  fontSize="9"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  NEXT CANDLE (+1)
                </text>
              </g>
            );
          })()}

          {/* Bollinger Bands Shading */}
          {showOverlays.bollinger && sliceFeatures.length > 1 && (
            <path
              d={sliceFeatures
                .map((f, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(f.bb_upper)}`)
                .concat(
                  sliceFeatures
                    .slice()
                    .reverse()
                    .map((f, i) => `L ${getX(sliceFeatures.length - 1 - i)} ${getY(f.bb_lower)}`)
                )
                .join(' ') + ' Z'}
              fill="#f59e0b"
              opacity="0.08"
            />
          )}

          {/* EMA 9 Line */}
          {showOverlays.ema && sliceFeatures.length > 1 && (
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="1.5"
              points={sliceFeatures.map((f, i) => `${getX(i)},${getY(f.ema_9)}`).join(' ')}
            />
          )}

          {/* EMA 21 Line */}
          {showOverlays.ema && sliceFeatures.length > 1 && (
            <polyline
              fill="none"
              stroke="#f97316"
              strokeWidth="1.5"
              points={sliceFeatures.map((f, i) => `${getX(i)},${getY(f.ema_21)}`).join(' ')}
            />
          )}

          {/* VWAP Line */}
          {showOverlays.vwap && sliceFeatures.length > 1 && (
            <polyline
              fill="none"
              stroke="#9333ea"
              strokeWidth="1.8"
              strokeDasharray="4 2"
              points={sliceFeatures.map((f, i) => `${getX(i)},${getY(f.vwap)}`).join(' ')}
            />
          )}

          {/* Candlesticks (Closed Historical Bars) */}
          {sliceCandles.map((c, i) => {
            const x = getX(i);
            const isGreen = c.close >= c.open;
            const top = getY(Math.max(c.open, c.close));
            const bottom = getY(Math.min(c.open, c.close));
            const bodyHeight = Math.max(1.5, bottom - top);
            const highY = getY(c.high);
            const lowY = getY(c.low);

            return (
              <g key={i}>
                {/* Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={isGreen ? '#059669' : '#e11d48'}
                  strokeWidth="1.2"
                />
                {/* Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={top}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={isGreen ? '#10b981' : '#f43f5e'}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Next Candle Forecast Cone (Placed strictly at bar_index + 1) */}
          {showOverlays.forecastCone && (
            <g>
              {(() => {
                const lastX = getX(sliceCandles.length - 1);
                const nextX = lastX + (plotWidth / sliceCandles.length) * 1.6;
                const lowY = getY(forecast?.expectedRange.low);
                const highY = getY(forecast?.expectedRange.high);
                const lastCloseY = getY(forecast?.currentPrice);
                const isBullish = forecastSignal === 'NEXT BUY';
                const isBearish = forecastSignal === 'NEXT SELL';
                const coneColor = isBullish ? '#10b981' : isBearish ? '#f43f5e' : '#64748b';
                const strokeColor = isBullish ? '#059669' : isBearish ? '#e11d48' : '#475569';

                const targetMidY = (highY + lowY) / 2;

                return (
                  <>
                    {/* Probabilistic Forecast Cone Shading to Next Candle */}
                    <polygon
                      points={`${lastX},${lastCloseY} ${nextX},${highY} ${nextX},${lowY}`}
                      fill={coneColor}
                      opacity="0.2"
                    />
                    {/* Upper & Lower Bound Projections */}
                    <line
                      x1={lastX}
                      y1={lastCloseY}
                      x2={nextX}
                      y2={highY}
                      stroke={strokeColor}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={lastX}
                      y1={lastCloseY}
                      x2={nextX}
                      y2={lowY}
                      stroke={strokeColor}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    {/* Center Forecast Trajectory Line */}
                    <line
                      x1={lastX}
                      y1={lastCloseY}
                      x2={nextX}
                      y2={targetMidY}
                      stroke={strokeColor}
                      strokeWidth="2"
                    />

                    {/* Forecast Target Marker on Unopened Bar (+1) */}
                    <circle cx={nextX} cy={targetMidY} r="5" fill={strokeColor} />

                    {/* Next Candle Forecast Label Badge */}
                    <g transform={`translate(${nextX + 8}, ${Math.max(25, Math.min(plotHeight - 50, targetMidY - 20))})`}>
                      <rect
                        x="0"
                        y="0"
                        width="112"
                        height="42"
                        rx="6"
                        fill="#0f172a"
                        opacity="0.95"
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <text
                        x="7"
                        y="14"
                        fill={isBullish ? '#34d399' : isBearish ? '#fb7185' : '#94a3b8'}
                        fontSize="9.5"
                        fontFamily="sans-serif"
                        fontWeight="900"
                      >
                        🔮 {forecastSignal} {Math.round(forecast?.confidence * 100)}%
                      </text>
                      <text
                        x="7"
                        y="27"
                        fill="#cbd5e1"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {forecast?.targetBarTimestamp ? `Target: ${getDubaiTimeInterval(forecast?.targetBarTimestamp, parseTimeframeToMinutes(forecast?.timeframe))}` : `Target: +1 (Unopened)`}
                      </text>
                      <text
                        x="7"
                        y="37"
                        fill="#10b981"
                        fontSize="7.5"
                        fontFamily="sans-serif"
                        fontWeight="bold"
                      >
                        Frozen: YES • Repaint: NO
                      </text>
                    </g>
                  </>
                );
              })()}
            </g>
          )}

          {/* Interactive Crosshair & Tooltip */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={0}
                x2={getX(hoverIndex)}
                y2={plotHeight}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(sliceCandles[hoverIndex].close)}
                r="4"
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-blue-600 inline-block" /> EMA 9
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-orange-500 inline-block" /> EMA 21
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-purple-600 inline-block" /> VWAP
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-indigo-600/30 border border-indigo-600 inline-block rounded-xs" /> Next Candle Forecast (bar_index + 1)
            </span>
          </div>
          <span className="font-mono text-slate-400">Timeframe: {forecast?.timeframe} • Target: Unopened Candle</span>
        </div>
      </div>
    </div>
  );
};
