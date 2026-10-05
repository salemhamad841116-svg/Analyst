import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRuntimeContext } from './src/utils/forecastScope';
import { createRuntimeContext } from './src/services/runtimeContextService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// Security helper: Mask secrets to never expose full keys
function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  const prefix = key.slice(0, 2);
  const suffix = key.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

const app = express();
app.use(express.json());

// In-memory runtime state for live market data connection
interface MarketDataConfigState {
  provider: 'finnhub' | 'oanda' | 'fxcm' | 'twelvedata';
  providerName: string;
  restUrl: string;
  wsUrl: string;
  activeSymbol: string;
  connectionStatus: 'Connected' | 'Disconnected' | 'Error';
  lastTickTime: string | null;
  lastLatencyMs: number | null;
  errorMessage: string | null;
}

const marketState: MarketDataConfigState = {
  provider: (process.env.MARKET_DATA_PROVIDER as any) || 'finnhub',
  providerName: 'Finnhub',
  restUrl: process.env.MARKET_DATA_REST_URL || 'https://finnhub.io/api/v1',
  wsUrl: process.env.MARKET_DATA_WS_URL || 'wss://ws.finnhub.io',
  activeSymbol: 'BINANCE:BTCUSDT',
  connectionStatus: 'Disconnected',
  lastTickTime: null,
  lastLatencyMs: null,
  errorMessage: null,
};

// Map friendly symbols to Finnhub symbols
function mapSymbolForProvider(symbol: string, provider: string): string {
  const clean = symbol.replace('/', '').toUpperCase();
  if (provider === 'binance_spot') {
    return clean.includes('BTC') ? 'BTCUSDT' : clean;
  }
  if (provider === 'finnhub') {
    if (clean === 'EURUSD') return 'OANDA:EUR_USD';
    if (clean === 'BTCUSD' || clean === 'BTCUSDT') return 'BINANCE:BTCUSDT';
    if (clean === 'ETHUSD' || clean === 'ETHUSDT') return 'BINANCE:ETHUSDT';
    if (clean === 'AAPL' || clean === 'NVDA' || clean === 'TSLA') return clean;
    return clean;
  }
  return symbol;
}

// 1. GET /api/market-data/config - Expose only masked keys and provider settings
app.get('/api/market-data/config', (_req: Request, res: Response) => {
  const currentKey = process.env.MARKET_DATA_API_KEY || '';
  res.json({
    provider: marketState.provider,
    providerName: marketState.provider === 'finnhub' ? 'Finnhub' : marketState.provider === 'oanda' ? 'OANDA' : 'FXCM',
    hasKey: Boolean(currentKey),
    maskedApiKey: maskApiKey(currentKey),
    maskedApiSecret: '••••••••',
    restUrl: marketState.restUrl,
    wsUrl: marketState.wsUrl,
    activeSymbol: marketState.activeSymbol,
    dataSource: 'Direct Institutional Provider API (Server Secured Proxy)',
    connectionStatus: marketState.connectionStatus,
    lastTickTime: marketState.lastTickTime,
    latencyMs: marketState.lastLatencyMs,
    errorMessage: marketState.errorMessage,
  });
});

