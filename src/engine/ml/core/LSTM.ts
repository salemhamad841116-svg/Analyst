import { Matrix } from './Matrix';

/**
 * Lightweight Recurrent Neural Network (RNN) core for time-series.
 * Simplified for Native TS without heavy tensor libraries.
 */
export class NativeRNN {
  inputSize: number;
  hiddenSize: number;
  
  // Weights
  Wx: number[][]; // hiddenSize x inputSize
  Wh: number[][]; // hiddenSize x hiddenSize
  bh: number[];   // hiddenSize
  Wy: number[];   // hiddenSize (to 1 output)
  by: number;
  
  learningRate: number;

  constructor(inputSize: number, hiddenSize: number, learningRate = 0.01) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.learningRate = learningRate;

    const limitX = Math.sqrt(6 / (inputSize + hiddenSize));
    this.Wx = Array.from({ length: hiddenSize }, () => 
      Array.from({ length: inputSize }, () => (Math.random() * 2 - 1) * limitX)
    );
    
    const limitH = Math.sqrt(6 / (hiddenSize + hiddenSize));
    this.Wh = Array.from({ length: hiddenSize }, () => 
      Array.from({ length: hiddenSize }, () => (Math.random() * 2 - 1) * limitH)
    );
    
    this.bh = Array.from({ length: hiddenSize }, () => 0);

    const limitY = Math.sqrt(6 / (hiddenSize + 1));
    this.Wy = Array.from({ length: hiddenSize }, () => (Math.random() * 2 - 1) * limitY);
    this.by = 0;
  }

  // Forward pass over a sequence of features
  forward(sequence: number[][]): { finalOutput: number, hiddenStates: number[][] } {
    let h = new Array(this.hiddenSize).fill(0);
    const hiddenStates = [];

    for (const x of sequence) {
      const nextH = new Array(this.hiddenSize).fill(0);
      for (let i = 0; i < this.hiddenSize; i++) {
        let z = this.bh[i];
        for (let j = 0; j < this.inputSize; j++) z += this.Wx[i][j] * x[j];
        for (let j = 0; j < this.hiddenSize; j++) z += this.Wh[i][j] * h[j];
        nextH[i] = Math.tanh(z);
      }
      h = nextH;
      hiddenStates.push([...h]);
    }

    let zOut = this.by;
    for (let i = 0; i < this.hiddenSize; i++) {
      zOut += this.Wy[i] * h[i];
    }
    const finalOutput = Matrix.sigmoid(zOut);
    
    return { finalOutput, hiddenStates };
  }

  predict(sequence: number[][]): number {
    return this.forward(sequence).finalOutput;
  }

  trainStep(sequence: number[][], label: number) {
    // Simplified BPTT (Backpropagation Through Time) truncating to last step
    const { finalOutput, hiddenStates } = this.forward(sequence);
    const errorOut = finalOutput - label;

    const lastH = hiddenStates[hiddenStates.length - 1];
    
    // Output layer gradients
    for (let i = 0; i < this.hiddenSize; i++) {
      this.Wy[i] -= this.learningRate * errorOut * lastH[i];
    }
    this.by -= this.learningRate * errorOut;
    
    // We omit full BPTT through all timesteps to keep the browser fast.
    // This acts as a pseudo-recurrent dense layer for the final state.
    const errorH = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      const tanhDeriv = 1 - lastH[i] * lastH[i];
      errorH[i] = errorOut * this.Wy[i] * tanhDeriv;
    }

    const lastX = sequence[sequence.length - 1];
    let prevH = sequence.length > 1 ? hiddenStates[hiddenStates.length - 2] : new Array(this.hiddenSize).fill(0);

    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        this.Wx[i][j] -= this.learningRate * errorH[i] * lastX[j];
      }
      for (let j = 0; j < this.hiddenSize; j++) {
        this.Wh[i][j] -= this.learningRate * errorH[i] * prevH[j];
      }
      this.bh[i] -= this.learningRate * errorH[i];
    }
  }

  train(sequences: number[][][], labels: number[], epochs: number) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < sequences.length; i++) {
        this.trainStep(sequences[i], labels[i]);
      }
    }
  }
}
