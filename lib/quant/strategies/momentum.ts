import type { StrategySignal, QuantStrategy, TickContext } from "../types";
import { ema, rsi } from "../indicators";

export interface MomentumConfig {
  coins: string[];
  fastPeriod: number;        // EMA fast (default 9)
  slowPeriod: number;        // EMA slow (default 21)
  rsiPeriod: number;         // RSI period (default 14)
  rsiBuyThreshold: number;   // RSI > this for long (default 50)
  rsiSellThreshold: number;  // RSI < this for short (default 50)
  trailingStopPct: number;   // trailing stop (default 0.005)
  positionSizePct: number;   // % of account (default 0.05)
  leverage: number;          // leverage (default 5)
}

const DEFAULT_CONFIG: MomentumConfig = {
  coins: ["BTC", "ETH", "SOL", "SPY", "QQQ", "HOOD"],
  fastPeriod: 9,
  slowPeriod: 21,
  rsiPeriod: 14,
  rsiBuyThreshold: 50,
  rsiSellThreshold: 50,
  trailingStopPct: 0.005,
  positionSizePct: 0.10,
  leverage: 3,
};

export interface CandleData {
  coin: string;
  closes: number[];
  assetIndex: number;
  currentPrice: number;
}

const previousSignals: Map<string, "long" | "short" | null> = new Map();

export function evaluate(
  strategy: QuantStrategy,
  candles: CandleData[],
  ctx: TickContext,
): StrategySignal[] {
  const cfg: MomentumConfig = { ...DEFAULT_CONFIG, ...(strategy.config as Partial<MomentumConfig>) };
  const signals: StrategySignal[] = [];

  for (const data of candles) {
    if (!cfg.coins.includes(data.coin)) continue;
    if (data.closes.length < cfg.slowPeriod + 2) continue;

    const emaFast = ema(data.closes, cfg.fastPeriod);
    const emaSlow = ema(data.closes, cfg.slowPeriod);
    const rsiValues = rsi(data.closes, cfg.rsiPeriod);

    const lastFast = emaFast[emaFast.length - 1];
    const prevFast = emaFast[emaFast.length - 2];
    const lastSlow = emaSlow[emaSlow.length - 1];
    const prevSlow = emaSlow[emaSlow.length - 2];
    const lastRsi = rsiValues[rsiValues.length - 1];

    if (isNaN(lastRsi) || isNaN(lastFast) || isNaN(lastSlow)) continue;

    const prevSignal = previousSignals.get(data.coin) ?? null;
    let newSignal: "long" | "short" | null = null;

    // Bullish crossover: fast crosses above slow + RSI confirms
    const bullishCross = prevFast <= prevSlow && lastFast > lastSlow;
    if (bullishCross && lastRsi > cfg.rsiBuyThreshold) {
      newSignal = "long";
    }

    // Bearish crossover: fast crosses below slow + RSI confirms
    const bearishCross = prevFast >= prevSlow && lastFast < lastSlow;
    if (bearishCross && lastRsi < cfg.rsiSellThreshold) {
      newSignal = "short";
    }

    if (newSignal && newSignal !== prevSignal) {
      // Close opposite position first
      const existingPos = ctx.positions.find((p) => p.coin === data.coin);
      if (existingPos && Math.abs(existingPos.szi) > 0) {
        const isCurrentlyLong = existingPos.szi > 0;
        if ((isCurrentlyLong && newSignal === "short") || (!isCurrentlyLong && newSignal === "long")) {
          signals.push({
            coin: data.coin,
            side: isCurrentlyLong ? "short" : "long",
            size: 0,
            price: data.currentPrice,
            assetIndex: data.assetIndex,
            reason: `MOM close: reversing from ${isCurrentlyLong ? "long" : "short"}`,
          });
        }
      }

      const positionValue = ctx.accountValue * cfg.positionSizePct * cfg.leverage;
      const size = positionValue / data.currentPrice;
      const stopLoss = newSignal === "long"
        ? data.currentPrice * (1 - cfg.trailingStopPct)
        : data.currentPrice * (1 + cfg.trailingStopPct);

      signals.push({
        coin: data.coin,
        side: newSignal,
        size,
        price: data.currentPrice,
        assetIndex: data.assetIndex,
        reason: `MOM ${newSignal}: EMA${cfg.fastPeriod}=${lastFast.toFixed(2)} x EMA${cfg.slowPeriod}=${lastSlow.toFixed(2)}, RSI=${lastRsi.toFixed(1)}`,
        stopLoss,
      });

      previousSignals.set(data.coin, newSignal);
    }
  }

  return signals;
}

export function resetState(): void {
  previousSignals.clear();
}
