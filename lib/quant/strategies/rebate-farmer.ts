/**
 * Rebate Farmer — High-frequency spread capture via maker-only orders.
 *
 * Inspired by the Hyperliquid trader who turned $6.8K into $1.5M by
 * providing liquidity and earning rebates. At Tier 0 we pay 0.015% maker
 * fee instead of getting rebates, so we capture the bid-ask spread on
 * medium-cap coins where spread > 3 bps and profit on the delta.
 *
 * Strategy: one-sided quoting based on order book imbalance, immediate
 * inventory unwind, tight risk controls. Runs event-driven on the
 * WebSocket price feed — NOT on the 30s tick loop.
 */

import { placeOrder, cancelOrder, fetchPositions } from "../executor";
import { PriceFeed } from "../price-feed";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RebateFarmerConfig, OrderResult } from "../types";
import { REBATE_FARMER_DEFAULTS } from "../types";

const HL_API = "https://api.hyperliquid.xyz";

const MAKER_FEE_BPS = 1.5; // Tier 0 maker fee: 0.015%
// Need spread >> 2× maker fee to survive adverse selection
// STRK at 7.4bps was profitable. WIF at 5bps lost money.
const MIN_PROFITABLE_SPREAD_BPS = 7;

interface L2Snapshot {
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spreadBps: number;
  bidSize: number;
  askSize: number;
  imbalance: number; // [-1, 1]: positive = more bids (buy pressure)
}

interface ActiveQuote {
  oid: number;
  coin: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  placedAt: number;
  assetIndex: number;
}

interface InventoryEntry {
  coin: string;
  netQty: number;
  avgEntryPx: number;
  assetIndex: number;
}

interface CycleStats {
  fills: number;
  cancels: number;
  roundTrips: number;
  grossPnl: number;
  fees: number;
  volume: number;
}

export class RebateFarmer {
  private config: RebateFarmerConfig;
  private priceFeed: PriceFeed;
  private supabase: SupabaseClient;
  private running = false;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;

  private activeQuotes: Map<string, ActiveQuote> = new Map(); // coin -> active order
  private inventory: Map<string, InventoryEntry> = new Map();
  private assetIndices: Map<string, number> = new Map();
  private szDecimalsMap: Map<string, number> = new Map();

  // Stats tracking
  private dailyStats: CycleStats = { fills: 0, cancels: 0, roundTrips: 0, grossPnl: 0, fees: 0, volume: 0 };
  private dailyLoss = 0;
  private statsResetDay = -1;

  // Stale quote protection
  private readonly STALE_QUOTE_MS = 5_000;
  private readonly MAX_INVENTORY_AGE_MS = 60_000;
  private inventoryTimestamps: Map<string, number> = new Map();

  // Diagnostic logging
  private cycleCount = 0;
  private readonly DIAGNOSTIC_LOG_INTERVAL = 120; // log every 120 cycles (~60s at 500ms)

  constructor(priceFeed: PriceFeed, config?: Partial<RebateFarmerConfig>) {
    this.config = { ...REBATE_FARMER_DEFAULTS, ...config };
    this.priceFeed = priceFeed;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials for RebateFarmer");
    this.supabase = createClient(url, key);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log("[rebate-farmer] Starting spread capture bot");
    console.log(`[rebate-farmer]   coins: ${this.config.coins.join(", ")}`);
    console.log(`[rebate-farmer]   orderSize: $${this.config.orderSizeUsd} | maxExposure: $${this.config.maxExposureUsd}`);
    console.log(`[rebate-farmer]   spreadOffset: ${this.config.spreadBps} bps | cycle: ${this.config.cycleSleepMs}ms`);

    await this.loadAssetMeta();
    this.resetDailyStats();

    // Real-time fill detection via WebSocket userEvents
    this.priceFeed.onUserEvent((event) => {
      if (event.type !== "fill" || !event.coin) return;
      const quote = this.activeQuotes.get(event.coin);
      if (!quote) return;
      const fillSide = event.side === "B" ? "buy" : event.side === "A" ? "sell" : null;
      if (!fillSide || fillSide !== quote.side) return;
      const fillPx = event.price ?? quote.price;
      const fillSz = event.size ?? quote.size;
      console.log(`[rebate-farmer] WS FILL: ${fillSide} ${event.coin} ${fillSz} @ ${fillPx}`);
      this.recordFill(event.coin, fillSide, fillSz, fillPx, quote.assetIndex);
      this.activeQuotes.delete(event.coin);
      this.dailyStats.fills++;
      this.dailyStats.volume += fillSz * fillPx;
      this.dailyStats.fees += (fillSz * fillPx) * 0.00015;
    });

    // Event-driven cycle: runs every cycleSleepMs
    this.cycleTimer = setInterval(() => {
      this.cycle().catch((e) =>
        console.error("[rebate-farmer] cycle error:", (e as Error).message),
      );
    }, this.config.cycleSleepMs);

    // Run first cycle immediately
    await this.cycle();
  }

