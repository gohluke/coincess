import type { Strategy, DCAConfig, TradeLog } from "../types";
import type { MarketInfo } from "@/lib/hyperliquid/types";
import { signAndPlaceOrder, getMarketOrderPrice } from "@/lib/hyperliquid/signing";

export async function evaluateDCA(
  strategy: Strategy,
  markets: MarketInfo[],
): Promise<{ executed: boolean; log?: TradeLog }> {
  const config = strategy.config as DCAConfig;
  const now = Date.now();

  if (config.totalOrders && strategy.totalTrades >= config.totalOrders) {
    return { executed: false };
  }

  const shouldExecute = !strategy.lastExecutedAt || now >= (strategy.lastExecutedAt + config.intervalMs);
  if (!shouldExecute) return { executed: false };

  const market = markets.find((m) => m.name === config.coin);
  if (!market) {
    return {
      executed: false,
      log: makeLog(strategy, "error", `Market ${config.coin} not found`),
    };
  }

  const markPx = parseFloat(market.markPx);
  if (!markPx) return { executed: false };

  if (config.priceLimit) {
    if (config.side === "buy" && markPx > config.priceLimit) return { executed: false };
    if (config.side === "sell" && markPx < config.priceLimit) return { executed: false };
  }

  const size = config.amountUsd / markPx;
  const price = getMarketOrderPrice(config.side === "buy", markPx);

  const result = await signAndPlaceOrder({
    coin: config.coin,
    isBuy: config.side === "buy",
    price,
    size: size.toString(),
    orderType: "market",
    markets,
  });

  const log = makeLog(
    strategy,
    result.success ? "order" : "error",
    result.success
      ? `DCA ${config.side} ${size.toFixed(4)} ${config.coin} @ ~$${markPx.toFixed(2)}`
      : `DCA failed: ${result.error}`,
    { coin: config.coin, side: config.side, price: markPx, size },
  );

  return { executed: result.success, log };
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
