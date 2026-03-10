import type { StrategySignal, QuantStrategy, TickContext } from "../types";
import { rsi } from "../indicators";

export interface MeanReversionConfig {
  rsiPeriod: number;         // RSI calculation period (default 14)
  oversoldThreshold: number; // RSI < this -> long (default 25)
  overboughtThreshold: number; // RSI > this -> short (default 75)
  exitLow: number;           // RSI exits below (default 40)
  exitHigh: number;          // RSI exits above (default 60)
  stopLossPct: number;       // stop loss (default 0.015)
  positionSizePct: number;   // % of account (default 0.03)
  leverage: number;          // leverage (default 3)
  topCoins: number;          // how many coins to monitor (default 20)
}

const DEFAULT_CONFIG: MeanReversionConfig = {
  rsiPeriod: 14,
  oversoldThreshold: 25,
  overboughtThreshold: 75,
  exitLow: 40,
  exitHigh: 60,
  stopLossPct: 0.015,
  positionSizePct: 0.08,
  leverage: 3,
  topCoins: 20,
};

export interface CoinCandles {
  coin: string;
  closes: number[];
  assetIndex: number;
  currentPrice: number;
  volume24h: number;
}

const activeMrPositions: Map<string, "long" | "short"> = new Map();

export function evaluate(
  strategy: QuantStrategy,
  coinsData: CoinCandles[],
  ctx: TickContext,
): StrategySignal[] {
  const cfg: MeanReversionConfig = { ...DEFAULT_CONFIG, ...(strategy.config as Partial<MeanReversionConfig>) };
  const signals: StrategySignal[] = [];

  // Sort by volume to focus on top liquid coins
  const sorted = [...coinsData]
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, cfg.topCoins);

  for (const data of sorted) {
    if (data.closes.length < cfg.rsiPeriod + 2) continue;

    const rsiValues = rsi(data.closes, cfg.rsiPeriod);
    const lastRsi = rsiValues[rsiValues.length - 1];
    if (isNaN(lastRsi)) continue;

    const existingDirection = activeMrPositions.get(data.coin);
    const existingPos = ctx.positions.find((p) => p.coin === data.coin);

    // Exit logic: RSI returns to normal zone
    if (existingDirection && existingPos && Math.abs(existingPos.szi) > 0) {
      const shouldExit =
        (existingDirection === "long" && lastRsi >= cfg.exitLow && lastRsi <= cfg.exitHigh) ||
        (existingDirection === "short" && lastRsi >= cfg.exitLow && lastRsi <= cfg.exitHigh);

      if (shouldExit) {
        signals.push({
          coin: data.coin,
          side: existingDirection === "long" ? "short" : "long",
          size: 0,
          price: data.currentPrice,
          assetIndex: data.assetIndex,
          reason: `MR exit: RSI=${lastRsi.toFixed(1)} back in [${cfg.exitLow},${cfg.exitHigh}]`,
        });
        activeMrPositions.delete(data.coin);
        continue;
      }
    }

    // Skip if already in a position for this coin
    if (existingDirection) continue;
    if (existingPos && Math.abs(existingPos.szi) > 0) continue;

    // Entry: oversold
    if (lastRsi < cfg.oversoldThreshold) {
      const positionValue = ctx.accountValue * cfg.positionSizePct * cfg.leverage;
      const size = positionValue / data.currentPrice;
      signals.push({
        coin: data.coin,
        side: "long",
        size,
        price: data.currentPrice,
        assetIndex: data.assetIndex,
        reason: `MR long: RSI=${lastRsi.toFixed(1)} < ${cfg.oversoldThreshold} (oversold)`,
        stopLoss: data.currentPrice * (1 - cfg.stopLossPct),
      });
      activeMrPositions.set(data.coin, "long");
    }

    // Entry: overbought
    if (lastRsi > cfg.overboughtThreshold) {
      const positionValue = ctx.accountValue * cfg.positionSizePct * cfg.leverage;
      const size = positionValue / data.currentPrice;
      signals.push({
        coin: data.coin,
        side: "short",
        size,
        price: data.currentPrice,
        assetIndex: data.assetIndex,
        reason: `MR short: RSI=${lastRsi.toFixed(1)} > ${cfg.overboughtThreshold} (overbought)`,
        stopLoss: data.currentPrice * (1 + cfg.stopLossPct),
      });
      activeMrPositions.set(data.coin, "short");
    }
  }

  return signals;
}

export function resetState(): void {
  activeMrPositions.clear();
}
