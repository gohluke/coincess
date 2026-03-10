-- Quant Trading Suite Schema
-- Run this in Supabase SQL Editor for project xoggrjyjhewbwsshhjmz

-- Strategy configurations
create table if not exists quant_strategies (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('funding_rate', 'momentum', 'grid', 'mean_reversion')),
  status text not null default 'paused' check (status in ('active', 'paused', 'stopped', 'error')),
  config jsonb not null default '{}',
  wallet_address text not null,
  error_message text,
  total_trades int not null default 0,
  total_pnl numeric not null default 0,
  last_executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trade log
create table if not exists quant_trades (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid references quant_strategies(id) on delete set null,
  strategy_type text not null,
  coin text not null,
  side text not null check (side in ('long', 'short')),
  size numeric not null,
  entry_px numeric not null,
  exit_px numeric,
  pnl numeric,
  fees numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  oid bigint,
  meta jsonb default '{}',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Engine state (singleton row)
create table if not exists quant_state (
  id int primary key default 1 check (id = 1),
  engine_status text not null default 'stopped' check (engine_status in ('running', 'stopped', 'paused', 'error')),
  daily_pnl numeric not null default 0,
  daily_pnl_reset_at timestamptz not null default now(),
  total_pnl numeric not null default 0,
  peak_equity numeric not null default 0,
  max_drawdown numeric not null default 0,
  current_exposure numeric not null default 0,
  last_tick_at timestamptz,
  error_message text,
  updated_at timestamptz not null default now()
);

-- Seed the singleton state row
insert into quant_state (id) values (1) on conflict (id) do nothing;

-- Auto-update updated_at
create or replace function update_quant_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger quant_strategies_updated
  before update on quant_strategies
  for each row execute function update_quant_updated_at();

create trigger quant_state_updated
  before update on quant_state
  for each row execute function update_quant_updated_at();

-- Indexes
create index if not exists idx_quant_trades_strategy on quant_trades(strategy_id);
create index if not exists idx_quant_trades_opened on quant_trades(opened_at desc);
create index if not exists idx_quant_trades_status on quant_trades(status);
create index if not exists idx_quant_strategies_wallet on quant_strategies(wallet_address);
create index if not exists idx_quant_strategies_status on quant_strategies(status);