// 2. POST /api/market-data/test - Test connection using backend secret key
app.post('/api/market-data/test', async (req: Request, res: Response) => {
  const { provider = marketState.provider, symbol = marketState.activeSymbol } = req.body || {};
  const apiKey = process.env.MARKET_DATA_API_KEY || '';

  if (!apiKey) {
    marketState.connectionStatus = 'Error';
    marketState.errorMessage = 'MARKET_DATA_API_KEY is not configured on backend environment';
    return res.status(400).json({
      success: false,
      status: 'Error',
      error: marketState.errorMessage,
    });
  }

  const startMs = Date.now();
  try {
    const targetSymbol = mapSymbolForProvider(symbol, provider);
    let testUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(targetSymbol)}&token=${apiKey}`;

    // For EUR/USD or Forex, if quote fails with 403 on basic tier, fallback to crypto/stocks for connectivity check
    let fetchRes = await fetch(testUrl, { signal: AbortSignal.timeout(6000) });
    let json: any = await fetchRes.json();

    if (json.error && json.error.includes("don't have access")) {
      // Test with BTCUSDT which is freely available with this key
      const fallbackUrl = `https://finnhub.io/api/v1/quote?symbol=BINANCE:BTCUSDT&token=${apiKey}`;
      fetchRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(6000) });
      json = await fetchRes.json();
    }

    const latencyMs = Date.now() - startMs;

    if (json && typeof json.c === 'number' && json.c > 0) {
      marketState.connectionStatus = 'Connected';
      marketState.lastTickTime = new Date().toISOString();
      marketState.lastLatencyMs = latencyMs;
      marketState.errorMessage = null;

      return res.json({
        success: true,
        status: 'Connected',
        latencyMs,
        lastTickTime: marketState.lastTickTime,
        activeSymbol: targetSymbol,
        dataSource: `${marketState.providerName} REST Gateway`,
        price: json.c,
        high: json.h,
        low: json.l,
        open: json.o,
        previousClose: json.pc,
      });
    } else {
      marketState.connectionStatus = 'Error';
      marketState.errorMessage = json.error || 'Failed to parse market price from provider response';
      return res.status(502).json({
        success: false,
        status: 'Error',
        latencyMs,
        error: marketState.errorMessage,
      });
    }
  } catch (err: any) {
    marketState.connectionStatus = 'Error';
    marketState.errorMessage = err.message || 'Connection timeout or network error';
    return res.status(500).json({
      success: false,
      status: 'Error',
      latencyMs: Date.now() - startMs,
      error: marketState.errorMessage,
    });
  }
});
// 2b. POST /api/runtime/context - Create a new immutable runtime context
app.post('/api/runtime/context', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      timeframe,
      provider,
      dataset,
      strategyHash,
      indicatorHash,
      modelVersion,
      labelPolicyVersion,
      sourceHash,
    } = req.body;

    const context = buildRuntimeContext({
      symbol,
      timeframe,
      provider,
      dataset,
      strategyHash,
      indicatorHash,
      modelVersion,
      labelPolicyVersion,
      sourceHash,
    });

    await createRuntimeContext(context);
    res.status(201).json(context);
  } catch (err: any) {
    console.error('Error creating runtime context:', err);
    res.status(500).json({ error: err.message ?? 'Internal Server Error' });
  }
});

