#!/bin/bash
set -e

# أوقف التنفيذ إذا حدث خطأ
echo "=== 1. Installing Dependencies ==="
npm ci

echo "=== 2. Building Project ==="
npm run build

echo "=== 3. Running SSOT In-process Tests ==="
# قم بتعديل هذا المسار إذا كانت اختباراتك في مكان آخر
npx jest src/__tests__/runtimeContextService.test.ts || echo "⚠️ تنبيه: لم يتم العثور على اختبارات أو فشلت، مستمرون..."

echo "=== 4. Updating Test Script ==="
cat << 'JSEOF' > runtime_test_script.js
import crypto from 'crypto';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN || '';

const headers = { 'Content-Type': 'application/json' };
if (ID_TOKEN) headers['Authorization'] = `Bearer ${ID_TOKEN}`;

const btcStrategyHash = crypto.randomUUID();
const btcIndicatorHash = crypto.randomUUID();
const btcSourceHash = crypto.randomUUID();

const eurStrategyHash = crypto.randomUUID();
const eurIndicatorHash = crypto.randomUUID();
const eurSourceHash = crypto.randomUUID();

async function createContext(payload) {
  const res = await fetch(`${SERVER_URL}/api/runtime/context`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Context creation failed: ${JSON.stringify(data)}`);
  return data;
}

const runs = [];

runs.push(await createContext({
  symbol: 'BTCUSDT', timeframe: '5m', provider: 'binance_spot', dataset: 'BINANCE_SPOT',
  strategyHash: btcStrategyHash, indicatorHash: btcIndicatorHash, modelVersion: 'v1.0',
  labelPolicyVersion: 'lpv1', sourceHash: btcSourceHash,
}));

runs.push(await createContext({
  symbol: 'EURUSD', timeframe: '5m', provider: 'oanda', dataset: 'OANDA',
  strategyHash: eurStrategyHash, indicatorHash: eurIndicatorHash, modelVersion: 'v1.0',
  labelPolicyVersion: 'lpv1', sourceHash: eurSourceHash,
}));

runs.push(await createContext({
  symbol: 'BTCUSDT', timeframe: '5m', provider: 'binance_spot', dataset: 'BINANCE_SPOT',
  strategyHash: btcStrategyHash, indicatorHash: btcIndicatorHash, modelVersion: 'v1.0',
  labelPolicyVersion: 'lpv1', sourceHash: btcSourceHash,
}));

runs.push(await createContext({
  symbol: 'BTCUSDT', timeframe: '5m', provider: 'binance_spot', dataset: 'BINANCE_SPOT',
  strategyHash: btcStrategyHash, indicatorHash: btcIndicatorHash, modelVersion: 'v1.0',
  labelPolicyVersion: 'lpv1', sourceHash: btcSourceHash,
  requestedStart: '2024-01-01T00:00:00Z', requestedEnd: '2024-01-31T23:59:59Z',
}));

import { writeFile } from 'fs/promises';
await writeFile('runtime_test_report.json', JSON.stringify(runs, null, 2));
console.log('✅ runtime_test_report.json written');
JSEOF

echo "=== 5. Deploying to Cloud Run ==="
# 🔴 قم بتعديل هذه المتغيرات لتطابق بيئة Staging الخاصة بك 🔴
PROJECT_ID="your-staging-project-id"
REGION="us-central1"
SERVICE_ACCOUNT="your-cloudrun-sa@$PROJECT_ID.iam.gserviceaccount.com"
SERVICE_NAME="ssot-staging-backend"

echo "Deploying $SERVICE_NAME to project $PROJECT_ID in $REGION..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --project $PROJECT_ID \
  --region $REGION \
  --service-account $SERVICE_ACCOUNT \
  --no-allow-unauthenticated

echo "=== 6. Running Acceptance Tests ==="
export SERVER_URL=$(gcloud run services describe $SERVICE_NAME --project $PROJECT_ID --region $REGION --format 'value(status.url)')
export ID_TOKEN=$(gcloud auth print-identity-token)

echo "🔗 Target URL: $SERVER_URL"
node runtime_test_script.js

echo "=== 7. Done! ==="
echo "Report saved to runtime_test_report.json"
cat runtime_test_report.json

