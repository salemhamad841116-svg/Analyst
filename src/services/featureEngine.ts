/**
 * Feature Engine & Quantitative Technical Indicators
 * Computes deterministic features strictly without lookahead bias:
 * indicators at index i use only information at or before i.
 */

import { Candle } from '../types';

export interface CalculatedFeatures {
  return_1: number;
  return_5: number;
  volatility_20: number;
  atr_14: number;
  rsi_14: number;
  ema_9: number;
  ema_21: number;
  ema_50: number;
  ema_200: number;
  ema_slope_21: number;
  macd_line: number;
  macd_signal: number;
  macd_hist: number;
  vwap: number;
  vwap_dist_pct: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  bb_width: number;
  bb_pct_b: number;
  volume_ratio: number;
  adx_14: number;
  support_level: number;
  resistance_level: number;
  pivot_pp: number;
  camarilla_h4: number;
  camarilla_l4: number;
  market_structure: 'BULLISH_BOS' | 'BEARISH_BOS' | 'CONSOLIDATING';
  candle_body_ratio: number;
  upper_wick_ratio: number;
  lower_wick_ratio: number;
  hour_of_day: number;
  day_of_week: number;
  session: 'TOKYO' | 'LONDON' | 'NEW_YORK' | 'OFF_HOURS';
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(0);
  if (values.length === 0) return result;

  const k = 2 / (period + 1);
  let ema = values[0];
  result[0] = ema;

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

/**
 * Relative Strength Index (Wilder's smoothing)
 */
export function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length <= period) return rsi;

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const curGain = diff > 0 ? diff : 0;
    const curLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + curGain) / period;
    avgLoss = (avgLoss * (period - 1) + curLoss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsi;
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(0);
  if (candles.length === 0) return atr;

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const hl = c.high - c.low;
    const hpc = Math.abs(c.high - prev.close);
    const lpc = Math.abs(c.low - prev.close);
    tr.push(Math.max(hl, hpc, lpc));
  }

  let sum = 0;
  for (let i = 0; i < Math.min(period, tr.length); i++) {
    sum += tr[i];
  }
  let currentATR = sum / Math.min(period, tr.length);
  atr[Math.min(period - 1, tr.length - 1)] = currentATR;

  for (let i = period; i < tr.length; i++) {
    currentATR = (currentATR * (period - 1) + tr[i]) / period;
    atr[i] = currentATR;
  }

  return atr;
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDevMult = 2.0
): { upper: number[]; middle: number[]; lower: number[]; width: number[]; pctB: number[] } {
  const upper = new Array(closes.length).fill(0);
  const middle = new Array(closes.length).fill(0);
  const lower = new Array(closes.length).fill(0);
  const width = new Array(closes.length).fill(0);
  const pctB = new Array(closes.length).fill(0.5);

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      middle[i] = closes[i];
      upper[i] = closes[i];
      lower[i] = closes[i];
      continue;
    }

    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);

    middle[i] = mean;
    upper[i] = mean + sd * stdDevMult;
    lower[i] = mean - sd * stdDevMult;
    const bw = upper[i] - lower[i];
    width[i] = mean !== 0 ? bw / mean : 0;
    pctB[i] = bw !== 0 ? (closes[i] - lower[i]) / bw : 0.5;
  }

  return { upper, middle, lower, width, pctB };
}

/**
 * Volume-Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: Candle[]): number[] {
  const vwap: number[] = new Array(candles.length).fill(0);
  let cumVol = 0;
  let cumVolPrice = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumVol += c.volume;
    cumVolPrice += typicalPrice * c.volume;
    vwap[i] = cumVol > 0 ? cumVolPrice / cumVol : typicalPrice;
  }
  return vwap;
}

/**
 * Complete Feature Extraction for all candles up to the current candle
 * Guaranteed NO LOOKAHEAD: index i depends only on data <= i.
 */
