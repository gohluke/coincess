-- Push Notifications Schema for Coincess
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_wallet ON push_subscriptions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS notification_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text NOT NULL,
  type text NOT NULL,
  coin text,
  threshold numeric,
  enabled boolean DEFAULT true,
  triggered_at timestamptz,
  one_shot boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_alerts_wallet ON notification_alerts(wallet_address);

CREATE TABLE IF NOT EXISTS notification_preferences (
  wallet_address text PRIMARY KEY,
  fills_enabled boolean DEFAULT true,
  funding_enabled boolean DEFAULT false,
  whale_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use service role key)
CREATE POLICY "Service role full access" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON notification_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON notification_preferences FOR ALL USING (true) WITH CHECK (true);
