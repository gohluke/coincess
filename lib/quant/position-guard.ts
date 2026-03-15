/**
 * Rule-based Position Guard
 *
 * Checks all open trades against their stop-loss and take-profit levels
 * on every WebSocket price update.  Closes positions deterministically
 * without calling the LLM — the AI sets the levels, the guard enforces
 * them with sub-second latency.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { closePosition } from "./executor";
import type { PriceFeed } from "./price-feed";

const HL_API = "https://api.hyperliquid.xyz";

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
  /** Prevent duplicate close attempts for the same trade */
  private closingSet: Set<string> = new Set();
  private lastCheckMs = 0;
  private checksRun = 0;
  private closesRun = 0;
  /** Cache of perp asset indices (coin -> index) fetched once from meta */
  private perpIndexCache: Map<string, number> = new Map();

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

    console.log(`[guard] Position guard started — tracking ${this.trades.size} open trade(s)`);
  }

  stop(): void {
    this.running = false;
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
    console.log(`[guard] Stopped. Checks=${this.checksRun}, Closes=${this.closesRun}`);
  }

  get stats() {
    return { trackedTrades: this.trades.size, checksRun: this.checksRun, closesRun: this.closesRun };
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

    this.trades.clear();
    for (const t of data ?? []) {
      const meta = (t.meta ?? {}) as Record<string, unknown>;
      const sl = typeof meta.stopLoss === "number" ? meta.stopLoss : null;
      const tp = typeof meta.takeProfit === "number" ? meta.takeProfit : null;
      if (!sl && !tp) continue; // nothing to guard
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
  }

  private checkAllPositions(_prices: Map<string, number>): void {
    if (this.trades.size === 0) return;

    const now = Date.now();
    if (now - this.lastCheckMs < 1000) return; // throttle to 1 check/sec
    this.lastCheckMs = now;
    this.checksRun++;

    for (const [id, trade] of this.trades) {
      if (this.closingSet.has(id)) continue;

      const price = this.priceFeed.getPrice(trade.coin);
      if (!price || price <= 0) continue;

      const trigger = this.checkTrigger(trade, price);
      if (trigger) {
        this.closingSet.add(id);
        this.executeGuardClose(trade, price, trigger).catch((e) => {
          console.error(`[guard] Close error ${trade.coin}:`, (e as Error).message);
          this.closingSet.delete(id);
        });
      }
    }
  }

  private checkTrigger(t: GuardedTrade, px: number): "stop_loss" | "take_profit" | null {
    if (t.side === "long") {
      if (t.stopLoss && px <= t.stopLoss) return "stop_loss";
      if (t.takeProfit && px >= t.takeProfit) return "take_profit";
    } else {
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
    reason: "stop_loss" | "take_profit",
  ): Promise<void> {
    const label = reason === "stop_loss" ? "SL" : "TP";
    const levelPx = reason === "stop_loss" ? trade.stopLoss : trade.takeProfit;
    console.log(
      `[guard] ${label} triggered ${trade.coin} ${trade.side} @ ${triggerPrice.toFixed(4)} ` +
      `(entry=${trade.entry_px.toFixed(4)}, ${label}=${levelPx})`,
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
          close_reason: `Rule-based ${label} @ ${triggerPrice.toFixed(4)}`,
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

      // Log for visibility in the AI agent logs panel
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
          },
          signals_generated: 0,
          error_message: null,
        });
      } catch { /* non-critical */ }

      this.trades.delete(trade.id);
      console.log(
        `[guard] ${label} closed ${trade.coin} ${trade.side}: ` +
        `pnl=${pnl.toFixed(4)} (entry=${trade.entry_px.toFixed(4)}, exit=${fillPx.toFixed(4)})`,
      );
    } else {
      console.error(`[guard] Failed to close ${trade.coin}: ${result.error}`);
    }

    this.closingSet.delete(trade.id);
  }
}