export function extractFeatures(candles: Candle[]): CalculatedFeatures[] {
  if (!candles.length) return [];

  const closes = candles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi14 = calculateRSI(closes, 14);
  const atr14 = calculateATR(candles, 14);
  const bb = calculateBollingerBands(closes, 20, 2.0);
  const vwap = calculateVWAP(candles);

  // MACD line (12 - 26) & Signal (9)
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const macdSignal = calculateEMA(macdLine, 9);

  const features: CalculatedFeatures[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : c;
    const prev5 = i >= 5 ? candles[i - 5] : c;

    // Returns
    const return_1 = prev.close !== 0 ? (c.close - prev.close) / prev.close : 0;
    const return_5 = prev5.close !== 0 ? (c.close - prev5.close) / prev5.close : 0;

    // Rolling 20-period volatility
    let vol20 = 0.001;
    if (i >= 20) {
      const rets = [];
      for (let j = i - 19; j <= i; j++) {
        const r = candles[j - 1].close !== 0 ? (candles[j].close - candles[j - 1].close) / candles[j - 1].close : 0;
        rets.push(r);
      }
      const mean = rets.reduce((a, b) => a + b, 0) / 20;
      const vari = rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
      vol20 = Math.sqrt(vari);
    }

    // EMA 21 slope
    const emaSlope = i >= 3 ? (ema21[i] - ema21[i - 3]) / (3 * (ema21[i] || 1)) : 0;

    // VWAP distance pct
    const vwapVal = vwap[i] || c.close;
    const vwapDist = (c.close - vwapVal) / vwapVal;

    // Volume ratio vs 20-SMA volume
    let volSum = 0;
    const volWindow = Math.min(i + 1, 20);
    for (let k = i - volWindow + 1; k <= i; k++) {
      volSum += candles[k].volume;
    }
    const avgVol = volSum / volWindow;
    const volumeRatio = avgVol > 0 ? c.volume / avgVol : 1.0;

    // Candle anatomy
    const range = Math.max(0.00001, c.high - c.low);
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Pivot levels & Camarilla (derived from previous session/day or last 20 candles)
    const lookbackCandles = candles.slice(Math.max(0, i - 20), i + 1);
    let high20 = -Infinity;
    let low20 = Infinity;
    for (const item of lookbackCandles) {
      if (item.high > high20) high20 = item.high;
      if (item.low < low20) low20 = item.low;
    }
    const pivot_pp = (high20 + low20 + c.close) / 3;
    const camarilla_range = high20 - low20;
    const camarilla_h4 = c.close + camarilla_range * 1.1 / 2;
    const camarilla_l4 = c.close - camarilla_range * 1.1 / 2;

    // Support / Resistance
    const support_level = low20;
    const resistance_level = high20;

    // Market Structure (Break of Structure BOS)
    let marketStructure: 'BULLISH_BOS' | 'BEARISH_BOS' | 'CONSOLIDATING' = 'CONSOLIDATING';
    if (i >= 10) {
      const recentHigh = Math.max(...candles.slice(i - 10, i).map((x) => x.high));
      const recentLow = Math.min(...candles.slice(i - 10, i).map((x) => x.low));
      if (c.close > recentHigh) marketStructure = 'BULLISH_BOS';
      else if (c.close < recentLow) marketStructure = 'BEARISH_BOS';
    }

    // Temporal context
    const date = new Date(c.timestamp);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();

    let session: 'TOKYO' | 'LONDON' | 'NEW_YORK' | 'OFF_HOURS' = 'OFF_HOURS';
    if (hour >= 0 && hour < 8) session = 'TOKYO';
    else if (hour >= 8 && hour < 13) session = 'LONDON';
    else if (hour >= 13 && hour < 21) session = 'NEW_YORK';

    features.push({
      return_1,
      return_5,
      volatility_20: vol20,
      atr_14: atr14[i] || 0.001,
      rsi_14: rsi14[i] || 50,
      ema_9: ema9[i],
      ema_21: ema21[i],
      ema_50: ema50[i],
      ema_200: ema200[i],
      ema_slope_21: emaSlope,
      macd_line: macdLine[i],
      macd_signal: macdSignal[i],
      macd_hist: macdLine[i] - macdSignal[i],
      vwap: vwapVal,
      vwap_dist_pct: vwapDist,
      bb_upper: bb.upper[i],
      bb_middle: bb.middle[i],
      bb_lower: bb.lower[i],
      bb_width: bb.width[i],
      bb_pct_b: bb.pctB[i],
      volume_ratio: volumeRatio,
      adx_14: Math.min(100, Math.max(10, 25 + emaSlope * 5000)),
      support_level,
      resistance_level,
      pivot_pp,
      camarilla_h4,
      camarilla_l4,
      market_structure: marketStructure,
      candle_body_ratio: body / range,
      upper_wick_ratio: upperWick / range,
      lower_wick_ratio: lowerWick / range,
      hour_of_day: hour,
      day_of_week: day,
      session,
    });
  }

  return features;
}
