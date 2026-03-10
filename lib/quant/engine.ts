import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RiskManager } from "./risk";
import { placeOrder, closePosition, fetchAccountValue, fetchPositions, getAccountAddress } from "./executor";
import * as fundingRate from "./strategies/funding-rate";
import * as momentum from "./strategies/momentum";
import * as grid from "./strategies/grid";
import * as meanReversion from "./strategies/mean-reversion";
import type {
  QuantStrategy,
  QuantState,
  QuantTrade,
  StrategySignal,
  TickContext,
  PositionInfo,
  MarketSnapshot,
} from "./types";

const HL_API = "https://api.hyperliquid.xyz";
const TICK_INTERVAL_MS = 30_000; // 30 seconds

const assetMeta: Map<number, { szDecimals: number }> = new Map();

function roundPrice(price: number): string {
  if (price >= 100_000) return (Math.round(price / 10) * 10).toString();
  if (price >= 10_000) return (Math.round(price)).toString();
  if (price >= 1_000) return (Math.round(price * 10) / 10).toFixed(1);
  if (price >= 100) return (Math.round(price * 100) / 100).toFixed(2);
  if (price >= 10) return (Math.round(price * 1000) / 1000).toFixed(3);
  if (price >= 1) return (Math.round(price * 10000) / 10000).toFixed(4);
  return (Math.round(price * 100000) / 100000).toFixed(5);
}

function roundSize(size: number, assetIndex: number): string {
  const meta = assetMeta.get(assetIndex);
  const decimals = meta?.szDecimals ?? 4;
  const factor = Math.pow(10, decimals);
  return (Math.floor(size * factor) / factor).toFixed(decimals);
}

export class QuantEngine {
  private supabase: SupabaseClient;
  private risk: RiskManager;
  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;
  private walletAddress: string;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    this.supabase = createClient(url, key);
    this.risk = new RiskManager();
    this.walletAddress = getAccountAddress();
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log("[engine] Starting quant engine...");
    await this.updateState({ engine_status: "running", error_message: null });

    this.tickTimer = setInterval(() => {
      this.tick().catch((err) => {
        console.error("[engine] Tick error:", err);
        this.updateState({ error_message: (err as Error).message }).catch(() => {});
      });
    }, TICK_INTERVAL_MS);

