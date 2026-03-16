/**
 * Market Analysis Module
 *
 * Fetches OHLCV candle data and computes technical indicators for each coin.
 * Produces an enriched snapshot that gives the AI real signal data instead
 * of just a single price tick.
 */

import { ema, rsi, macd, bollingerBands, atr } from "./indicators";
import type { MarketSnapshot } from "./types";

const HL_API = "https://api.hyperliquid.xyz";

export interface CandleBar {
  t: number; // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface TechnicalSnapshot {
  coin: string;
  markPx: number;
  funding: number;
  openInterest: number;
  volume24h: number;

  // Price returns
  return1h: number;
  return4h: number;
  return24h: number;

  // RSI
  rsi14: number;

  // EMA
  ema9: number;
  ema21: number;
  emaTrend: "bullish" | "bearish" | "neutral";

  // MACD
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  macdCross: "bullish" | "bearish" | "none";

  // Bollinger Bands
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbPosition: "above_upper" | "above_mid" | "below_mid" | "below_lower";

  // Volatility
  atr14: number;
  atr14Pct: number; // ATR as % of price

  // Volume analysis
  volumeChange: number; // current volume vs 20-bar avg

  // Higher timeframe trend (4h)
  htfTrend: "up" | "down" | "sideways";
}

/**
 * Fetch candle bars from Hyperliquid for a specific coin and interval.
 */
