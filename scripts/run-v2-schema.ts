#!/usr/bin/env npx tsx
/**
 * Run V2 schema against Supabase using the Management API
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATEMENTS = [
  // market_candles
  `create table if not exists market_candles (
    coin text not null,
    interval text not null default '5m',
    open_time bigint not null,
    o numeric not null,
    h numeric not null,
    l numeric not null,
    c numeric not null,
    v numeric not null default 0,
    n int not null default 0,
    dex text not null default 'perp',
    primary key (coin, interval, open_time)
  )`,
  `create index if not exists idx_candles_time on market_candles(open_time desc)`,
  `create index if not exists idx_candles_coin_interval on market_candles(coin, interval, open_time desc)`,

  // backtest_runs
  `create table if not exists backtest_runs (
    id uuid primary key default gen_random_uuid(),
    strategy_type text not null,
    config jsonb not null default '{}',
    start_time bigint not null,
    end_time bigint not null,
    coins text[] not null default '{}',
    interval text not null default '5m',
    total_trades int not null default 0,
    winning_trades int not null default 0,
    total_pnl numeric not null default 0,
    max_drawdown numeric not null default 0,
    sharpe_ratio numeric,
    sortino_ratio numeric,
    win_rate numeric,
    profit_factor numeric,
    avg_trade_pnl numeric,
    equity_curve numeric[] default '{}',
    wallet_address text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_backtest_strategy on backtest_runs(strategy_type)`,
  `create index if not exists idx_backtest_created on backtest_runs(created_at desc)`,

  // strategy_performance
  `create table if not exists strategy_performance (
    strategy_id uuid references quant_strategies(id) on delete cascade,
    window_start timestamptz not null,
    window_end timestamptz not null,
    trade_count int not null default 0,
    win_rate numeric,
    sharpe numeric,
    pnl numeric not null default 0,
    avg_hold_minutes numeric,
    primary key (strategy_id, window_start)
  )`,
  `create index if not exists idx_perf_strategy on strategy_performance(strategy_id, window_end desc)`,

  // data_collection_state
  `create table if not exists data_collection_state (
    coin text not null,
    interval text not null default '5m',
    last_collected_at bigint not null default 0,
    total_candles bigint not null default 0,
    primary key (coin, interval)
  )`,

  // Update strategy type constraint
  `alter table quant_strategies drop constraint if exists quant_strategies_type_check`,
  `alter table quant_strategies add constraint quant_strategies_type_check check (type in ('funding_rate', 'momentum', 'grid', 'mean_reversion', 'market_maker'))`,
];

async function run() {
  console.log("Running V2 schema...");

  for (const sql of STATEMENTS) {
    const label = sql.trim().slice(0, 60).replace(/\s+/g, " ");
    const { error } = await supabase.rpc("exec_sql", { query: sql });
    if (error) {
      // Try direct postgrest approach - insert into a dummy to test connection
      console.log(`  [!] ${label}... (rpc unavailable, manual SQL needed)`);
    } else {
      console.log(`  [OK] ${label}...`);
    }
  }

  // Test: try inserting a test candle and reading it back
  console.log("\nTesting market_candles table...");
  const { error: insertErr } = await supabase.from("market_candles").upsert({
    coin: "_TEST",
    interval: "5m",
    open_time: 0,
    o: 1, h: 1, l: 1, c: 1, v: 0, n: 0, dex: "test",
  }, { onConflict: "coin,interval,open_time" });

  if (insertErr) {
    console.log(`Table test: FAILED (${insertErr.message})`);
    console.log("\n⚠️  Tables may not exist yet. Please run this SQL in your Supabase SQL Editor:");
    console.log("   File: lib/supabase/quant-v2-schema.sql\n");
  } else {
    await supabase.from("market_candles").delete().eq("coin", "_TEST");
    console.log("Table test: OK ✓");

    // Also test backtest_runs
    const { error: btErr } = await supabase.from("backtest_runs").select("id").limit(1);
    console.log(`backtest_runs: ${btErr ? "MISSING" : "OK ✓"}`);
    const { error: dcErr } = await supabase.from("data_collection_state").select("coin").limit(1);
    console.log(`data_collection_state: ${dcErr ? "MISSING" : "OK ✓"}`);
  }

  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
