/**
 * TWAP (Time-Weighted Average Price) execution engine.
 *
 * Splits a large order into smaller slices executed over a time window,
 * minimizing market impact. Used by the quant engine for large position entries/exits.
 */

import { placeOrder } from "./executor";
import type { OrderRequest, OrderResult } from "./types";

export interface TWAPConfig {
  /** Total duration in milliseconds */
  durationMs: number;
  /** Number of slices to split order into */
  slices: number;
  /** Max slippage per slice (bps) */
  maxSlippageBps: number;
  /** Randomize timing ±20% to avoid detection */
  randomize: boolean;
  /** Price fetcher: returns current mark price for the asset */
  getMarkPrice: () => Promise<number>;
}

export interface TWAPOrder {
  coin: string;
  isBuy: boolean;
  totalSize: number;
  assetIndex: number;
  config: TWAPConfig;
}

export interface TWAPResult {
  success: boolean;
  filledSize: number;
  avgPrice: number;
  sliceResults: SliceResult[];
  totalDurationMs: number;
  error?: string;
}

interface SliceResult {
  sliceIndex: number;
  size: number;
  price: string;
  result: OrderResult;
  timestamp: number;
}

const activeOrders = new Map<string, { cancel: () => void }>();

function hlRoundPrice(price: number): string {
  if (price >= 100_000) return (Math.round(price / 10) * 10).toString();
  if (price >= 10_000) return Math.round(price).toString();
  if (price >= 1_000) return (Math.round(price * 10) / 10).toFixed(1);
  if (price >= 100) return (Math.round(price * 100) / 100).toFixed(2);
  if (price >= 10) return (Math.round(price * 1000) / 1000).toFixed(3);
  if (price >= 1) return (Math.round(price * 10000) / 10000).toFixed(4);
  return (Math.round(price * 100000) / 100000).toFixed(5);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeTWAP(order: TWAPOrder): Promise<TWAPResult> {
  const { coin, isBuy, totalSize, assetIndex, config } = order;
  const { durationMs, slices, maxSlippageBps, randomize, getMarkPrice } = config;

  const sliceSize = totalSize / slices;
  const intervalMs = durationMs / slices;
  const sliceResults: SliceResult[] = [];
  let cancelled = false;
  let filledSize = 0;
  let totalCost = 0;

  const orderKey = `${coin}-${isBuy ? "buy" : "sell"}-${Date.now()}`;
  activeOrders.set(orderKey, { cancel: () => { cancelled = true; } });

  const startTime = Date.now();

  try {
    for (let i = 0; i < slices; i++) {
      if (cancelled) break;

      const markPrice = await getMarkPrice();
      const slippage = isBuy ? 1 + maxSlippageBps / 10000 : 1 - maxSlippageBps / 10000;
      const limitPrice = hlRoundPrice(markPrice * slippage);
      const remainingSize = totalSize - filledSize;
      const thisSliceSize = Math.min(sliceSize, remainingSize);

      if (thisSliceSize <= 0) break;

      const result = await placeOrder({
        coin,
        isBuy,
        size: thisSliceSize.toFixed(4),
        price: limitPrice,
        reduceOnly: false,
        tif: "Ioc",
        assetIndex,
      });

      const sliceResult: SliceResult = {
        sliceIndex: i,
        size: thisSliceSize,
        price: limitPrice,
        result,
        timestamp: Date.now(),
      };
      sliceResults.push(sliceResult);

      if (result.success && result.avgPx) {
        const fillPrice = parseFloat(result.avgPx);
        filledSize += thisSliceSize;
        totalCost += thisSliceSize * fillPrice;
        console.log(
          `[TWAP] ${coin} slice ${i + 1}/${slices}: ${thisSliceSize.toFixed(4)} @ $${fillPrice}`,
        );
      } else {
        console.log(
          `[TWAP] ${coin} slice ${i + 1}/${slices}: MISSED (${result.error ?? "no fill"})`,
        );
      }

      if (i < slices - 1 && !cancelled) {
        let waitMs = intervalMs;
        if (randomize) {
          const jitter = intervalMs * 0.2;
          waitMs += (Math.random() - 0.5) * 2 * jitter;
        }
        await sleep(Math.max(waitMs, 1000));
      }
    }
  } finally {
    activeOrders.delete(orderKey);
  }

  return {
    success: filledSize > 0,
    filledSize,
    avgPrice: filledSize > 0 ? totalCost / filledSize : 0,
    sliceResults,
    totalDurationMs: Date.now() - startTime,
  };
}

export function cancelTWAP(orderKey: string): boolean {
  const order = activeOrders.get(orderKey);
  if (order) {
    order.cancel();
    return true;
  }
  return false;
}

export function getActiveTWAPOrders(): string[] {
  return Array.from(activeOrders.keys());
}

/**
 * Smart execution: choose IOC for small orders, TWAP for large ones.
 * Threshold is configurable but defaults to $500 notional.
 */
export async function smartExecute(params: {
  coin: string;
  isBuy: boolean;
  size: number;
  price: number;
  assetIndex: number;
  getMarkPrice: () => Promise<number>;
  twapThresholdUsd?: number;
}): Promise<OrderResult & { executionType: "ioc" | "twap"; avgPrice?: number }> {
  const notional = params.size * params.price;
  const threshold = params.twapThresholdUsd ?? 500;

  if (notional < threshold) {
    const slippage = params.isBuy ? 1.005 : 0.995;
    const result = await placeOrder({
      coin: params.coin,
      isBuy: params.isBuy,
      size: params.size.toFixed(4),
      price: hlRoundPrice(params.price * slippage),
      reduceOnly: false,
      tif: "Ioc",
      assetIndex: params.assetIndex,
    });
    return {
      ...result,
      executionType: "ioc",
      avgPrice: result.avgPx ? parseFloat(result.avgPx) : undefined,
    };
  }

  const slices = Math.min(Math.max(Math.ceil(notional / 200), 3), 20);
  const durationMs = slices * 5000;

  const twapResult = await executeTWAP({
    coin: params.coin,
    isBuy: params.isBuy,
    totalSize: params.size,
    assetIndex: params.assetIndex,
    config: {
      durationMs,
      slices,
      maxSlippageBps: 30,
      randomize: true,
      getMarkPrice: params.getMarkPrice,
    },
  });

  return {
    success: twapResult.success,
    error: twapResult.error,
    executionType: "twap",
    avgPrice: twapResult.avgPrice,
  };
}
