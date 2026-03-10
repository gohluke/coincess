/**
 * Signal Combiner (Meta-Engine)
 *
 * Takes signals from all active strategies and produces an optimal
 * portfolio allocation. Inspired by Renaissance-style ensemble methods:
 *
 * 1. Weigh each strategy by rolling Sharpe ratio
 * 2. Detect market regime (trending vs mean-reverting via volatility)
 * 3. Correlation-aware position sizing (reduce correlated bets)
 * 4. Kelly criterion-based sizing with half-Kelly for safety
 */

import type { StrategySignal, QuantStrategy, TickContext, QuantState } from "./types";
import { atr } from "./indicators";

export interface CombinerConfig {
  /** Lookback window for strategy performance (hours) */
  performanceWindow: number;
  /** Minimum trades to trust a strategy's Sharpe */
  minTradesForWeight: number;
  /** Maximum correlation to allow between positions (0-1) */
  maxCorrelation: number;
  /** Use half-Kelly sizing for safety */
  halfKelly: boolean;
  /** Max total positions across all strategies */
  maxTotalPositions: number;
  /** Min signal confidence to execute (0-1) */
  minConfidence: number;
}

const DEFAULT_CONFIG: CombinerConfig = {
  performanceWindow: 168, // 7 days
  minTradesForWeight: 5,
  maxCorrelation: 0.8,
  halfKelly: true,
  maxTotalPositions: 8,
  minConfidence: 0.3,
};

interface StrategyWeight {
  strategyId: string;
  strategyType: string;
  weight: number;
  sharpe: number;
  winRate: number;
  tradeCount: number;
}

interface CombinedSignal extends StrategySignal {
  confidence: number;
  sourceStrategies: string[];
  adjustedSize: number;
}

// Rolling performance tracker (in-memory, updated each tick)
const rollingPerformance: Map<string, {
  returns: number[];
  wins: number;
  losses: number;
  lastUpdated: number;
}> = new Map();

// Price history for correlation calculation
const priceHistory: Map<string, number[]> = new Map();
const PRICE_HISTORY_LENGTH = 100;

/**
 * Detect current market regime based on volatility.
 * High volatility = trending, Low volatility = mean-reverting.
 */
export function detectRegime(recentPrices: number[]): "trending" | "mean_reverting" | "neutral" {
  if (recentPrices.length < 20) return "neutral";

  const returns = [];
  for (let i = 1; i < recentPrices.length; i++) {
    returns.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
  }

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const vol = Math.sqrt(variance);

  // Annualized vol thresholds (assuming 5m bars, ~105120 per year)
  const annualizedVol = vol * Math.sqrt(105120);

  if (annualizedVol > 0.8) return "trending";
  if (annualizedVol < 0.3) return "mean_reverting";
  return "neutral";
}

/**
 * Calculate Pearson correlation between two price series
 */
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 10) return 0;

  const sliceA = a.slice(-n);
  const sliceB = b.slice(-n);

  const meanA = sliceA.reduce((s, v) => s + v, 0) / n;
  const meanB = sliceB.reduce((s, v) => s + v, 0) / n;

  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = sliceA[i] - meanA;
    const db = sliceB[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
}

/**
 * Update price history for correlation tracking
 */
export function updatePriceHistory(coin: string, price: number): void {
  let history = priceHistory.get(coin);
  if (!history) {
    history = [];
    priceHistory.set(coin, history);
  }
  history.push(price);
  if (history.length > PRICE_HISTORY_LENGTH) {
    history.splice(0, history.length - PRICE_HISTORY_LENGTH);
  }
}

/**
 * Record a trade result for rolling performance
 */
export function recordTradeResult(
  strategyId: string,
  pnl: number,
  accountValue: number,
): void {
  let perf = rollingPerformance.get(strategyId);
  if (!perf) {
    perf = { returns: [], wins: 0, losses: 0, lastUpdated: Date.now() };
    rollingPerformance.set(strategyId, perf);
  }
  const ret = accountValue > 0 ? pnl / accountValue : 0;
  perf.returns.push(ret);
  if (pnl > 0) perf.wins++;
  else perf.losses++;
  perf.lastUpdated = Date.now();

  // Keep only recent returns
  if (perf.returns.length > 200) {
    perf.returns.splice(0, perf.returns.length - 200);
  }
}

/**
 * Calculate strategy weights based on rolling performance
 */
