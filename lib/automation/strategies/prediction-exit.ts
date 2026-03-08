import type { Strategy, PredictionExitConfig, TradeLog } from "../types";
import { placePolymarketOrder, hasPolymarketCredentials } from "@/lib/polymarket/trading";
import { fetchPrice } from "@/lib/polymarket/api";

export async function evaluatePredictionExit(
  strategy: Strategy,
): Promise<{ executed: boolean; log?: TradeLog }> {
  const config = strategy.config as PredictionExitConfig;

  if (!hasPolymarketCredentials()) {
    return {
      executed: false,
      log: makeLog(strategy, "error", "No Polymarket API credentials."),
    };
  }

  const endTime = new Date(config.endDate).getTime();
  const now = Date.now();
  const timeUntilEnd = endTime - now;

  if (timeUntilEnd > config.exitBeforeMs) {
    return { executed: false };
  }

  if (timeUntilEnd <= 0) {
    return {
      executed: false,
      log: makeLog(strategy, "info", `Market already ended for "${config.eventTitle?.slice(0, 40)}"`),
    };
  }

  let currentPrice: number;
  try {
    currentPrice = await fetchPrice(config.tokenId, "SELL");
  } catch {
    return { executed: false };
  }

  // Sell position at current price
  const result = await placePolymarketOrder({
    tokenId: config.tokenId,
    side: "SELL",
    price: currentPrice,
    size: 1, // placeholder — real flow would check actual position size
  });

  return {
    executed: result.success,
    log: makeLog(
      strategy,
      result.success ? "order" : "error",
      result.success
        ? `Auto-exit: Sold position on "${config.eventTitle?.slice(0, 40)}" @ ${(currentPrice * 100).toFixed(1)}¢ (${Math.round(timeUntilEnd / 60_000)}m before close)`
        : `Auto-exit failed: ${result.error}`,
    ),
  };
}

function makeLog(strategy: Strategy, type: TradeLog["type"], details: string): TradeLog {
  return {
    id: `${strategy.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    strategyId: strategy.id,
    timestamp: Date.now(),
    type,
    platform: "polymarket",
    details,
  };
}
