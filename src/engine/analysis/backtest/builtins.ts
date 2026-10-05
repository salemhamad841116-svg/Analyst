export function rsi(series: (number | null)[], length: number, currentBar: number): number | null {
  if (currentBar < length) return null;
  let gains = 0, losses = 0;
  for (let i = 0; i < length; i++) {
    const diff = (series[currentBar - i] || 0) - (series[currentBar - i - 1] || 0);
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  gains /= length;
  losses /= length;
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

export function ema(series: (number | null)[], length: number, currentBar: number, previousEma: number | null): number | null {
  const val = series[currentBar];
  if (val === null) return null;
  if (previousEma === null) {
    // initialize with SMA
    if (currentBar < length - 1) return null;
    let sum = 0;
    for (let i = 0; i < length; i++) sum += (series[currentBar - i] || 0);
    return sum / length;
  }
  const alpha = 2 / (length + 1);
  return (val - previousEma) * alpha + previousEma;
}