  stop(): void {
    this.running = false;
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    // Cancel all resting orders
    this.cancelAllQuotes().catch(() => {});
    console.log("[rebate-farmer] Stopped");
    this.logDailyStats();
  }

  // ------------------------------------------------------------------
  // Core cycle: runs every ~500ms
  // ------------------------------------------------------------------

  private async cycle(): Promise<void> {
    if (!this.running) return;
    this.cycleCount++;

    this.maybeResetDailyStats();

    // Kill switch: daily loss
    if (this.dailyLoss >= this.config.maxDailyLossUsd) {
      console.error(`[rebate-farmer] DAILY LOSS LIMIT HIT ($${this.dailyLoss.toFixed(2)}). Stopping.`);
      this.stop();
      return;
    }

    const isDiagCycle = this.cycleCount === 3 || this.cycleCount % this.DIAGNOSTIC_LOG_INTERVAL === 0;

    for (const coin of this.config.coins) {
      try {
        await this.processCoin(coin, isDiagCycle);
      } catch (e) {
        console.error(`[rebate-farmer] ${coin} error:`, (e as Error).message);
      }
    }
  }

  private async processCoin(coin: string, diag = false): Promise<void> {
    const assetIndex = this.assetIndices.get(coin);
    if (assetIndex === undefined) return;

    // Step 1: Fetch L2 book for this coin
    const book = await this.fetchL2(coin);
    if (!book) return;

    if (diag) {
      const imb = book.imbalance > 0 ? `+${book.imbalance.toFixed(2)}` : book.imbalance.toFixed(2);
      console.log(
        `[rebate-farmer] ${coin}: spread=${book.spreadBps.toFixed(1)}bps mid=$${book.midPrice.toFixed(2)} ` +
        `imb=${imb} (need>=${MIN_PROFITABLE_SPREAD_BPS.toFixed(1)}bps)`,
      );
    }

    // Step 2: Check if existing quote should be cancelled
    const existing = this.activeQuotes.get(coin);
    if (existing) {
      const priceMoved = this.shouldCancelQuote(existing, book);
      const isStale = Date.now() - existing.placedAt > this.STALE_QUOTE_MS;

      if (priceMoved || isStale) {
        await this.cancelQuote(coin, existing);
      } else {
        return; // quote is still good, skip this coin
      }
    }

    // Step 3: Check if we need to unwind inventory first
    const inv = this.inventory.get(coin);
    if (inv && Math.abs(inv.netQty) > 0) {
      await this.unwindInventory(coin, inv, book);
      return; // focus on unwinding, don't add new quotes
    }

    // Step 4: Check if spread is wide enough to be profitable
    if (book.spreadBps < MIN_PROFITABLE_SPREAD_BPS) return;

    // Step 5: Determine which side to quote based on imbalance
    const side = this.chooseSide(book);
    if (!side) return;

    // Step 6: Check exposure limits
    const totalExposure = this.getTotalExposureUsd(book.midPrice, coin);
    if (totalExposure + this.config.orderSizeUsd > this.config.maxExposureUsd) return;

    // Step 7: Place the maker order
    if (diag) {
      console.log(`[rebate-farmer] QUOTING ${coin} ${side} @ spread=${book.spreadBps.toFixed(1)}bps`);
    }
    await this.placeQuote(coin, side, book, assetIndex);
  }

