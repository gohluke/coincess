/**
 * Rebate Farmer v2 — Risk-free spread capture via maker-only orders.
 *
 * RULES (learned from live testing):
 * 1. Only enter when spread >= 7 bps (below that, fees eat all profit)
 * 2. One position at a time globally (no multi-coin inventory)
 * 3. NEVER use taker orders for unwind — always Alo (maker)
 * 4. If stuck, cancel and accept the loss rather than spam IoC orders
 * 5. Minimum imbalance threshold to avoid balanced/neutral books
 */

import { placeOrder, cancelOrder, fetchPositions } from "../executor";
import { PriceFeed } from "../price-feed";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RebateFarmerConfig } from "../types";
import { REBATE_FARMER_DEFAULTS } from "../types";

const HL_API = "https://api.hyperliquid.xyz";

const MIN_SPREAD_BPS = 7;
const MIN_IMBALANCE = 0.10;

// Hyperliquid fee tiers (14-day rolling volume)
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
  imbalance: number; // [-1, 1]
}

type Phase = "idle" | "quoting" | "unwinding";

interface TradeState {
  phase: Phase;
  coin: string | null;
  oid: number | null;
  side: "buy" | "sell" | null;
  entryPx: number;
  size: number;
  assetIndex: number;
  placedAt: number;
  unwindOid: number | null;
  lastUnwindAttempt: number;
  unwindAttempts: number;
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
}

export class RebateFarmer {
  private config: RebateFarmerConfig;
  private priceFeed: PriceFeed;
  private supabase: SupabaseClient;
  private running = false;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;

  private assetIndices: Map<string, number> = new Map();
  private szDecimalsMap: Map<string, number> = new Map();

  // Single trade state — one position at a time for safety
  private state: TradeState = this.freshState();
  private stats: Stats = { roundTrips: 0, grossPnl: 0, fees: 0, volume: 0, wins: 0, losses: 0 };
  private dailyLoss = 0;
  private statsResetDay = -1;

  private cycleCount = 0;
  private coinIndex = 0;
  private cycling = false;

  // Volume & fee tier tracking
  private sessionStartTime = Date.now();
  private sessionVolume = 0;
  private allTimeVolume = 0;
  private currentMakerBps = 1.5;
  private currentFeeTier = "Tier 0";
  private lastFeeTierCheck = 0;
  private readonly FEE_TIER_CHECK_INTERVAL = 300_000; // re-check every 5 min

  // Per-coin performance tracking (prioritize best performers)
  private coinPerf: Map<string, CoinPerf> = new Map();

  private readonly STALE_QUOTE_MS = 8_000;
  private readonly UNWIND_COOLDOWN_MS = 10_000;
  private readonly MAX_UNWIND_ATTEMPTS = 30;
  private readonly DIAG_INTERVAL = 60;
  private readonly VOLUME_LOG_INTERVAL = 30; // log volume stats every 30 cycles

  constructor(priceFeed: PriceFeed, config?: Partial<RebateFarmerConfig>) {
    this.config = { ...REBATE_FARMER_DEFAULTS, ...config };
    this.priceFeed = priceFeed;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials for RebateFarmer");
    this.supabase = createClient(url, key);
  }

