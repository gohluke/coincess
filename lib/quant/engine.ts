import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RiskManager } from "./risk";
import { placeOrder, closePosition, fetchAccountValue, fetchPositions, getAccountAddress, cancelAllOpenOrders } from "./executor";
import { PriceFeed } from "./price-feed";
import { PositionGuard } from "./position-guard";
import { SpikeDetector } from "./spike-detector";
import { SpikeReversionStrategy } from "./strategies/spike-reversion";
import { RebateFarmer } from "./strategies/rebate-farmer";
import * as fundingRate from "./strategies/funding-rate";
import * as momentum from "./strategies/momentum";
import * as grid from "./strategies/grid";
import * as meanReversion from "./strategies/mean-reversion";
import * as marketMaker from "./strategies/market-maker";
import * as aiAgent from "./strategies/ai-agent";
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
const AI_ANALYSIS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between AI calls
const SIGNIFICANT_MOVE_PCT = 0.02; // 2% price move triggers early AI re-analysis

const assetMeta: Map<number, { szDecimals: number }> = new Map();

const HIP3_STOCKS = new Set([
  "TSLA", "NVDA", "GOOGL", "AAPL", "HOOD", "MSTR", "SPY", "AMZN",
  "META", "QQQ", "MSFT", "ORCL", "AVGO", "GLD", "MU", "SLV",
  "SPACEX", "OPENAI", "INTC", "NFLX",
]);

