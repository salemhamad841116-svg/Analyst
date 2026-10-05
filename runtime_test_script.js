import crypto from 'crypto';

const SERVER_URL = 'http://localhost:3000';

// Shared BTC source identity (strategy/indicator/source hashes)
const btcStrategyHash = crypto.randomUUID();
const btcIndicatorHash = crypto.randomUUID();
const btcSourceHash = crypto.randomUUID();

// EURUSD distinct source identity
const eurStrategyHash = crypto.randomUUID();
const eurIndicatorHash = crypto.randomUUID();
const eurSourceHash = crypto.randomUUID();

async function createContext(payload) {
  const res = await fetch(`${SERVER_URL}/api/runtime/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Context creation failed: ${JSON.stringify(data)}`);
  }
  return data;
}

const runs = [];

// Run 1 – BTCUSDT base
runs.push(
  await createContext({
    symbol: 'BTCUSDT',
    timeframe: '5m',
    provider: 'binance_spot',
    dataset: 'BINANCE_SPOT',
    strategyHash: btcStrategyHash,
    indicatorHash: btcIndicatorHash,
    modelVersion: 'v1.0',
    labelPolicyVersion: 'lpv1',
    sourceHash: btcSourceHash,
  })
);

// Run 2 – EURUSD base (different source identity)
runs.push(
  await createContext({
    symbol: 'EURUSD',
    timeframe: '5m',
    provider: 'oanda',
    dataset: 'OANDA',
    strategyHash: eurStrategyHash,
    indicatorHash: eurIndicatorHash,
    modelVersion: 'v1.0',
    labelPolicyVersion: 'lpv1',
    sourceHash: eurSourceHash,
  })
);

// Run 3 – BTCUSDT again (same source identity as Run 1)
runs.push(
  await createContext({
    symbol: 'BTCUSDT',
    timeframe: '5m',
    provider: 'binance_spot',
    dataset: 'BINANCE_SPOT',
    strategyHash: btcStrategyHash,
    indicatorHash: btcIndicatorHash,
    modelVersion: 'v1.0',
    labelPolicyVersion: 'lpv1',
    sourceHash: btcSourceHash,
  })
);

// Run 4 – BTCUSDT with different date range only (same source identity)
runs.push(
  await createContext({
    symbol: 'BTCUSDT',
    timeframe: '5m',
    provider: 'binance_spot',
    dataset: 'BINANCE_SPOT',
    strategyHash: btcStrategyHash,
    indicatorHash: btcIndicatorHash,
    modelVersion: 'v1.0',
    labelPolicyVersion: 'lpv1',
    sourceHash: btcSourceHash,
    requestedStart: '2024-01-01T00:00:00Z',
    requestedEnd:   '2024-01-31T23:59:59Z',
  })
);

import { writeFile } from 'fs/promises';
await writeFile('runtime_test_report.json', JSON.stringify(runs, null, 2));
console.log('✅ runtime_test_report.json written');