  private freshState(): TradeState {
    return {
      phase: "idle",
      coin: null,
      oid: null,
      side: null,
      entryPx: 0,
      size: 0,
      assetIndex: 0,
      placedAt: 0,
      unwindOid: null,
      lastUnwindAttempt: 0,
      unwindAttempts: 0,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.sessionStartTime = Date.now();
    this.sessionVolume = 0;

    console.log("[rebate-farmer] v3 starting — risk-free mode + volume tracking");
    console.log(`[rebate-farmer]   coins: ${this.config.coins.join(", ")}`);
    console.log(`[rebate-farmer]   orderSize: $${this.config.orderSizeUsd} | minSpread: ${MIN_SPREAD_BPS}bps`);
    console.log(`[rebate-farmer]   ONE position at a time | maker-only unwind`);

    await this.loadAssetMeta();
    await this.fetchFeeTier();
    await this.loadAllTimeVolume();
    this.resetStats();

    this.priceFeed.onUserEvent((event) => {
      if (event.type !== "fill" || !event.coin) return;
      if (this.state.coin !== event.coin) return;
      this.handleWsFill(event);
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
    if (this.state.oid && this.state.coin) {
      cancelOrder(this.state.assetIndex, this.state.oid).catch(() => {});
    }
    if (this.state.unwindOid && this.state.coin) {
      cancelOrder(this.state.assetIndex, this.state.unwindOid).catch(() => {});
    }
    console.log("[rebate-farmer] Stopped");
    this.logStats();
  }

  // ------------------------------------------------------------------
  // Core cycle
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

    // Refresh fee tier periodically
    if (Date.now() - this.lastFeeTierCheck > this.FEE_TIER_CHECK_INTERVAL) {
      this.fetchFeeTier().catch(() => {});
    }

    switch (this.state.phase) {
      case "idle":
        await this.findOpportunity(isDiag);
        break;
      case "quoting":
        await this.manageQuote();
        break;
      case "unwinding":
        await this.manageUnwind();
        break;
    }
  }

  // ------------------------------------------------------------------
  // Phase: IDLE — scan for opportunities
  // ------------------------------------------------------------------

  private async findOpportunity(diag: boolean): Promise<void> {
    const coins = this.getPrioritizedCoins();
    if (coins.length === 0) return;

    // Batch-fetch L2 for all coins in parallel (much faster than sequential)
    const books = await Promise.all(
      coins.map(async (coin) => ({ coin, book: await this.fetchL2(coin) })),
    );

    // Find best opportunity: highest spread that meets thresholds
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

      // Score = spread * |imbalance| * coin_win_rate_bonus
      const perf = this.coinPerf.get(coin);
      const winBonus = perf && perf.trades >= 3
        ? 0.5 + (perf.wins / perf.trades)
        : 1.0;
      const score = book.spreadBps * Math.abs(book.imbalance) * winBonus;

      if (!best || score > best.score) {
        best = { coin, book, assetIndex, score };
      }
    }

    if (best) {
      const side: "buy" | "sell" = best.book.imbalance > 0 ? "buy" : "sell";
      await this.placeEntry(best.coin, side, best.book, best.assetIndex);
    }
  }

  private async placeEntry(
    coin: string,
    side: "buy" | "sell",
    book: L2Book,
    assetIndex: number,
  ): Promise<void> {
    const offsetFrac = this.config.spreadBps / 10_000;
    let price: number;
    if (side === "buy") {
      price = Math.min(book.bestBid * (1 + offsetFrac), book.mid * 0.9999);
    } else {
      price = Math.max(book.bestAsk * (1 - offsetFrac), book.mid * 1.0001);
    }

    const size = this.config.orderSizeUsd / price;
    const sizeStr = this.roundSize(size, coin);
    const priceStr = this.roundPrice(price);
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

    if (!result.success) return;

    console.log(
      `[rebate-farmer] ENTRY ${side.toUpperCase()} ${coin} $${notional.toFixed(0)} @ ${priceStr} ` +
      `(spread=${book.spreadBps.toFixed(1)}bps, imb=${book.imbalance.toFixed(2)})`,
    );

    if (result.oid) {
      this.state = {
        phase: "quoting",
        coin,
        oid: result.oid,
        side,
        entryPx: price,
        size: parseFloat(sizeStr),
        assetIndex,
        placedAt: Date.now(),
        unwindOid: null,
        lastUnwindAttempt: 0,
        unwindAttempts: 0,
      };
    }

    // Alo filled immediately (extremely rare)
    if (result.avgPx) {
      this.state = {
        phase: "unwinding",
        coin,
        oid: null,
        side,
        entryPx: parseFloat(result.avgPx),
        size: parseFloat(sizeStr),
        assetIndex,
        placedAt: Date.now(),
        unwindOid: null,
        lastUnwindAttempt: 0,
        unwindAttempts: 0,
      };
      this.stats.volume += notional;
      console.log(`[rebate-farmer] Immediate fill — switching to unwind`);
    }
  }

  // ------------------------------------------------------------------
  // Phase: QUOTING — waiting for our entry to fill
  // ------------------------------------------------------------------

  private async manageQuote(): Promise<void> {
    const { coin, oid, assetIndex } = this.state;
    if (!coin || !oid) {
      this.state = this.freshState();
      return;
    }

    const age = Date.now() - this.state.placedAt;

    // Cancel stale quotes
    if (age > this.STALE_QUOTE_MS) {
      await cancelOrder(assetIndex, oid).catch(() => {});
      console.log(`[rebate-farmer] Cancelled stale quote on ${coin} (${(age / 1000).toFixed(0)}s)`);
      this.state = this.freshState();
      return;
    }

    // Check if the book has moved against us (cancel to avoid bad fill)
    const book = await this.fetchL2(coin);
    if (!book) return;

    if (this.state.side === "buy" && this.state.entryPx >= book.bestAsk) {
      await cancelOrder(assetIndex, oid).catch(() => {});
      this.state = this.freshState();
      return;
    }
    if (this.state.side === "sell" && this.state.entryPx <= book.bestBid) {
      await cancelOrder(assetIndex, oid).catch(() => {});
      this.state = this.freshState();
      return;
    }
  }

  // ------------------------------------------------------------------
  // Phase: UNWINDING — trying to close at profit via maker order
  // ------------------------------------------------------------------

  private async manageUnwind(): Promise<void> {
    const { coin, assetIndex, unwindOid, side, entryPx, size } = this.state;
    if (!coin) {
      this.state = this.freshState();
      return;
    }

    // Gave up on unwind — accept loss and reset
    if (this.state.unwindAttempts >= this.MAX_UNWIND_ATTEMPTS) {
      console.log(`[rebate-farmer] ABANDON ${coin} after ${this.state.unwindAttempts} unwind attempts — accepting loss`);
      if (unwindOid) await cancelOrder(assetIndex, unwindOid).catch(() => {});
      await this.forceClose(coin, side!, size, assetIndex, entryPx);
      this.state = this.freshState();
      return;
    }

    // If we have a resting unwind order, check if it's still valid
    if (unwindOid) {
      const age = Date.now() - this.state.lastUnwindAttempt;
      if (age < this.UNWIND_COOLDOWN_MS) return; // wait for cooldown

      // Cancel stale unwind and try again
      await cancelOrder(assetIndex, unwindOid).catch(() => {});
      this.state.unwindOid = null;
    }

    // Cooldown between attempts
    const sinceLast = Date.now() - this.state.lastUnwindAttempt;
    if (sinceLast < this.UNWIND_COOLDOWN_MS) return;

    // Place new unwind order at profitable price
    const book = await this.fetchL2(coin);
    if (!book) return;

    const unwindSide: "buy" | "sell" = side === "buy" ? "sell" : "buy";
    const feeBuffer = this.currentMakerBps * 2 / 10_000 + 0.0002;

    let unwindPx: number;
    if (unwindSide === "sell") {
      unwindPx = Math.max(book.bestAsk, entryPx * (1 + feeBuffer));
    } else {
      unwindPx = Math.min(book.bestBid, entryPx * (1 - feeBuffer));
    }

    const sizeStr = this.roundSize(size, coin);
    const priceStr = this.roundPrice(unwindPx);
    const notional = parseFloat(sizeStr) * parseFloat(priceStr);

    if (parseFloat(sizeStr) === 0 || notional < 10) {
      this.state.unwindAttempts++;
      this.state.lastUnwindAttempt = Date.now();
      return;
    }

    const result = await placeOrder({
      coin,
      isBuy: unwindSide === "buy",
      size: sizeStr,
      price: priceStr,
      tif: "Alo",
      assetIndex,
    });

    this.state.unwindAttempts++;
    this.state.lastUnwindAttempt = Date.now();

    if (result.success && result.oid) {
      this.state.unwindOid = result.oid;
    }

    if (result.success && result.avgPx) {
      // Filled immediately
      const fillPx = parseFloat(result.avgPx);
      this.completeRoundTrip(fillPx);
    }
  }

  private async forceClose(
    coin: string,
    entrySide: "buy" | "sell",
    size: number,
    assetIndex: number,
    entryPx: number,
  ): Promise<void> {
    // Use a single IoC close — one attempt only, no spam
    const book = await this.fetchL2(coin);
    if (!book) {
      this.recordLoss(coin, entryPx, entryPx, size);
      return;
    }

    const closeSide = entrySide === "buy" ? "sell" : "buy";
    const slippage = closeSide === "buy" ? 1.005 : 0.995;
    const price = book.mid * slippage;
    const sizeStr = this.roundSize(size, coin);
    const priceStr = this.roundPrice(price);

    console.log(`[rebate-farmer] FORCE CLOSE ${coin} ${closeSide} ${sizeStr} @ ${priceStr}`);

    const result = await placeOrder({
      coin,
      isBuy: closeSide === "buy",
      size: sizeStr,
      price: priceStr,
      tif: "Ioc",
      assetIndex,
    });

    if (result.success && result.avgPx) {
      const fillPx = parseFloat(result.avgPx);
      this.completeRoundTrip(fillPx);
    } else {
      // Couldn't close — log as loss at current mid
      this.recordLoss(coin, entryPx, book.mid, size);
    }
  }

  private recordLoss(coin: string, entryPx: number, exitPx: number, size: number): void {
    const pnl = this.state.side === "buy"
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
  }

  private completeRoundTrip(exitPx: number): void {
    const { coin, side, entryPx, size } = this.state;
    if (!coin || !side) return;

    const pnl = side === "buy"
      ? (exitPx - entryPx) * size
      : (entryPx - exitPx) * size;
    const fees = size * entryPx * this.currentMakerBps * 2 / 10_000;
    const net = pnl - fees;
    const tradeVol = size * entryPx + size * exitPx; // both legs count

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

    // Track per-coin performance
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
      `rate=$${hourlyRate.toFixed(2)}/hr`,
    );

    this.state = this.freshState();
  }

