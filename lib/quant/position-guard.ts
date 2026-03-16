/**
 * Position Guard v2 — Rule-Based SL/TP + Trailing Stop
 *
 * Checks all open trades against their stop-loss and take-profit levels
 * on every WebSocket price update. Now with trailing stop support:
 * as price moves in your favor, the stop ratchets up to lock in profit.
 *
 * Trailing logic:
 * - Track peak favorable price per trade (highest for longs, lowest for shorts)
 * - Trail = peakPrice - (entryPrice * trailPct)  for longs
 * - Trail = peakPrice + (entryPrice * trailPct)  for shorts
 * - Only ratchet tighter, never looser than original SL
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { closePosition } from "./executor";
import type { PriceFeed } from "./price-feed";

const HL_API = "https://api.hyperliquid.xyz";

// After price moves this far in your favor, switch from fixed SL to trailing
const TRAIL_ACTIVATION_PCT = 0.005; // 0.5% in profit to activate trail
// Trail distance as fraction of entry price
const TRAIL_DISTANCE_PCT = 0.008; // 0.8% trailing distance

interface GuardedTrade {
  id: string;
  coin: string;
  side: "long" | "short";
  size: number;
  entry_px: number;
  stopLoss: number | null;
  takeProfit: number | null;
  assetIndex: number | null;
  strategy_id: string;
}

export class PositionGuard {
  private supabase: SupabaseClient;
  private priceFeed: PriceFeed;
  private trades: Map<string, GuardedTrade> = new Map();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private closingSet: Set<string> = new Set();
  private skippedTrades: Set<string> = new Set();
  private lastCheckMs = 0;
  private checksRun = 0;
  private closesRun = 0;
  private perpIndexCache: Map<string, number> = new Map();

  /** Track peak favorable price per trade for trailing stops */
  private peakPrices: Map<string, number> = new Map();
  /** Active trailing stop levels (ratcheted from peak) */
  private trailingStops: Map<string, number> = new Map();

  constructor(priceFeed: PriceFeed) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials for PositionGuard");
    this.supabase = createClient(url, key);
    this.priceFeed = priceFeed;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    await this.refreshTrades();
    await this.buildPerpIndexCache();

    this.refreshTimer = setInterval(() => {
      this.refreshTrades().catch((e) =>
        console.error("[guard] Refresh error:", (e as Error).message),
      );
    }, 30_000);

    this.priceFeed.onPrice((prices) => this.checkAllPositions(prices));

    console.log(`[guard] Position guard v2 started — tracking ${this.trades.size} open trade(s) (trailing stops enabled)`);
  }

  stop(): void {
    this.running = false;
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
    console.log(`[guard] Stopped. Checks=${this.checksRun}, Closes=${this.closesRun}`);
  }

  get stats() {
    return {
      trackedTrades: this.trades.size,
      checksRun: this.checksRun,
      closesRun: this.closesRun,
      activeTrailingStops: this.trailingStops.size,
    };
  }

  // ------------------------------------------------------------------

  private async buildPerpIndexCache(): Promise<void> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
      });
      const meta = (await res.json()) as { universe: Array<{ name: string }> };
      for (let i = 0; i < meta.universe.length; i++) {
        this.perpIndexCache.set(meta.universe[i].name, i);
      }
    } catch (e) {
      console.error("[guard] Failed to build perp index cache:", (e as Error).message);
    }
  }

  private async refreshTrades(): Promise<void> {
    const { data } = await this.supabase
      .from("quant_trades")
      .select("id, coin, side, size, entry_px, strategy_id, meta")
      .eq("status", "open");

    const newIds = new Set<string>();
    this.trades.clear();
    this.skippedTrades.clear();

    for (const t of data ?? []) {
      const meta = (t.meta ?? {}) as Record<string, unknown>;
      const sl = typeof meta.stopLoss === "number" ? meta.stopLoss : null;
      const tp = typeof meta.takeProfit === "number" ? meta.takeProfit : null;
      if (!sl && !tp) continue;

      newIds.add(t.id);
      this.trades.set(t.id, {
        id: t.id,
        coin: t.coin,
        side: t.side as "long" | "short",
        size: Number(t.size),
        entry_px: Number(t.entry_px),
        stopLoss: sl,
        takeProfit: tp,
        assetIndex: typeof meta.assetIndex === "number" ? meta.assetIndex : null,
        strategy_id: t.strategy_id,
      });
    }

    // Clean up peak/trail data for trades that are gone
    for (const id of this.peakPrices.keys()) {
      if (!newIds.has(id)) {
        this.peakPrices.delete(id);
        this.trailingStops.delete(id);
      }
    }
  }

  private checkAllPositions(_prices: Map<string, number>): void {
    if (this.trades.size === 0) return;

    const now = Date.now();
    if (now - this.lastCheckMs < 1000) return;
    this.lastCheckMs = now;
    this.checksRun++;

    for (const [id, trade] of this.trades) {
      if (this.closingSet.has(id) || this.skippedTrades.has(id)) continue;

      const price = this.priceFeed.getPrice(trade.coin);
      if (!price || price <= 0) continue;

      // Update trailing stop
      this.updateTrailingStop(id, trade, price);

      const trigger = this.checkTrigger(trade, price, id);
      if (trigger) {
        this.closingSet.add(id);
        this.executeGuardClose(trade, price, trigger).catch((e) => {
          const msg = (e as Error).message;
          console.error(`[guard] Close error ${trade.coin}:`, msg);
          this.closingSet.delete(id);
        });
      }
    }
  }

  /**
   * Update trailing stop for a trade based on current price.
   * Only activates after price moves TRAIL_ACTIVATION_PCT in profit.
   */
  private updateTrailingStop(id: string, trade: GuardedTrade, price: number): void {
    const peak = this.peakPrices.get(id);

    if (trade.side === "long") {
      // Track highest price seen
      if (!peak || price > peak) {
        this.peakPrices.set(id, price);
      }
      const currentPeak = this.peakPrices.get(id)!;
      const profitPct = (currentPeak - trade.entry_px) / trade.entry_px;

      if (profitPct >= TRAIL_ACTIVATION_PCT) {
        const trailStop = currentPeak * (1 - TRAIL_DISTANCE_PCT);
        const existingTrail = this.trailingStops.get(id);
        // Only ratchet up, never down — and never below original SL
        const minStop = trade.stopLoss ?? 0;
        const newTrail = Math.max(trailStop, existingTrail ?? 0, minStop);
        if (!existingTrail || newTrail > existingTrail) {
          this.trailingStops.set(id, newTrail);
        }
      }
    } else {
      // Short: track lowest price seen
      if (!peak || price < peak) {
        this.peakPrices.set(id, price);
      }
      const currentPeak = this.peakPrices.get(id)!;
      const profitPct = (trade.entry_px - currentPeak) / trade.entry_px;

      if (profitPct >= TRAIL_ACTIVATION_PCT) {
        const trailStop = currentPeak * (1 + TRAIL_DISTANCE_PCT);
        const existingTrail = this.trailingStops.get(id);
        // Only ratchet down (tighter), never up — and never above original SL
        const maxStop = trade.stopLoss ?? Infinity;
        const newTrail = Math.min(trailStop, existingTrail ?? Infinity, maxStop);
        if (!existingTrail || newTrail < existingTrail) {
          this.trailingStops.set(id, newTrail);
        }
      }
    }
  }

  private checkTrigger(t: GuardedTrade, px: number, id: string): "stop_loss" | "trailing_stop" | "take_profit" | null {
    const trailStop = this.trailingStops.get(id);

    if (t.side === "long") {
      // Check trailing stop first (tighter than original SL)
      if (trailStop && px <= trailStop) return "trailing_stop";
      if (t.stopLoss && px <= t.stopLoss) return "stop_loss";
      if (t.takeProfit && px >= t.takeProfit) return "take_profit";
    } else {
      if (trailStop && px >= trailStop) return "trailing_stop";
      if (t.stopLoss && px >= t.stopLoss) return "stop_loss";
      if (t.takeProfit && px <= t.takeProfit) return "take_profit";
    }
    return null;
  }

  private resolveAssetIndex(trade: GuardedTrade): number {
    if (trade.assetIndex !== null) return trade.assetIndex;
    return this.perpIndexCache.get(trade.coin) ?? 0;
  }

  private async executeGuardClose(
    trade: GuardedTrade,
    triggerPrice: number,
    reason: "stop_loss" | "trailing_stop" | "take_profit",
  ): Promise<void> {
    const label = reason === "stop_loss" ? "SL" : reason === "trailing_stop" ? "TRAIL" : "TP";
    const trailStop = this.trailingStops.get(trade.id);
    const levelPx = reason === "trailing_stop"
      ? trailStop
      : reason === "stop_loss" ? trade.stopLoss : trade.takeProfit;
    console.log(
      `[guard] ${label} triggered ${trade.coin} ${trade.side} @ ${triggerPrice.toFixed(4)} ` +
      `(entry=${trade.entry_px.toFixed(4)}, ${label}=${levelPx})` +
      (trailStop ? ` [trail=${trailStop.toFixed(4)}, peak=${this.peakPrices.get(trade.id)?.toFixed(4)}]` : ""),
    );

    const assetIndex = this.resolveAssetIndex(trade);

    const result = await closePosition({
      coin: trade.coin,
      size: trade.size,
      isBuy: trade.side === "short",
      markPrice: triggerPrice,
      assetIndex,
    });

    if (result.success) {
      this.closesRun++;
      const fillPx = parseFloat(result.avgPx ?? String(triggerPrice));
      const pnl = trade.side === "long"
        ? (fillPx - trade.entry_px) * trade.size
        : (trade.entry_px - fillPx) * trade.size;

      await this.supabase.from("quant_trades").update({
        status: "closed",
        exit_px: fillPx,
        pnl,
        closed_at: new Date().toISOString(),
        meta: {
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          assetIndex,
          close_reason: reason === "trailing_stop"
            ? `Trailing stop @ ${trailStop?.toFixed(4)} (peak=${this.peakPrices.get(trade.id)?.toFixed(4)})`
            : `Rule-based ${label} @ ${triggerPrice.toFixed(4)}`,
        },
      }).eq("id", trade.id);

      if (trade.strategy_id) {
        const { data: strat } = await this.supabase
          .from("quant_strategies")
          .select("total_pnl")
          .eq("id", trade.strategy_id)
          .single();
        if (strat) {
          await this.supabase.from("quant_strategies").update({
            total_pnl: (strat.total_pnl ?? 0) + pnl,
          }).eq("id", trade.strategy_id);
        }
      }

      try {
        await this.supabase.from("ai_agent_logs").insert({
          strategy_id: trade.strategy_id,
          event_type: "guard_close",
          decision: {
            trigger: reason,
            coin: trade.coin,
            side: trade.side,
            entryPx: trade.entry_px,
            exitPx: fillPx,
            pnl,
            triggerPrice,
            stopLoss: trade.stopLoss,
            takeProfit: trade.takeProfit,
            trailingStop: trailStop ?? null,
            peakPrice: this.peakPrices.get(trade.id) ?? null,
          },
          signals_generated: 0,
          error_message: null,
        });
      } catch { /* non-critical */ }

      this.trades.delete(trade.id);
      this.peakPrices.delete(trade.id);
      this.trailingStops.delete(trade.id);
      console.log(
        `[guard] ${label} closed ${trade.coin} ${trade.side}: ` +
        `pnl=${pnl.toFixed(4)} (entry=${trade.entry_px.toFixed(4)}, exit=${fillPx.toFixed(4)})`,
      );
    } else {
      const err = result.error ?? "";
      if (err.includes("increase position")) {
        console.warn(
          `[guard] Skipping ${trade.coin} ${trade.side}: net HL position is opposite direction (would increase)`,
        );
        this.skippedTrades.add(trade.id);
      } else {
        console.error(`[guard] Failed to close ${trade.coin}: ${err}`);
      }
    }

    this.closingSet.delete(trade.id);
  }
}
