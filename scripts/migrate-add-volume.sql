-- Run this in Supabase SQL Editor to add volume tracking to existing table

-- Add coincess_volume column (safe if already exists)
ALTER TABLE coincess_traders ADD COLUMN IF NOT EXISTS coincess_volume NUMERIC NOT NULL DEFAULT 0;

-- Update the RPC to accept and accumulate volume
CREATE OR REPLACE FUNCTION upsert_coincess_trader(p_address TEXT, p_now BIGINT, p_volume NUMERIC DEFAULT 0)
RETURNS void AS $$
BEGIN
  INSERT INTO coincess_traders (address, first_seen, last_seen, order_count, coincess_volume)
  VALUES (p_address, p_now, p_now, 1, COALESCE(p_volume, 0))
  ON CONFLICT (address) DO UPDATE SET
    last_seen = p_now,
    order_count = coincess_traders.order_count + 1,
    coincess_volume = coincess_traders.coincess_volume + COALESCE(p_volume, 0),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Coincess managed accounts table
CREATE TABLE IF NOT EXISTS coincess_accounts (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  private_key TEXT NOT NULL,
  agent_key TEXT,
  agent_address TEXT,
  label TEXT,
  strategy TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_whitelisted BOOLEAN NOT NULL DEFAULT true,
  deposited_usd NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  trade_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coincess_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON coincess_accounts
  FOR ALL USING (auth.role() = 'service_role');
