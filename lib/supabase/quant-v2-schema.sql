-- Quant V2 Schema: Data Pipeline + Backtester + Signal Combiner
-- Run this in Supabase SQL Editor after quant-schema.sql

-- Historical candle storage
create table if not exists market_candles (
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
);

create index if not exists idx_candles_time on market_candles(open_time desc);
create index if not exists idx_candles_coin_interval on market_candles(coin, interval, open_time desc);

-- Backtest results
create table if not exists backtest_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_type text not null,
  config jsonb not null default '{}',
  start_time bigint not null,
  end_time bigint not null,
  coins text[] not null default '{}',
  interval text not null default '5m',
  -- Results
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
  -- Meta
  wallet_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_backtest_strategy on backtest_runs(strategy_type);
create index if not exists idx_backtest_created on backtest_runs(created_at desc);

-- Strategy performance tracking (rolling metrics for signal combiner)
create table if not exists strategy_performance (
  strategy_id uuid references quant_strategies(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  trade_count int not null default 0,
  win_rate numeric,
  sharpe numeric,
  pnl numeric not null default 0,
  avg_hold_minutes numeric,
  primary key (strategy_id, window_start)
);

create index if not exists idx_perf_strategy on strategy_performance(strategy_id, window_end desc);

-- Update quant_strategies type check to include new strategy types
alter table quant_strategies drop constraint if exists quant_strategies_type_check;
alter table quant_strategies add constraint quant_strategies_type_check
  check (type in ('funding_rate', 'momentum', 'grid', 'mean_reversion', 'market_maker', 'ai_agent'));

-- AI Agent decision & analysis logs
create table if not exists ai_agent_logs (
  id uuid default gen_random_uuid() primary key,
  strategy_id uuid references quant_strategies(id) on delete cascade,
  event_type text not null default 'cycle',
  market_sentiment text,
  opportunities jsonb default '[]',
  decision jsonb,
  signals_generated int default 0,
  analyst_model text,
  trader_model text,
  error_message text,
  created_at timestamptz default now()
);
create index if not exists idx_ai_logs_strategy on ai_agent_logs(strategy_id, created_at desc);
create index if not exists idx_ai_logs_created on ai_agent_logs(created_at desc);

-- Data collection state tracking
create table if not exists data_collection_state (
  coin text not null,
  interval text not null default '5m',
  last_collected_at bigint not null default 0,
  total_candles bigint not null default 0,
  primary key (coin, interval)
);
