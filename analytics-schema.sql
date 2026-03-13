-- Analytics schema for Coincess
-- Run this in Supabase SQL editor

-- Page views: every page hit across the entire site
CREATE TABLE IF NOT EXISTS page_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  path text NOT NULL,
  referrer text,
  user_agent text,
  wallet_address text,
  session_id text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path);
CREATE INDEX IF NOT EXISTS idx_page_views_wallet ON page_views (wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views (session_id);

-- Click events: track specific user interactions
CREATE TABLE IF NOT EXISTS click_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name text NOT NULL,
  path text NOT NULL,
  target text,
  wallet_address text,
  session_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_click_events_created ON click_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_name ON click_events (event_name);

-- User sessions: track logged-in wallet users across pages
CREATE TABLE IF NOT EXISTS user_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text NOT NULL,
  session_id text NOT NULL,
  path text NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  duration_ms int
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_wallet ON user_sessions (wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_sessions_entered ON user_sessions (entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions (session_id);

-- Enable RLS but allow inserts from anon (tracking is public, reads are admin-only)
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Anon can insert (tracking)
CREATE POLICY "anon_insert_page_views" ON page_views FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_click_events" ON click_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_user_sessions" ON user_sessions FOR INSERT TO anon WITH CHECK (true);

-- Service role can read (admin dashboard)
CREATE POLICY "service_read_page_views" ON page_views FOR SELECT TO service_role USING (true);
CREATE POLICY "service_read_click_events" ON click_events FOR SELECT TO service_role USING (true);
CREATE POLICY "service_read_user_sessions" ON user_sessions FOR SELECT TO service_role USING (true);

-- Helper RPCs for admin dashboard

CREATE OR REPLACE FUNCTION get_top_pages(since timestamptz, lim int DEFAULT 20)
RETURNS TABLE(path text, views bigint) AS $$
  SELECT path, count(*) AS views
  FROM page_views
  WHERE created_at >= since
  GROUP BY path
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_top_clicks(since timestamptz, lim int DEFAULT 15)
RETURNS TABLE(target text, event_name text, clicks bigint) AS $$
  SELECT target, event_name, count(*) AS clicks
  FROM click_events
  WHERE created_at >= since
  GROUP BY target, event_name
  ORDER BY clicks DESC
  LIMIT lim;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_hourly_views(since timestamptz)
RETURNS TABLE(hour timestamptz, views bigint) AS $$
  SELECT date_trunc('hour', created_at) AS hour, count(*) AS views
  FROM page_views
  WHERE created_at >= since
  GROUP BY hour
  ORDER BY hour;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: increment blog view count (if not already exists)
CREATE OR REPLACE FUNCTION increment_blog_view_count(post_id text)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts SET view_count = view_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
