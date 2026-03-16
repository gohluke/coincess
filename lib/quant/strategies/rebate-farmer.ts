/**
 * Rebate Farmer v4.1 — Single-position spread capture via maker-only orders.
 *
 * v4.1 fixes over v4:
 * - Reverted to single position to eliminate race conditions
 * - Added reduceOnly on unwind orders to prevent direction flips
 * - Added HL position guard before entry to prevent accumulation
 * - Separated orphan adoption from entry logic
 *
 * Kept from v4: auto-discovery, dynamic sizing, fill-rate tracking, volume filter
 */

import { placeOrder, cancelOrder, closePosition, cancelAllOpenOrders, fetchPositions } from "../executor";
import { PriceFeed } from "../price-feed";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RebateFarmerConfig } from "../types";
import { REBATE_FARMER_DEFAULTS } from "../types";

const HL_API = "https://api.hyperliquid.xyz";

const MIN_SPREAD_BPS = 5;
const MIN_IMBALANCE = 0.10;
const MIN_HOURLY_VOLUME_USD = 5_000;
const MAX_CONCURRENT_TRADES = 1;

const FEE_TIERS = [
  { minVol: 0,           makerBps: 1.5,  takerBps: 4.5,  label: "Tier 0" },
  { minVol: 1_000_000,   makerBps: 1.2,  takerBps: 4.0,  label: "Tier 1" },
  { minVol: 5_000_000,   makerBps: 1.0,  takerBps: 3.5,  label: "Tier 2" },
  { minVol: 25_000_000,  makerBps: 0.8,  takerBps: 3.0,  label: "Tier 3" },
  { minVol: 100_000_000, makerBps: 0.6,  takerBps: 2.5,  label: "Tier 4" },
  { minVol: 500_000_000, makerBps: 0.4,  takerBps: 2.0,  label: "Tier 5" },
];

interface L2Book {
  bestBid: number;
  bestAsk: number;
  mid: number;
  spreadBps: number;
  imbalance: number;
}

type Phase = "quoting" | "unwinding";

interface TradeState {
  phase: Phase;
  coin: string;
  oid: number | null;
  side: "buy" | "sell";
  entryPx: number;
  size: number;
  assetIndex: number;
  placedAt: number;
  unwindOid: number | null;
  lastUnwindAttempt: number;
  unwindAttempts: number;
  lastUnwindPx: number;
  entryPlacedAt: number;
}

interface Stats {
  roundTrips: number;
  grossPnl: number;
  fees: number;
  volume: number;
  wins: number;
  losses: number;
}

interface CoinPerf {
  trades: number;
  wins: number;
  netPnl: number;
  avgSpreadBps: number;
  totalSpread: number;
  totalFillMs: number;
  fillCount: number;
}

export class RebateFarmer {
  private config: RebateFarmerConfig;
  private priceFeed: PriceFeed;
  private supabase: SupabaseClient;
  private running = false;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;

  private assetIndices: Map<string, number> = new Map();
  private szDecimalsMap: Map<string, number> = new Map();

  private trades: Map<string, TradeState> = new Map();
  private stats: Stats = { roundTrips: 0, grossPnl: 0, fees: 0, volume: 0, wins: 0, losses: 0 };
  private dailyLoss = 0;
  private statsResetDay = -1;

  private cycleCount = 0;
  private coinIndex = 0;
  private cycling = false;

  private sessionStartTime = Date.now();
  private sessionVolume = 0;
  private allTimeVolume = 0;
  private currentMakerBps = 1.5;
  private currentFeeTier = "Tier 0";
  private lastFeeTierCheck = 0;
  private readonly FEE_TIER_CHECK_INTERVAL = 300_000;

  private coinPerf: Map<string, CoinPerf> = new Map();

  // Auto-discovery
  private activeCoinList: string[] = [];
  private volumeCache: Map<string, number> = new Map();
  private lastDiscovery = 0;
  private readonly DISCOVERY_INTERVAL = 600_000; // 10 min
  private readonly VOLUME_CACHE_TTL = 300_000;
  private lastVolumeRefresh = 0;

  private readonly STALE_QUOTE_MS = 120_000;
  private readonly UNWIND_COOLDOWN_MS = 15_000;
  private readonly MAX_UNWIND_ATTEMPTS = 40;
  private readonly DIAG_INTERVAL = 60;
  private readonly VOLUME_LOG_INTERVAL = 30;

  constructor(priceFeed: PriceFeed, config?: Partial<RebateFarmerConfig>) {
    this.config = { ...REBATE_FARMER_DEFAULTS, ...config };
    this.priceFeed = priceFeed;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials for RebateFarmer");
    this.supabase = createClient(url, key);
  }

  get managedCoins(): string[] {
    return this.activeCoinList;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.sessionStartTime = Date.now();
    this.sessionVolume = 0;

    console.log("[rebate-farmer] v4.1 starting — single position + auto-discovery + safety guards");

    await this.loadAssetMeta();
    await this.discoverCoins();
    await this.fetchFeeTier();
    await this.loadAllTimeVolume();
    this.resetStats();

    console.log(`[rebate-farmer]   coins: ${this.activeCoinList.join(", ")}`);
    console.log(`[rebate-farmer]   baseSize: $${this.config.orderSizeUsd} | maxExposure: $${this.config.maxExposureUsd} | single position`);
    console.log(`[rebate-farmer]   reduceOnly unwinds | HL position guard | auto-discovery`);

    this.priceFeed.onUserEvent((event) => {
      if (event.type !== "fill" || !event.coin) return;
      const trade = this.trades.get(event.coin);
      if (!trade) return;
      this.handleWsFill(trade, event);
    });

    this.cycleTimer = setInterval(() => {
      this.cycle().catch((e) =>
        console.error("[rebate-farmer] cycle error:", (e as Error).message),
      );
    }, this.config.cycleSleepMs);

    await this.cycle();
  }