async function fetchCandles(
  coin: string,
  interval: string,
  count: number,
  candleCoin?: string,
): Promise<CandleBar[]> {
  const intervalMs: Record<string, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
  };
  const ms = intervalMs[interval] ?? 300_000;
  const now = Date.now();
  const startTime = now - ms * count;

  try {
    const res = await fetch(`${HL_API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: { coin: candleCoin ?? coin, interval, startTime, endTime: now },
      }),
    });
    const raw = (await res.json()) as Array<{
      t: number;
      o: string;
      h: string;
      l: string;
      c: string;
      v: string;
    }>;
    return raw.map((c) => ({
      t: c.t,
      o: parseFloat(c.o),
      h: parseFloat(c.h),
      l: parseFloat(c.l),
      c: parseFloat(c.c),
      v: parseFloat(c.v),
    }));
  } catch {
    return [];
  }
}

/**
 * Compute technical indicators from candle data.
 */
function computeIndicators(candles5m: CandleBar[], candles4h: CandleBar[]): Omit<
  TechnicalSnapshot,
  "coin" | "markPx" | "funding" | "openInterest" | "volume24h"
> | null {
  if (candles5m.length < 30) return null;

  const closes = candles5m.map((c) => c.c);
  const highs = candles5m.map((c) => c.h);
  const lows = candles5m.map((c) => c.l);
  const volumes = candles5m.map((c) => c.v);
  const currentPx = closes[closes.length - 1];

  // Price returns
  const barsIn1h = Math.min(12, closes.length - 1); // 12 x 5m = 1h
  const barsIn4h = Math.min(48, closes.length - 1);
  const barsIn24h = Math.min(288, closes.length - 1);
  const return1h = barsIn1h > 0 ? (currentPx - closes[closes.length - 1 - barsIn1h]) / closes[closes.length - 1 - barsIn1h] : 0;
  const return4h = barsIn4h > 0 ? (currentPx - closes[closes.length - 1 - barsIn4h]) / closes[closes.length - 1 - barsIn4h] : 0;
  const return24h = barsIn24h > 0 ? (currentPx - closes[closes.length - 1 - barsIn24h]) / closes[closes.length - 1 - barsIn24h] : 0;

  // RSI
  const rsiValues = rsi(closes, 14);
  const rsi14 = rsiValues[rsiValues.length - 1] ?? 50;

  // EMA
  const ema9Values = ema(closes, 9);
  const ema21Values = ema(closes, 21);
  const ema9Val = ema9Values[ema9Values.length - 1] ?? currentPx;
  const ema21Val = ema21Values[ema21Values.length - 1] ?? currentPx;
  const emaDiff = (ema9Val - ema21Val) / ema21Val;
  const emaTrend: "bullish" | "bearish" | "neutral" =
    emaDiff > 0.001 ? "bullish" : emaDiff < -0.001 ? "bearish" : "neutral";

  // MACD
  const macdValues = macd(closes, 12, 26, 9);
  const lastMacd = macdValues[macdValues.length - 1] ?? { macd: 0, signal: 0, histogram: 0 };
  const prevMacd = macdValues[macdValues.length - 2] ?? { macd: 0, signal: 0, histogram: 0 };
  let macdCross: "bullish" | "bearish" | "none" = "none";
  if (!isNaN(lastMacd.histogram) && !isNaN(prevMacd.histogram)) {
    if (prevMacd.histogram <= 0 && lastMacd.histogram > 0) macdCross = "bullish";
    if (prevMacd.histogram >= 0 && lastMacd.histogram < 0) macdCross = "bearish";
  }

  // Bollinger Bands
  const bb = bollingerBands(closes, 20, 2);
  const lastBb = bb[bb.length - 1] ?? { upper: currentPx, middle: currentPx, lower: currentPx };
  let bbPosition: TechnicalSnapshot["bbPosition"] = "above_mid";
  if (!isNaN(lastBb.upper)) {
    if (currentPx >= lastBb.upper) bbPosition = "above_upper";
    else if (currentPx >= lastBb.middle) bbPosition = "above_mid";
    else if (currentPx >= lastBb.lower) bbPosition = "below_mid";
    else bbPosition = "below_lower";
  }

  // ATR
  const atrValues = atr(highs, lows, closes, 14);
  const atr14 = atrValues[atrValues.length - 1] ?? 0;
  const atr14Pct = currentPx > 0 ? atr14 / currentPx : 0;

  // Volume change vs 20-bar average
  const recentVols = volumes.slice(-20);
  const avgVol = recentVols.length > 0 ? recentVols.reduce((s, v) => s + v, 0) / recentVols.length : 0;
  const currentVol = volumes[volumes.length - 1] ?? 0;
  const volumeChange = avgVol > 0 ? currentVol / avgVol - 1 : 0;

  // Higher timeframe trend (4h candles)
  let htfTrend: "up" | "down" | "sideways" = "sideways";
  if (candles4h.length >= 10) {
    const htfCloses = candles4h.map((c) => c.c);
    const htfEma9 = ema(htfCloses, 5);
    const htfEma21 = ema(htfCloses, 10);
    const lastHtf9 = htfEma9[htfEma9.length - 1] ?? 0;
    const lastHtf21 = htfEma21[htfEma21.length - 1] ?? 0;
    if (lastHtf21 > 0) {
      const htfDiff = (lastHtf9 - lastHtf21) / lastHtf21;
      if (htfDiff > 0.005) htfTrend = "up";
      else if (htfDiff < -0.005) htfTrend = "down";
    }
  }

  return {
    return1h,
    return4h,
    return24h,
    rsi14: isNaN(rsi14) ? 50 : rsi14,
    ema9: ema9Val,
    ema21: ema21Val,
    emaTrend,
    macdLine: isNaN(lastMacd.macd) ? 0 : lastMacd.macd,
    macdSignal: isNaN(lastMacd.signal) ? 0 : lastMacd.signal,
    macdHistogram: isNaN(lastMacd.histogram) ? 0 : lastMacd.histogram,
    macdCross,
    bbUpper: isNaN(lastBb.upper) ? currentPx * 1.02 : lastBb.upper,
    bbMiddle: isNaN(lastBb.middle) ? currentPx : lastBb.middle,
    bbLower: isNaN(lastBb.lower) ? currentPx * 0.98 : lastBb.lower,
    bbPosition,
    atr14: isNaN(atr14) ? 0 : atr14,
    atr14Pct: isNaN(atr14Pct) ? 0 : atr14Pct,
    volumeChange,
    htfTrend,
  };
}

/**
 * Select top coins by volume * volatility product (best for short-term trading).
 */
export function selectTopCoins(
  markets: MarketSnapshot[],
  maxCoins = 15,
): MarketSnapshot[] {
  return markets
    .filter((m) => m.dex === "perp" && !m.coin.startsWith("xyz:"))
    .filter((m) => m.volume24h > 500_000) // min $500k volume
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, maxCoins);
}

/**
 * Build enriched technical snapshots for a set of coins.
 * Fetches 5m candles (300 bars = 25h) and 4h candles (30 bars = 5 days)
 * and computes all indicators.
 */
export async function buildTechnicalSnapshots(
  markets: MarketSnapshot[],
): Promise<TechnicalSnapshot[]> {
  const results: TechnicalSnapshot[] = [];

  // Fetch candles in parallel, batched to avoid overwhelming the API
  const BATCH_SIZE = 5;
  for (let i = 0; i < markets.length; i += BATCH_SIZE) {
    const batch = markets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (m) => {
        const [candles5m, candles4h] = await Promise.all([
          fetchCandles(m.coin, "5m", 300, m.candleCoin),
          fetchCandles(m.coin, "4h", 30, m.candleCoin),
        ]);

        const indicators = computeIndicators(candles5m, candles4h);
        if (!indicators) return null;

        return {
          coin: m.coin,
          markPx: m.markPx,
          funding: m.funding,
          openInterest: m.openInterest,
          volume24h: m.volume24h,
          ...indicators,
        } satisfies TechnicalSnapshot;
      }),
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

/**
 * Get ATR-based spike threshold for a coin.
 * Returns the threshold as a fraction (e.g., 0.03 for 3%).
 * Uses 2x ATR as a "normal" move; a spike is anything beyond that.
 */
export function dynamicSpikeThreshold(atr14Pct: number): number {
  // Clamp: at least 1%, at most 8%
  const threshold = Math.max(0.01, Math.min(0.08, atr14Pct * 2.5));
  return threshold;
}
