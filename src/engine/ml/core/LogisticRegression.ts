import { Matrix } from './Matrix';

export class LogisticRegression {
  weights: number[];
  bias: number;
  learningRate: number;

  constructor(featureCount: number, learningRate = 0.01) {
    this.weights = Array.from({ length: featureCount }, () => (Math.random() - 0.5) * 0.1);
    this.bias = 0;
    this.learningRate = learningRate;
  }

  predict(features: number[]): number {
    const z = Matrix.dot(this.weights, features) + this.bias;
    return Matrix.sigmoid(z);
  }

  trainStep(features: number[], label: number) {
    const prediction = this.predict(features);
    const error = prediction - label;

    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] -= this.learningRate * error * features[i];
    }
    this.bias -= this.learningRate * error;
  }

  train(X: number[][], y: number[], epochs: number) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < X.length; i++) {
        this.trainStep(X[i], y[i]);
      }
    }
  }
}
