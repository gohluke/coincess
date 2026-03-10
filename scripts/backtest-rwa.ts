#!/usr/bin/env npx tsx
/**
 * RWA-focused backfill and backtest runner.
 * Backfills GOLD, SILVER, BRENTOIL (xyz perps) + HIP-3 stocks,
 * then runs all strategies against RWA assets.
 */

import { DataCollector } from "../lib/quant/data/collector";
import { Backtester } from "../lib/quant/backtester";
import type { StrategyType } from "../lib/quant/types";

const RWA_COINS = {
  commodities: ["xyz:GOLD", "xyz:SILVER", "xyz:BRENTOIL"],
  stocks: ["TSLA", "MSFT", "AAPL", "GOOGL", "AMZN", "META", "HOOD"],
  indices: ["SPY", "QQQ"],
};

const ALL_RWA = [...RWA_COINS.commodities, ...RWA_COINS.stocks, ...RWA_COINS.indices];

async function backfillRwa() {
  const collector = new DataCollector();
  console.log("=== BACKFILLING RWA ASSETS (30 days) ===\n");

  for (const coin of ALL_RWA) {
    console.log(`Backfilling ${coin}...`);
    const count = await collector.backfill(coin, 30, "5m");
    console.log(`  -> ${count} candles\n`);
  }

  console.log("RWA backfill complete.\n");
}

async function runRwaBacktests() {
  const days = 30;
  const now = Date.now();
  const startTime = now - days * 86400_000;

  const strategies: Array<{ name: string; type: StrategyType; coins: string[]; config: Record<string, unknown> }> = [
    {
      name: "Momentum on Commodities",
      type: "momentum",
      coins: ["xyz:GOLD", "xyz:SILVER", "xyz:BRENTOIL"],
      config: { coins: ["xyz:GOLD", "xyz:SILVER", "xyz:BRENTOIL"], fastPeriod: 9, slowPeriod: 21, positionSizePct: 0.10 },
    },
    {
      name: "Momentum on Stocks",
      type: "momentum",
      coins: ["TSLA", "MSFT", "AAPL", "AMZN", "META"],
      config: { coins: ["TSLA", "MSFT", "AAPL", "AMZN", "META"], fastPeriod: 9, slowPeriod: 21, positionSizePct: 0.10 },
    },
    {
      name: "Mean Reversion on Commodities",
      type: "mean_reversion",
      coins: ["xyz:GOLD", "xyz:SILVER", "xyz:BRENTOIL"],
      config: { rsiPeriod: 14, oversoldThreshold: 25, overboughtThreshold: 75, positionSizePct: 0.08 },
    },
    {
      name: "Grid on Commodities",
      type: "grid",
      coins: ["xyz:GOLD", "xyz:SILVER", "xyz:BRENTOIL"],
      config: { coins: ["xyz:GOLD", "xyz:SILVER", "xyz:BRENTOIL"], gridLevels: 5, gridSpacingPct: 0.003, sizePerLevel: 15 },
    },
    {
      name: "Grid on Stocks",
      type: "grid",
      coins: ["TSLA", "MSFT", "AAPL"],
      config: { coins: ["TSLA", "MSFT", "AAPL"], gridLevels: 5, gridSpacingPct: 0.005, sizePerLevel: 15 },
    },
    {
      name: "Funding Rate on Commodities",
      type: "funding_rate",
      coins: ["xyz:GOLD", "xyz:SILVER", "xyz:BRENTOIL"],
      config: { entryThreshold: 0.0001, positionSizePct: 0.08 },
    },
    {
      name: "Market Maker on Stocks",
      type: "market_maker",
      coins: ["TSLA", "MSFT", "AAPL", "HOOD"],
      config: { coins: ["TSLA", "MSFT", "AAPL", "HOOD"], spreadBps: 50, sizePerQuoteUsd: 20 },
    },
    {
      name: "Momentum on Mixed (Crypto + RWA)",
      type: "momentum",
      coins: ["BTC", "ETH", "xyz:GOLD", "xyz:SILVER", "TSLA"],
      config: { coins: ["BTC", "ETH", "xyz:GOLD", "xyz:SILVER", "TSLA"], fastPeriod: 9, slowPeriod: 21, positionSizePct: 0.08 },
    },
  ];

  console.log("=== RUNNING RWA BACKTESTS ===\n");

  const results: Array<{ name: string; pnl: number; sharpe: number; trades: number; winRate: number; maxDD: number }> = [];

  for (const strat of strategies) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  ${strat.name}`);
    console.log(`  Coins: ${strat.coins.join(", ")}`);
    console.log("=".repeat(50));

    try {
      const bt = new Backtester({
        strategy: strat.type,
        config: strat.config,
        coins: strat.coins,
        interval: "5m",
        initialCapital: 1000,
      });
      const result = await bt.run(startTime, now);
      results.push({
        name: strat.name,
        pnl: result.totalPnl,
        sharpe: result.sharpeRatio,
        trades: result.totalTrades,
        winRate: result.winRate,
        maxDD: result.maxDrawdownPct,
      });
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
      results.push({ name: strat.name, pnl: 0, sharpe: 0, trades: 0, winRate: 0, maxDD: 0 });
    }
  }

  // Summary table
  console.log("\n\n" + "=".repeat(100));
  console.log("  RWA BACKTEST SUMMARY");
  console.log("=".repeat(100));
  console.log(
    "Strategy".padEnd(40),
    "P&L".padStart(10),
    "Sharpe".padStart(8),
    "Trades".padStart(8),
    "Win%".padStart(8),
    "Max DD".padStart(8),
  );
  console.log("-".repeat(100));

  results.sort((a, b) => b.sharpe - a.sharpe);
  for (const r of results) {
    console.log(
      r.name.padEnd(40),
      `$${r.pnl.toFixed(2)}`.padStart(10),
      r.sharpe.toFixed(2).padStart(8),
      String(r.trades).padStart(8),
      `${(r.winRate * 100).toFixed(1)}%`.padStart(8),
      `${(r.maxDD * 100).toFixed(1)}%`.padStart(8),
    );
  }

  console.log("-".repeat(100));
  const best = results[0];
  if (best && best.trades > 0) {
    console.log(`\nBEST: ${best.name} (Sharpe: ${best.sharpe.toFixed(2)}, P&L: $${best.pnl.toFixed(2)})`);
  }
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "backfill") {
    await backfillRwa();
  } else if (cmd === "test") {
    await runRwaBacktests();
  } else {
    await backfillRwa();
    await runRwaBacktests();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
