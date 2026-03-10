/**
 * Market Maker Strategy
 *
 * Posts bid/ask quotes around the mid price to capture the spread.
 * Optimized for low-liquidity HIP-3 stock tokens where spreads are wide.
 *
 * How it works:
 * 1. Quote bid and ask at configurable spread around mid price
 * 2. When a bid fills (we bought), post a sell at higher price
 * 3. When an ask fills (we sold), post a buy at lower price
 * 4. Inventory management: skew quotes when holding too much inventory
 * 5. Volatility adjustment: widen spread in high-vol, tighten in low-vol
 */

import type { StrategySignal, QuantStrategy, TickContext, MarketSnapshot } from "../types";

export interface MarketMakerConfig {
  coins: string[];
  spreadBps: number;       // base spread in bps (default 50 = 0.5%)
  sizePerQuoteUsd: number; // USD per quote (default 20)
  maxInventoryUsd: number; // max one-sided inventory (default 100)
  volatilityLookback: number; // candles for vol calc (default 20)
  inventorySkewFactor: number; // how much to skew on inventory (default 0.5)
  requoteThresholdPct: number; // requote if price moves this much (default 0.002)
}

const DEFAULT_CONFIG: MarketMakerConfig = {
  coins: ["TSLA", "AAPL", "MSFT", "HOOD", "META"],
  spreadBps: 50,
  sizePerQuoteUsd: 20,
  maxInventoryUsd: 100,
  volatilityLookback: 20,
  inventorySkewFactor: 0.5,
  requoteThresholdPct: 0.002,
};

interface MakerState {
  inventory: number;     // net position (positive = long, negative = short)
  lastMidPx: number;
  lastQuoteTime: number;
  recentPrices: number[];
  totalSpreadCaptured: number;
  roundTrips: number;
}

const makerStates: Map<string, MakerState> = new Map();

function getOrInitState(coin: string, midPx: number): MakerState {
  let state = makerStates.get(coin);
  if (!state) {
    state = {
      inventory: 0,
      lastMidPx: midPx,
      lastQuoteTime: 0,
      recentPrices: [],
      totalSpreadCaptured: 0,
      roundTrips: 0,
    };
    makerStates.set(coin, state);
  }
  return state;
}

function estimateVolatility(prices: number[]): number {
  if (prices.length < 5) return 0.01;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]));
  }
  return returns.reduce((s, r) => s + r, 0) / returns.length;
}

export function evaluate(
  strategy: QuantStrategy,
  markets: MarketSnapshot[],
  ctx: TickContext,
): StrategySignal[] {
  const raw = strategy.config as Record<string, unknown>;
  const cfg: MarketMakerConfig = {
    ...DEFAULT_CONFIG,
    coins: (raw.coins as string[]) ?? DEFAULT_CONFIG.coins,
    spreadBps: (raw.spreadBps as number) ?? DEFAULT_CONFIG.spreadBps,
    sizePerQuoteUsd: (raw.sizePerQuoteUsd as number) ?? DEFAULT_CONFIG.sizePerQuoteUsd,
    maxInventoryUsd: (raw.maxInventoryUsd as number) ?? DEFAULT_CONFIG.maxInventoryUsd,
    inventorySkewFactor: (raw.inventorySkewFactor as number) ?? DEFAULT_CONFIG.inventorySkewFactor,
  };

  const signals: StrategySignal[] = [];
  const now = Date.now();

  for (const market of markets) {
    if (!cfg.coins.includes(market.coin)) continue;
    if (market.markPx <= 0) continue;

    const state = getOrInitState(market.coin, market.markPx);

    // Track price history for volatility estimation
    state.recentPrices.push(market.markPx);
    if (state.recentPrices.length > cfg.volatilityLookback * 2) {
      state.recentPrices.splice(0, state.recentPrices.length - cfg.volatilityLookback * 2);
    }

    // Dynamic spread: widen on high vol, tighten on low vol
    const vol = estimateVolatility(state.recentPrices);
    const volMultiplier = Math.max(0.5, Math.min(3, vol / 0.005));
    const effectiveSpread = (cfg.spreadBps / 10000) * volMultiplier;

    // Inventory skew: if holding long, lower the ask (want to sell), raise the bid
    const inventoryValue = state.inventory * market.markPx;
    const inventoryRatio = cfg.maxInventoryUsd > 0
      ? inventoryValue / cfg.maxInventoryUsd
      : 0;
    const skew = inventoryRatio * cfg.inventorySkewFactor * effectiveSpread;

    const midPx = market.markPx;
    const bidPx = midPx * (1 - effectiveSpread / 2) - skew;
    const askPx = midPx * (1 + effectiveSpread / 2) - skew;
    const quoteSize = cfg.sizePerQuoteUsd / midPx;

    // Check if price has moved significantly since last quote
    const priceMoved = state.lastMidPx > 0
      ? Math.abs(midPx - state.lastMidPx) / state.lastMidPx
      : 1;

    const shouldRequote = priceMoved > cfg.requoteThresholdPct
      || now - state.lastQuoteTime > 60_000; // Requote every minute minimum

    if (!shouldRequote) continue;

    // Don't accumulate too much inventory
    const atMaxLong = inventoryValue >= cfg.maxInventoryUsd;
    const atMaxShort = inventoryValue <= -cfg.maxInventoryUsd;

    // Post bid (buy order) if not at max long inventory
    if (!atMaxLong) {
      signals.push({
        coin: market.coin,
        side: "long",
        size: quoteSize,
        price: bidPx,
        assetIndex: market.assetIndex,
        reason: `MM bid: spread=${(effectiveSpread * 10000).toFixed(0)}bps, inv=${inventoryValue.toFixed(0)}`,
      });
    }

    // Post ask (sell order) if not at max short inventory
    // For HIP-3 spot, we can only sell if we hold tokens
    if (!atMaxShort && (market.dex === "perp" || state.inventory > 0)) {
      signals.push({
        coin: market.coin,
        side: "short",
        size: quoteSize,
        price: askPx,
        assetIndex: market.assetIndex,
        reason: `MM ask: spread=${(effectiveSpread * 10000).toFixed(0)}bps, inv=${inventoryValue.toFixed(0)}`,
      });
    }

    state.lastMidPx = midPx;
    state.lastQuoteTime = now;
  }

  return signals;
}

/** Update inventory after a fill */
export function updateInventory(coin: string, side: "long" | "short", size: number): void {
  const state = makerStates.get(coin);
  if (!state) return;
  if (side === "long") state.inventory += size;
  else state.inventory -= size;
}

export function resetState(): void {
  makerStates.clear();
}

export function getState(coin: string): MakerState | undefined {
  return makerStates.get(coin);
}