  stop(): void {
    this.running = false;
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    for (const [, trade] of this.trades) {
      if (trade.oid) cancelOrder(trade.assetIndex, trade.oid).catch(() => {});
      if (trade.unwindOid) cancelOrder(trade.assetIndex, trade.unwindOid).catch(() => {});
    }
    console.log("[rebate-farmer] Stopped");
    this.logStats();
  }

  // ------------------------------------------------------------------
  // Core cycle — manages ALL active trades + finds new opportunities
  // ------------------------------------------------------------------

  private async cycle(): Promise<void> {
    if (!this.running || this.cycling) return;
    this.cycling = true;
    try { await this.doCycle(); } finally { this.cycling = false; }
  }

  private async doCycle(): Promise<void> {
    this.cycleCount++;
    this.maybeResetStats();

    if (this.dailyLoss >= this.config.maxDailyLossUsd) {
      console.error(`[rebate-farmer] DAILY LOSS $${this.dailyLoss.toFixed(2)} — pausing`);
      this.stop();
      return;
    }

    const isDiag = this.cycleCount % this.DIAG_INTERVAL === 0;
    const isVolLog = this.cycleCount % this.VOLUME_LOG_INTERVAL === 0;

    if (isVolLog) this.logVolumeStatus();

    if (Date.now() - this.lastFeeTierCheck > this.FEE_TIER_CHECK_INTERVAL) {
      this.fetchFeeTier().catch(() => {});
    }

    // Refresh coin universe periodically
    if (Date.now() - this.lastDiscovery > this.DISCOVERY_INTERVAL) {
      this.discoverCoins().catch(() => {});
    }

    // Adopt any orphaned HL positions first (separate from entry logic)
    if (this.trades.size === 0) {
      await this.adoptOrphans();
    }

    // Manage all active trades
    for (const [coin, trade] of this.trades) {
      try {
        if (trade.phase === "quoting") {
          await this.manageQuote(trade);
        } else if (trade.phase === "unwinding") {
          await this.manageUnwind(trade);
        }
      } catch (e) {
        console.error(`[rebate-farmer] Error managing ${coin}:`, (e as Error).message);
      }
    }

    // Find new opportunities if we have capacity AND no active trades
    if (this.trades.size === 0) {
      await this.findOpportunity(isDiag);
    }
  }

  private getCurrentExposure(): number {
    let total = 0;
    for (const [, trade] of this.trades) {
      total += trade.size * trade.entryPx;
    }
    return total;
  }

  // ------------------------------------------------------------------
  // Adopt orphaned HL positions (runs BEFORE entry logic, not inside it)
  // ------------------------------------------------------------------

  private async adoptOrphans(): Promise<void> {
    try {
      const positions = await fetchPositions();
      const openPos = positions.filter((p) => parseFloat(p.position.szi) !== 0);
      for (const pos of openPos) {
        const coin = pos.position.coin;
        if (this.trades.has(coin)) continue;
        const idx = this.assetIndices.get(coin);
        if (idx === undefined) continue;

        const qty = Math.abs(parseFloat(pos.position.szi));
        const isLong = parseFloat(pos.position.szi) > 0;
        console.log(`[rebate-farmer] Adopting orphaned ${coin} ${isLong ? "LONG" : "SHORT"} ${qty} — unwinding as maker`);
        this.trades.set(coin, {
          phase: "unwinding",
          coin,
          oid: null,
          side: isLong ? "buy" : "sell",
          entryPx: parseFloat(pos.position.entryPx ?? "0"),
          size: qty,
          assetIndex: idx,
          placedAt: Date.now(),
          unwindOid: null,
          lastUnwindAttempt: 0,
          unwindAttempts: 0,
          lastUnwindPx: 0,
          entryPlacedAt: Date.now(),
        });
        return; // Only adopt ONE orphan at a time
      }
    } catch (e) {
      console.error("[rebate-farmer] adoptOrphans failed:", (e as Error).message);
    }
  }

  // ------------------------------------------------------------------
  // Find new opportunities (with auto-discovery, volume filter, dynamic sizing)
  // ------------------------------------------------------------------

  private async findOpportunity(diag: boolean): Promise<void> {
    const coins = this.getPrioritizedCoins();
    if (coins.length === 0) return;

    // Skip coins we already have active trades on
    const available = coins.filter((c) => !this.trades.has(c));
    if (available.length === 0) return;

    const BATCH = 6;
    const start = this.coinIndex;
    const batch: string[] = [];
    for (let i = 0; i < Math.min(BATCH, available.length); i++) {
      batch.push(available[(start + i) % available.length]);
    }
    this.coinIndex = (start + BATCH) % Math.max(available.length, 1);

    const toScan = diag ? available : batch;

    const books = await Promise.all(
      toScan.map(async (coin) => ({ coin, book: await this.fetchL2(coin) })),
    );

    let best: { coin: string; book: L2Book; assetIndex: number; score: number } | null = null;

    for (const { coin, book } of books) {
      if (!book) continue;
      const assetIndex = this.assetIndices.get(coin);
      if (assetIndex === undefined) continue;

      if (diag) {
        const imb = book.imbalance >= 0 ? `+${book.imbalance.toFixed(2)}` : book.imbalance.toFixed(2);
        console.log(
          `[rebate-farmer] ${coin}: ${book.spreadBps.toFixed(1)}bps imb=${imb} mid=$${book.mid.toFixed(4)}`,
        );
      }

      if (book.spreadBps < MIN_SPREAD_BPS) continue;
      if (Math.abs(book.imbalance) < MIN_IMBALANCE) continue;

      // Volume filter — skip dead books
      const vol24h = this.volumeCache.get(coin) ?? 0;
      if (vol24h / 24 < MIN_HOURLY_VOLUME_USD) continue;

      const perf = this.coinPerf.get(coin);
      const winBonus = perf && perf.trades >= 3
        ? 0.5 + (perf.wins / perf.trades)
        : 1.0;

      // Fill-speed bonus: prefer coins that fill quickly
      let fillSpeedBonus = 1.0;
      if (perf && perf.fillCount >= 2) {
        const avgFillMs = perf.totalFillMs / perf.fillCount;
        if (avgFillMs < 30_000) fillSpeedBonus = 1.5;
        else if (avgFillMs > 60_000) fillSpeedBonus = 0.5;
      }

      const score = book.spreadBps * Math.abs(book.imbalance) * winBonus * fillSpeedBonus;

      if (!best || score > best.score) {
        best = { coin, book, assetIndex, score };
      }
    }

    if (!best) return;

    // Safety: check HL for existing positions — never enter if one already exists
    const positions = await fetchPositions();
    const hlHasPosition = positions.some(
      (p) => p.position.coin === best!.coin && parseFloat(p.position.szi) !== 0,
    );
    if (hlHasPosition) {
      console.log(`[rebate-farmer] SKIP ${best.coin}: HL position already exists`);
      return;
    }

    // Dynamic sizing based on spread
    const remainingCapacity = this.config.maxExposureUsd;
    const dynamicSize = this.getDynamicSize(best.book.spreadBps, remainingCapacity);
    if (dynamicSize < 50) {
      console.log(`[rebate-farmer] SKIP ${best.coin}: dynamic size $${dynamicSize.toFixed(0)} too small`);
      return;
    }

    const side: "buy" | "sell" = best.book.imbalance > 0 ? "buy" : "sell";
    console.log(`[rebate-farmer] Attempting entry: ${best.coin} ${side} $${dynamicSize.toFixed(0)} (spread=${best.book.spreadBps.toFixed(1)}bps, score=${best.score.toFixed(2)})`);
    await this.placeEntry(best.coin, side, best.book, best.assetIndex, dynamicSize);
  }

