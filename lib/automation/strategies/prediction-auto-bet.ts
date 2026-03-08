import type { Strategy, PredictionBetConfig, TradeLog } from "../types";
import { fetchPrice } from "@/lib/polymarket/api";
import { placePolymarketOrder, hasPolymarketCredentials } from "@/lib/polymarket/trading";

export async function evaluatePredictionBet(
  strategy: Strategy,
): Promise<{ executed: boolean; log?: TradeLog }> {
  const config = strategy.config as PredictionBetConfig;

  if (!hasPolymarketCredentials()) {
    return {
      executed: false,
      log: makeLog(strategy, "error", "No Polymarket API credentials. Connect wallet on the Automate page."),
    };
  }

  let currentPrice: number;
  try {
    currentPrice = await fetchPrice(config.tokenId, "BUY");
  } catch {
    return { executed: false };
  }

  if (currentPrice > config.triggerPrice) {
    return { executed: false };
  }

  const size = config.betSize / currentPrice;

  const result = await placePolymarketOrder({
    tokenId: config.tokenId,
    side: "BUY",
    price: currentPrice,
    size,
  });

  return {
    executed: result.success,
    log: makeLog(
      strategy,
      result.success ? "order" : "error",
      result.success
        ? `Auto-bet: Buy ${config.outcome} on "${config.eventTitle.slice(0, 40)}" @ ${(currentPrice * 100).toFixed(1)}¢ ($${config.betSize})`
        : `Auto-bet failed: ${result.error}`,
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
