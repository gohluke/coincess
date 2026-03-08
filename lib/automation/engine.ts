import type { Strategy, TradeLog } from "./types";
import { getAllStrategies, putStrategy, addTradeLog } from "./storage";
import { fetchAllMarkets } from "@/lib/hyperliquid/api";
import type { MarketInfo } from "@/lib/hyperliquid/types";
import { evaluateDCA } from "./strategies/dca";
import { evaluateGrid, resetGrid } from "./strategies/grid";
import { evaluateTrailingStop, resetTrailingStop } from "./strategies/trailing-stop";

const TICK_INTERVAL = 5_000;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let marketCache: MarketInfo[] = [];
let lastMarketFetch = 0;
const MARKET_CACHE_TTL = 10_000;

let onUpdate: (() => void) | null = null;

export function setEngineUpdateCallback(cb: () => void) {
  onUpdate = cb;
}

async function getMarkets(): Promise<MarketInfo[]> {
  if (Date.now() - lastMarketFetch > MARKET_CACHE_TTL || marketCache.length === 0) {
    try {
      marketCache = await fetchAllMarkets();
      lastMarketFetch = Date.now();
    } catch (err) {
      console.error("[engine] Failed to fetch markets:", err);
    }
  }
  return marketCache;
}

export function getCachedMarkets(): MarketInfo[] {
  return marketCache;
}

async function evaluateStrategy(strategy: Strategy, markets: MarketInfo[]): Promise<void> {
  if (strategy.status !== "active") return;

  let result: { executed: boolean; log?: TradeLog } = { executed: false };

  try {
    switch (strategy.type) {
      case "dca":
        result = await evaluateDCA(strategy, markets);
        break;
      case "grid":
        result = await evaluateGrid(strategy, markets);
        break;
      case "trailing_stop":
        result = await evaluateTrailingStop(strategy, markets);
        break;
      case "prediction_auto_bet": {
        const { evaluatePredictionBet } = await import("./strategies/prediction-auto-bet");
        result = await evaluatePredictionBet(strategy);
        break;
      }
      case "prediction_exit": {
        const { evaluatePredictionExit } = await import("./strategies/prediction-exit");
        result = await evaluatePredictionExit(strategy);
        break;
      }
      case "copy_trade": {
        const { evaluateCopyTrade } = await import("./strategies/copy-trade");
        result = await evaluateCopyTrade(strategy, markets);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    result = {
      executed: false,
      log: {
        id: `${strategy.id}-${Date.now()}-err`,
        strategyId: strategy.id,
        timestamp: Date.now(),
        type: "error",
        platform: strategy.platform,
        details: `Unhandled error: ${(err as Error).message}`,
      },
    };
    strategy.status = "error";
    strategy.errorMessage = (err as Error).message;
  }

  if (result.log) {
    await addTradeLog(result.log);
  }

  if (result.executed) {
    strategy.lastExecutedAt = Date.now();
    strategy.totalTrades += 1;
    strategy.updatedAt = Date.now();
  }

  if (strategy.status === "error" || result.executed) {
    await putStrategy(strategy);
    onUpdate?.();
  }
}

async function tick() {
  const strategies = await getAllStrategies();
  const active = strategies.filter((s) => s.status === "active");
  if (active.length === 0) return;

  const markets = await getMarkets();

  for (const strategy of active) {
    await evaluateStrategy(strategy, markets);
  }
}

export function startEngine() {
  if (tickTimer) return;
  tick();
  tickTimer = setInterval(tick, TICK_INTERVAL);
}

export function stopEngine() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

export function isEngineRunning(): boolean {
  return tickTimer !== null;
}

export function cleanupStrategy(strategyId: string) {
  resetGrid(strategyId);
  resetTrailingStop(strategyId);
}