  private getDynamicSize(spreadBps: number, remainingCapacity: number): number {
    const base = this.config.orderSizeUsd;
    let multiplier = 0.75;
    if (spreadBps >= 15) multiplier = 2.0;
    else if (spreadBps >= 10) multiplier = 1.5;
    else if (spreadBps >= 7) multiplier = 1.0;

    return Math.min(base * multiplier, remainingCapacity);
  }

  private async placeEntry(
    coin: string,
    side: "buy" | "sell",
    book: L2Book,
    assetIndex: number,
    sizeUsd: number,
  ): Promise<void> {
    // Hard guard: never enter if we already have a trade
    if (this.trades.size > 0) return;

    const price = side === "buy" ? book.bestBid : book.bestAsk;
    const size = sizeUsd / price;
    const sizeStr = this.roundSize(size, coin);
    const priceStr = this.roundPrice(price, coin);
    const notional = parseFloat(sizeStr) * parseFloat(priceStr);

    if (parseFloat(sizeStr) === 0 || notional < 10) return;

    const result = await placeOrder({
      coin,
      isBuy: side === "buy",
      size: sizeStr,
      price: priceStr,
      tif: "Alo",
      assetIndex,
    });

    if (!result.success) {
      console.log(`[rebate-farmer] Entry FAILED ${coin}: ${result.error}`);
      return;
    }

    console.log(
      `[rebate-farmer] ENTRY ${side.toUpperCase()} ${coin} $${notional.toFixed(0)} @ ${priceStr} ` +
      `(spread=${book.spreadBps.toFixed(1)}bps, imb=${book.imbalance.toFixed(2)}) [${this.trades.size + 1}/${MAX_CONCURRENT_TRADES}]`,
    );

    const now = Date.now();

    if (result.oid) {
      this.trades.set(coin, {
        phase: "quoting",
        coin,
        oid: result.oid,
        side,
        entryPx: price,
        size: parseFloat(sizeStr),
        assetIndex,
        placedAt: now,
        unwindOid: null,
        lastUnwindAttempt: 0,
        unwindAttempts: 0,
        lastUnwindPx: 0,
        entryPlacedAt: now,
      });
    }

    if (result.avgPx) {
      this.trades.set(coin, {
        phase: "unwinding",
        coin,
        oid: null,
        side,
        entryPx: parseFloat(result.avgPx),
        size: parseFloat(sizeStr),
        assetIndex,
        placedAt: now,
        unwindOid: null,
        lastUnwindAttempt: 0,
        unwindAttempts: 0,
        lastUnwindPx: 0,
        entryPlacedAt: now,
      });
      this.stats.volume += notional;
      console.log(`[rebate-farmer] Immediate fill on ${coin} — switching to unwind`);
    }
  }

  // ------------------------------------------------------------------
  // Phase: QUOTING — waiting for entry to fill
  // ------------------------------------------------------------------

  private async manageQuote(trade: TradeState): Promise<void> {
    const { coin, oid, assetIndex } = trade;
    if (!oid) {
      this.trades.delete(coin);
      return;
    }

    const age = Date.now() - trade.placedAt;
    let shouldCancel = false;
    let reason = "";

    if (age > this.STALE_QUOTE_MS) {
      shouldCancel = true;
      reason = `stale (${(age / 1000).toFixed(0)}s)`;
    } else {
      const book = await this.fetchL2(coin);
      if (!book) return;
      if (trade.side === "buy" && trade.entryPx >= book.bestAsk) {
        shouldCancel = true;
        reason = "book moved (buy >= ask)";
      }
      if (trade.side === "sell" && trade.entryPx <= book.bestBid) {
        shouldCancel = true;
        reason = "book moved (sell <= bid)";
      }
    }

    if (shouldCancel) {
      await cancelOrder(assetIndex, oid).catch(() => {});

      const positions = await fetchPositions();
      const hlQty = positions
        .filter((p) => p.position.coin === coin)
        .reduce((sum, p) => sum + Math.abs(parseFloat(p.position.szi)), 0);

      if (hlQty > trade.size * 0.5) {
        console.log(`[rebate-farmer] Cancel raced with fill — ${coin} position exists (${hlQty.toFixed(2)}), switching to unwind`);
        trade.phase = "unwinding";
        trade.oid = null;
        trade.size = hlQty;
        this.stats.volume += trade.size * trade.entryPx;
        this.recordFillLatency(coin, trade.entryPlacedAt);
        return;
      }

      console.log(`[rebate-farmer] Cancelled quote on ${coin}: ${reason}`);
      this.trades.delete(coin);
    }
  }

