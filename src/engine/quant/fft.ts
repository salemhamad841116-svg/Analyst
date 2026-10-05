/**
 * Simple Discrete Fourier Transform (DFT) to extract dominant frequencies
 * Useful for finding cycles in market data and filtering noise.
 */
export class FastFourierTransform {
  static compute(prices: number[]): { frequencies: number[]; amplitudes: number[]; dominantCycle: number } {
    const N = prices.length;
    const real = new Array(N).fill(0);
    const imag = new Array(N).fill(0);
    const amplitudes = new Array(Math.floor(N / 2)).fill(0);
    const frequencies = new Array(Math.floor(N / 2)).fill(0);

    for (let k = 0; k < N; k++) {
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real[k] += prices[n] * Math.cos(angle);
        imag[k] -= prices[n] * Math.sin(angle);
      }
    }

    let maxAmp = -1;
    let dominantIndex = 0;

    // Only need the first half (Nyquist limit)
    for (let k = 1; k < Math.floor(N / 2); k++) {
      amplitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / N;
      frequencies[k] = k;
      
      // Ignore k=0 (DC component)
      if (amplitudes[k] > maxAmp) {
        maxAmp = amplitudes[k];
        dominantIndex = k;
      }
    }

    // Dominant cycle length = N / k
    const dominantCycle = dominantIndex > 0 ? N / dominantIndex : 0;

    return { frequencies, amplitudes, dominantCycle };
  }

  static filterNoise(prices: number[], keepTopComponents = 3): number[] {
    // Advanced feature: reconstruct wave using only top K frequencies
    // (A full IFFT would be used here, but for now we extract cycles for features)
    return prices; // Placeholder for actual IFFT smoothing
  }
}
