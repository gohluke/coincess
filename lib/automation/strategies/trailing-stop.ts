import type { Strategy, TrailingStopConfig, TradeLog } from "../types";
import type { MarketInfo } from "@/lib/hyperliquid/types";
import { signAndPlaceOrder, getMarketOrderPrice } from "@/lib/hyperliquid/signing";

// Track the highest (for long) or lowest (for short) price seen since activation
const peakPrices = new Map<string, number>();

export function getPeakPrice(strategyId: string): number | undefined {
  return peakPrices.get(strategyId);
}

export async function evaluateTrailingStop(
  strategy: Strategy,
  markets: MarketInfo[],
): Promise<{ executed: boolean; log?: TradeLog }> {
  const config = strategy.config as TrailingStopConfig;
  const market = markets.find((m) => m.name === config.coin);
  if (!market) {
    return { executed: false, log: makeLog(strategy, "error", `Market ${config.coin} not found`) };
  }

  const markPx = parseFloat(market.markPx);
  if (!markPx) return { executed: false };

  if (config.activationPrice) {
    if (config.side === "long" && markPx < config.activationPrice) return { executed: false };
    if (config.side === "short" && markPx > config.activationPrice) return { executed: false };
  }

  const peak = peakPrices.get(strategy.id);

  if (config.side === "long") {
    if (!peak || markPx > peak) {
      peakPrices.set(strategy.id, markPx);
      return { executed: false };
    }

    const stopPx = peak * (1 - config.trailPercent / 100);
    if (markPx <= stopPx) {
      const price = getMarketOrderPrice(false, markPx);
      const result = await signAndPlaceOrder({
        coin: config.coin,
        isBuy: false,
        price,
        size: config.size.toString(),
        orderType: "market",
        reduceOnly: true,
        markets,
      });

      peakPrices.delete(strategy.id);
      return {
        executed: result.success,
        log: makeLog(
          strategy,
          result.success ? "order" : "error",
          result.success
            ? `Trailing stop triggered: sell ${config.size} ${config.coin} @ ~$${markPx.toFixed(2)} (peak $${peak.toFixed(2)}, trail ${config.trailPercent}%)`
            : `Trailing stop failed: ${result.error}`,
          { coin: config.coin, side: "sell", price: markPx, size: config.size },
        ),
      };
    }
  } else {
    if (!peak || markPx < peak) {
      peakPrices.set(strategy.id, markPx);
      return { executed: false };
    }

    const stopPx = peak * (1 + config.trailPercent / 100);
    if (markPx >= stopPx) {
      const price = getMarketOrderPrice(true, markPx);
      const result = await signAndPlaceOrder({
        coin: config.coin,
        isBuy: true,
        price,
        size: config.size.toString(),
        orderType: "market",
        reduceOnly: true,
        markets,
      });

      peakPrices.delete(strategy.id);
      return {
        executed: result.success,
        log: makeLog(
          strategy,
          result.success ? "order" : "error",
          result.success
            ? `Trailing stop triggered: buy ${config.size} ${config.coin} @ ~$${markPx.toFixed(2)} (trough $${peak.toFixed(2)}, trail ${config.trailPercent}%)`
            : `Trailing stop failed: ${result.error}`,
          { coin: config.coin, side: "buy", price: markPx, size: config.size },
        ),
      };
    }
  }

  return { executed: false };
}

export function resetTrailingStop(strategyId: string) {
  peakPrices.delete(strategyId);
}

function makeLog(
  strategy: Strategy,
  type: TradeLog["type"],
  details: string,
  extra?: Partial<TradeLog>,
): TradeLog {
  return {
    id: `${strategy.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    strategyId: strategy.id,
    timestamp: Date.now(),
    type,
    platform: "hyperliquid",
    details,
    ...extra,
  };
}