  // ------------------------------------------------------------------
  // Phase: UNWINDING — close at profit via maker order
  // ------------------------------------------------------------------

  private async manageUnwind(trade: TradeState): Promise<void> {
    const { coin, assetIndex, unwindOid, side, entryPx } = trade;

    // Verify we actually have a position on HL before unwinding
    const posCheck0 = await fetchPositions();
    const hlQty0 = posCheck0
      .filter((p) => p.position.coin === coin)
      .reduce((sum, p) => sum + Math.abs(parseFloat(p.position.szi)), 0);
    if (hlQty0 < 0.0001) {
      const fillPx = trade.lastUnwindPx > 0 ? trade.lastUnwindPx : entryPx;
      console.log(`[rebate-farmer] Unwind filled for ${coin} (no HL position) — recording round trip @ ${fillPx}`);
      this.completeRoundTrip(trade, fillPx);
      return;
    }
    // Sync size with actual HL position to prevent oversized unwinds
    trade.size = hlQty0;
    const size = hlQty0;

    if (trade.unwindAttempts >= this.MAX_UNWIND_ATTEMPTS) {
      console.log(`[rebate-farmer] ABANDON ${coin} after ${trade.unwindAttempts} unwind attempts — accepting loss`);
      if (unwindOid) await cancelOrder(assetIndex, unwindOid).catch(() => {});
      await this.forceClose(trade);
      this.trades.delete(coin);
      return;
    }

    if (unwindOid) {
      const age = Date.now() - trade.lastUnwindAttempt;
      if (age < this.UNWIND_COOLDOWN_MS) return;

      const posCheck = await fetchPositions();
      const hlQty = posCheck
        .filter((p) => p.position.coin === coin)
        .reduce((sum, p) => sum + Math.abs(parseFloat(p.position.szi)), 0);
      if (hlQty < size * 0.05) {
        console.log(`[rebate-farmer] Reconcile: unwind ${coin} filled while resting`);
        const fillPx = trade.lastUnwindPx > 0 ? trade.lastUnwindPx : entryPx;
        this.completeRoundTrip(trade, fillPx);
        return;
      }

      await cancelOrder(assetIndex, unwindOid).catch(() => {});
      trade.unwindOid = null;
    }

    const sinceLast = Date.now() - trade.lastUnwindAttempt;
    if (sinceLast < this.UNWIND_COOLDOWN_MS) return;

    const book = await this.fetchL2(coin);
    if (!book) return;

    const unwindSide: "buy" | "sell" = side === "buy" ? "sell" : "buy";
    const feeBuffer = this.currentMakerBps * 2 / 10_000 + 0.0001;

    let unwindPx: number;
    const minProfit = entryPx * feeBuffer;
    if (unwindSide === "sell") {
      const profitFloor = entryPx + minProfit;
      const aggressive = book.bestAsk * 0.9999;
      unwindPx = Math.max(aggressive, profitFloor);
    } else {
      const profitCeiling = entryPx - minProfit;
      const aggressive = book.bestBid * 1.0001;
      unwindPx = Math.min(aggressive, profitCeiling);
    }

    const sizeStr = this.roundSize(size, coin);
    const priceStr = this.roundPrice(unwindPx, coin);
    const notional = parseFloat(sizeStr) * parseFloat(priceStr);

    if (parseFloat(sizeStr) === 0 || notional < 10) {
      trade.unwindAttempts++;
      trade.lastUnwindAttempt = Date.now();
      return;
    }

    const attempt = trade.unwindAttempts + 1;
    const result = await placeOrder({
      coin,
      isBuy: unwindSide === "buy",
      size: sizeStr,
      price: priceStr,
      tif: "Alo",
      reduceOnly: true,
      assetIndex,
    });

    trade.unwindAttempts = attempt;
    trade.lastUnwindAttempt = Date.now();

    if (!result.success) {
      console.log(`[rebate-farmer] Unwind #${attempt} FAILED ${coin}: ${result.error}`);
      return;
    }

    if (result.oid) {
      trade.unwindOid = result.oid;
      trade.lastUnwindPx = parseFloat(priceStr);
      if (attempt <= 3 || attempt % 10 === 0) {
        console.log(`[rebate-farmer] Unwind #${attempt} ${coin} ${unwindSide} @ ${priceStr} (oid=${result.oid})`);
      }
    }

    if (result.avgPx) {
      const posCheck = await fetchPositions();
      const remainingQty = posCheck
        .filter((p) => p.position.coin === coin)
        .reduce((sum, p) => sum + Math.abs(parseFloat(p.position.szi)), 0);
      if (remainingQty < size * 0.05) {
        this.completeRoundTrip(trade, parseFloat(result.avgPx));
      } else {
        console.log(`[rebate-farmer] Unwind order returned avgPx but ${coin} position still open (${remainingQty.toFixed(4)} remaining)`);
      }
    }
  }

  private async forceClose(trade: TradeState): Promise<void> {
    const { coin, side, size, assetIndex, entryPx } = trade;
    const book = await this.fetchL2(coin);
    if (!book) {
      this.recordLoss(trade, entryPx);
      return;
    }

    const closeSide = side === "buy" ? "sell" : "buy";
    const slippage = closeSide === "buy" ? 1.005 : 0.995;
    const price = book.mid * slippage;
    const sizeStr = this.roundSize(size, coin);
    const priceStr = this.roundPrice(price, coin);

    console.log(`[rebate-farmer] FORCE CLOSE ${coin} ${closeSide} ${sizeStr} @ ${priceStr}`);

    const result = await placeOrder({
      coin,
      isBuy: closeSide === "buy",
      size: sizeStr,
      price: priceStr,
      tif: "Ioc",
      reduceOnly: true,
      assetIndex,
    });

    if (result.success && result.avgPx) {
      this.completeRoundTrip(trade, parseFloat(result.avgPx));
    } else {
      this.recordLoss(trade, book.mid);
    }
  }

