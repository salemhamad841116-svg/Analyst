import { Matrix } from './Matrix';

export class MLP {
  inputSize: number;
  hiddenSize: number;
  weights1: number[][]; // hiddenSize x inputSize
  bias1: number[];      // hiddenSize
  weights2: number[];   // hiddenSize (since output is 1 node for binary classification)
  bias2: number;
  learningRate: number;

  constructor(inputSize: number, hiddenSize: number, learningRate = 0.01) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.learningRate = learningRate;

    // Xavier initialization
    const limit1 = Math.sqrt(6 / (inputSize + hiddenSize));
    this.weights1 = Array.from({ length: hiddenSize }, () => 
      Array.from({ length: inputSize }, () => (Math.random() * 2 - 1) * limit1)
    );
    this.bias1 = Array.from({ length: hiddenSize }, () => 0);

    const limit2 = Math.sqrt(6 / (hiddenSize + 1));
    this.weights2 = Array.from({ length: hiddenSize }, () => (Math.random() * 2 - 1) * limit2);
    this.bias2 = 0;
  }

  forward(features: number[]): { hidden: number[], output: number } {
    // Hidden layer with ReLU
    const hidden = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      let z = this.bias1[i];
      for (let j = 0; j < this.inputSize; j++) {
        z += this.weights1[i][j] * features[j];
      }
      hidden[i] = Math.max(0, z); // ReLU
    }

    // Output layer with Sigmoid
    let zOut = this.bias2;
    for (let i = 0; i < this.hiddenSize; i++) {
      zOut += this.weights2[i] * hidden[i];
    }
    const output = Matrix.sigmoid(zOut);
    
    return { hidden, output };
  }

  predict(features: number[]): number {
    return this.forward(features).output;
  }

  trainStep(features: number[], label: number) {
    const { hidden, output } = this.forward(features);
    
    // Output layer error (Binary Cross Entropy + Sigmoid derivative simplifies to prediction - label)
    const errorOut = output - label;
    
    // Hidden layer error
    const errorHidden = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      // ReLU derivative
      const reluDeriv = hidden[i] > 0 ? 1 : 0;
      errorHidden[i] = errorOut * this.weights2[i] * reluDeriv;
    }

    // Update weights2 & bias2
    for (let i = 0; i < this.hiddenSize; i++) {
      this.weights2[i] -= this.learningRate * errorOut * hidden[i];
    }
    this.bias2 -= this.learningRate * errorOut;

    // Update weights1 & bias1
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        this.weights1[i][j] -= this.learningRate * errorHidden[i] * features[j];
      }
      this.bias1[i] -= this.learningRate * errorHidden[i];
    }
  }

  train(X: number[][], y: number[], epochs: number) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < X.length; i++) {
        this.trainStep(X[i], y[i]);
      }
    }
  }
}
