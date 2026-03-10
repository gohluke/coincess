import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RiskManager } from "./risk";
import { placeOrder, closePosition, fetchAccountValue, fetchPositions, getAccountAddress } from "./executor";
import * as fundingRate from "./strategies/funding-rate";
import * as momentum from "./strategies/momentum";
import * as grid from "./strategies/grid";
import * as meanReversion from "./strategies/mean-reversion";
import * as marketMaker from "./strategies/market-maker";
import {
  calculateWeights,
  combineSignals,
  recordTradeResult,
  updatePriceHistory,
  detectRegime,
} from "./combiner";
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

const HIP3_STOCKS = new Set([
  "TSLA", "NVDA", "GOOGL", "AAPL", "HOOD", "MSTR", "SPY", "AMZN",
  "META", "QQQ", "MSFT", "ORCL", "AVGO", "GLD", "MU", "SLV",
  "SPACEX", "OPENAI", "INTC", "NFLX",
]);

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

      // Update price history for correlation tracking
      const markets = await this.fetchMarketSnapshots();
      for (const m of markets) {
        updatePriceHistory(m.coin, m.markPx);
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

      // Signal combiner: weigh strategies by rolling performance
      const weights = calculateWeights(strategies);
      const combined = combineSignals(allSignals, weights, ctx, state);

      // Log regime detection periodically
      if (this.tickCount % 60 === 0) {
        const btcPrices = markets.filter((m) => m.coin === "BTC").map((m) => m.markPx);
        if (btcPrices.length > 0) {
          const regime = detectRegime(btcPrices);
          console.log(`[engine] Market regime: ${regime}`);
        }
      }

      // Execute: use combined signals if combiner produced output, else raw signals
      const signalsToExecute = combined.length > 0
        ? combined.map((s) => ({ signal: s as StrategySignal, strategy: strategies[0] }))
        : allSignals;

      for (const { signal, strategy } of signalsToExecute) {
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
        // Funding rates only apply to perps, not HIP-3 spot
        const perpsOnly = markets.filter((m) => m.dex === "perp");
        return fundingRate.evaluate(strat, perpsOnly, ctx);
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
      case "market_maker": {
        const markets = await this.fetchMarketSnapshots();
        return marketMaker.evaluate(strat, markets, ctx);
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
      // HL nets positions: close any opposite-side open trade on the same coin
      const oppositeSide = signal.side === "long" ? "short" : "long";
      const { data: oppTrades } = await this.supabase
        .from("quant_trades")
        .select("id, entry_px, size, side")
        .eq("coin", signal.coin)
        .eq("side", oppositeSide)
        .eq("status", "open");

      if (oppTrades && oppTrades.length > 0) {
        for (const opp of oppTrades) {
          const oppEntry = Number(opp.entry_px);
          const fillPx = parseFloat(result.avgPx ?? limitPx);
          const oppPnl = opp.side === "long"
            ? (fillPx - oppEntry) * Number(opp.size)
            : (oppEntry - fillPx) * Number(opp.size);
          await this.supabase.from("quant_trades").update({
            status: "closed",
            exit_px: fillPx,
            pnl: oppPnl,
            closed_at: new Date().toISOString(),
            meta: { close_reason: `Netted by ${signal.side} order` },
          }).eq("id", opp.id);
          console.log(`[engine] AUTO-CLOSE opposite ${opp.side} ${signal.coin}: pnl=${oppPnl.toFixed(4)}`);
          recordTradeResult(strategy.id, oppPnl, 0);
        }
      }

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
    const [perps, hip3] = await Promise.all([
      this.fetchPerpsSnapshots(),
      this.fetchHip3Snapshots(),
    ]);
    return [...perps, ...hip3];
  }

  private async fetchPerpsSnapshots(): Promise<MarketSnapshot[]> {
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
        dex: "perp" as const,
        szDecimals: asset.szDecimals,
      };
    });
  }

  private async fetchHip3Snapshots(): Promise<MarketSnapshot[]> {
    try {
      const [spotMetaRes, allMidsRes] = await Promise.all([
        fetch(`${HL_API}/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "spotMetaAndAssetCtxs" }),
        }),
        fetch(`${HL_API}/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "allMids" }),
        }),
      ]);

      const [spotMeta, spotCtxs] = (await spotMetaRes.json()) as [
        {
          tokens: Array<{ index: number; name: string; szDecimals: number }>;
          universe: Array<{ name: string; index: number; tokens: number[] }>;
        },
        Array<{ markPx?: string; dayNtlVlm?: string }>,
      ];
      const allMids = (await allMidsRes.json()) as Record<string, string>;

      const idxToName: Record<number, string> = {};
      const idxToDecimals: Record<number, number> = {};
      for (const t of spotMeta.tokens) {
        idxToName[t.index] = t.name;
        idxToDecimals[t.index] = t.szDecimals;
      }

      const snapshots: MarketSnapshot[] = [];
      for (let i = 0; i < spotMeta.universe.length; i++) {
        const pair = spotMeta.universe[i];
        if (!pair.tokens || pair.tokens.length < 2) continue;
        const baseName = idxToName[pair.tokens[0]];
        if (!baseName || !HIP3_STOCKS.has(baseName)) continue;

        const pairName = pair.name; // e.g. @264
        const spotIndex = pair.index;
        const orderAssetId = 10000 + spotIndex;
        const midPx = parseFloat(allMids[pairName] ?? "0");
        const ctx = spotCtxs[i];
        const vol = parseFloat(ctx?.dayNtlVlm ?? "0");
        const szDec = idxToDecimals[pair.tokens[0]] ?? 4;

        if (midPx <= 0) continue;

        assetMeta.set(orderAssetId, { szDecimals: szDec });
        snapshots.push({
          coin: baseName,
          assetIndex: orderAssetId,
          markPx: midPx,
          funding: 0,
          openInterest: 0,
          volume24h: vol,
          dex: "spot",
          candleCoin: pairName,
          szDecimals: szDec,
        });
      }

      if (snapshots.length > 0) {
        console.log(`[engine] HIP-3 stocks loaded: ${snapshots.map((s) => s.coin).join(", ")}`);
      }
      return snapshots;
    } catch (err) {
      console.error("[engine] HIP-3 fetch failed, continuing with perps only:", (err as Error).message);
      return [];
    }
  }

  private async fetchCandlesForCoins(
    coins: string[],
    interval: string,
    count: number,
  ) {
    const now = Date.now();
    const intervalMs = interval === "5m" ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const startTime = now - intervalMs * count;

    const markets = await this.fetchMarketSnapshots();
    const marketMap = new Map(markets.map((m) => [m.coin, m]));

    const results = await Promise.all(
      coins.map(async (coin) => {
        const market = marketMap.get(coin);
        // HIP-3 spot uses @N pair name for candles
        const candleCoin = market?.candleCoin ?? coin;
        const res = await fetch(`${HL_API}/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "candleSnapshot",
            req: { coin: candleCoin, interval, startTime, endTime: now },
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
          assetIndex: market?.assetIndex ?? 0,
          currentPrice: candles.length > 0 ? parseFloat(candles[candles.length - 1].c) : 0,
        };
      }),
    );

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
