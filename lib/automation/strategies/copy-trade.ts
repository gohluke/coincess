import type { Strategy, CopyTradeConfig, TradeLog } from "../types";
import type { MarketInfo } from "@/lib/hyperliquid/types";
import { fetchClearinghouseState } from "@/lib/hyperliquid/api";
import { signAndPlaceOrder, getMarketOrderPrice } from "@/lib/hyperliquid/signing";
import type { AssetPosition } from "@/lib/hyperliquid/types";

// Track previously seen positions for each copy strategy
const previousPositions = new Map<string, Map<string, number>>();

function positionSize(ap: AssetPosition): number {
  return parseFloat(ap.position.szi);
}

export async function evaluateCopyTrade(
  strategy: Strategy,
  markets: MarketInfo[],
): Promise<{ executed: boolean; log?: TradeLog }> {
  const config = strategy.config as CopyTradeConfig;
  const now = Date.now();

  // Only poll every 15 seconds to avoid rate limits
  if (strategy.lastExecutedAt && now - strategy.lastExecutedAt < 15_000) {
    return { executed: false };
  }

  let targetState;
  try {
    targetState = await fetchClearinghouseState(config.targetAddress);
  } catch {
    return { executed: false };
  }

  const currentPositions = new Map<string, number>();
  for (const ap of targetState.assetPositions) {
    const size = positionSize(ap);
    if (size !== 0) {
      currentPositions.set(ap.position.coin, size);
    }
  }

  if (!previousPositions.has(strategy.id)) {
    // First tick: snapshot current state, don't trade
    previousPositions.set(strategy.id, currentPositions);
    return {
      executed: true,
      log: makeLog(strategy, "info", `Snapshot: tracking ${currentPositions.size} positions from ${config.targetLabel || config.targetAddress.slice(0, 10)}…`),
    };
  }

  const prev = previousPositions.get(strategy.id)!;
  let traded = false;
  let lastLog: TradeLog | undefined;

  for (const [coin, newSize] of currentPositions) {
    const oldSize = prev.get(coin) ?? 0;
    const delta = newSize - oldSize;

    if (Math.abs(delta) < 0.0001) continue;

    if (config.allowedCoins && !config.allowedCoins.includes(coin)) continue;
    if (config.excludedCoins?.includes(coin)) continue;

    const market = markets.find((m) => m.name === coin);
    if (!market) continue;

    const markPx = parseFloat(market.markPx);
    if (!markPx) continue;

    const copySize = Math.abs(delta) * config.sizeMultiplier;
    const copyUsd = copySize * markPx;
    if (config.maxPositionUsd && copyUsd > config.maxPositionUsd) continue;

    const isBuy = delta > 0;
    const price = getMarketOrderPrice(isBuy, markPx);

    const result = await signAndPlaceOrder({
      coin,
      isBuy,
      price,
      size: copySize.toFixed(market.szDecimals),
      orderType: "market",
      markets,
    });

    lastLog = makeLog(
      strategy,
      result.success ? "order" : "error",
      result.success
        ? `Copy ${isBuy ? "buy" : "sell"} ${copySize.toFixed(4)} ${coin} @ ~$${markPx.toFixed(2)} (mirroring ${config.targetLabel || config.targetAddress.slice(0, 8)})`
        : `Copy trade failed for ${coin}: ${result.error}`,
      { coin, side: isBuy ? "buy" : "sell", price: markPx, size: copySize },
    );

    if (result.success) traded = true;
  }

  // Check for closed positions
  for (const [coin, oldSize] of prev) {
    if (!currentPositions.has(coin) && Math.abs(oldSize) > 0.0001) {
      const market = markets.find((m) => m.name === coin);
      if (!market) continue;

      if (config.allowedCoins && !config.allowedCoins.includes(coin)) continue;
      if (config.excludedCoins?.includes(coin)) continue;

      const markPx = parseFloat(market.markPx);
      if (!markPx) continue;

      const copySize = Math.abs(oldSize) * config.sizeMultiplier;
      const isBuy = oldSize < 0; // close short = buy, close long = sell

      const result = await signAndPlaceOrder({
        coin,
        isBuy,
        price: getMarketOrderPrice(isBuy, markPx),
        size: copySize.toFixed(market.szDecimals),
        orderType: "market",
        reduceOnly: true,
        markets,
      });

      lastLog = makeLog(
        strategy,
        result.success ? "order" : "error",
        result.success
          ? `Copy close ${coin} position (${copySize.toFixed(4)} @ ~$${markPx.toFixed(2)})`
          : `Copy close failed for ${coin}: ${result.error}`,
      );
      if (result.success) traded = true;
    }
  }

  previousPositions.set(strategy.id, currentPositions);
  return { executed: traded || true, log: lastLog };
}

export function resetCopyTrade(strategyId: string) {
  previousPositions.delete(strategyId);
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