  private recordLoss(trade: TradeState, exitPx: number): void {
    const { coin, side, entryPx, size } = trade;
    const pnl = side === "buy"
      ? (exitPx - entryPx) * size
      : (entryPx - exitPx) * size;
    const fees = size * exitPx * this.currentMakerBps / 10_000;
    const net = pnl - fees;
    const tradeVol = size * entryPx + size * exitPx;

    console.log(`[rebate-farmer] LOSS ${coin}: net $${net.toFixed(4)}`);
    this.stats.roundTrips++;
    this.stats.grossPnl += pnl;
    this.stats.fees += fees;
    this.stats.volume += tradeVol;
    this.sessionVolume += tradeVol;
    this.allTimeVolume += tradeVol;
    this.stats.losses++;
    this.updateCoinPerf(coin, false, net, 0);
    if (net < 0) this.dailyLoss += Math.abs(net);
    this.logTradeToSupabase(coin, side, size, entryPx, exitPx, net, "closed");
  }

  private completeRoundTrip(trade: TradeState, exitPx: number): void {
    const { coin, side, entryPx, size } = trade;

    const pnl = side === "buy"
      ? (exitPx - entryPx) * size
      : (entryPx - exitPx) * size;
    const fees = size * entryPx * this.currentMakerBps * 2 / 10_000;
    const net = pnl - fees;
    const tradeVol = size * entryPx + size * exitPx;

    this.stats.roundTrips++;
    this.stats.grossPnl += pnl;
    this.stats.fees += fees;
    this.stats.volume += tradeVol;
    this.sessionVolume += tradeVol;
    this.allTimeVolume += tradeVol;
    if (net >= 0) this.stats.wins++;
    else {
      this.stats.losses++;
      this.dailyLoss += Math.abs(net);
    }

    const spreadBps = side === "buy"
      ? ((exitPx - entryPx) / entryPx) * 10_000
      : ((entryPx - exitPx) / entryPx) * 10_000;
    this.updateCoinPerf(coin, net >= 0, net, spreadBps);

    const symbol = net >= 0 ? "+" : "";
    const sessHrs = (Date.now() - this.sessionStartTime) / 3_600_000;
    const hourlyRate = sessHrs > 0.001 ? (this.stats.grossPnl - this.stats.fees) / sessHrs : 0;
    console.log(
      `[rebate-farmer] ROUND TRIP ${coin}: gross=${symbol}$${pnl.toFixed(4)} ` +
      `fees=-$${fees.toFixed(4)} net=${symbol}$${net.toFixed(4)} ` +
      `[${this.stats.wins}W/${this.stats.losses}L] vol=$${this.sessionVolume.toFixed(0)} ` +
      `rate=$${hourlyRate.toFixed(2)}/hr active=${this.trades.size - 1}`,
    );

    this.logTradeToSupabase(coin, side, size, entryPx, exitPx, net, "closed");
    this.trades.delete(coin);
  }

  private logTradeToSupabase(
    coin: string, side: string, size: number,
    entryPx: number, exitPx: number, pnl: number, status: string,
  ): void {
    const now = new Date().toISOString();
    this.supabase.from("quant_trades").insert({
      strategy_id: "rebate-farmer",
      strategy_type: "rebate_farmer",
      coin,
      side: side === "buy" ? "long" : "short",
      size,
      entry_px: entryPx,
      exit_px: exitPx,
      pnl,
      fees: 0,
      status,
      opened_at: now,
      closed_at: now,
      meta: { strategy: "rebate-farmer-v4.1" },
    }).then(({ error }) => {
      if (error) console.error("[rebate-farmer] Supabase trade log failed:", error.message);
    });
  }

  // ------------------------------------------------------------------
  // WebSocket fill handler (primary detection path)
  // ------------------------------------------------------------------

  private handleWsFill(trade: TradeState, event: { coin?: string; side?: string; price?: number; size?: number }): void {
    if (!event.coin) return;

    if (trade.phase === "quoting") {
      trade.phase = "unwinding";
      trade.oid = null;
      if (event.price) trade.entryPx = event.price;
      if (event.size) trade.size = event.size;
      this.stats.volume += (event.size ?? trade.size) * (event.price ?? trade.entryPx);
      this.recordFillLatency(event.coin, trade.entryPlacedAt);
      console.log(`[rebate-farmer] WS FILL entry ${event.coin} @ ${event.price ?? "?"}`);
    } else if (trade.phase === "unwinding" && trade.unwindOid) {
      const exitPx = event.price ?? (trade.lastUnwindPx || trade.entryPx);
      console.log(`[rebate-farmer] WS FILL unwind ${event.coin} @ ${exitPx}`);
      this.completeRoundTrip(trade, exitPx);
    }
  }

  private recordFillLatency(coin: string, entryPlacedAt: number): void {
    const fillMs = Date.now() - entryPlacedAt;
    let perf = this.coinPerf.get(coin);
    if (!perf) {
      perf = { trades: 0, wins: 0, netPnl: 0, avgSpreadBps: 0, totalSpread: 0, totalFillMs: 0, fillCount: 0 };
      this.coinPerf.set(coin, perf);
    }
    perf.totalFillMs += fillMs;
    perf.fillCount++;
  }

  // ------------------------------------------------------------------
  // L2 Book
  // ------------------------------------------------------------------