// XYZ sub-exchange commodity perps (high-liquidity RWA)
const XYZ_COMMODITY_NAMES = new Set(["GOLD", "SILVER", "BRENTOIL"]);

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
  priceFeed: PriceFeed;
  private positionGuard: PositionGuard;
  private spikeDetector: SpikeDetector;
  private spikeReversion: SpikeReversionStrategy;
  private rebateFarmer: RebateFarmer;
  private lastAiRunTime = 0;
  private lastAiPrices: Map<string, number> = new Map();

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    this.supabase = createClient(url, key);
    this.risk = new RiskManager();
    this.walletAddress = getAccountAddress();
    this.priceFeed = new PriceFeed(this.walletAddress);
    this.positionGuard = new PositionGuard(this.priceFeed);
    this.spikeDetector = new SpikeDetector(this.priceFeed);
    this.spikeReversion = new SpikeReversionStrategy(this.walletAddress);
    this.rebateFarmer = new RebateFarmer(this.priceFeed, {
      // Only coins with confirmed 5+ bps spreads (low liquidity perps)
      coins: [
        "GRASS", "INJ", "WIF", "ONDO", "TIA",
        "kBONK", "POPCAT", "kSHIB", "SPX", "CAKE",
        "MNT", "GRIFFAIN", "MELANIA", "STRK",
      ],
      orderSizeUsd: 50,    // smaller orders to reduce risk while tuning
      maxExposureUsd: 150,
      cycleSleepMs: 1000,  // slower cycle — less aggressive while we learn
      maxDailyLossUsd: 10,
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log("[engine] Starting quant engine...");
    await this.updateState({ engine_status: "running", error_message: null });

    // Phase 1: start real-time WebSocket price feed
    this.priceFeed.start();
    await this.discoverHip3Aliases();
    // Give WebSocket a moment to connect and receive first prices
    await new Promise((r) => setTimeout(r, 2000));
    console.log(`[engine] Price feed: ${this.priceFeed.isConnected ? "connected" : "connecting"} (${this.priceFeed.priceCount} prices)`);

    // Close ALL legacy positions on startup (from old strategies)
    await this.closeAllLegacyPositions();

    // Keep position guard for SL/TP on any remaining positions
    await this.positionGuard.start();

    // DISABLED: spike reversion & spike detector — only rebate farmer runs
    // await this.spikeReversion.start();
    // this.spikeDetector.onSpike(...)
    // this.spikeDetector.start();

    // Rebate farmer is the ONLY active trading strategy
    await this.rebateFarmer.start();

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
    this.rebateFarmer.stop();
    // this.spikeDetector.stop();
    // this.spikeReversion.stop();
    this.positionGuard.stop();
    this.priceFeed.stop();
    await this.updateState({ engine_status: "stopped" });
    console.log("[engine] Stopped.");
  }

  private async closeAllLegacyPositions(): Promise<void> {
    try {
      // Cancel ALL resting orders first (stale unwinds, etc.)
      const cancelled = await cancelAllOpenOrders();
      if (cancelled > 0) {
        console.log(`[engine] Cancelled ${cancelled} stale orders`);
      }

      const positions = await fetchPositions();
      const open = positions.filter((p) => parseFloat(p.position.szi) !== 0);
      if (open.length === 0) {
        console.log("[engine] No legacy positions to close");
        return;
      }

      // Fetch asset indices and current mid prices
      const [metaRes, midsRes] = await Promise.all([
        fetch(`${HL_API}/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs" }),
        }),
        fetch(`${HL_API}/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "allMids" }),
        }),
      ]);
      const [meta] = (await metaRes.json()) as [
        { universe: Array<{ name: string; szDecimals: number }> },
        unknown[],
      ];
      const coinToIndex = new Map<string, number>();
      const coinToSzDec = new Map<string, number>();
      for (let i = 0; i < meta.universe.length; i++) {
        coinToIndex.set(meta.universe[i].name, i);
        coinToSzDec.set(meta.universe[i].name, meta.universe[i].szDecimals);
      }
      const allMids = (await midsRes.json()) as Record<string, string> | null;

      console.log(`[engine] Closing ${open.length} legacy positions...`);
      for (const p of open) {
        const coin = p.position.coin;
        const szi = parseFloat(p.position.szi);
        const isBuy = szi < 0;
        const currentMid = allMids ? parseFloat(allMids[coin] ?? "0") : 0;
        const assetIdx = coinToIndex.get(coin);
        const szDec = coinToSzDec.get(coin) ?? 4;

        if (currentMid <= 0 || assetIdx === undefined) {
          console.warn(`[engine] No data for ${coin} (mid=${currentMid}, idx=${assetIdx}), skipping`);
          continue;
        }

        const slippage = isBuy ? 1.005 : 0.995;
        const limitPx = currentMid * slippage;
        const sizeStr = Math.abs(szi).toFixed(szDec);
        const priceStr = roundPrice(limitPx);

        try {
          const result = await placeOrder({
            coin,
            isBuy,
            size: sizeStr,
            price: priceStr,
            reduceOnly: true,
            tif: "Ioc",
            assetIndex: assetIdx,
          });
          const side = szi > 0 ? "LONG" : "SHORT";
          const upnl = parseFloat(p.position.unrealizedPnl);
          console.log(
            `[engine] Closed ${coin} ${side} ${sizeStr} @ $${priceStr}: ` +
            `${result.success ? "OK" : result.error} (uPnL: $${upnl.toFixed(4)})`,
          );
        } catch (e) {
          console.error(`[engine] Failed to close ${coin}:`, (e as Error).message);
        }
      }

      // Reset peak equity to current account value (clean slate)
      const currentValue = await fetchAccountValue();
      await this.updateState({ peak_equity: currentValue, max_drawdown: 0 });
      console.log(`[engine] Peak equity reset to $${currentValue.toFixed(2)}`);
    } catch (e) {
      console.error("[engine] Legacy position cleanup failed:", (e as Error).message);
    }
  }

  async tick(): Promise<void> {
    if (!this.running) return;
    this.tickCount++;
    const start = Date.now();

    try {
      const [accountValue, rawPositions, , state] = await Promise.all([
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

      // Reconcile Supabase open trades with actual Hyperliquid positions
      await this.reconcileOpenTrades(positions);

      // Risk check — DISABLED in safe mode. Rebate farmer has its own $10 daily loss limit.
      // The kill switch was triggering because peak_equity was stale from legacy positions.
      // Just track the drawdown metric, don't act on it.
      const riskUpdate = this.risk.updatePostTick(state, accountValue);

      // Update price history for correlation tracking
      const markets = await this.fetchMarketSnapshots();
      for (const m of markets) {
        updatePriceHistory(m.coin, m.markPx);
      }

      // All legacy strategies DISABLED — rebate farmer is the only active strategy.
      // Skip evaluation entirely to save compute (no more AI agent API calls).

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

      // Rebate farmer: reconcile fills and log status
      if (this.rebateFarmer.isRunning) {
        await this.rebateFarmer.reconcileFills();
        if (this.tickCount % 20 === 0) this.rebateFarmer.logStatus();
      }

      const elapsed = Date.now() - start;
      if (this.tickCount <= 3 || this.tickCount % 10 === 0) {
        console.log(
          `[engine] Tick #${this.tickCount}: $${accountValue.toFixed(2)} | ` +
          `${positions.length} pos | ${elapsed}ms`,
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
      case "ai_agent": {
        // DISABLED: AI agent is no longer used. Rebate farmer is the only active strategy.
        return [];
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
      // Only close positions the bot actually opened (protects manual trades)
      const { data: botTrades } = await this.supabase
        .from("quant_trades")
        .select("id")
        .eq("coin", signal.coin)
        .eq("status", "open")
        .limit(1);

      if (!botTrades || botTrades.length === 0) {
        console.log(`[engine] SKIP CLOSE ${signal.coin}: no bot-opened trade found (manual position?)`);
        return;
      }

      const result = await closePosition({
        coin: signal.coin,
        size: 1, // engine doesn't know exact size; executor handles it
        isBuy: signal.side === "long",
        markPrice: signal.price,
        assetIndex: signal.assetIndex,
      });
      console.log(
        `[engine] CLOSE ${signal.coin}: ${result.success ? "OK" : result.error}${signal.reason ? ` | ${signal.reason}` : ""}`,
      );

      if (result.success) {
        const fillPx = parseFloat(result.avgPx ?? String(signal.price));
        const { data: closedTrades } = await this.supabase
          .from("quant_trades")
          .select("id, entry_px, size, side")
          .eq("coin", signal.coin)
          .eq("strategy_id", strategy.id)
          .eq("status", "open");

        let totalClosePnl = 0;
        for (const t of closedTrades ?? []) {
          const pnl = t.side === "long"
            ? (fillPx - Number(t.entry_px)) * Number(t.size)
            : (Number(t.entry_px) - fillPx) * Number(t.size);
          totalClosePnl += pnl;
          await this.supabase.from("quant_trades").update({
            status: "closed",
            exit_px: fillPx,
            pnl,
            closed_at: new Date().toISOString(),
            meta: { close_reason: signal.reason ?? "AI close" },
          }).eq("id", t.id);
          recordTradeResult(strategy.id, pnl, 0);
        }

        if (totalClosePnl !== 0) {
          await this.updateStrategy(strategy.id, {
            total_pnl: strategy.total_pnl + totalClosePnl,
          });
        }
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
        meta: { reason: signal.reason, stopLoss: signal.stopLoss, takeProfit: signal.takeProfit, assetIndex: signal.assetIndex },
        opened_at: new Date().toISOString(),
      });

      strategy.total_trades += 1;
      await this.updateStrategy(strategy.id, {
        total_trades: strategy.total_trades,
        last_executed_at: new Date().toISOString(),
      });
    }
  }

  private async fetchMarketSnapshots(): Promise<MarketSnapshot[]> {
    const [perps, hip3, xyzCommodities] = await Promise.all([
      this.fetchPerpsSnapshots(),
      this.fetchHip3Snapshots(),
      this.fetchXyzCommoditySnapshots(),
    ]);
    return [...perps, ...hip3, ...xyzCommodities];
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

  private async fetchXyzCommoditySnapshots(): Promise<MarketSnapshot[]> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
      });
      const [meta, ctxs] = (await res.json()) as [
        { universe: Array<{ name: string; szDecimals: number }> },
        Array<{ markPx: string; funding: string; openInterest: string; dayNtlVlm: string }>,
      ];

      const snapshots: MarketSnapshot[] = [];
      for (let i = 0; i < meta.universe.length; i++) {
        const asset = meta.universe[i];
        if (!XYZ_COMMODITY_NAMES.has(asset.name)) continue;

        const ctx = ctxs[i];
        const xyzAssetIndex = i;
        assetMeta.set(xyzAssetIndex, { szDecimals: asset.szDecimals });

        snapshots.push({
          coin: `xyz:${asset.name}`,
          assetIndex: xyzAssetIndex,
          markPx: parseFloat(ctx?.markPx ?? "0"),
          funding: parseFloat(ctx?.funding ?? "0"),
          openInterest: parseFloat(ctx?.openInterest ?? "0"),
          volume24h: parseFloat(ctx?.dayNtlVlm ?? "0"),
          dex: "perp",
          candleCoin: asset.name,
          szDecimals: asset.szDecimals,
        });
      }

      if (snapshots.length > 0 && this.tickCount <= 3) {
        console.log(`[engine] XYZ commodities: ${snapshots.map((s) => `${s.coin} $${s.markPx.toFixed(2)}`).join(", ")}`);
      }
      return snapshots;
    } catch (err) {
      console.error("[engine] XYZ fetch failed:", (err as Error).message);
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

  /**
   * Reconcile Supabase open trades with actual HL positions.
   * Closes trades when: (a) no HL position exists for the coin, or
   * (b) the trade direction is opposite to the HL net position (netted out).
   */
  async reconcileOpenTrades(positions: PositionInfo[]): Promise<number> {
    const { data: openTrades } = await this.supabase
      .from("quant_trades")
      .select("id, coin, side, size, entry_px, strategy_id, strategy_type")
      .eq("status", "open");

    if (!openTrades || openTrades.length === 0) return 0;

    // Build map of coin -> HL direction
    const hlPositions = new Map<string, "long" | "short">();
    for (const p of positions) {
      hlPositions.set(p.coin, p.szi > 0 ? "long" : "short");
    }

    let allMids: Record<string, string> = {};
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "allMids" }),
      });
      allMids = (await res.json()) as Record<string, string>;
    } catch { /* best-effort */ }

    let closed = 0;
    for (const trade of openTrades) {
      const hlDir = hlPositions.get(trade.coin);
      const tradeDir = trade.side as "long" | "short";

      // Keep trade if HL has a position in the same direction
      if (hlDir === tradeDir) continue;

      // Close: either no HL position or HL direction is opposite (netted)
      const reason = !hlDir
        ? "Position reconciliation: no matching HL position"
        : `Position reconciliation: trade ${tradeDir} netted by HL ${hlDir} position`;

      const markPx = parseFloat(allMids[trade.coin] ?? "0");
      const entryPx = Number(trade.entry_px);
      const size = Number(trade.size);
      const pnl = trade.side === "long"
        ? (markPx - entryPx) * size
        : (entryPx - markPx) * size;

      await this.supabase.from("quant_trades").update({
        status: "closed",
        exit_px: markPx || null,
        pnl: markPx > 0 ? pnl : 0,
        closed_at: new Date().toISOString(),
        meta: { close_reason: reason },
      }).eq("id", trade.id);

      if (trade.strategy_id) {
        const { data: strat } = await this.supabase
          .from("quant_strategies")
          .select("total_pnl")
          .eq("id", trade.strategy_id)
          .single();
        if (strat) {
          await this.supabase.from("quant_strategies").update({
            total_pnl: (strat.total_pnl ?? 0) + (markPx > 0 ? pnl : 0),
          }).eq("id", trade.strategy_id);
        }
        recordTradeResult(trade.strategy_id, markPx > 0 ? pnl : 0, 0);
      }

      console.log(`[engine] RECONCILE: closed ${trade.coin} ${trade.side} — ${reason} (pnl=${pnl.toFixed(4)})`);
      closed++;
    }

    if (closed > 0) {
      console.log(`[engine] Reconciled ${closed} stale trade(s)`);
    }
    return closed;
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

  // ------------------------------------------------------------------
  // Price Feed helpers
  // ------------------------------------------------------------------

  /** Discover HIP-3 spot pair aliases (TSLA -> @264) so PriceFeed.getPrice("TSLA") works */
  private async discoverHip3Aliases(): Promise<void> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "spotMeta" }),
      });
      const spotMeta = (await res.json()) as {
        tokens: Array<{ index: number; name: string }>;
        universe: Array<{ name: string; index: number; tokens: number[] }>;
      };
      const idxToName: Record<number, string> = {};
      for (const t of spotMeta.tokens) idxToName[t.index] = t.name;

      let count = 0;
      for (const pair of spotMeta.universe) {
        if (!pair.tokens?.length) continue;
        const baseName = idxToName[pair.tokens[0]];
        if (baseName && HIP3_STOCKS.has(baseName)) {
          this.priceFeed.setAlias(baseName, pair.name);
          count++;
        }
      }
      if (count > 0) console.log(`[engine] Registered ${count} HIP-3 price aliases`);
    } catch (e) {
      console.error("[engine] HIP-3 alias discovery failed:", (e as Error).message);
    }
  }

  /** Check if any tracked coin moved >SIGNIFICANT_MOVE_PCT since last AI run */
  private hasSignificantPriceMove(): boolean {
    if (this.lastAiPrices.size === 0) return false;
    for (const [coin, lastPx] of this.lastAiPrices) {
      const current = this.priceFeed.getPrice(coin);
      if (!current || lastPx <= 0) continue;
      if (Math.abs((current - lastPx) / lastPx) >= SIGNIFICANT_MOVE_PCT) return true;
    }
    return false;
  }

  /** Snapshot current prices for change detection on next tick */
  private snapshotAiPrices(markets: MarketSnapshot[]): void {
    this.lastAiPrices.clear();
    for (const m of markets) {
      const px = this.priceFeed.getPrice(m.coin) ?? m.markPx;
      if (px > 0) this.lastAiPrices.set(m.coin, px);
    }
  }
}
