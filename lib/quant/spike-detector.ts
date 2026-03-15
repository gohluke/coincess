/**
 * Spike Detector
 *
 * Maintains a rolling price window per coin from the WebSocket feed.
 * On every price update, calculates rate-of-change over the lookback
 * window.  When the change exceeds the threshold, emits a SpikeEvent
 * so the mean-reversion strategy can trade against the move instantly.
 */

import type { PriceFeed } from "./price-feed";

export interface SpikeEvent {
  coin: string;
  direction: "up" | "down";
  /** Signed percentage change (negative = dump, positive = pump) */
  changePct: number;
  /** Absolute magnitude (always positive) */
  magnitude: number;
  /** How many milliseconds the move took */
  durationMs: number;
  /** Current price at detection time */
  currentPrice: number;
  /** Price at the start of the spike window */
  referencePrice: number;
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
  private thresholdPct: number;
  /** Tracks last spike time per coin to avoid firing repeatedly on the same move */
  private lastSpikeTs: Map<string, number> = new Map();
  private spikeDebounceMs: number;
  private running = false;
  private lastProcessMs = 0;
  private spikesDetected = 0;

  constructor(
    priceFeed: PriceFeed,
    opts?: { lookbackMs?: number; thresholdPct?: number; debounceMs?: number },
  ) {
    this.priceFeed = priceFeed;
    this.lookbackMs = opts?.lookbackMs ?? 60_000;
    this.thresholdPct = opts?.thresholdPct ?? 0.02;
    this.spikeDebounceMs = opts?.debounceMs ?? 10_000;
  }

  onSpike(cb: SpikeCallback): void {
    this.callbacks.push(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.priceFeed.onPrice((prices) => this.processTick(prices));
    console.log(
      `[spike-detector] Started (lookback=${this.lookbackMs}ms, threshold=${(this.thresholdPct * 100).toFixed(1)}%)`,
    );
  }

  stop(): void {
    this.running = false;
    this.windows.clear();
    this.lastSpikeTs.clear();
    console.log(`[spike-detector] Stopped. Total spikes detected: ${this.spikesDetected}`);
  }

  get stats() {
    return { coinsTracked: this.windows.size, spikesDetected: this.spikesDetected };
  }

  private processTick(prices: Map<string, number>): void {
    if (!this.running) return;

    const now = Date.now();
    // Throttle to at most 2 checks per second to limit CPU on hot WS streams
    if (now - this.lastProcessMs < 500) return;
    this.lastProcessMs = now;

    for (const [key, price] of prices) {
      if (price <= 0) continue;
      // Skip stablecoin-like keys and pair-format keys (e.g. @264)
      if (key.startsWith("@") || key === "USDC" || key === "USDT") continue;

      let window = this.windows.get(key);
      if (!window) {
        window = [];
        this.windows.set(key, window);
      }

      window.push({ price, ts: now });

      // Trim samples older than the lookback window
      const cutoff = now - this.lookbackMs;
      while (window.length > 0 && window[0].ts < cutoff) {
        window.shift();
      }

      // Need at least 2 samples spanning >5s to detect a real move
      if (window.length < 2) continue;
      const span = now - window[0].ts;
      if (span < 5000) continue;

      const refPrice = window[0].price;
      const changePct = (price - refPrice) / refPrice;

      if (Math.abs(changePct) >= this.thresholdPct) {
        // Debounce: don't fire again on the same coin within debounce window
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
}