  private async fetchL2(coin: string): Promise<L2Book | null> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "l2Book", coin }),
      });
      const data = (await res.json()) as {
        levels: [
          Array<{ px: string; sz: string; n: number }>,
          Array<{ px: string; sz: string; n: number }>,
        ];
      };

      if (!data.levels || data.levels.length < 2) return null;
      const [bids, asks] = data.levels;
      if (bids.length === 0 || asks.length === 0) return null;

      const bestBid = parseFloat(bids[0].px);
      const bestAsk = parseFloat(asks[0].px);
      const mid = (bestBid + bestAsk) / 2;
      const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10_000 : 0;

      let bidSz = 0, askSz = 0;
      for (let i = 0; i < Math.min(5, bids.length); i++) bidSz += parseFloat(bids[i].sz);
      for (let i = 0; i < Math.min(5, asks.length); i++) askSz += parseFloat(asks[i].sz);
      const total = bidSz + askSz;
      const imbalance = total > 0 ? (bidSz - askSz) / total : 0;

      return { bestBid, bestAsk, mid, spreadBps, imbalance };
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Auto-discovery: scan all perps for best coins
  // ------------------------------------------------------------------

  private async discoverCoins(): Promise<void> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      });
      const [meta, ctxs] = (await res.json()) as [
        { universe: Array<{ name: string; szDecimals: number }> },
        Array<{ markPx: string; dayNtlVlm: string }>,
      ];

      // Update asset indices and volume cache
      for (let i = 0; i < meta.universe.length; i++) {
        this.assetIndices.set(meta.universe[i].name, i);
        this.szDecimalsMap.set(meta.universe[i].name, meta.universe[i].szDecimals);
        const vol = parseFloat(ctxs[i]?.dayNtlVlm ?? "0");
        this.volumeCache.set(meta.universe[i].name, vol);
      }
      this.lastVolumeRefresh = Date.now();

      // Filter candidates: sufficient volume
      const candidates: Array<{ coin: string; vol24h: number }> = [];
      for (let i = 0; i < meta.universe.length; i++) {
        const coin = meta.universe[i].name;
        const vol24h = parseFloat(ctxs[i]?.dayNtlVlm ?? "0");
        const hourlyVol = vol24h / 24;

        // Skip stablecoins and major coins (spreads too tight)
        if (["USDC", "USDT", "BTC", "ETH"].includes(coin)) continue;
        if (hourlyVol < MIN_HOURLY_VOLUME_USD) continue;

        candidates.push({ coin, vol24h });
      }

      // Sample L2 books for top volume candidates to check spreads
      const topCandidates = candidates
        .sort((a, b) => b.vol24h - a.vol24h)
        .slice(0, 50);

      const bookChecks = await Promise.all(
        topCandidates.map(async ({ coin, vol24h }) => {
          const book = await this.fetchL2(coin);
          return { coin, vol24h, spreadBps: book?.spreadBps ?? 0 };
        }),
      );

      // Select coins with good spreads, sorted by spread * sqrt(volume) product
      const selected = bookChecks
        .filter((c) => c.spreadBps >= MIN_SPREAD_BPS)
        .sort((a, b) => {
          const scoreA = a.spreadBps * Math.sqrt(a.vol24h);
          const scoreB = b.spreadBps * Math.sqrt(b.vol24h);
          return scoreB - scoreA;
        })
        .slice(0, 20)
        .map((c) => c.coin);

      // Merge with manual config coins (if any) as priority
      const manual = this.config.coins.filter((c) => this.assetIndices.has(c));
      const merged = [...new Set([...manual, ...selected])];

      this.activeCoinList = merged;
      this.lastDiscovery = Date.now();

      if (this.cycleCount > 0) {
        console.log(`[rebate-farmer] Discovery: ${merged.length} coins — ${merged.slice(0, 10).join(", ")}${merged.length > 10 ? "..." : ""}`);
      }
    } catch (e) {
      console.error("[rebate-farmer] discoverCoins failed:", (e as Error).message);
      // Fallback to config coins
      if (this.activeCoinList.length === 0) {
        this.activeCoinList = this.config.coins.filter((c) => this.assetIndices.has(c));
      }
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private async loadAssetMeta(): Promise<void> {
    try {
      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      });
      const [meta] = (await res.json()) as [
        { universe: Array<{ name: string; szDecimals: number }> },
        unknown[],
      ];
      for (let i = 0; i < meta.universe.length; i++) {
        this.assetIndices.set(meta.universe[i].name, i);
        this.szDecimalsMap.set(meta.universe[i].name, meta.universe[i].szDecimals);
      }
    } catch (e) {
      console.error("[rebate-farmer] loadAssetMeta failed:", (e as Error).message);
    }
  }

  private roundPrice(price: number, coin: string): string {
    if (price <= 0) return "0";
    const szDec = this.szDecimalsMap.get(coin) ?? 0;
    const maxDec = 6 - szDec;

    // Round to 5 significant figures first
    const mag = Math.floor(Math.log10(price));
    const sfPower = 4 - mag; // 5-1 = 4 → yields 5 sig figs
    if (sfPower >= 0) {
      const f = Math.pow(10, sfPower);
      price = Math.round(price * f) / f;
    } else {
      const f = Math.pow(10, -sfPower);
      price = Math.round(price / f) * f;
    }

    // Then clamp to max decimal places (HL rule: 6 - szDecimals for perps)
    const df = Math.pow(10, maxDec);
    price = Math.round(price * df) / df;

    let s = price.toFixed(maxDec);
    if (s.includes(".")) {
      s = s.replace(/0+$/, "");
      if (s.endsWith(".")) s = s.slice(0, -1);
    }
    return s;
  }

  private roundSize(size: number, coin: string): string {
    const decimals = this.szDecimalsMap.get(coin) ?? 4;
    const factor = Math.pow(10, decimals);
    return (Math.floor(size * factor) / factor).toFixed(decimals);
  }

  // ------------------------------------------------------------------
  // Volume & fee tier tracking
  // ------------------------------------------------------------------

  private async fetchFeeTier(): Promise<void> {
    try {
      const address = process.env.HL_ACCOUNT_ADDRESS;
      if (!address) return;

      const res = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "userFees", user: address }),
      });
      const data = await res.json() as {
        userCrossRate?: string;
        userAddRate?: string;
        activeReferralDiscount?: string;
        dailyUserVlm?: Array<{ date: string; userCrossVlm: string; userAddVlm: string }>;
      };

      if (data.userAddRate) {
        this.currentMakerBps = Math.round(parseFloat(data.userAddRate) * 100_000) / 10;
      }

      let rollingVol = 0;
      if (data.dailyUserVlm) {
        const now = new Date();
        for (const day of data.dailyUserVlm) {
          const dayDate = new Date(day.date);
          const daysAgo = (now.getTime() - dayDate.getTime()) / 86_400_000;
          if (daysAgo <= 14) {
            rollingVol += parseFloat(day.userCrossVlm || "0") + parseFloat(day.userAddVlm || "0");
          }
        }
      }

      let tier = FEE_TIERS[0];
      for (const t of FEE_TIERS) {
        if (rollingVol >= t.minVol) tier = t;
      }
      this.currentFeeTier = tier.label;

      const tierIdx = FEE_TIERS.indexOf(tier);
      const nextTier = tierIdx < FEE_TIERS.length - 1 ? FEE_TIERS[tierIdx + 1] : null;
      const volToNext = nextTier ? nextTier.minVol - rollingVol : 0;

      console.log(
        `[rebate-farmer] FEE TIER: ${tier.label} (maker=${this.currentMakerBps}bps) | ` +
        `14d vol: $${this.fmtVol(rollingVol)}` +
        (nextTier ? ` | $${this.fmtVol(volToNext)} to ${nextTier.label} (${nextTier.makerBps}bps)` : " | MAX TIER"),
      );

      this.lastFeeTierCheck = Date.now();
    } catch (e) {
      console.error("[rebate-farmer] fetchFeeTier failed:", (e as Error).message);
    }
  }

  private async loadAllTimeVolume(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from("ai_agent_logs")
        .select("details")
        .eq("action", "rebate_farmer_daily")
        .order("created_at", { ascending: false })
        .limit(30);

      if (data) {
        this.allTimeVolume = data.reduce((sum, row) => {
          const vol = (row.details as Record<string, number>)?.volume ?? 0;
          return sum + vol;
        }, 0);
        console.log(`[rebate-farmer] All-time logged volume: $${this.fmtVol(this.allTimeVolume)}`);
      }
    } catch {}
  }

  private logVolumeStatus(): void {
    const sessHrs = (Date.now() - this.sessionStartTime) / 3_600_000;
    const net = this.stats.grossPnl - this.stats.fees;
    const hourlyRate = sessHrs > 0.01 ? net / sessHrs : 0;
    const hourlyVol = sessHrs > 0.01 ? this.sessionVolume / sessHrs : 0;
    const winRate = this.stats.roundTrips > 0
      ? (this.stats.wins / this.stats.roundTrips * 100).toFixed(0)
      : "0";
    const dailyVol24h = hourlyVol * 24;

    let tierProjection = "";
    const tierIdx = FEE_TIERS.findIndex(t => t.label === this.currentFeeTier);
    if (tierIdx < FEE_TIERS.length - 1 && hourlyVol > 0) {
      const nextTier = FEE_TIERS[tierIdx + 1];
      const volNeeded = nextTier.minVol - this.sessionVolume;
      if (volNeeded > 0) {
        const hoursToNext = volNeeded / hourlyVol;
        const daysToNext = hoursToNext / 24;
        tierProjection = daysToNext < 1
          ? ` | ${nextTier.label} in ~${hoursToNext.toFixed(0)}h`
          : ` | ${nextTier.label} in ~${daysToNext.toFixed(0)}d`;
      }
    }

    console.log(
      `[rebate-farmer] ` +
      `SESSION: ${sessHrs.toFixed(1)}h | ${this.stats.roundTrips} trades (${winRate}% win) | ` +
      `net $${net.toFixed(4)} ($${hourlyRate.toFixed(2)}/hr) | active: ${this.trades.size}`,
    );
    console.log(
      `[rebate-farmer] ` +
      `VOLUME: session $${this.fmtVol(this.sessionVolume)} | today $${this.fmtVol(this.stats.volume)} | ` +
      `rate $${this.fmtVol(hourlyVol)}/hr ($${this.fmtVol(dailyVol24h)}/day proj)`,
    );
    console.log(
      `[rebate-farmer] ` +
      `FEES: ${this.currentFeeTier} (${this.currentMakerBps}bps maker)${tierProjection}`,
    );

    const topCoins = [...this.coinPerf.entries()]
      .sort((a, b) => b[1].netPnl - a[1].netPnl)
      .slice(0, 5);
    if (topCoins.length > 0) {
      const coinStr = topCoins
        .map(([coin, p]) => {
          const wr = p.trades > 0 ? (p.wins / p.trades * 100).toFixed(0) : "0";
          const avgFill = p.fillCount > 0 ? `${(p.totalFillMs / p.fillCount / 1000).toFixed(0)}s` : "?";
          return `${coin}(${p.trades}t ${wr}%w $${p.netPnl.toFixed(3)} fill:${avgFill})`;
        })
        .join(" ");
      console.log(`[rebate-farmer] TOP COINS: ${coinStr}`);
    }
  }

  private updateCoinPerf(coin: string, isWin: boolean, net: number, spreadBps: number): void {
    let perf = this.coinPerf.get(coin);
    if (!perf) {
      perf = { trades: 0, wins: 0, netPnl: 0, avgSpreadBps: 0, totalSpread: 0, totalFillMs: 0, fillCount: 0 };
      this.coinPerf.set(coin, perf);
    }
    perf.trades++;
    if (isWin) perf.wins++;
    perf.netPnl += net;
    perf.totalSpread += spreadBps;
    perf.avgSpreadBps = perf.totalSpread / perf.trades;
  }

  private getPrioritizedCoins(): string[] {
    const coins = [...this.activeCoinList];
    if (this.coinPerf.size < 5) return coins;

    return coins.sort((a, b) => {
      const pa = this.coinPerf.get(a);
      const pb = this.coinPerf.get(b);
      if (!pa && !pb) return 0;
      if (!pa) return 1;
      if (!pb) return -1;
      const scoreA = pa.netPnl * (pa.wins / Math.max(pa.trades, 1));
      const scoreB = pb.netPnl * (pb.wins / Math.max(pb.trades, 1));
      return scoreB - scoreA;
    });
  }

  private fmtVol(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  }

  // ------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------

  private maybeResetStats(): void {
    const day = new Date().getUTCDate();
    if (day !== this.statsResetDay) {
      if (this.statsResetDay !== -1) this.logStats();
      this.resetStats();
    }
  }

  private resetStats(): void {
    this.stats = { roundTrips: 0, grossPnl: 0, fees: 0, volume: 0, wins: 0, losses: 0 };
    this.dailyLoss = 0;
    this.statsResetDay = new Date().getUTCDate();
  }

  private logStats(): void {
    const s = this.stats;
    const net = s.grossPnl - s.fees;
    const winRate = s.roundTrips > 0 ? (s.wins / s.roundTrips * 100).toFixed(0) : "0";
    console.log(
      `[rebate-farmer] DAILY SUMMARY: ${s.roundTrips} trades (${winRate}% win, ${s.wins}W/${s.losses}L) | ` +
      `vol $${this.fmtVol(s.volume)} | net $${net.toFixed(4)} | ` +
      `${this.currentFeeTier} (${this.currentMakerBps}bps)`,
    );

    const coinPerfSnapshot: Record<string, CoinPerf> = {};
    for (const [coin, perf] of this.coinPerf) coinPerfSnapshot[coin] = { ...perf };

    this.supabase.from("ai_agent_logs").insert({
      action: "rebate_farmer_daily",
      details: {
        ...s,
        net,
        date: new Date().toISOString().split("T")[0],
        sessionVolume: this.sessionVolume,
        feeTier: this.currentFeeTier,
        makerBps: this.currentMakerBps,
        coinPerf: coinPerfSnapshot,
      },
    }).then(() => {}).catch(() => {});
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  logStatus(): void {
    const s = this.stats;
    const net = s.grossPnl - s.fees;
    const sessHrs = (Date.now() - this.sessionStartTime) / 3_600_000;
    const hourlyRate = sessHrs > 0.01 ? net / sessHrs : 0;
    const activeCoins = [...this.trades.keys()].join(",") || "—";
    console.log(
      `[rebate-farmer] active(${this.trades.size}): ${activeCoins} | ` +
      `${s.roundTrips} trades (${s.wins}W/${s.losses}L) | net $${net.toFixed(4)} ($${hourlyRate.toFixed(2)}/hr) | ` +
      `vol $${this.fmtVol(this.sessionVolume)} | ${this.currentFeeTier}`,
    );
  }

  async reconcileFills(): Promise<void> {
    if (this.trades.size === 0) return;

    try {
      const positions = await fetchPositions();
      const hlPositions = new Map<string, number>();
      for (const p of positions) {
        const qty = parseFloat(p.position.szi);
        if (qty !== 0) hlPositions.set(p.position.coin, qty);
      }

      for (const [coin, trade] of this.trades) {
        const hlQty = hlPositions.get(coin) ?? 0;

        if (trade.phase === "quoting") {
          const expected = trade.side === "buy" ? trade.size : -trade.size;
          if (Math.abs(hlQty) > trade.size * 0.5 && Math.sign(hlQty) === Math.sign(expected)) {
            console.log(`[rebate-farmer] Reconcile: entry ${coin} filled`);
            trade.phase = "unwinding";
            trade.oid = null;
            trade.size = Math.abs(hlQty);
            this.stats.volume += trade.size * trade.entryPx;
            this.recordFillLatency(coin, trade.entryPlacedAt);
          }
        } else if (trade.phase === "unwinding") {
          if (Math.abs(hlQty) < trade.size * 0.05) {
            console.log(`[rebate-farmer] Reconcile: unwind ${coin} complete`);
            const fillPx = trade.lastUnwindPx > 0 ? trade.lastUnwindPx : trade.entryPx;
            this.completeRoundTrip(trade, fillPx);
          }
        }
      }
    } catch {}
  }

  get isRunning(): boolean {
    return this.running;
  }

  getSnapshot(): Record<string, unknown> {
    const s = this.stats;
    const elapsed = Date.now() - this.sessionStartTime;
    const hrs = elapsed / 3_600_000;
    const net = s.grossPnl - s.fees;
    const winRate = s.roundTrips > 0 ? (s.wins / s.roundTrips * 100) : 0;
    const hourlyRate = hrs > 0.01 ? net / hrs : 0;
    const dailyProjected = hourlyRate * 24;
    const volRate = hrs > 0.01 ? this.sessionVolume / hrs : 0;

    const coins: Record<string, { trades: number; wins: number; netPnl: number; avgFillSec?: number }> = {};
    for (const [coin, perf] of this.coinPerf) {
      coins[coin] = {
        trades: perf.trades,
        wins: perf.wins,
        netPnl: perf.netPnl,
        avgFillSec: perf.fillCount > 0 ? Math.round(perf.totalFillMs / perf.fillCount / 1000) : undefined,
      };
    }

    const activeTrades: Array<{ coin: string; phase: string; side: string; entryPx: number; size: number }> = [];
    for (const [, trade] of this.trades) {
      activeTrades.push({
        coin: trade.coin,
        phase: trade.phase,
        side: trade.side,
        entryPx: trade.entryPx,
        size: trade.size,
      });
    }

    return {
      status: this.running ? "active" : "stopped",
      version: "v4.1",
      sessionUptime: elapsed,
      sessionTrades: s.roundTrips,
      sessionWins: s.wins,
      sessionLosses: s.losses,
      winRate: Math.round(winRate * 10) / 10,
      grossPnl: Math.round(s.grossPnl * 10000) / 10000,
      fees: Math.round(s.fees * 10000) / 10000,
      netPnl: Math.round(net * 10000) / 10000,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      dailyProjected: Math.round(dailyProjected * 100) / 100,
      sessionVolume: Math.round(this.sessionVolume),
      allTimeVolume: Math.round(this.allTimeVolume),
      volumeRate: Math.round(volRate),
      dailyVolumeProjected: Math.round(volRate * 24),
      feeTier: this.currentFeeTier,
      makerFeeBps: this.currentMakerBps,
      maxConcurrent: MAX_CONCURRENT_TRADES,
      activeTrades,
      coins,
      config: {
        orderSize: this.config.orderSizeUsd,
        maxExposure: this.config.maxExposureUsd,
        minSpreadBps: MIN_SPREAD_BPS,
        coinCount: this.activeCoinList.length,
        coinList: this.activeCoinList,
      },
    };
  }
}
