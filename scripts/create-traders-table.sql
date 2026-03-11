-- Coincess traders table (leaderboard)
CREATE TABLE IF NOT EXISTS coincess_traders (
  address TEXT PRIMARY KEY,
  first_seen BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  last_seen BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  order_count INT NOT NULL DEFAULT 1,
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

-- RPC for upsert: insert new or increment order_count + update last_seen if exists
CREATE OR REPLACE FUNCTION upsert_coincess_trader(p_address TEXT, p_now BIGINT)
RETURNS void AS $$
BEGIN
  INSERT INTO coincess_traders (address, first_seen, last_seen, order_count)
  VALUES (p_address, p_now, p_now, 1)
  ON CONFLICT (address) DO UPDATE SET
    last_seen = p_now,
    order_count = coincess_traders.order_count + 1,
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
