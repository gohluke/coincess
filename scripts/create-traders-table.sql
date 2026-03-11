-- Coincess traders table (leaderboard)
CREATE TABLE IF NOT EXISTS coincess_traders (
  address TEXT PRIMARY KEY,
  first_seen BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  last_seen BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  order_count INT NOT NULL DEFAULT 1,
  coincess_volume NUMERIC NOT NULL DEFAULT 0,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE coincess_traders ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (public leaderboard)
CREATE POLICY "Anyone can read traders" ON coincess_traders FOR SELECT USING (true);

-- Allow inserts/updates via anon key (called from the frontend)
CREATE POLICY "Anyone can insert traders" ON coincess_traders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update traders" ON coincess_traders FOR UPDATE USING (true);

-- RPC for upsert: insert new or increment order_count + accumulate volume
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

-- Starred traders table (per-user favorites)
CREATE TABLE IF NOT EXISTS coincess_starred_traders (
  user_address TEXT NOT NULL,
  trader_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_address, trader_address)
);

ALTER TABLE coincess_starred_traders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read starred" ON coincess_starred_traders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert starred" ON coincess_starred_traders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete starred" ON coincess_starred_traders FOR DELETE USING (true);

-- =======================================================================
-- Coincess managed accounts (automated trading fleet)
-- =======================================================================

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

-- Only service role can access (private keys inside)
CREATE POLICY "Service role only" ON coincess_accounts
  FOR ALL USING (auth.role() = 'service_role');
