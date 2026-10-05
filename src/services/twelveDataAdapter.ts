/**
 * Twelve Data Historical Market Data Adapter
 * 
 * Fetches OHLCV candle data from the Twelve Data /time_series API.
 * Supports Forex, Crypto, Stocks, and Commodities.
 * Docs: https://twelvedata.com/docs#time-series
 */

import { Candle } from '../types';

export interface TwelveDataRequestParams {
  apiKey: string;
  symbol: string;       // e.g. "EUR/USD", "GBP/USD", "BTC/USD"
  interval: string;     // e.g. "1min", "5min", "15min", "1h", "4h", "1day"
  start: string;        // ISO date string
  end: string;          // ISO date string
  outputsize?: number;  // max rows per request (max 5000)
}

/**
 * Map internal timeframe keys to Twelve Data interval strings.
 */
export function mapTimeframeToTwelveData(tf: string): string {
  const map: Record<string, string> = {
    '1m': '1min',
    '5m': '5min',
    '10m': '15min',
    '15m': '15min',
    '30m': '30min',
    '1h': '1h',
    '4h': '4h',
    '6h': '4h',
    '8h': '8h',
    '1D': '1day',
    '1W': '1week',
    '1M': '1month',
  };
  return map[tf] || '5min';
}

/**
 * Convert ISO date string to Twelve Data format: "yyyy-MM-dd HH:mm:ss"
 */
export function formatDateForTwelveData(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  } catch {
    return isoDate;
  }
}

/**
 * Forex symbol pairs supported by Twelve Data.
 */
export const TWELVEDATA_FOREX_SYMBOLS = [
  { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
  { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
  { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar' },
  { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar' },
  { symbol: 'EUR/GBP', name: 'Euro / British Pound' },
  { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen' },
  { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen' },
  { symbol: 'EUR/CHF', name: 'Euro / Swiss Franc' },
  { symbol: 'AUD/JPY', name: 'Australian Dollar / Japanese Yen' },
  { symbol: 'EUR/AUD', name: 'Euro / Australian Dollar' },
  { symbol: 'GBP/CHF', name: 'British Pound / Swiss Franc' },
  { symbol: 'GBP/AUD', name: 'British Pound / Australian Dollar' },
  { symbol: 'EUR/CAD', name: 'Euro / Canadian Dollar' },
  { symbol: 'AUD/CAD', name: 'Australian Dollar / Canadian Dollar' },
  { symbol: 'NZD/JPY', name: 'New Zealand Dollar / Japanese Yen' },
  { symbol: 'XAU/USD', name: 'Gold / US Dollar' },
  { symbol: 'XAG/USD', name: 'Silver / US Dollar' },
];

/**
 * Fetch historical candle data from the Twelve Data /time_series endpoint
 * via the backend proxy at /api/twelvedata/historical.
 */
export async function fetchTwelveDataHistoricalData(params: TwelveDataRequestParams): Promise<Candle[]> {
  // Format dates for Twelve Data API
  const formattedStart = formatDateForTwelveData(params.start);
  const formattedEnd = formatDateForTwelveData(params.end);

  const response = await fetch('/api/twelvedata/historical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: params.apiKey,
      symbol: params.symbol,
      interval: params.interval,
      start_date: formattedStart,
      end_date: formattedEnd,
      outputsize: params.outputsize || 5000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error || errorData?.details || `${response.status} ${response.statusText}`;
    console.error('[TwelveDataAdapter] HTTP Error:', errorMsg);
    throw new Error(`TWELVEDATA_HTTP_ERROR: ${errorMsg}`);
  }

  const result = await response.json();

  // Twelve Data returns { values: [...], status: "ok" } on success
  if (result.status === 'error' || result.code) {
    throw new Error(`TWELVEDATA_API_ERROR: ${result.message || result.code || 'Unknown error'}`);
  }

  const rawValues: any[] = result.values || result;
  if (!Array.isArray(rawValues) || rawValues.length === 0) {
    console.warn('[TwelveDataAdapter] No data returned for', params.symbol);
    return [];
  }

  // Parse candles — Twelve Data returns newest-first, so we reverse
  const candles: Candle[] = rawValues
    .map((v: any) => ({
      timestamp: new Date(v.datetime).getTime(),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume) || 0,
    }))
    .filter((c: Candle) => c.timestamp > 0 && !isNaN(c.open))
    .sort((a: Candle, b: Candle) => a.timestamp - b.timestamp);

  console.log(`[TwelveDataAdapter] Parsed ${candles.length} candles for ${params.symbol}`);
  return candles;
}
