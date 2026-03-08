import type { Strategy, GridConfig, TradeLog } from "../types";
import type { MarketInfo } from "@/lib/hyperliquid/types";
import { signAndPlaceOrder } from "@/lib/hyperliquid/signing";

interface GridLevel {
  price: number;
  filled: boolean;
  side: "buy" | "sell";
}

const activeGrids = new Map<string, GridLevel[]>();

export function getGridLevels(strategyId: string): GridLevel[] {
  return activeGrids.get(strategyId) ?? [];
}

function buildGridLevels(config: GridConfig): GridLevel[] {
  const levels: GridLevel[] = [];
  const step = (config.upperPrice - config.lowerPrice) / config.gridCount;
  for (let i = 0; i <= config.gridCount; i++) {
    const price = config.lowerPrice + step * i;
    levels.push({ price, filled: false, side: "buy" });
  }
  return levels;
}

function priceToWire(price: number): string {
  const rounded = parseFloat(price.toPrecision(5));
  if (rounded === Math.round(rounded)) return rounded.toFixed(1);
  return rounded.toString();
}

export async function evaluateGrid(
  strategy: Strategy,
  markets: MarketInfo[],
): Promise<{ executed: boolean; log?: TradeLog }> {
  const config = strategy.config as GridConfig;
  const market = markets.find((m) => m.name === config.coin);
  if (!market) {
    return { executed: false, log: makeLog(strategy, "error", `Market ${config.coin} not found`) };
  }

  const markPx = parseFloat(market.markPx);
  if (!markPx) return { executed: false };

  if (!activeGrids.has(strategy.id)) {
    activeGrids.set(strategy.id, buildGridLevels(config));
  }
  const levels = activeGrids.get(strategy.id)!;

  for (const level of levels) {
    if (level.filled) continue;

    const shouldBuy = markPx <= level.price && level.side === "buy";
    const shouldSell = markPx >= level.price && level.side === "sell";

    if (shouldBuy || shouldSell) {
      const isBuy = shouldBuy;
      const result = await signAndPlaceOrder({
        coin: config.coin,
        isBuy,
        price: priceToWire(level.price),
        size: config.orderSize.toString(),
        orderType: "limit",
        markets,
      });

      if (result.success) {
        level.filled = true;
        level.side = isBuy ? "sell" : "buy";
        level.filled = false;

        return {
          executed: true,
          log: makeLog(
            strategy, "order",
            `Grid ${isBuy ? "buy" : "sell"} ${config.orderSize} ${config.coin} @ $${level.price.toFixed(2)}`,
            { coin: config.coin, side: isBuy ? "buy" : "sell", price: level.price, size: config.orderSize },
          ),
        };
      }
      return { executed: false, log: makeLog(strategy, "error", `Grid order failed: ${result.error}`) };
    }
  }

  return { executed: false };
}

export function resetGrid(strategyId: string) {
  activeGrids.delete(strategyId);
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