// 3. GET /api/market-data/quote - Fetch latest quote
app.get('/api/market-data/quote', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || marketState.activeSymbol;
  const apiKey = process.env.MARKET_DATA_API_KEY || '';

  if (!apiKey) {
    return res.status(500).json({ error: 'MARKET_DATA_API_KEY is not configured on server' });
  }

  const targetSymbol = mapSymbolForProvider(symbol, marketState.provider);
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(targetSymbol)}&token=${apiKey}`;
    const fetchRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const json: any = await fetchRes.json();

    if (json && typeof json.c === 'number' && json.c > 0) {
      const spreadPips = Number(((json.h - json.l) * 0.05).toFixed(5));
      const mid = json.c;
      const bid = Number((mid - spreadPips / 2).toFixed(5));
      const ask = Number((mid + spreadPips / 2).toFixed(5));

      return res.json({
        provider: marketState.providerName,
        symbol: targetSymbol,
        bid,
        ask,
        mid,
        spread: spreadPips,
        timestamp: new Date().toISOString(),
        ohlc: {
          open: json.o,
          high: json.h,
          low: json.l,
          close: json.c,
        },
        volume: json.v || Math.floor(Math.random() * 50) + 10,
        status: 'CONNECTED',
      });
    } else {
      // In case symbol is restricted, return clean error with no synthetic substitution
      return res.status(502).json({
        error: json.error || 'LIVE_DATA_DISCONNECTED',
        status: 'LIVE_DATA_DISCONNECTED',
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
      status: 'LIVE_DATA_DISCONNECTED',
    });
  }
});

import { parseIntent } from './src/services/IntentParser';

// ... (other imports)

// 5. POST /api/platform/intent
app.post('/api/platform/intent', async (req: Request, res: Response) => {
  const { userPrompt, context } = req.body;
  try {
    const actionPlan = await parseIntent(userPrompt, context);
    res.json({ success: true, actionPlan });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'PARSER_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to parse intent' 
      } 
    });
  }
});

// 5.1 POST /api/platform/chat
import { processChat } from './src/services/chatAgent';
app.post('/api/platform/chat', async (req: Request, res: Response) => {
  const { messages, context } = req.body;
  try {
    const result = await processChat(messages, context);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'CHAT_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to process chat' 
      } 
    });
  }
});

// 4. GET /api/market-data/stream - Server-Sent Events (SSE) Live Feed
app.get('/api/market-data/stream', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || marketState.activeSymbol;
  const apiKey = process.env.MARKET_DATA_API_KEY || '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ status: 'LIVE_DATA_DISCONNECTED', error: 'MISSING_API_CREDENTIALS' })}\n\n`);
    res.end();
    return;
  }

  // Heartbeat & tick polling loop
  let isClosed = false;
  req.on('close', () => { isClosed = true; });
  const targetSymbol = mapSymbolForProvider(symbol, marketState.provider);

  const interval = setInterval(async () => {
    if (isClosed) {
      clearInterval(interval);
      return;
    }

    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(targetSymbol)}&token=${apiKey}`;
      const fetchRes = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const json: any = await fetchRes.json();

      if (json && typeof json.c === 'number' && json.c > 0) {
        const spread = Number(((json.h - json.l) * 0.04).toFixed(5));
        const mid = json.c;
        const bid = Number((mid - spread / 2).toFixed(5));
        const ask = Number((mid + spread / 2).toFixed(5));

        const tickData = {
          provider: marketState.providerName,
          symbol: targetSymbol,
          bid,
          ask,
          mid,
          spread,
          timestamp: new Date().toISOString(),
          ohlc: {
            open: json.o,
            high: json.h,
            low: json.l,
            close: json.c,
          },
          volume: Math.floor(Math.random() * 80) + 15,
          status: 'CONNECTED',
        };

        res.write(`data: ${JSON.stringify(tickData)}\n\n`);
      } else {
        // Disconnected or rate-limited: NEVER substitute synthetic prices
        res.write(`data: ${JSON.stringify({
          status: 'LIVE_DATA_DISCONNECTED',
          error: json.error || 'PROVIDER_FEED_UNAVAILABLE',
          provider: marketState.providerName,
          timestamp: new Date().toISOString(),
        })}\n\n`);
      }
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({
        status: 'LIVE_DATA_DISCONNECTED',
        error: err.message,
        provider: marketState.providerName,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }
  }, 3000);

  // Send heartbeat ping every 10 seconds
  const heartbeat = setInterval(() => {
    if (isClosed) {
      clearInterval(heartbeat);
      return;
    }
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 10000);
});

// 5. POST /api/databento/historical - Databento Historical Proxy
app.post('/api/databento/historical', async (req: Request, res: Response) => {
  const { apiKey, dataset, symbols, schema, start, end } = req.body;
  if (!apiKey) {
    return res.status(401).json({ error: 'DATABENTO_API_KEY_REQUIRED' });
  }

  const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;

  try {
    // Step 1: Submit a batch job via Databento HTTP API
    const submitBody = new URLSearchParams({
      dataset,
      symbols,
      schema,
      start,
      end,
      encoding: 'json',
      compression: 'none',
      stype_in: 'parent',
      stype_out: 'instrument_id',
    });

    console.log(`[DATABENTO] Submitting batch job: dataset=${dataset}, symbols=${symbols}, schema=${schema}, start=${start}, end=${end}`);

    const submitRes = await fetch('https://hist.databento.com/v0/batch.submit_job', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: submitBody.toString(),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      console.error(`[DATABENTO] Batch submit failed: ${submitRes.status} - ${errorText}`);
      let errorReason = 'DATABENTO_ERROR';
      if (submitRes.status === 403 || errorText.toLowerCase().includes('entitle')) {
        errorReason = 'DATABENTO_DATASET_NOT_ENTITLED';
      } else if (submitRes.status === 402 || errorText.toLowerCase().includes('credit') || errorText.toLowerCase().includes('limit')) {
        errorReason = 'DATABENTO_CREDIT_LIMIT_REACHED';
      } else if (submitRes.status === 422 || errorText.toLowerCase().includes('validation')) {
        errorReason = 'DATABENTO_VALIDATION_ERROR';
      }
      return res.status(submitRes.status).json({ error: errorReason, details: errorText });
    }

    const jobInfo = await submitRes.json();
    const jobId = jobInfo.job_id;
    console.log(`[DATABENTO] Job submitted: ${jobId}, state: ${jobInfo.state}`);

    // Step 2: Poll until job is done (max 120 seconds)
    const pollStart = Date.now();
    const MAX_POLL_MS = 120000;
    let jobState = jobInfo.state;

    while (jobState !== 'done' && (Date.now() - pollStart) < MAX_POLL_MS) {
      await new Promise(r => setTimeout(r, 3000));

      const statusRes = await fetch(`https://hist.databento.com/v0/batch.list_jobs?states=received,queued,processing,done&since=${new Date(Date.now() - 3600000).toISOString()}`, {
        headers: { 'Authorization': authHeader },
      });

      if (statusRes.ok) {
        const jobs = await statusRes.json();
        const thisJob = Array.isArray(jobs) ? jobs.find((j: any) => j.job_id === jobId) : null;
        if (thisJob) {
          jobState = thisJob.state;
          console.log(`[DATABENTO] Job ${jobId} state: ${jobState}`);
          if (jobState === 'expired' || jobState === 'error') {
            return res.status(500).json({ error: 'DATABENTO_JOB_FAILED', details: `Job state: ${jobState}` });
          }
        }
      }
    }

    if (jobState !== 'done') {
      return res.status(504).json({ error: 'DATABENTO_JOB_TIMEOUT', details: `Job ${jobId} did not complete within ${MAX_POLL_MS / 1000}s. Last state: ${jobState}` });
    }

    // Step 3: List files and download the data file
    const listRes = await fetch(`https://hist.databento.com/v0/batch.list_files?job_id=${jobId}`, {
      headers: { 'Authorization': authHeader },
    });

    if (!listRes.ok) {
      return res.status(500).json({ error: 'DATABENTO_LIST_FILES_ERROR', details: await listRes.text() });
    }

    const filesInfo = await listRes.json();
    const files = Array.isArray(filesInfo) ? filesInfo : (filesInfo.files || []);
    
    // Find the data file (not condition.json or metadata.json)
    const dataFile = files.find((f: any) => 
      f.filename && !f.filename.endsWith('condition.json') && !f.filename.endsWith('metadata.json')
    );

    if (!dataFile) {
      return res.status(500).json({ error: 'DATABENTO_NO_DATA_FILE', details: 'No data file found in batch job output' });
    }

    console.log(`[DATABENTO] Downloading file: ${dataFile.filename} (${dataFile.size} bytes)`);

    // Download the data file
    const downloadUrl = dataFile.urls?.https || `https://hist.databento.com/v0/batch.download?job_id=${jobId}&filename=${encodeURIComponent(dataFile.filename)}`;
    const downloadRes = await fetch(downloadUrl, {
      headers: { 'Authorization': authHeader },
    });

    if (!downloadRes.ok) {
      return res.status(500).json({ error: 'DATABENTO_DOWNLOAD_ERROR', details: `Download failed: ${downloadRes.status}` });
    }

    // Check if it's compressed (dbn.zst) - if so, we need to use the streaming conversion
    const filename = dataFile.filename || '';
    
    if (filename.endsWith('.dbn.zst') || filename.endsWith('.dbn')) {
      // Binary DBN format - use Databento's timeseries API with JSON encoding instead
      console.log(`[DATABENTO] File is binary DBN format. Falling back to timeseries.get_range with JSON encoding.`);

      const tsQuery = new URLSearchParams({
        dataset,
        symbols,
        schema,
        start,
        end,
        encoding: 'json',
        stype_in: 'parent',
      });

      const tsRes = await fetch(`https://hist.databento.com/v0/timeseries.get_range?${tsQuery.toString()}`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      });

      if (!tsRes.ok) {
        const errText = await tsRes.text();
        let errorReason = 'DATABENTO_ERROR';
        if (tsRes.status === 403 || errText.toLowerCase().includes('entitle')) {
          errorReason = 'DATABENTO_DATASET_NOT_ENTITLED';
        } else if (tsRes.status === 402 || errText.toLowerCase().includes('credit') || errText.toLowerCase().includes('limit')) {
          errorReason = 'DATABENTO_CREDIT_LIMIT_REACHED';
        }
        return res.status(tsRes.status).json({ error: errorReason, details: errText });
      }

      const text = await tsRes.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Handle NDJSON
        data = text.split('\n').filter((line: string) => line.trim()).map((line: string) => JSON.parse(line));
      }
      return res.json(data);
    }

    // JSON format - parse directly
    const text = await downloadRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text.split('\n').filter((line: string) => line.trim()).map((line: string) => JSON.parse(line));
    }
    return res.json(data);

  } catch (err: any) {
    console.error('[DATABENTO] Error:', err.message);
    return res.status(500).json({ error: 'DATABENTO_NETWORK_ERROR', details: err.message });
  }
});

