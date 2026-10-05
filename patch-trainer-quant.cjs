const fs = require('fs');
const path = './src/engine/ml/training/trainer.ts';

const code = `import { Candle } from '../../../types';
import { LogisticRegression } from '../core/LogisticRegression';
import { MLP } from '../core/MLP';
import { NativeRNN } from '../core/LSTM';
import { FastFourierTransform } from '../../quant/fft';
import { HiddenMarkovModel } from '../../quant/hmm';
import { MonteCarloEngine } from '../../quant/monteCarlo';
import { CointegrationMath } from '../../quant/cointegration';

export interface MLTrainingResult {
  logisticModel: LogisticRegression;
  mlpModel: MLP;
  rnnModel: NativeRNN;
  oosAccuracy: number;
  blindAccuracy: number;
  calibrationMetrics: {
    avgConfidenceWhenCorrect: number;
    avgConfidenceWhenWrong: number;
  };
  modelVersion: string;
  datasetHash: string;
  sampleCount: number;
}

let cachedResult: MLTrainingResult | null = null;
let cachedDatasetHash: string | null = null;

function extractQuantFeatures(candles: Candle[], index: number, windowSize: number): number[] {
  // We look back 'windowSize' + a slightly larger context for FFT/MC
  const lookbackContext = 32;
  const startIdx = Math.max(0, index - lookbackContext);
  const contextCandles = candles.slice(startIdx, index + 1);
  const returns = contextCandles.slice(1).map((c, i) => (c.close - contextCandles[i].close) / contextCandles[i].close);
  const closes = contextCandles.map(c => c.close);

  // 1. FFT Dominant Cycle
  const fft = FastFourierTransform.compute(closes);
  
  // 2. HMM State Probabilities
  const hmm = HiddenMarkovModel.estimateStateProbabilities(returns);
  
  // 3. Monte Carlo Expected Variance
  const mc = MonteCarloEngine.simulateNextCandle(closes[closes.length - 1], returns, 100); // lightweight sim for features
  
  // 4. Cointegration Z-Score
  const zScore = CointegrationMath.getZScore(closes, closes[closes.length - 1]);

  const f: number[] = [
    fft.dominantCycle / 32, // normalized
    hmm.stateProbs[0], 
    hmm.stateProbs[1], 
    hmm.stateProbs[2],
    mc.variance * 1000,
    zScore / 5 // normalized
  ];
  
  // Add raw price action window
  for (let i = 0; i < windowSize; i++) {
    const c = candles[index - i];
    const prev = candles[index - i - 1];
    if (!c || !prev) {
      f.push(0, 0, 0, 0); 
      continue;
    }
    const returnPct = (c.close - prev.close) / prev.close;
    const body = (c.close - c.open) / c.open;
    const highWick = (c.high - Math.max(c.open, c.close)) / c.open;
    const lowWick = (Math.min(c.open, c.close) - c.low) / c.open;
    f.push(returnPct * 100, body * 100, highWick * 100, lowWick * 100);
  }
  return f;
}

export function trainModelsNative(candles: Candle[], symbol: string, timeframe: string): MLTrainingResult {
  const datasetHash = \`\${symbol}_\${timeframe}_\${candles.length}_\${candles[0]?.timestamp || 0}\`;
  
  if (cachedResult && cachedDatasetHash === datasetHash) {
    return cachedResult;
  }

  const windowSize = 5;
  const X: number[][] = [];
  const seqX: number[][][] = []; // For RNN
  const y: number[] = [];

  for (let i = 32; i < candles.length - 1; i++) {
    const f = extractQuantFeatures(candles, i, windowSize);
    
    // For RNN, we need a sequence. We'll build a mini sequence of the last 3 steps
    const seq = [];
    for(let step = 2; step >= 0; step--) {
       seq.push(extractQuantFeatures(candles, i - step, windowSize));
    }

    const targetCandle = candles[i + 1];
    const isUp = targetCandle.close > targetCandle.open ? 1 : 0;
    
    X.push(f);
    seqX.push(seq);
    y.push(isUp);
  }

  const total = X.length;
  if (total < 100) throw new Error('Not enough data to train');

  const trainSplit = Math.floor(total * 0.7);
  const oosSplit = Math.floor(total * 0.85);

  const X_train = X.slice(0, trainSplit);
  const seqX_train = seqX.slice(0, trainSplit);
  const y_train = y.slice(0, trainSplit);
  
  const X_oos = X.slice(trainSplit, oosSplit);
  const seqX_oos = seqX.slice(trainSplit, oosSplit);
  const y_oos = y.slice(trainSplit, oosSplit);
  
  const X_blind = X.slice(oosSplit);
  const seqX_blind = seqX.slice(oosSplit);
  const y_blind = y.slice(oosSplit);

  const featureCount = X[0].length;
  
  const logistic = new LogisticRegression(featureCount, 0.05);
  const mlp = new MLP(featureCount, 8, 0.05);
  const rnn = new NativeRNN(featureCount, 8, 0.05);

  logistic.train(X_train, y_train, 15);
  mlp.train(X_train, y_train, 20);
  rnn.train(seqX_train, y_train, 15);

  let oosCorrect = 0;
  for (let i = 0; i < X_oos.length; i++) {
    const p1 = logistic.predict(X_oos[i]);
    const p2 = mlp.predict(X_oos[i]);
    const p3 = rnn.predict(seqX_oos[i]);
    const ensemblePrediction = (p1 + p2 + p3) / 3 > 0.5 ? 1 : 0;
    if (ensemblePrediction === y_oos[i]) oosCorrect++;
  }
  const oosAccuracy = (oosCorrect / X_oos.length) * 100;

  let blindCorrect = 0;
  let sumConfCorrect = 0;
  let sumConfWrong = 0;
  
  for (let i = 0; i < X_blind.length; i++) {
    const p1 = logistic.predict(X_blind[i]);
    const p2 = mlp.predict(X_blind[i]);
    const p3 = rnn.predict(seqX_blind[i]);
    const avgProb = (p1 + p2 + p3) / 3;
    const ensemblePrediction = avgProb > 0.5 ? 1 : 0;
    const confidence = avgProb > 0.5 ? avgProb : 1 - avgProb;
    
    if (ensemblePrediction === y_blind[i]) {
      blindCorrect++;
      sumConfCorrect += confidence;
    } else {
      sumConfWrong += confidence;
    }
  }
  const blindAccuracy = (blindCorrect / X_blind.length) * 100;

  const result: MLTrainingResult = {
    logisticModel: logistic,
    mlpModel: mlp,
    rnnModel: rnn,
    oosAccuracy: parseFloat(oosAccuracy.toFixed(2)),
    blindAccuracy: parseFloat(blindAccuracy.toFixed(2)),
    calibrationMetrics: {
      avgConfidenceWhenCorrect: blindCorrect > 0 ? (sumConfCorrect / blindCorrect) * 100 : 0,
      avgConfidenceWhenWrong: (X_blind.length - blindCorrect) > 0 ? (sumConfWrong / (X_blind.length - blindCorrect)) * 100 : 0
    },
    modelVersion: 'Institutional_Hybrid_v1.0',
    datasetHash,
    sampleCount: total
  };

  cachedResult = result;
  cachedDatasetHash = datasetHash;
  return result;
}

export function extractLiveFeatures(candles: Candle[]): { f: number[], seq: number[][] } {
  const f = extractQuantFeatures(candles, candles.length - 1, 5);
  const seq = [];
  for(let step = 2; step >= 0; step--) {
     seq.push(extractQuantFeatures(candles, candles.length - 1 - step, 5));
  }
  return { f, seq };
}
`;

fs.writeFileSync(path, code);
console.log('Patched trainer.ts with Quant Layer and RNN.');
