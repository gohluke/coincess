import type { StrategySignal, QuantStrategy, TickContext, MarketSnapshot } from "../types";

export interface FundingRateConfig {
  entryThreshold: number;    // abs funding rate to enter (default 0.0001 = 0.01%/hr)
  exitThreshold: number;     // abs funding rate to exit (default 0.00005)
  maxHoldHours: number;      // max hold duration (default 8)
  maxPositions: number;      // concurrent positions (default 3)
  positionSizePct: number;   // % of account per position (default 0.08)
  leverage: number;          // leverage to use (default 3)
  stopLossPct: number;       // SL as % of entry price (default 0.03 = 3%)
  takeProfitPct: number;     // TP as % of entry price (default 0.02 = 2%)
}

const DEFAULT_CONFIG: FundingRateConfig = {
  entryThreshold: 0.0001,
  exitThreshold: 0.00005,
  maxHoldHours: 8,
  maxPositions: 3,
  positionSizePct: 0.08,
  leverage: 3,
  stopLossPct: 0.03,
  takeProfitPct: 0.02,
};

interface ActiveFundingPosition {
  coin: string;
  side: "long" | "short";
  enteredAt: number;
}

const activePositions: Map<string, ActiveFundingPosition> = new Map();

export function evaluate(
  strategy: QuantStrategy,
  markets: MarketSnapshot[],
  ctx: TickContext,
): StrategySignal[] {
  const cfg: FundingRateConfig = { ...DEFAULT_CONFIG, ...(strategy.config as Partial<FundingRateConfig>) };
  const signals: StrategySignal[] = [];
  const now = Date.now();

  // Check exits for held positions
  for (const [coin, pos] of activePositions) {
    const market = markets.find((m) => m.coin === coin);
    const hoursHeld = (now - pos.enteredAt) / (1000 * 60 * 60);

    const shouldExit =
      hoursHeld >= cfg.maxHoldHours ||
      !market ||
      Math.abs(market.funding) < cfg.exitThreshold;

    if (shouldExit && market) {
      signals.push({
        coin,
        side: pos.side === "long" ? "short" : "long",
        size: 0,
        price: market.markPx,
        assetIndex: market.assetIndex,
        reason: `FR exit: held ${hoursHeld.toFixed(1)}h, rate=${market?.funding.toFixed(6) ?? "N/A"}`,
      });
      activePositions.delete(coin);
    }
  }

  // Don't enter if at capacity
  const openCount = ctx.positions.filter((p) =>
    activePositions.has(p.coin),
  ).length;
  if (openCount >= cfg.maxPositions) return signals;

  // Scan for extreme funding rates, sorted by magnitude
  const candidates = markets
    .filter((m) => Math.abs(m.funding) >= cfg.entryThreshold)
    .filter((m) => !activePositions.has(m.coin))
    .filter((m) => !ctx.positions.some((p) => p.coin === m.coin))
    .filter((m) => m.volume24h >= 500_000) // min volume filter
    .sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding));

  const slotsAvailable = cfg.maxPositions - openCount;

  for (const market of candidates.slice(0, slotsAvailable)) {
    const side: "long" | "short" = market.funding > 0 ? "short" : "long";
    const positionValue = ctx.accountValue * cfg.positionSizePct * cfg.leverage;
    const size = positionValue / market.markPx;

    // Calculate SL/TP based on entry price
    const stopLoss = side === "long"
      ? market.markPx * (1 - cfg.stopLossPct)
      : market.markPx * (1 + cfg.stopLossPct);
    const takeProfit = side === "long"
      ? market.markPx * (1 + cfg.takeProfitPct)
      : market.markPx * (1 - cfg.takeProfitPct);

    signals.push({
      coin: market.coin,
      side,
      size,
      price: market.markPx,
      assetIndex: market.assetIndex,
      reason: `FR entry: rate=${(market.funding * 100).toFixed(4)}%, APR=${(Math.abs(market.funding) * 8760 * 100).toFixed(1)}%`,
      stopLoss,
      takeProfit,
    });

    activePositions.set(market.coin, {
      coin: market.coin,
      side,
      enteredAt: now,
    });
  }

  return signals;
}

export function resetState(): void {
  activePositions.clear();
}