  // ------------------------------------------------------------------
  // WebSocket fill handler
  // ------------------------------------------------------------------

  private handleWsFill(event: { coin?: string; side?: string; price?: number; size?: number }): void {
    if (!event.coin || this.state.coin !== event.coin) return;

    if (this.state.phase === "quoting") {
      // Entry filled
      this.state.phase = "unwinding";
      this.state.oid = null;
      if (event.price) this.state.entryPx = event.price;
      if (event.size) this.state.size = event.size;
      this.stats.volume += (event.size ?? this.state.size) * (event.price ?? this.state.entryPx);
      console.log(`[rebate-farmer] WS FILL entry ${event.coin} @ ${event.price ?? "?"}`);
    } else if (this.state.phase === "unwinding" && this.state.unwindOid) {
      // Unwind filled
      const exitPx = event.price ?? this.state.entryPx;
      console.log(`[rebate-farmer] WS FILL unwind ${event.coin} @ ${exitPx}`);
      this.completeRoundTrip(exitPx);
    }
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
      const found = this.config.coins.filter((c) => this.assetIndices.has(c));
      const missing = this.config.coins.filter((c) => !this.assetIndices.has(c));
      console.log(`[rebate-farmer] Loaded ${found.length} coins: ${found.join(", ")}`);
      if (missing.length > 0) {
        console.warn(`[rebate-farmer] Missing: ${missing.join(", ")}`);
        this.config.coins = found;
      }
    } catch (e) {
      console.error("[rebate-farmer] loadAssetMeta failed:", (e as Error).message);
    }
  }

  private roundPrice(price: number): string {
    if (price >= 100_000) return (Math.round(price / 10) * 10).toString();
    if (price >= 10_000) return Math.round(price).toString();
    if (price >= 1_000) return (Math.round(price * 10) / 10).toFixed(1);
    if (price >= 100) return (Math.round(price * 100) / 100).toFixed(2);
    if (price >= 10) return (Math.round(price * 1000) / 1000).toFixed(3);
    if (price >= 1) return (Math.round(price * 10000) / 10000).toFixed(4);
    return (Math.round(price * 100000) / 100000).toFixed(5);
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

      // Calculate 14-day rolling volume from daily data
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

      // Determine current tier
      let tier = FEE_TIERS[0];
      for (const t of FEE_TIERS) {
        if (rollingVol >= t.minVol) tier = t;
      }
      this.currentFeeTier = tier.label;

      // Find next tier
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

    // Projected time to next tier
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
      `net $${net.toFixed(4)} ($${hourlyRate.toFixed(2)}/hr)`,
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

    // Log top coins
    const topCoins = [...this.coinPerf.entries()]
      .sort((a, b) => b[1].netPnl - a[1].netPnl)
      .slice(0, 5);
    if (topCoins.length > 0) {
      const coinStr = topCoins
        .map(([coin, p]) => {
          const wr = p.trades > 0 ? (p.wins / p.trades * 100).toFixed(0) : "0";
          return `${coin}(${p.trades}t ${wr}%w $${p.netPnl.toFixed(3)})`;
        })
        .join(" ");
      console.log(`[rebate-farmer] TOP COINS: ${coinStr}`);
    }
  }

  private updateCoinPerf(coin: string, isWin: boolean, net: number, spreadBps: number): void {
    let perf = this.coinPerf.get(coin);
    if (!perf) {
      perf = { trades: 0, wins: 0, netPnl: 0, avgSpreadBps: 0, totalSpread: 0 };
      this.coinPerf.set(coin, perf);
    }
    perf.trades++;
    if (isWin) perf.wins++;
    perf.netPnl += net;
    perf.totalSpread += spreadBps;
    perf.avgSpreadBps = perf.totalSpread / perf.trades;
  }

  private getPrioritizedCoins(): string[] {
    const coins = [...this.config.coins];
    if (this.coinPerf.size < 5) return coins;

    // Sort by profitability: coins with more wins and higher PnL go first
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

  logStatus(): void {
    const s = this.stats;
    const net = s.grossPnl - s.fees;
    const phase = this.state.phase;
    const activeCoin = this.state.coin ?? "—";
    const sessHrs = (Date.now() - this.sessionStartTime) / 3_600_000;
    const hourlyRate = sessHrs > 0.01 ? net / sessHrs : 0;
    console.log(
      `[rebate-farmer] ${phase}${phase !== "idle" ? ` (${activeCoin})` : ""} | ` +
      `${s.roundTrips} trades (${s.wins}W/${s.losses}L) | net $${net.toFixed(4)} ($${hourlyRate.toFixed(2)}/hr) | ` +
      `vol $${this.fmtVol(this.sessionVolume)} | ${this.currentFeeTier}`,
    );
  }

  async reconcileFills(): Promise<void> {
    if (this.state.phase !== "quoting" && this.state.phase !== "unwinding") return;
    if (!this.state.coin) return;

    try {
      const positions = await fetchPositions();
      const hlQty = positions
        .filter((p) => p.position.coin === this.state.coin)
        .reduce((sum, p) => sum + parseFloat(p.position.szi), 0);

      if (this.state.phase === "quoting") {
        const expected = this.state.side === "buy" ? this.state.size : -this.state.size;
        if (Math.abs(hlQty - expected) < this.state.size * 0.05) {
          console.log(`[rebate-farmer] Reconcile: entry ${this.state.coin} filled`);
          this.state.phase = "unwinding";
          this.state.oid = null;
          this.stats.volume += this.state.size * this.state.entryPx;
        }
      } else if (this.state.phase === "unwinding") {
        if (Math.abs(hlQty) < this.state.size * 0.05) {
          console.log(`[rebate-farmer] Reconcile: unwind ${this.state.coin} complete`);
          const mid = this.priceFeed.getPrice(this.state.coin!) ?? this.state.entryPx;
          this.completeRoundTrip(mid);
        }
      }
    } catch {}
  }

  get isRunning(): boolean {
    return this.running;
  }
}