    // Run first tick immediately
    await this.tick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    await this.updateState({ engine_status: "stopped" });
    console.log("[engine] Stopped.");
  }

  async tick(): Promise<void> {
    if (!this.running) return;
    this.tickCount++;
    const start = Date.now();

    try {
      const [accountValue, rawPositions, strategies, state] = await Promise.all([
        fetchAccountValue(),
        fetchPositions(),
        this.getActiveStrategies(),
        this.getState(),
      ]);

      const positions: PositionInfo[] = rawPositions
        .filter((p) => parseFloat(p.position.szi) !== 0)
        .map((p, i) => ({
          coin: p.position.coin,
          szi: parseFloat(p.position.szi),
          entryPx: parseFloat(p.position.entryPx ?? "0"),
          unrealizedPnl: parseFloat(p.position.unrealizedPnl),
          marginUsed: parseFloat(p.position.marginUsed),
          leverage: p.position.leverage.value,
          assetIndex: i,
        }));

      const ctx: TickContext = { accountValue, positions, timestamp: Date.now() };

      // Risk check
      const riskUpdate = this.risk.updatePostTick(state, accountValue);
      if (riskUpdate.shouldKill) {
        console.error("[engine] KILL SWITCH: max drawdown exceeded");
        await this.stop();
        await this.updateState({
          engine_status: "error",
          error_message: "Kill switch: max drawdown exceeded",
        });
        return;
      }

      // Collect signals from all active strategies
      const allSignals: Array<{ signal: StrategySignal; strategy: QuantStrategy }> = [];

      for (const strat of strategies) {
        try {
          const signals = await this.evaluateStrategy(strat, ctx);
          for (const signal of signals) {
            allSignals.push({ signal, strategy: strat });
          }
        } catch (err) {
          console.error(`[engine] Strategy ${strat.type} error:`, err);
          await this.updateStrategy(strat.id, {
            status: "error",
            error_message: (err as Error).message,
          });
        }
      }

      // Execute approved signals
      for (const { signal, strategy } of allSignals) {
        const check = this.risk.checkPreTrade(signal, ctx, state);
        if (!check.allowed) {
          console.log(`[engine] Risk blocked ${signal.coin} ${signal.side}: ${check.reason}`);
          continue;
        }

        await this.executeSignal(signal, strategy);
      }

      // Update engine state
      const currentExposure = positions.reduce(
        (sum, p) => sum + Math.abs(p.szi * p.entryPx),
        0,
      );

      await this.updateState({
        last_tick_at: new Date().toISOString(),
        current_exposure: currentExposure,
        peak_equity: Math.max(state.peak_equity, accountValue),
        daily_pnl: riskUpdate.dailyPnl,
        total_pnl: state.total_pnl,
        max_drawdown: Math.max(
          state.max_drawdown,
          state.peak_equity > 0 ? (state.peak_equity - accountValue) / state.peak_equity : 0,
        ),
      });

      const elapsed = Date.now() - start;
      const shouldLog = this.tickCount <= 3 || this.tickCount % 10 === 0 || allSignals.length > 0;
      if (shouldLog) {
        console.log(
          `[engine] Tick #${this.tickCount}: $${accountValue.toFixed(2)} | ` +
          `${strategies.length} strats | ${positions.length} pos | ${allSignals.length} signals | ${elapsed}ms`,
        );
      }
    } catch (err) {
      console.error("[engine] Tick failed:", err);
    }
  }

  private async evaluateStrategy(
    strat: QuantStrategy,
    ctx: TickContext,
  ): Promise<StrategySignal[]> {
    switch (strat.type) {
      case "funding_rate": {
        const markets = await this.fetchMarketSnapshots();
        return fundingRate.evaluate(strat, markets, ctx);
      }
      case "momentum": {
        const coins = (strat.config.coins as string[]) ?? ["BTC", "ETH", "SOL"];
        const candles = await this.fetchCandlesForCoins(coins, "5m", 50);
        return momentum.evaluate(strat, candles, ctx);
      }
      case "grid": {
        const markets = await this.fetchMarketSnapshots();
        return grid.evaluate(strat, markets, ctx);
      }
      case "mean_reversion": {
        const markets = await this.fetchMarketSnapshots();
        const topCoins = markets
          .sort((a, b) => b.volume24h - a.volume24h)
          .slice(0, 20)
          .map((m) => m.coin);
        const candles = await this.fetchCandlesForMeanReversion(topCoins);
        return meanReversion.evaluate(strat, candles, ctx);
      }
      default:
        return [];
    }
  }

  private async executeSignal(
    signal: StrategySignal,
    strategy: QuantStrategy,
  ): Promise<void> {
    const isClose = signal.size === 0;

    if (!isClose) {
      const notional = signal.size * signal.price;
      if (notional < 10) {
        console.log(`[engine] SKIP ${signal.coin}: notional $${notional.toFixed(2)} below $10 min`);
        return;
      }
    }

    if (isClose) {
      const result = await closePosition({
        coin: signal.coin,
        size: 1, // engine doesn't know exact size; executor handles it
        isBuy: signal.side === "long",
        markPrice: signal.price,
        assetIndex: signal.assetIndex,
      });
      console.log(
        `[engine] CLOSE ${signal.coin}: ${result.success ? "OK" : result.error}`,
      );

      if (result.success) {
        // Mark open trade as closed
        await this.supabase
          .from("quant_trades")
          .update({
            status: "closed",
            exit_px: signal.price,
            closed_at: new Date().toISOString(),
          })
          .eq("coin", signal.coin)
          .eq("strategy_id", strategy.id)
          .eq("status", "open");
      }
      return;
    }

    const isBuy = signal.side === "long";
    const slippage = isBuy ? 1.002 : 0.998;
    const limitPx = roundPrice(signal.price * slippage);
    const size = roundSize(signal.size, signal.assetIndex);

    if (parseFloat(size) === 0) {
      console.log(`[engine] SKIP ${signal.coin}: size rounds to 0`);
      return;
    }

    const result = await placeOrder({
      coin: signal.coin,
      isBuy,
      size,
      price: limitPx,
      tif: "Ioc",
      assetIndex: signal.assetIndex,
    });

    console.log(
      `[engine] ${signal.side.toUpperCase()} ${signal.coin} ${size} @ ${limitPx}: ${result.success ? "FILLED" : result.error}`,
    );

    if (result.success) {
      await this.logTrade({
        strategy_id: strategy.id,
        strategy_type: strategy.type,
        coin: signal.coin,
        side: signal.side,
        size: signal.size,
        entry_px: parseFloat(result.avgPx ?? limitPx),
        fees: 0,
        status: "open",
        oid: result.oid ?? null,
        meta: { reason: signal.reason, stopLoss: signal.stopLoss },
        opened_at: new Date().toISOString(),
      });

      await this.updateStrategy(strategy.id, {
        total_trades: strategy.total_trades + 1,
        last_executed_at: new Date().toISOString(),
      });
    }
  }

  private async fetchMarketSnapshots(): Promise<MarketSnapshot[]> {
    const res = await fetch(`${HL_API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const [meta, ctxs] = (await res.json()) as [
      { universe: Array<{ name: string; szDecimals: number }> },
      Array<{ markPx: string; funding: string; openInterest: string; dayNtlVlm: string }>,
    ];

    return meta.universe.map((asset, i) => {
      assetMeta.set(i, { szDecimals: asset.szDecimals });
      return {
        coin: asset.name,
        assetIndex: i,
        markPx: parseFloat(ctxs[i]?.markPx ?? "0"),
        funding: parseFloat(ctxs[i]?.funding ?? "0"),
        openInterest: parseFloat(ctxs[i]?.openInterest ?? "0"),
        volume24h: parseFloat(ctxs[i]?.dayNtlVlm ?? "0"),
        dex: "",
      };
    });
  }

  private async fetchCandlesForCoins(
    coins: string[],
    interval: string,
    count: number,
  ) {
    const now = Date.now();
    const intervalMs = interval === "5m" ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const startTime = now - intervalMs * count;

    const results = await Promise.all(
      coins.map(async (coin) => {
        const res = await fetch(`${HL_API}/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "candleSnapshot",
            req: { coin, interval, startTime, endTime: now },
          }),
        });
        const candles = (await res.json()) as Array<{
          c: string;
          o: string;
          h: string;
          l: string;
        }>;
        return {
          coin,
          closes: candles.map((c) => parseFloat(c.c)),
          assetIndex: 0,
          currentPrice: candles.length > 0 ? parseFloat(candles[candles.length - 1].c) : 0,
        };
      }),
    );

    // Resolve asset indices from market data
    const markets = await this.fetchMarketSnapshots();
    for (const r of results) {
      const m = markets.find((mk) => mk.coin === r.coin);
      if (m) r.assetIndex = m.assetIndex;
    }

    return results;
  }

  private async fetchCandlesForMeanReversion(coins: string[]) {
    const results = await this.fetchCandlesForCoins(coins, "15m", 30);
    const markets = await this.fetchMarketSnapshots();

    return results.map((r) => ({
      ...r,
      volume24h: markets.find((m) => m.coin === r.coin)?.volume24h ?? 0,
    }));
  }

  // Supabase helpers
  private async getActiveStrategies(): Promise<QuantStrategy[]> {
    const { data } = await this.supabase
      .from("quant_strategies")
      .select("*")
      .eq("status", "active")
      .eq("wallet_address", this.walletAddress);
    return (data ?? []) as QuantStrategy[];
  }

  private async getState(): Promise<QuantState> {
    const { data } = await this.supabase
      .from("quant_state")
      .select("*")
      .eq("id", 1)
      .single();
    return data as QuantState;
  }

  private async updateState(updates: Partial<QuantState>): Promise<void> {
    await this.supabase.from("quant_state").update(updates).eq("id", 1);
  }

  private async updateStrategy(id: string, updates: Partial<QuantStrategy>): Promise<void> {
    await this.supabase.from("quant_strategies").update(updates).eq("id", id);
  }

  private async logTrade(trade: Omit<QuantTrade, "id" | "exit_px" | "pnl" | "closed_at"> & { meta: Record<string, unknown> }): Promise<void> {
    await this.supabase.from("quant_trades").insert(trade);
  }
}
