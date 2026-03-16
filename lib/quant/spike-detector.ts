/**
 * Spike Detector v2 — ATR-Adaptive Thresholds
 *
 * Maintains a rolling price window per coin from the WebSocket feed.
 * Instead of a fixed threshold for all coins, each coin's spike threshold
 * is based on its recent volatility (ATR proxy from price samples).
 *
 * A "spike" is defined as a move > 2.5x the coin's rolling volatility
 * within the lookback window. This means BTC (low vol) triggers on a
 * 1.5% move while a micro-cap (high vol) might need 5%+.
 */

import type { PriceFeed } from "./price-feed";

export interface SpikeEvent {
  coin: string;
  direction: "up" | "down";
  changePct: number;
  magnitude: number;
  durationMs: number;
  currentPrice: number;
  referencePrice: number;
  /** Dynamic threshold that was exceeded */
  dynamicThreshold: number;
}

export type SpikeCallback = (event: SpikeEvent) => void;

interface PriceSample {
  price: number;
  ts: number;
}

export class SpikeDetector {
  private priceFeed: PriceFeed;
  private windows: Map<string, PriceSample[]> = new Map();
  private callbacks: SpikeCallback[] = [];
  private lookbackMs: number;
  private fallbackThresholdPct: number;
  private lastSpikeTs: Map<string, number> = new Map();
  private spikeDebounceMs: number;
  private running = false;
  private lastProcessMs = 0;
  private spikesDetected = 0;

  /** Rolling volatility per coin (updated every check) */
  private coinVolatility: Map<string, number> = new Map();

  /** Multiplier: spike = move > (volatility * multiplier) */
  private volatilityMultiplier: number;

  /** Minimum threshold regardless of volatility */
  private minThreshold: number;
  /** Maximum threshold regardless of volatility */
  private maxThreshold: number;

  constructor(
    priceFeed: PriceFeed,
    opts?: {
      lookbackMs?: number;
      thresholdPct?: number;
      debounceMs?: number;
      volatilityMultiplier?: number;
      minThreshold?: number;
      maxThreshold?: number;
    },
  ) {
    this.priceFeed = priceFeed;
    this.lookbackMs = opts?.lookbackMs ?? 60_000;
    this.fallbackThresholdPct = opts?.thresholdPct ?? 0.02;
    this.spikeDebounceMs = opts?.debounceMs ?? 10_000;
    this.volatilityMultiplier = opts?.volatilityMultiplier ?? 2.5;
    this.minThreshold = opts?.minThreshold ?? 0.01;  // at least 1%
    this.maxThreshold = opts?.maxThreshold ?? 0.08;   // at most 8%
  }

  onSpike(cb: SpikeCallback): void {
    this.callbacks.push(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.priceFeed.onPrice((prices) => this.processTick(prices));
    console.log(
      `[spike-detector] Started v2 (lookback=${this.lookbackMs}ms, volMultiplier=${this.volatilityMultiplier}, range=${(this.minThreshold * 100).toFixed(0)}%-${(this.maxThreshold * 100).toFixed(0)}%)`,
    );
  }

  stop(): void {
    this.running = false;
    this.windows.clear();
    this.lastSpikeTs.clear();
    this.coinVolatility.clear();
    console.log(`[spike-detector] Stopped. Total spikes detected: ${this.spikesDetected}`);
  }

  get stats() {
    return { coinsTracked: this.windows.size, spikesDetected: this.spikesDetected };
  }

  /** Get the current dynamic threshold for a coin (for external use) */
  getThreshold(coin: string): number {
    return this.coinVolatility.get(coin) ?? this.fallbackThresholdPct;
  }

  private processTick(prices: Map<string, number>): void {
    if (!this.running) return;

    const now = Date.now();
    if (now - this.lastProcessMs < 500) return;
    this.lastProcessMs = now;

    for (const [key, price] of prices) {
      if (price <= 0) continue;
      if (key.startsWith("@") || key === "USDC" || key === "USDT") continue;

      let window = this.windows.get(key);
      if (!window) {
        window = [];
        this.windows.set(key, window);
      }

      window.push({ price, ts: now });

      const cutoff = now - this.lookbackMs;
      while (window.length > 0 && window[0].ts < cutoff) {
        window.shift();
      }

      if (window.length < 2) continue;
      const span = now - window[0].ts;
      if (span < 5000) continue;

      // Compute rolling volatility from price samples
      const threshold = this.computeDynamicThreshold(key, window);

      const refPrice = window[0].price;
      const changePct = (price - refPrice) / refPrice;

      if (Math.abs(changePct) >= threshold) {
        const lastSpike = this.lastSpikeTs.get(key) ?? 0;
        if (now - lastSpike < this.spikeDebounceMs) continue;

        this.lastSpikeTs.set(key, now);
        this.spikesDetected++;

        const event: SpikeEvent = {
          coin: key,
          direction: changePct > 0 ? "up" : "down",
          changePct,
          magnitude: Math.abs(changePct),
          durationMs: span,
          currentPrice: price,
          referencePrice: refPrice,
          dynamicThreshold: threshold,
        };

        for (const cb of this.callbacks) {
          try {
            cb(event);
          } catch (e) {
            console.error("[spike-detector] Callback error:", (e as Error).message);
          }
        }
      }
    }
  }

  /**
   * Compute ATR-like volatility from price samples.
   * Uses the standard deviation of returns over the lookback window
   * as a proxy for realized volatility, then multiplies by the
   * configured multiplier to get the spike threshold.
   */
  private computeDynamicThreshold(coin: string, samples: PriceSample[]): number {
    if (samples.length < 5) {
      return this.coinVolatility.get(coin) ?? this.fallbackThresholdPct;
    }

    // Calculate returns between consecutive samples
    const returns: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const ret = (samples[i].price - samples[i - 1].price) / samples[i - 1].price;
      returns.push(ret);
    }

    if (returns.length < 3) {
      return this.coinVolatility.get(coin) ?? this.fallbackThresholdPct;
    }

    // Standard deviation of returns
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Scale up: a "spike" should be significantly larger than normal noise
    // Use max-range of returns as additional signal
    const maxReturn = Math.max(...returns.map(Math.abs));
    const vol = Math.max(stdDev, maxReturn * 0.5);

    const threshold = Math.max(
      this.minThreshold,
      Math.min(this.maxThreshold, vol * this.volatilityMultiplier),
    );

    this.coinVolatility.set(coin, threshold);
    return threshold;
  }
}
