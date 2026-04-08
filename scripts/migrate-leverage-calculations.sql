-- Run in Supabase SQL Editor (once) to enable saved leverage calculator scenarios.
-- Table: leverage_calculator_saves

create table if not exists public.leverage_calculator_saves (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  title text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists leverage_calculator_saves_wallet_created_idx
  on public.leverage_calculator_saves (wallet_address, created_at desc);

comment on table public.leverage_calculator_saves is 'User-saved crypto leverage calculator inputs (Coincess)';
