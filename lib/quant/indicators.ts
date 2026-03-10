/**
 * Technical indicators for quant strategies.
 * All functions operate on arrays of closing prices (newest last).
 */

export function ema(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    result.push(prices[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += prices[j];
    result.push(sum / period);
  }
  return result;
}

export function rsi(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) return prices.map(() => NaN);

  const result: number[] = new Array(prices.length).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta > 0) avgGain += delta;
    else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number[] {
  const len = highs.length;
  if (len < 2) return highs.map(() => NaN);

  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < len; i++) {
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1]),
      ),
    );
  }

  const result: number[] = new Array(len).fill(NaN);

  let sum = 0;
  for (let i = 0; i < Math.min(period, len); i++) sum += tr[i];
  if (len >= period) {
    result[period - 1] = sum / period;
    for (let i = period; i < len; i++) {
      result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
    }
  }

  return result;
}

export interface BollingerBand {
  upper: number;
  middle: number;
  lower: number;
}

export function bollingerBands(
  prices: number[],
  period = 20,
  stdDevMultiplier = 2,
): BollingerBand[] {
  const result: BollingerBand[] = [];
  const mid = sma(prices, period);

  for (let i = 0; i < prices.length; i++) {
    if (isNaN(mid[i])) {
      result.push({ upper: NaN, middle: NaN, lower: NaN });
      continue;
    }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += (prices[j] - mid[i]) ** 2;
    }
    const stdDev = Math.sqrt(variance / period);
    result.push({
      upper: mid[i] + stdDev * stdDevMultiplier,
      middle: mid[i],
      lower: mid[i] - stdDev * stdDevMultiplier,
    });
  }

  return result;
}

export function latestEma(prices: number[], period: number): number {
  const vals = ema(prices, period);
  return vals[vals.length - 1] ?? NaN;
}

export function latestRsi(prices: number[], period = 14): number {
  const vals = rsi(prices, period);
  return vals[vals.length - 1] ?? NaN;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export function macd(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult[] {
  if (prices.length === 0) return [];
  const fastEma = ema(prices, fastPeriod);
  const slowEma = ema(prices, slowPeriod);
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(fastEma[i] - slowEma[i]);
  }
  const signalLine = ema(macdLine, signalPeriod);
  const result: MACDResult[] = [];
  for (let i = 0; i < prices.length; i++) {
    const macdVal = macdLine[i];
    const sigVal = signalLine[i];
    const valid = i >= slowPeriod + signalPeriod - 1;
    result.push({
      macd: valid ? macdVal : NaN,
      signal: valid ? sigVal : NaN,
      histogram: valid ? macdVal - sigVal : NaN,
    });
  }
  return result;
}

export function latestMacd(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  const vals = macd(prices, fastPeriod, slowPeriod, signalPeriod);
  return vals[vals.length - 1] ?? { macd: NaN, signal: NaN, histogram: NaN };
}

export function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
): number[] {
  const len = Math.min(highs.length, lows.length, closes.length, volumes.length);
  if (len === 0) return [];
  const result: number[] = [];
  let cumTpVol = 0;
  let cumVol = 0;
  for (let i = 0; i < len; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTpVol += tp * volumes[i];
    cumVol += volumes[i];
    result.push(cumVol === 0 ? NaN : cumTpVol / cumVol);
  }
  return result;
}

export function latestVwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
): number {
  const vals = vwap(highs, lows, closes, volumes);
  return vals[vals.length - 1] ?? NaN;
}

export function obv(closes: number[], volumes: number[]): number[] {
  const len = Math.min(closes.length, volumes.length);
  if (len === 0) return [];
  const result: number[] = [0];
  for (let i = 1; i < len; i++) {
    const prev = result[i - 1];
    if (closes[i] > closes[i - 1]) result.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) result.push(prev - volumes[i]);
    else result.push(prev);
  }
  return result;
}

export function latestObv(closes: number[], volumes: number[]): number {
  const vals = obv(closes, volumes);
  return vals[vals.length - 1] ?? NaN;
}
