/**
 * Backtesting Engine
 *
 * Replays historical candle data through any strategy's evaluate() function
 * with simulated order matching, slippage, and fee modeling.
 *
 * Usage:
 *   const bt = new Backtester({ strategy: "grid", config: {...}, coins: ["BTC","ETH"] });
 *   const result = await bt.run(startTime, endTime);
 *   console.log(result.sharpeRatio, result.totalPnl);
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fundingRate from "./strategies/funding-rate";
import * as momentum from "./strategies/momentum";
import * as grid from "./strategies/grid";
import * as meanReversion from "./strategies/mean-reversion";
import * as marketMaker from "./strategies/market-maker";
import type {
  QuantStrategy,
  StrategySignal,
  TickContext,
  PositionInfo,
  MarketSnapshot,
  StrategyType,
  QuantState,
} from "./types";

export interface BacktestConfig {
  strategy: StrategyType;
  config: Record<string, unknown>;
  coins: string[];
  interval?: string;
  initialCapital?: number;
  feeRate?: number;       // per trade (default 0.0003 = 0.03%)
  slippageBps?: number;   // in basis points (default 2 = 0.02%)
  maxLeverage?: number;
}

export interface BacktestTrade {
  coin: string;
  side: "long" | "short";
  size: number;
  entryPx: number;
  exitPx: number | null;
  entryTime: number;
  exitTime: number | null;
  pnl: number;
  fees: number;
  reason: string;
}

export interface BacktestResult {
  strategyType: StrategyType;
  config: Record<string, unknown>;
  coins: string[];
  startTime: number;
  endTime: number;
  interval: string;
  initialCapital: number;
  finalEquity: number;
  totalPnl: number;
  totalFees: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgTradePnl: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  equityCurve: number[];
  dailyReturns: number[];
  trades: BacktestTrade[];
}

interface SimPosition {
  coin: string;
  side: "long" | "short";
  size: number;
  entryPx: number;
  entryTime: number;
  reason: string;
}

export class Backtester {
  private cfg: Required<BacktestConfig>;
  private supabase: SupabaseClient;

  constructor(config: BacktestConfig) {
    this.cfg = {
      interval: "5m",
      initialCapital: 1000,
      feeRate: 0.0003,
      slippageBps: 2,
      maxLeverage: 5,
      ...config,
    };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials");
    this.supabase = createClient(url, key);
  }

  async run(startTime: number, endTime: number): Promise<BacktestResult> {
    console.log(
      `[backtest] ${this.cfg.strategy} on [${this.cfg.coins.join(",")}] ` +
      `from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`,
    );

    // Load candle data for all coins
    const candleMap = await this.loadCandles(startTime, endTime);

    // Build aligned time series (all coins share same timestamps)
    const allTimes = new Set<number>();
    for (const candles of candleMap.values()) {
      for (const c of candles) allTimes.add(c.open_time);
    }
    const times = Array.from(allTimes).sort((a, b) => a - b);

    if (times.length === 0) {
      throw new Error("No candle data found. Run collector.backfill() first.");
    }

    // Simulation state
    let equity = this.cfg.initialCapital;
    let peakEquity = equity;
    let maxDrawdown = 0;
    const positions: Map<string, SimPosition> = new Map();
    const closedTrades: BacktestTrade[] = [];
    const equityCurve: number[] = [];
    const dailyReturns: number[] = [];
    let lastDayEquity = equity;
    let lastDay = -1;

    // Build a mock strategy object
    const mockStrategy: QuantStrategy = {
      id: "backtest",
      type: this.cfg.strategy,
      status: "active",
      config: { maxPositionPct: 0.5, maxLeverage: 5, ...this.cfg.config, coins: this.cfg.coins },
      wallet_address: "backtest",
      error_message: null,
      total_trades: 0,
      total_pnl: 0,
      last_executed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Reset strategy state
    this.resetStrategy();

    // Replay each time step
    for (const t of times) {
      // Build market snapshots at this timestamp
      const snapshots: MarketSnapshot[] = [];
      for (const [coin, candles] of candleMap) {
        const candle = candles.find((c) => c.open_time === t);
        if (!candle) continue;
        snapshots.push({
          coin,
          assetIndex: 0,
          markPx: candle.c,
          funding: 0,
          openInterest: 0,
          volume24h: candle.v,
          dex: candle.dex === "spot" ? "spot" : "perp",
        });
      }

      // Update position P&L
      let unrealizedPnl = 0;
      for (const [coin, pos] of positions) {
        const snap = snapshots.find((s) => s.coin === coin);
        if (!snap) continue;
        const pnl = pos.side === "long"
          ? (snap.markPx - pos.entryPx) * pos.size
          : (pos.entryPx - snap.markPx) * pos.size;
        unrealizedPnl += pnl;
      }

      // Build tick context
      const posInfos: PositionInfo[] = Array.from(positions.values()).map((p) => ({
        coin: p.coin,
        szi: p.side === "long" ? p.size : -p.size,
        entryPx: p.entryPx,
        unrealizedPnl: 0,
        marginUsed: p.size * p.entryPx / this.cfg.maxLeverage,
        leverage: this.cfg.maxLeverage,
        assetIndex: 0,
      }));

      const ctx: TickContext = {
        accountValue: equity + unrealizedPnl,
        positions: posInfos,
        timestamp: t,
      };

      // Evaluate strategy
      const signals = this.evaluateStrategy(mockStrategy, snapshots, ctx, candleMap, t);

      // Execute signals
      for (const signal of signals) {
        if (signal.size === 0) {
          // Close signal
          const pos = positions.get(signal.coin);
          if (pos) {
            const snap = snapshots.find((s) => s.coin === signal.coin);
            const exitPx = snap?.markPx ?? pos.entryPx;
            const slippage = (signal.side === "long" ? 1 : -1) * exitPx * (this.cfg.slippageBps / 10000);
            const fillPx = exitPx + slippage;
            const pnl = pos.side === "long"
              ? (fillPx - pos.entryPx) * pos.size
              : (pos.entryPx - fillPx) * pos.size;
            const fees = pos.size * fillPx * this.cfg.feeRate;

            equity += pnl - fees;
            closedTrades.push({
              coin: pos.coin, side: pos.side, size: pos.size,
              entryPx: pos.entryPx, exitPx: fillPx,
              entryTime: pos.entryTime, exitTime: t,
              pnl, fees, reason: signal.reason,
            });
            positions.delete(signal.coin);
          }
          continue;
        }

        // Skip if already in position for this coin
        if (positions.has(signal.coin)) continue;

        // Position sizing: respect max leverage and capital
        const maxPositionValue = equity * (this.cfg.config.positionSizePct as number ?? 0.1) * this.cfg.maxLeverage;
        const positionValue = Math.min(signal.size * signal.price, maxPositionValue);
        const size = positionValue / signal.price;

        if (positionValue < 10) continue; // Min notional

        const slippage = (signal.side === "long" ? 1 : -1) * signal.price * (this.cfg.slippageBps / 10000);
        const fillPx = signal.price + slippage;
        const fees = size * fillPx * this.cfg.feeRate;
        equity -= fees;

        positions.set(signal.coin, {
          coin: signal.coin,
          side: signal.side,
          size,
          entryPx: fillPx,
          entryTime: t,
          reason: signal.reason,
        });
      }

      // Track equity curve and daily returns
      const currentEquity = equity + unrealizedPnl;
      equityCurve.push(currentEquity);
      peakEquity = Math.max(peakEquity, currentEquity);
      maxDrawdown = Math.max(maxDrawdown, peakEquity - currentEquity);

      const day = Math.floor(t / (24 * 60 * 60 * 1000));
      if (day !== lastDay && lastDay !== -1) {
        dailyReturns.push((currentEquity - lastDayEquity) / lastDayEquity);
        lastDayEquity = currentEquity;
      }
      lastDay = day;
    }

    // Close any remaining open positions at last price
    for (const [coin, pos] of positions) {
      const lastCandles = candleMap.get(coin);
      const lastPx = lastCandles?.[lastCandles.length - 1]?.c ?? pos.entryPx;
      const pnl = pos.side === "long"
        ? (lastPx - pos.entryPx) * pos.size
        : (pos.entryPx - lastPx) * pos.size;
      const fees = pos.size * lastPx * this.cfg.feeRate;
      equity += pnl - fees;
      closedTrades.push({
        coin: pos.coin, side: pos.side, size: pos.size,
        entryPx: pos.entryPx, exitPx: lastPx,
        entryTime: pos.entryTime, exitTime: times[times.length - 1],
        pnl, fees, reason: "Backtest end: force close",
      });
    }

    // Compute metrics
    const finalEquity = equity;
    const totalPnl = finalEquity - this.cfg.initialCapital;
    const totalFees = closedTrades.reduce((s, t) => s + t.fees, 0);
    const wins = closedTrades.filter((t) => t.pnl > 0);
    const losses = closedTrades.filter((t) => t.pnl <= 0);
    const winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0;
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgTradePnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
    const maxDrawdownPct = peakEquity > 0 ? maxDrawdown / peakEquity : 0;

    const sharpe = this.computeSharpe(dailyReturns);
    const sortino = this.computeSortino(dailyReturns);
    const calmar = maxDrawdownPct > 0
      ? (totalPnl / this.cfg.initialCapital) / maxDrawdownPct
      : 0;

    const result: BacktestResult = {
      strategyType: this.cfg.strategy,
      config: this.cfg.config,
      coins: this.cfg.coins,
      startTime,
      endTime,
      interval: this.cfg.interval,
      initialCapital: this.cfg.initialCapital,
      finalEquity,
      totalPnl,
      totalFees,
      totalTrades: closedTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate,
      profitFactor,
      avgTradePnl,
      maxDrawdown,
      maxDrawdownPct,
      sharpeRatio: sharpe,
      sortinoRatio: sortino,
      calmarRatio: calmar,
      equityCurve,
      dailyReturns,
      trades: closedTrades,
    };

    // Store results in Supabase
    await this.storeResult(result);
    this.printSummary(result);
    return result;
  }

  private evaluateStrategy(
    strat: QuantStrategy,
    markets: MarketSnapshot[],
    ctx: TickContext,
    candleMap: Map<string, CandleRow[]>,
    currentTime: number,
  ): StrategySignal[] {
    switch (strat.type) {
      case "funding_rate": {
        // Synthesize funding rates from price momentum for backtesting.
        // In live mode, actual funding rates come from the API.
        const marketsWithFunding = markets.map((m) => {
          const candles = candleMap.get(m.coin) ?? [];
          const recent = candles.filter((c) => c.open_time <= currentTime).slice(-24);
          if (recent.length < 2) return m;
          const first = recent[0].c;
          const last = recent[recent.length - 1].c;
          const pctChange = (last - first) / first;
          // Synthetic funding: positive price momentum = positive funding
          const syntheticFunding = pctChange * 0.005;
          return { ...m, funding: syntheticFunding };
        });
        return fundingRate.evaluate(strat, marketsWithFunding, ctx);
      }

      case "grid":
        return grid.evaluate(strat, markets, ctx);

      case "momentum": {
        const candleData = this.cfg.coins.map((coin) => {
          const candles = candleMap.get(coin) ?? [];
          const relevant = candles.filter((c) => c.open_time <= currentTime).slice(-50);
          return {
            coin,
            closes: relevant.map((c) => c.c),
            assetIndex: 0,
            currentPrice: relevant[relevant.length - 1]?.c ?? 0,
          };
        });
        return momentum.evaluate(strat, candleData, ctx);
      }

      case "mean_reversion": {
        const candleData = this.cfg.coins.map((coin) => {
          const candles = candleMap.get(coin) ?? [];
          const relevant = candles.filter((c) => c.open_time <= currentTime).slice(-30);
          return {
            coin,
            closes: relevant.map((c) => c.c),
            assetIndex: 0,
            currentPrice: relevant[relevant.length - 1]?.c ?? 0,
            volume24h: markets.find((m) => m.coin === coin)?.volume24h ?? 0,
          };
        });
        return meanReversion.evaluate(strat, candleData, ctx);
      }

      case "market_maker":
        return marketMaker.evaluate(strat, markets, ctx);

      default:
        return [];
    }
  }

  private resetStrategy(): void {
    fundingRate.resetState();
    momentum.resetState();
    grid.resetState();
    meanReversion.resetState();
    marketMaker.resetState();
  }

  private async loadCandles(
    startTime: number,
    endTime: number,
  ): Promise<Map<string, CandleRow[]>> {
    const map = new Map<string, CandleRow[]>();

    for (const coin of this.cfg.coins) {
      const { data, error } = await this.supabase
        .from("market_candles")
        .select("*")
        .eq("coin", coin)
        .eq("interval", this.cfg.interval)
        .gte("open_time", startTime)
        .lte("open_time", endTime)
        .order("open_time", { ascending: true });

      if (error) {
        console.error(`[backtest] Failed to load ${coin}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        map.set(coin, data as CandleRow[]);
      }
    }

    console.log(
      `[backtest] Loaded candles: ${Array.from(map.entries()).map(([k, v]) => `${k}=${v.length}`).join(", ")}`,
    );
    return map;
  }

  private computeSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return (mean / std) * Math.sqrt(252); // Annualized
  }

  private computeSortino(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const downside = returns.filter((r) => r < 0);
    if (downside.length === 0) return mean > 0 ? Infinity : 0;
    const downsideVariance = downside.reduce((s, r) => s + r ** 2, 0) / downside.length;
    const downsideStd = Math.sqrt(downsideVariance);
    if (downsideStd === 0) return 0;
    return (mean / downsideStd) * Math.sqrt(252);
  }

  private async storeResult(result: BacktestResult): Promise<void> {
    const { error } = await this.supabase.from("backtest_runs").insert({
      strategy_type: result.strategyType,
      config: result.config,
      start_time: result.startTime,
      end_time: result.endTime,
      coins: result.coins,
      interval: result.interval,
      total_trades: result.totalTrades,
      winning_trades: result.winningTrades,
      total_pnl: result.totalPnl,
      max_drawdown: result.maxDrawdownPct,
      sharpe_ratio: result.sharpeRatio,
      sortino_ratio: result.sortinoRatio,
      win_rate: result.winRate,
      profit_factor: result.profitFactor,
      avg_trade_pnl: result.avgTradePnl,
      equity_curve: result.equityCurve.length > 500
        ? result.equityCurve.filter((_, i) => i % Math.ceil(result.equityCurve.length / 500) === 0)
        : result.equityCurve,
    });
    if (error) console.error("[backtest] Failed to store result:", error.message);
  }

  private printSummary(r: BacktestResult): void {
    const days = (r.endTime - r.startTime) / (24 * 60 * 60 * 1000);
    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║         BACKTEST RESULTS              ║");
    console.log("╠═══════════════════════════════════════╣");
    console.log(`║ Strategy:   ${r.strategyType.padEnd(25)}║`);
    console.log(`║ Period:     ${days.toFixed(0).padEnd(3)} days${" ".repeat(18)}║`);
    console.log(`║ Coins:      ${r.coins.join(",").slice(0, 25).padEnd(25)}║`);
    console.log("╠═══════════════════════════════════════╣");
    console.log(`║ Initial:    $${r.initialCapital.toFixed(2).padEnd(23)}║`);
    console.log(`║ Final:      $${r.finalEquity.toFixed(2).padEnd(23)}║`);
    console.log(`║ P&L:        $${r.totalPnl.toFixed(2).padEnd(23)}║`);
    console.log(`║ Return:     ${((r.totalPnl / r.initialCapital) * 100).toFixed(2).padEnd(4)}%${" ".repeat(20)}║`);
    console.log(`║ Fees:       $${r.totalFees.toFixed(2).padEnd(23)}║`);
    console.log("╠═══════════════════════════════════════╣");
    console.log(`║ Trades:     ${String(r.totalTrades).padEnd(25)}║`);
    console.log(`║ Win Rate:   ${(r.winRate * 100).toFixed(1).padEnd(4)}%${" ".repeat(20)}║`);
    console.log(`║ Profit F:   ${r.profitFactor === Infinity ? "∞" : r.profitFactor.toFixed(2).padEnd(25)}║`);
    console.log(`║ Avg Trade:  $${r.avgTradePnl.toFixed(4).padEnd(23)}║`);
    console.log("╠═══════════════════════════════════════╣");
    console.log(`║ Sharpe:     ${r.sharpeRatio.toFixed(2).padEnd(25)}║`);
    console.log(`║ Sortino:    ${r.sortinoRatio === Infinity ? "∞" : r.sortinoRatio.toFixed(2).padEnd(25)}║`);
    console.log(`║ Calmar:     ${r.calmarRatio.toFixed(2).padEnd(25)}║`);
    console.log(`║ Max DD:     ${(r.maxDrawdownPct * 100).toFixed(2).padEnd(4)}%${" ".repeat(20)}║`);
    console.log("╚═══════════════════════════════════════╝\n");
  }
}

interface CandleRow {
  coin: string;
  interval: string;
  open_time: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  dex: string;
}