export function calculateWeights(
  strategies: QuantStrategy[],
  config: CombinerConfig = DEFAULT_CONFIG,
): StrategyWeight[] {
  const weights: StrategyWeight[] = [];

  for (const strat of strategies) {
    const perf = rollingPerformance.get(strat.id);
    const tradeCount = perf ? perf.wins + perf.losses : 0;
    let sharpe = 0;
    let winRate = 0.5;

    if (perf && tradeCount >= config.minTradesForWeight) {
      const returns = perf.returns;
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1 || 1);
      const std = Math.sqrt(variance);
      sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
      winRate = tradeCount > 0 ? perf.wins / tradeCount : 0.5;
    }

    // Weight = max(0, Sharpe) normalized. New strategies get base weight.
    const rawWeight = tradeCount >= config.minTradesForWeight
      ? Math.max(0, sharpe)
      : 0.5; // Default weight for new strategies

    weights.push({
      strategyId: strat.id,
      strategyType: strat.type,
      weight: rawWeight,
      sharpe,
      winRate,
      tradeCount,
    });
  }

  // Normalize weights to sum to 1
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight > 0) {
    for (const w of weights) w.weight /= totalWeight;
  }

  return weights;
}

/**
 * Combine signals from multiple strategies into optimal portfolio actions.
 */
export function combineSignals(
  allSignals: Array<{ signal: StrategySignal; strategy: QuantStrategy }>,
  weights: StrategyWeight[],
  ctx: TickContext,
  state: QuantState,
  config: CombinerConfig = DEFAULT_CONFIG,
): CombinedSignal[] {
  if (allSignals.length === 0) return [];

  // Group signals by coin
  const byCoin = new Map<string, Array<{ signal: StrategySignal; strategy: QuantStrategy; weight: number }>>();
  for (const { signal, strategy } of allSignals) {
    const w = weights.find((w) => w.strategyId === strategy.id)?.weight ?? 0.5;
    const existing = byCoin.get(signal.coin) ?? [];
    existing.push({ signal, strategy, weight: w });
    byCoin.set(signal.coin, existing);
  }

  const combined: CombinedSignal[] = [];

  for (const [coin, signals] of byCoin) {
    // Close signals pass through directly
    const closeSignals = signals.filter((s) => s.signal.size === 0);
    if (closeSignals.length > 0) {
      const best = closeSignals.sort((a, b) => b.weight - a.weight)[0];
      combined.push({
        ...best.signal,
        confidence: best.weight,
        sourceStrategies: closeSignals.map((s) => s.strategy.type),
        adjustedSize: 0,
      });
      continue;
    }

    // Aggregate directional signals
    let longWeight = 0;
    let shortWeight = 0;
    let weightedPrice = 0;
    let totalWeight = 0;

    for (const { signal, weight } of signals) {
      if (signal.side === "long") longWeight += weight;
      else shortWeight += weight;
      weightedPrice += signal.price * weight;
      totalWeight += weight;
    }

    const netDirection = longWeight - shortWeight;
    const confidence = Math.abs(netDirection) / (longWeight + shortWeight || 1);

    if (confidence < config.minConfidence) continue;

    const side = netDirection > 0 ? "long" : "short";
    const avgPrice = totalWeight > 0 ? weightedPrice / totalWeight : signals[0].signal.price;

    // Kelly criterion sizing: f* = (p*b - q) / b
    // where p = win rate, q = 1-p, b = avg win / avg loss
    const weightData = weights.find((w) =>
      signals.some((s) => s.strategy.id === w.strategyId),
    );
    const winRate = weightData?.winRate ?? 0.5;
    const b = 1.5; // Assume avg win 1.5x avg loss
    const kellyFraction = Math.max(0, (winRate * b - (1 - winRate)) / b);
    const sizeFraction = config.halfKelly ? kellyFraction * 0.5 : kellyFraction;

    // Scale by confidence and account value
    const baseSize = ctx.accountValue * Math.min(sizeFraction, 0.15);
    const adjustedSize = (baseSize * confidence) / avgPrice;

    // Correlation check: reduce size if highly correlated with existing positions
    let correlationPenalty = 1;
    for (const pos of ctx.positions) {
      if (pos.coin === coin) continue;
      const histA = priceHistory.get(coin);
      const histB = priceHistory.get(pos.coin);
      if (histA && histB) {
        const corr = Math.abs(correlation(histA, histB));
        if (corr > config.maxCorrelation) {
          correlationPenalty *= (1 - corr);
        }
      }
    }

    // Max positions check
    const openPositions = ctx.positions.filter((p) => Math.abs(p.szi) > 0).length;
    if (openPositions >= config.maxTotalPositions) continue;

    combined.push({
      coin,
      side: side as "long" | "short",
      size: adjustedSize * correlationPenalty,
      price: avgPrice,
      assetIndex: signals[0].signal.assetIndex,
      reason: `COMBINED [${signals.map((s) => s.strategy.type).join("+")}] conf=${(confidence * 100).toFixed(0)}%`,
      confidence,
      sourceStrategies: signals.map((s) => s.strategy.type),
      adjustedSize: adjustedSize * correlationPenalty,
    });
  }

  // Sort by confidence, highest first
  combined.sort((a, b) => b.confidence - a.confidence);
  return combined;
}
