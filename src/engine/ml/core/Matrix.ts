export class Matrix {
  static dot(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Vector lengths must match');
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
  }

  static sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }
}
