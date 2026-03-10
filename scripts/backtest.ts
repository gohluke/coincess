#!/usr/bin/env npx tsx
/**
 * Coincess Backtest CLI
 *
 * Usage:
 *   npx tsx scripts/backtest.ts backfill                    # Backfill 30 days of data
 *   npx tsx scripts/backtest.ts backfill --days 60          # Backfill 60 days
 *   npx tsx scripts/backtest.ts run grid --coins BTC,ETH    # Run grid backtest
 *   npx tsx scripts/backtest.ts run momentum                # Run momentum backtest
 *   npx tsx scripts/backtest.ts run mean_reversion          # Run mean reversion backtest
 *   npx tsx scripts/backtest.ts run all                     # Run all strategies
 */

import { DataCollector } from "../lib/quant/data/collector";
import { Backtester, type BacktestConfig } from "../lib/quant/backtester";
import type { StrategyType } from "../lib/quant/types";

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

async function backfill(): Promise<void> {
  const days = parseInt(getFlag("days", "30"), 10);
  const collector = new DataCollector();
  await collector.backfillAll(days);
}

async function runBacktest(strategy: string): Promise<void> {
  const coins = getFlag("coins", "BTC,ETH,SOL").split(",");
  const days = parseInt(getFlag("days", "30"), 10);
  const capital = parseFloat(getFlag("capital", "1000"));
  const interval = getFlag("interval", "5m");

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const strategyConfigs: Record<string, Partial<BacktestConfig>> = {
    grid: {
      strategy: "grid",
      config: { coins, gridLevels: 5, gridSpacingPct: 0.005, sizePerLevel: 15 },
      coins,
    },
    momentum: {
      strategy: "momentum",
      config: { coins, fastPeriod: 9, slowPeriod: 21, positionSizePct: 0.10 },
      coins,
    },
    mean_reversion: {
      strategy: "mean_reversion",
      config: { rsiPeriod: 14, oversoldThreshold: 25, overboughtThreshold: 75, positionSizePct: 0.08 },
      coins,
    },
    funding_rate: {
      strategy: "funding_rate",
      config: { entryThreshold: 0.0001, positionSizePct: 0.08 },
      coins,
    },
    market_maker: {
      strategy: "market_maker",
      config: { coins, spreadBps: 50, sizePerQuoteUsd: 20 },
      coins,
    },
  };

  if (strategy === "all") {
    for (const [name, cfg] of Object.entries(strategyConfigs)) {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`Running ${name} backtest...`);
      console.log("=".repeat(50));
      const bt = new Backtester({
        strategy: cfg.strategy as StrategyType,
        config: cfg.config ?? {},
        coins: cfg.coins ?? coins,
        interval,
        initialCapital: capital,
      });
      await bt.run(startTime, now);
    }
  } else {
    const cfg = strategyConfigs[strategy];
    if (!cfg) {
      console.error(`Unknown strategy: ${strategy}`);
      console.error(`Available: ${Object.keys(strategyConfigs).join(", ")}, all`);
      process.exit(1);
    }
    const bt = new Backtester({
      strategy: cfg.strategy as StrategyType,
      config: cfg.config ?? {},
      coins: cfg.coins ?? coins,
      interval,
      initialCapital: capital,
    });
    await bt.run(startTime, now);
  }
}

async function main(): Promise<void> {
  if (!command) {
    console.log("Coincess Backtest CLI");
    console.log("");
    console.log("Commands:");
    console.log("  backfill [--days 30]              Backfill historical candle data");
    console.log("  run <strategy> [options]           Run a backtest");
    console.log("");
    console.log("Strategies: grid, momentum, mean_reversion, funding_rate, market_maker, all");
    console.log("");
    console.log("Options:");
    console.log("  --coins BTC,ETH,SOL    Coins to backtest (comma-separated)");
    console.log("  --days 30              Number of days");
    console.log("  --capital 1000         Initial capital in USD");
    console.log("  --interval 5m          Candle interval");
    process.exit(0);
  }

  if (command === "backfill") {
    await backfill();
  } else if (command === "run") {
    const strategy = args[1];
    if (!strategy) {
      console.error("Usage: backtest.ts run <strategy>");
      process.exit(1);
    }
    await runBacktest(strategy);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
