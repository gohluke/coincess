/**
 * Spike Mean-Reversion Strategy
 *
 * Listens to SpikeDetector events and instantly opens a contra-position
 * expecting the price to snap back to the mean.  Runs event-driven on
 * the WebSocket feed — no polling, no LLM calls, pure math.
 *
 * Coin dumps 3%  → go LONG  (expect rebound)
 * Coin pumps 3%  → go SHORT (expect pullback)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { placeOrder, fetchAccountValue } from "../executor";
import type { SpikeEvent } from "../spike-detector";
import type { SpikeReversionConfig } from "../types";
import { SPIKE_REVERSION_DEFAULTS } from "../types";

const HL_API = "https://api.hyperliquid.xyz";

interface ActivePosition {
  coin: string;
  side: "long" | "short";
  entryPx: number;
  size: number;
  tradeId: string;
}

export class SpikeReversionStrategy {
  private supabase: SupabaseClient;
  private config: SpikeReversionConfig;
  private activePositions: Map<string, ActivePosition> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private executing: Set<string> = new Set();
  private perpIndexCache: Map<string, number> = new Map();
  private perpDecimalsCache: Map<string, number> = new Map();
  private volumeCache: Map<string, number> = new Map();
  private volumeCacheTs = 0;
  private walletAddress: string;
  private tradesExecuted = 0;
  private running = false;

  constructor(walletAddress: string, config?: Partial<SpikeReversionConfig>) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials for SpikeReversion");
    this.supabase = createClient(url, key);
    this.config = { ...SPIKE_REVERSION_DEFAULTS, ...config };
    this.walletAddress = walletAddress;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.buildPerpCache();
    await this.refreshVolumeCache();
    console.log(
      `[spike-reversion] Started (threshold=${(this.config.spikeThresholdPct * 100).toFixed(1)}%, ` +
      `maxPos=${this.config.maxPositions}, cooldown=${this.config.cooldownMs / 1000}s)`,
    );
  }

  stop(): void {
    this.running = false;
    console.log(`[spike-reversion] Stopped. Trades executed: ${this.tradesExecuted}`);
  }

  /** Called by SpikeDetector on every detected spike */
  async handleSpike(event: SpikeEvent): Promise<void> {
    if (!this.running) return;

    // Already handling this coin
    if (this.executing.has(event.coin)) return;

    // Cooldown check
    const lastTrade = this.cooldowns.get(event.coin) ?? 0;
    if (Date.now() - lastTrade < this.config.cooldownMs) return;

    // Max positions check
    if (this.activePositions.size >= this.config.maxPositions) return;

    // Already have a position in this coin
    if (this.activePositions.has(event.coin)) return;

    // Must be a perp (we need the asset index to trade)
    const assetIndex = this.perpIndexCache.get(event.coin);
    if (assetIndex === undefined) return;

    // Volume filter — refresh cache every 5 minutes
    if (Date.now() - this.volumeCacheTs > 5 * 60 * 1000) {
      this.refreshVolumeCache().catch(() => {});
    }
    const vol = this.volumeCache.get(event.coin) ?? 0;
    if (vol < this.config.minVolumeUsd) return;

    this.executing.add(event.coin);
    try {
      await this.executeTrade(event, assetIndex);
    } catch (e) {
      console.error(`[spike-reversion] Error trading ${event.coin}:`, (e as Error).message);
    } finally {
      this.executing.delete(event.coin);
    }
  }

  get stats() {
    return {
      activePositions: this.activePositions.size,
      tradesExecuted: this.tradesExecuted,
      coinsOnCooldown: this.cooldowns.size,
    };
  }

  // ------------------------------------------------------------------

  private async executeTrade(event: SpikeEvent, assetIndex: number): Promise<void> {
    // Contra-direction: spike up → short, spike down → long
    const side: "long" | "short" = event.direction === "up" ? "short" : "long";
    const isBuy = side === "long";

    // Risk-adjusted position sizing
    let accountValue: number;
    try {
      accountValue = await fetchAccountValue();
    } catch {
      console.error("[spike-reversion] Failed to fetch account value");
      return;
    }

    const budgetUsd = accountValue * this.config.capitalAllocationPct / this.config.maxPositions;
    const sizeUsd = Math.max(10, budgetUsd * Math.min(1, event.magnitude / this.config.spikeThresholdPct));
    const sizeCoins = sizeUsd / event.currentPrice;

    const szDecimals = this.perpDecimalsCache.get(event.coin) ?? 4;
    const factor = Math.pow(10, szDecimals);
    const roundedSize = (Math.floor(sizeCoins * factor) / factor).toFixed(szDecimals);

    if (parseFloat(roundedSize) === 0) return;

    // SL/TP based on spike magnitude
    const slDistance = event.currentPrice * event.magnitude * this.config.stopLossRatio;
    const tpDistance = event.currentPrice * event.magnitude * this.config.takeProfitRatio;

    const stopLoss = isBuy
      ? event.currentPrice - slDistance
      : event.currentPrice + slDistance;
    const takeProfit = isBuy
      ? event.currentPrice + tpDistance
      : event.currentPrice - tpDistance;

    // Slippage: widen limit price so IOC fill is likely
    const slippage = isBuy ? 1.003 : 0.997;
    const limitPx = roundPrice(event.currentPrice * slippage);

    console.log(
      `[spike-reversion] ${event.coin} ${event.direction} ${(event.magnitude * 100).toFixed(2)}% in ${(event.durationMs / 1000).toFixed(1)}s ` +
      `(threshold=${((event.dynamicThreshold ?? this.config.spikeThresholdPct) * 100).toFixed(2)}%) → ` +
      `${side.toUpperCase()} $${sizeUsd.toFixed(0)} @ ${limitPx} (SL=${stopLoss.toFixed(4)}, TP=${takeProfit.toFixed(4)})`,
    );

    const result = await placeOrder({
      coin: event.coin,
      isBuy,
      size: roundedSize,
      price: limitPx,
      tif: "Ioc",
      assetIndex,
    });

    if (!result.success) {
      console.error(`[spike-reversion] Order failed ${event.coin}: ${result.error}`);
      return;
    }

    const fillPx = parseFloat(result.avgPx ?? limitPx);
    this.tradesExecuted++;
    this.cooldowns.set(event.coin, Date.now());

    // Recalculate SL/TP from actual fill price
    const actualSl = isBuy ? fillPx - slDistance : fillPx + slDistance;
    const actualTp = isBuy ? fillPx + tpDistance : fillPx - tpDistance;

    // Log trade to Supabase
    const { data: inserted } = await this.supabase.from("quant_trades").insert({
      strategy_id: await this.getStrategyId(),
      strategy_type: "spike_reversion",
      coin: event.coin,
      side,
      size: parseFloat(roundedSize),
      entry_px: fillPx,
      fees: 0,
      status: "open",
      oid: result.oid ?? null,
      meta: {
        reason: `Spike ${event.direction} ${(event.magnitude * 100).toFixed(2)}% in ${(event.durationMs / 1000).toFixed(0)}s → fade ${side}`,
        stopLoss: actualSl,
        takeProfit: actualTp,
        assetIndex,
        spikeMagnitude: event.magnitude,
        referencePrice: event.referencePrice,
      },
      opened_at: new Date().toISOString(),
    }).select("id").single();

    this.activePositions.set(event.coin, {
      coin: event.coin,
      side,
      entryPx: fillPx,
      size: parseFloat(roundedSize),
      tradeId: inserted?.id ?? "",
    });

    // Log to ai_agent_logs for UI visibility
    try {
      await this.supabase.from("ai_agent_logs").insert({
        strategy_id: await this.getStrategyId(),
        event_type: "spike_trade",
        market_sentiment: event.direction === "up" ? "volatile" : "volatile",
        decision: {
          coin: event.coin,
          spikeDirection: event.direction,
          spikeMagnitude: event.magnitude,
          spikeDurationMs: event.durationMs,
          tradeDirection: side,
          sizeUsd: sizeUsd,
          entryPx: fillPx,
          stopLoss: actualSl,
          takeProfit: actualTp,
          referencePrice: event.referencePrice,
        },
        signals_generated: 1,
        error_message: null,
      });
    } catch { /* non-critical */ }

    console.log(
      `[spike-reversion] FILLED ${event.coin} ${side} ${roundedSize} @ ${fillPx.toFixed(4)} ` +
      `(SL=${actualSl.toFixed(4)}, TP=${actualTp.toFixed(4)})`,
    );
  }

  private _strategyId: string | null = null;
  private async getStrategyId(): Promise<string | null> {
    if (this._strategyId) return this._strategyId;
    const { data } = await this.supabase
      .from("quant_strategies")
      .select("id")
      .eq("type", "spike_reversion")
      .eq("wallet_address", this.walletAddress)
      .eq("status", "active")
      .limit(1)
      .single();
    this._strategyId = data?.id ?? null;
    return this._strategyId;
  }

  private async buildPerpCache(): Promise<void> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
      });
      const meta = (await res.json()) as { universe: Array<{ name: string; szDecimals: number }> };
      for (let i = 0; i < meta.universe.length; i++) {
        this.perpIndexCache.set(meta.universe[i].name, i);
        this.perpDecimalsCache.set(meta.universe[i].name, meta.universe[i].szDecimals);
      }
    } catch (e) {
      console.error("[spike-reversion] Failed to build perp cache:", (e as Error).message);
    }
  }

  private async refreshVolumeCache(): Promise<void> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      });
      const [meta, ctxs] = (await res.json()) as [
        { universe: Array<{ name: string }> },
        Array<{ dayNtlVlm: string }>,
      ];
      for (let i = 0; i < meta.universe.length; i++) {
        this.volumeCache.set(meta.universe[i].name, parseFloat(ctxs[i]?.dayNtlVlm ?? "0"));
      }
      this.volumeCacheTs = Date.now();
    } catch { /* best-effort */ }
  }
}

function roundPrice(price: number): string {
  if (price >= 100_000) return (Math.round(price / 10) * 10).toString();
  if (price >= 10_000) return Math.round(price).toString();
  if (price >= 1_000) return (Math.round(price * 10) / 10).toFixed(1);
  if (price >= 100) return (Math.round(price * 100) / 100).toFixed(2);
  if (price >= 10) return (Math.round(price * 1000) / 1000).toFixed(3);
  if (price >= 1) return (Math.round(price * 10000) / 10000).toFixed(4);
  return (Math.round(price * 100000) / 100000).toFixed(5);
}
