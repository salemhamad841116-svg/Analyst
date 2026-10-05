import { Candle } from '../types';

export interface DatabentoRequestParams {
  apiKey: string;
  dataset: string;
  symbol: string;
  schema: string;
  start: string;
  end: string;
}

// Databento uses fixed-point prices (divide by 1e9 to get actual price)
const DATABENTO_PRICE_SCALE = 1_000_000_000;

function parseDatabentoPrice(value: any): number {
  if (typeof value === 'number') {
    // If the value is very large (> 1e6), it's likely a fixed-point price
    if (Math.abs(value) > 1_000_000) {
      return value / DATABENTO_PRICE_SCALE;
    }
    return value;
  }
  if (typeof value === 'string') {
    const num = Number(value);
    if (Math.abs(num) > 1_000_000) {
      return num / DATABENTO_PRICE_SCALE;
    }
    return num;
  }
  return 0;
}

function parseDatabentoTimestamp(ts: any): number {
  if (!ts) return 0;
  // Nanoseconds (int64 > 1e18)
  if (typeof ts === 'number' && ts > 1e15) {
    return Math.floor(ts / 1_000_000); // ns → ms
  }
  // Microseconds (> 1e12)
  if (typeof ts === 'number' && ts > 1e12) {
    return Math.floor(ts / 1_000); // µs → ms
  }
  // Milliseconds
  if (typeof ts === 'number' && ts > 1e9) {
    return ts;
  }
  // Seconds
  if (typeof ts === 'number') {
    return ts * 1000;
  }
  // ISO string
  if (typeof ts === 'string') {
    return new Date(ts).getTime();
  }
  return 0;
}

export async function fetchDatabentoHistoricalData(params: DatabentoRequestParams): Promise<Candle[]> {
  const response = await fetch('/api/databento/historical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: params.apiKey,
      dataset: params.dataset,
      symbols: params.symbol,
      schema: params.schema,
      start: params.start,
      end: params.end
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    if (errorData && errorData.error) {
       throw new Error(errorData.error);
    }
    throw new Error(`DATABENTO_ERROR: ${response.status} ${response.statusText}`);
  }

  const rawData = await response.json();
  
  // Parse rawData into Candle[]
  const candles: Candle[] = [];
  
  const records = Array.isArray(rawData) ? rawData : (rawData.data ? rawData.data : []);
  
  console.log(`[DATABENTO_ADAPTER] Received ${records.length} records from API`);
  if (records.length > 0) {
    console.log(`[DATABENTO_ADAPTER] Sample record:`, JSON.stringify(records[0]).substring(0, 300));
  }

  for (const record of records) {
    // Databento OHLCV schema fields: ts_event, open, high, low, close, volume
    const tsMs = parseDatabentoTimestamp(record.ts_event || record.hd?.ts_event);
      
    if (tsMs) {
      candles.push({
        timestamp: tsMs,
        open: parseDatabentoPrice(record.open),
        high: parseDatabentoPrice(record.high),
        low: parseDatabentoPrice(record.low),
        close: parseDatabentoPrice(record.close),
        volume: typeof record.volume === 'number' ? record.volume : 0,
        isClosed: true
      });
    }
  }

  // Ensure chronologically sorted
  candles.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`[DATABENTO_ADAPTER] Parsed ${candles.length} candles`);
  if (candles.length > 0) {
    console.log(`[DATABENTO_ADAPTER] First candle: ${new Date(candles[0].timestamp).toISOString()} O=${candles[0].open} H=${candles[0].high} L=${candles[0].low} C=${candles[0].close}`);
    console.log(`[DATABENTO_ADAPTER] Last candle:  ${new Date(candles[candles.length - 1].timestamp).toISOString()} O=${candles[candles.length - 1].open} H=${candles[candles.length - 1].high} L=${candles[candles.length - 1].low} C=${candles[candles.length - 1].close}`);
  }

  return candles;
}