  // ------------------------------------------------------------------
  // L2 Book
  // ------------------------------------------------------------------

  private async fetchL2(coin: string): Promise<L2Snapshot | null> {
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
      const midPrice = (bestBid + bestAsk) / 2;
      const spreadBps = midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 10_000 : 0;

      let bidSize = 0, askSize = 0;
      const topN = 5;
      for (let i = 0; i < Math.min(topN, bids.length); i++) bidSize += parseFloat(bids[i].sz);
      for (let i = 0; i < Math.min(topN, asks.length); i++) askSize += parseFloat(asks[i].sz);
      const total = bidSize + askSize;
      const imbalance = total > 0 ? (bidSize - askSize) / total : 0;

      return { bestBid, bestAsk, midPrice, spreadBps, bidSize, askSize, imbalance };
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Quote management
  // ------------------------------------------------------------------

  private chooseSide(book: L2Snapshot): "buy" | "sell" | null {
    // One-sided quoting: pick the side with MORE support (safer)
    // If bids > asks (buy pressure), we JOIN the bids (buy side) to capture a fill
    // then immediately sell the inventory at the ask
    if (book.imbalance > 0.05) return "buy";
    if (book.imbalance < -0.05) return "sell";

    // If balanced, pick the side where our fill is more likely
    // In balanced markets, prefer buying (more natural for crypto upward bias)
    return null; // skip balanced books — no edge
  }

  private async placeQuote(
    coin: string,
    side: "buy" | "sell",
    book: L2Snapshot,
    assetIndex: number,
  ): Promise<void> {
    // Place at best bid/ask with a small offset toward mid to improve fill priority
    const offsetBps = this.config.spreadBps;
    const offsetFraction = offsetBps / 10_000;

    let quotePrice: number;
    if (side === "buy") {
      // Place just above best bid to be first in queue
      quotePrice = book.bestBid * (1 + offsetFraction);
      // But never cross the mid
      quotePrice = Math.min(quotePrice, book.midPrice * 0.9999);
    } else {
      // Place just below best ask
      quotePrice = book.bestAsk * (1 - offsetFraction);
      quotePrice = Math.max(quotePrice, book.midPrice * 1.0001);
    }

    const size = this.config.orderSizeUsd / quotePrice;
    const sizeStr = this.roundSize(size, coin);
    const priceStr = this.roundPrice(quotePrice);

    if (parseFloat(sizeStr) === 0) return;

    // Minimum notional check
    const notional = parseFloat(sizeStr) * parseFloat(priceStr);
    if (notional < 10) return;

    const result = await placeOrder({
      coin,
      isBuy: side === "buy",
      size: sizeStr,
      price: priceStr,
      tif: "Alo", // Add Liquidity Only — guarantees maker
      assetIndex,
    });

    if (result.success) {
      console.log(
        `[rebate-farmer] PLACED ${side.toUpperCase()} ${coin} $${notional.toFixed(0)} @ ${priceStr} ` +
        `(spread=${book.spreadBps.toFixed(1)}bps, ${result.oid ? "resting" : "filled"})`,
      );

      if (result.oid) {
        this.activeQuotes.set(coin, {
          oid: result.oid,
          coin,
          side,
          price: quotePrice,
          size: parseFloat(sizeStr),
          placedAt: Date.now(),
          assetIndex,
        });
      }

      if (result.avgPx) {
        const fillPx = parseFloat(result.avgPx);
        this.recordFill(coin, side, parseFloat(sizeStr), fillPx, assetIndex);
        this.dailyStats.fills++;
        this.dailyStats.volume += notional;
      }
    }
  }

  private shouldCancelQuote(quote: ActiveQuote, book: L2Snapshot): boolean {
    const thresholdBps = this.config.cancelThresholdBps;
    const thresholdFraction = thresholdBps / 10_000;

    if (quote.side === "buy") {
      // Cancel if price dropped significantly (we'd be buying too high)
      if (book.midPrice < quote.price * (1 - thresholdFraction)) return true;
      // Cancel if our order is now above the best ask (crossed book)
      if (quote.price >= book.bestAsk) return true;
    } else {
      if (book.midPrice > quote.price * (1 + thresholdFraction)) return true;
      if (quote.price <= book.bestBid) return true;
    }

    return false;
  }

  private async cancelQuote(coin: string, quote: ActiveQuote): Promise<void> {
    const result = await cancelOrder(quote.assetIndex, quote.oid);
    this.activeQuotes.delete(coin);
    if (result.success) {
      this.dailyStats.cancels++;
    }
  }

  private async cancelAllQuotes(): Promise<void> {
    for (const [coin, quote] of this.activeQuotes) {
      try {
        await cancelOrder(quote.assetIndex, quote.oid);
      } catch {}
    }
    this.activeQuotes.clear();
  }

  // ------------------------------------------------------------------
  // Inventory management
  // ------------------------------------------------------------------

  private recordFill(
    coin: string,
    side: "buy" | "sell",
    qty: number,
    fillPx: number,
    assetIndex: number,
  ): void {
    const signedQty = side === "buy" ? qty : -qty;
    const inv = this.inventory.get(coin);

    if (!inv) {
      this.inventory.set(coin, { coin, netQty: signedQty, avgEntryPx: fillPx, assetIndex });
      this.inventoryTimestamps.set(coin, Date.now());
    } else {
      const oldNotional = inv.netQty * inv.avgEntryPx;
      inv.netQty += signedQty;

      if (Math.abs(inv.netQty) < 1e-10) {
        // Round trip complete
        const pnl = side === "sell"
          ? (fillPx - inv.avgEntryPx) * qty
          : (inv.avgEntryPx - fillPx) * qty;
        const estFees = qty * fillPx * MAKER_FEE_BPS * 2 / 10_000;
        const netPnl = pnl - estFees;
        this.dailyStats.roundTrips++;
        this.dailyStats.grossPnl += pnl;
        this.dailyStats.fees += estFees;
        if (netPnl < 0) this.dailyLoss += Math.abs(netPnl);
        console.log(
          `[rebate-farmer] ROUND TRIP ${coin}: gross=${pnl >= 0 ? "+" : ""}$${pnl.toFixed(4)} ` +
          `fees=-$${estFees.toFixed(4)} net=${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(4)}`,
        );
        this.inventory.delete(coin);
        this.inventoryTimestamps.delete(coin);
      } else {
        // Update average entry
        const newNotional = oldNotional + signedQty * fillPx;
        inv.avgEntryPx = Math.abs(inv.netQty) > 0
          ? Math.abs(newNotional / inv.netQty)
          : fillPx;
      }
    }
  }

  private async unwindInventory(
    coin: string,
    inv: InventoryEntry,
    book: L2Snapshot,
  ): Promise<void> {
    const age = Date.now() - (this.inventoryTimestamps.get(coin) ?? Date.now());
    const urgent = age > this.MAX_INVENTORY_AGE_MS;

    if (inv.netQty > 0) {
      // We're long — need to sell
      if (urgent) {
        // Urgent: use taker to get out immediately
        await this.marketUnwind(coin, inv, book);
      } else {
        // Patient: place maker sell at best ask
        const existing = this.activeQuotes.get(coin);
        if (!existing || existing.side !== "sell") {
          if (existing) await this.cancelQuote(coin, existing);
          await this.placeUnwindQuote(coin, "sell", inv, book);
        }
      }
    } else if (inv.netQty < 0) {
      // We're short — need to buy
      if (urgent) {
        await this.marketUnwind(coin, inv, book);
      } else {
        const existing = this.activeQuotes.get(coin);
        if (!existing || existing.side !== "buy") {
          if (existing) await this.cancelQuote(coin, existing);
          await this.placeUnwindQuote(coin, "buy", inv, book);
        }
      }
    }
  }

  private async placeUnwindQuote(
    coin: string,
    side: "buy" | "sell",
    inv: InventoryEntry,
    book: L2Snapshot,
  ): Promise<void> {
    const qty = Math.abs(inv.netQty);

    // Calculate minimum profitable unwind price (entry ± round-trip fees)
    const feeBuffer = MAKER_FEE_BPS * 2 / 10_000; // both entry and exit maker fees
    let price: number;
    if (side === "sell") {
      // We're long, need to sell ABOVE entry + fees
      const minProfitablePx = inv.avgEntryPx * (1 + feeBuffer + 0.0001); // +1 bps extra buffer
      price = Math.max(book.bestAsk, minProfitablePx);
    } else {
      // We're short, need to buy BELOW entry - fees
      const minProfitablePx = inv.avgEntryPx * (1 - feeBuffer - 0.0001);
      price = Math.min(book.bestBid, minProfitablePx);
    }

    const sizeStr = this.roundSize(qty, coin);
    const priceStr = this.roundPrice(price);

    if (parseFloat(sizeStr) === 0) return;
    const notional = parseFloat(sizeStr) * parseFloat(priceStr);
    if (notional < 10) return;

    const result = await placeOrder({
      coin,
      isBuy: side === "buy",
      size: sizeStr,
      price: priceStr,
      tif: "Alo",
      assetIndex: inv.assetIndex,
    });

    if (result.success && result.oid) {
      this.activeQuotes.set(coin, {
        oid: result.oid,
        coin,
        side,
        price,
        size: qty,
        placedAt: Date.now(),
        assetIndex: inv.assetIndex,
      });
    }

    if (result.success && result.avgPx) {
      const fillPx = parseFloat(result.avgPx);
      this.recordFill(coin, side, qty, fillPx, inv.assetIndex);
      this.dailyStats.fills++;
      this.dailyStats.volume += notional;
      this.activeQuotes.delete(coin);
    }
  }

  private async marketUnwind(
    coin: string,
    inv: InventoryEntry,
    book: L2Snapshot,
  ): Promise<void> {
    const qty = Math.abs(inv.netQty);
    const isBuy = inv.netQty < 0;
    const slippage = isBuy ? 1.003 : 0.997;
    const price = book.midPrice * slippage;
    const sizeStr = this.roundSize(qty, coin);
    const priceStr = this.roundPrice(price);

    if (parseFloat(sizeStr) === 0) return;
    const notional = parseFloat(sizeStr) * parseFloat(priceStr);
    if (notional < 10) return;

    console.log(`[rebate-farmer] URGENT unwind ${coin}: ${isBuy ? "BUY" : "SELL"} ${sizeStr} @ ${priceStr}`);

    const result = await placeOrder({
      coin,
      isBuy,
      size: sizeStr,
      price: priceStr,
      tif: "Ioc", // taker order for urgent unwind
      assetIndex: inv.assetIndex,
    });

    if (result.success && result.avgPx) {
      const fillPx = parseFloat(result.avgPx);
      this.recordFill(coin, isBuy ? "buy" : "sell", qty, fillPx, inv.assetIndex);
      this.dailyStats.fills++;
      this.dailyStats.volume += notional;
      // Extra fee for taker
      this.dailyStats.fees += notional * 0.00045;
    }
  }

  // ------------------------------------------------------------------
  // Fill detection via position polling
  // ------------------------------------------------------------------

  /**
   * Called externally (by engine or a timer) to reconcile fills.
   * Since Alo orders rest on the book, we detect fills by checking
   * if our resting orders are gone + our position changed.
   */
  async reconcileFills(): Promise<void> {
    if (this.activeQuotes.size === 0) return;

    try {
      const positions = await fetchPositions();
      const posMap = new Map<string, number>();
      for (const p of positions) {
        const szi = parseFloat(p.position.szi);
        if (szi !== 0) posMap.set(p.position.coin, szi);
      }

      for (const [coin, quote] of this.activeQuotes) {
        const hlQty = posMap.get(coin) ?? 0;
        const invQty = this.inventory.get(coin)?.netQty ?? 0;
        const expectedQtyIfFilled = invQty + (quote.side === "buy" ? quote.size : -quote.size);

        // If HL position matches what we'd expect after a fill, the order was filled
        const tolerance = quote.size * 0.01;
        if (Math.abs(hlQty - expectedQtyIfFilled) < tolerance) {
          console.log(`[rebate-farmer] FILL detected: ${quote.side} ${coin} ${quote.size} @ ~${quote.price.toFixed(2)}`);
          this.recordFill(coin, quote.side, quote.size, quote.price, quote.assetIndex);
          this.activeQuotes.delete(coin);
          this.dailyStats.fills++;
          this.dailyStats.volume += quote.size * quote.price;
          this.dailyStats.fees += (quote.size * quote.price) * 0.00015; // maker fee
        }
      }
    } catch (e) {
      console.error("[rebate-farmer] reconcile error:", (e as Error).message);
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private getTotalExposureUsd(refPrice: number, excludeCoin?: string): number {
    let total = 0;
    for (const [coin, inv] of this.inventory) {
      if (coin === excludeCoin) continue;
      const px = this.priceFeed.getPrice(coin) ?? inv.avgEntryPx;
      total += Math.abs(inv.netQty) * px;
    }
    // Also count active quotes as potential exposure
    for (const [coin, quote] of this.activeQuotes) {
      if (coin === excludeCoin) continue;
      total += quote.size * quote.price;
    }
    return total;
  }

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
        const asset = meta.universe[i];
        this.assetIndices.set(asset.name, i);
        this.szDecimalsMap.set(asset.name, asset.szDecimals);
      }

      const found = this.config.coins.filter((c) => this.assetIndices.has(c));
      const missing = this.config.coins.filter((c) => !this.assetIndices.has(c));
      console.log(`[rebate-farmer] Loaded ${found.length} coins: ${found.join(", ")}`);
      if (missing.length > 0) {
        console.warn(`[rebate-farmer] Missing coins (removed): ${missing.join(", ")}`);
        this.config.coins = found;
      }
    } catch (e) {
      console.error("[rebate-farmer] Failed to load asset meta:", (e as Error).message);
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
  // Stats & logging
  // ------------------------------------------------------------------

  private maybeResetDailyStats(): void {
    const day = new Date().getUTCDate();
    if (day !== this.statsResetDay) {
      if (this.statsResetDay !== -1) this.logDailyStats();
      this.resetDailyStats();
    }
  }

  private resetDailyStats(): void {
    this.dailyStats = { fills: 0, cancels: 0, roundTrips: 0, grossPnl: 0, fees: 0, volume: 0 };
    this.dailyLoss = 0;
    this.statsResetDay = new Date().getUTCDate();
  }

  private logDailyStats(): void {
    const s = this.dailyStats;
    const netPnl = s.grossPnl - s.fees;
    console.log(
      `[rebate-farmer] Daily summary: ` +
      `${s.fills} fills, ${s.roundTrips} round-trips, ${s.cancels} cancels | ` +
      `volume $${s.volume.toFixed(0)} | gross $${s.grossPnl.toFixed(4)} | ` +
      `fees $${s.fees.toFixed(4)} | net $${netPnl.toFixed(4)}`,
    );

    // Log to Supabase
    this.supabase.from("ai_agent_logs").insert({
      action: "rebate_farmer_daily",
      details: {
        ...s,
        netPnl,
        coins: this.config.coins,
        date: new Date().toISOString().split("T")[0],
      },
    }).then(() => {}).catch(() => {});
  }

  /** Periodic status log (call from engine every N ticks) */
  logStatus(): void {
    const s = this.dailyStats;
    const netPnl = s.grossPnl - s.fees;
    const invCoins = [...this.inventory.entries()]
      .filter(([, v]) => Math.abs(v.netQty) > 0)
      .map(([coin, v]) => `${coin}:${v.netQty > 0 ? "+" : ""}${v.netQty.toFixed(4)}`);

    console.log(
      `[rebate-farmer] Status: ${s.fills} fills / ${s.roundTrips} RTs / $${s.volume.toFixed(0)} vol / ` +
      `net $${netPnl.toFixed(4)} | quotes: ${this.activeQuotes.size} | inv: [${invCoins.join(", ")}]`,
    );
  }

  get isRunning(): boolean {
    return this.running;
  }

  get stats(): CycleStats {
    return { ...this.dailyStats };
  }
}