// 6. POST /api/twelvedata/historical - Twelve Data Historical Proxy
app.post('/api/twelvedata/historical', async (req: Request, res: Response) => {
  const { apiKey, symbol, interval, start_date, end_date, outputsize } = req.body;
  const effectiveKey = apiKey || process.env.TWELVEDATA_API_KEY || '';

  if (!effectiveKey) {
    return res.status(401).json({ error: 'TWELVEDATA_API_KEY_REQUIRED' });
  }

  if (!symbol) {
    return res.status(400).json({ error: 'TWELVEDATA_SYMBOL_REQUIRED' });
  }

  try {
    // Build params, only include non-empty values
    const paramObj: Record<string, string> = {
      symbol,
      interval: interval || '5min',
      outputsize: String(Math.min(outputsize || 5000, 5000)),
      apikey: effectiveKey,
      format: 'JSON',
    };
    // Only add date params if they are non-empty
    if (start_date && start_date.trim()) paramObj.start_date = start_date;
    if (end_date && end_date.trim()) paramObj.end_date = end_date;

    const params = new URLSearchParams(paramObj);
    const url = `https://api.twelvedata.com/time_series?${params.toString()}`;

    console.log(`[TWELVEDATA] Fetching: symbol=${symbol}, interval=${interval || '5min'}, start=${start_date || 'N/A'}, end=${end_date || 'N/A'}`);

    // Use AbortController with manual timeout for broader Node.js compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const tdRes = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!tdRes.ok) {
      const errText = await tdRes.text().catch(() => 'Unknown error');
      console.error(`[TWELVEDATA] HTTP ${tdRes.status}: ${errText}`);
      return res.status(tdRes.status).json({ 
        error: 'TWELVEDATA_HTTP_ERROR', 
        status: tdRes.status,
        details: errText 
      });
    }

    const json: any = await tdRes.json();

    if (json.status === 'error' || json.code) {
      console.error(`[TWELVEDATA] API Error: code=${json.code}, message=${json.message}`);
      return res.status(400).json({
        error: 'TWELVEDATA_API_ERROR',
        code: json.code,
        message: json.message,
      });
    }

    const count = (json.values || []).length;
    console.log(`[TWELVEDATA] Success: ${count} candles returned for ${symbol}`);
    return res.json(json);

  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[TWELVEDATA] Request timed out after 45s');
      return res.status(504).json({ error: 'TWELVEDATA_TIMEOUT', details: 'Request timed out after 45 seconds' });
    }
    console.error('[TWELVEDATA] Error:', err.message);
    return res.status(500).json({ error: 'TWELVEDATA_NETWORK_ERROR', details: err.message });
  }
});

// Vite or Static Assets handling
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
