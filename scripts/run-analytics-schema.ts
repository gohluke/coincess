#!/usr/bin/env npx tsx
/**
 * Create analytics tables in Supabase.
 * Uses exec_sql RPC if available, otherwise prints SQL for manual execution.
 *
 * Usage:  source .env.local && npx tsx scripts/run-analytics-schema.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS page_views (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    path text NOT NULL,
    referrer text,
    user_agent text,
    wallet_address text,
    session_id text,
    country text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_wallet ON page_views (wallet_address) WHERE wallet_address IS NOT NULL`,

  `CREATE TABLE IF NOT EXISTS click_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_name text NOT NULL,
    path text NOT NULL,
    target text,
    wallet_address text,
    session_id text,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_click_events_created ON click_events (created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS user_sessions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_address text NOT NULL,
    session_id text NOT NULL,
    path text NOT NULL,
    entered_at timestamptz NOT NULL DEFAULT now(),
    duration_ms int
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_sessions_wallet ON user_sessions (wallet_address)`,
  `CREATE INDEX IF NOT EXISTS idx_user_sessions_entered ON user_sessions (entered_at DESC)`,

  // RLS
  `ALTER TABLE page_views ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE click_events ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_views' AND policyname='anon_insert_page_views') THEN
      CREATE POLICY "anon_insert_page_views" ON page_views FOR INSERT TO anon WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='click_events' AND policyname='anon_insert_click_events') THEN
      CREATE POLICY "anon_insert_click_events" ON click_events FOR INSERT TO anon WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='anon_insert_user_sessions') THEN
      CREATE POLICY "anon_insert_user_sessions" ON user_sessions FOR INSERT TO anon WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_views' AND policyname='service_read_page_views') THEN
      CREATE POLICY "service_read_page_views" ON page_views FOR SELECT TO service_role USING (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='click_events' AND policyname='service_read_click_events') THEN
      CREATE POLICY "service_read_click_events" ON click_events FOR SELECT TO service_role USING (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='service_read_user_sessions') THEN
      CREATE POLICY "service_read_user_sessions" ON user_sessions FOR SELECT TO service_role USING (true);
    END IF;
  END $$`,

  // Grants
  `GRANT ALL ON page_views TO anon, authenticated, service_role`,
  `GRANT ALL ON click_events TO anon, authenticated, service_role`,
  `GRANT ALL ON user_sessions TO anon, authenticated, service_role`,

  // Reload PostgREST schema cache
  `NOTIFY pgrst, 'reload schema'`,
];

async function run() {
  console.log("Running analytics schema migration...\n");

  let rpcAvailable = false;
  const testRes = await supabase.rpc("exec_sql", {
    query: "SELECT 1 as test",
  });
  if (!testRes.error) rpcAvailable = true;

  if (rpcAvailable) {
    console.log("Using exec_sql RPC...\n");
    for (const sql of STATEMENTS) {
      const label = sql.trim().slice(0, 60).replace(/\s+/g, " ");
      const { error } = await supabase.rpc("exec_sql", { query: sql });
      console.log(`  ${error ? "[!]" : "[OK]"} ${label}...`);
      if (error) console.log(`       ${error.message}`);
    }
  } else {
    console.log("exec_sql RPC not available.");
    console.log(
      "Please run the following SQL in your Supabase Dashboard SQL Editor:\n"
    );
    console.log("=".repeat(70));
    console.log(STATEMENTS.join(";\n\n") + ";");
    console.log("=".repeat(70));
    console.log(
      "\nAfter running the SQL, verify by re-running this script.\n"
    );
  }

  // Verify tables
  console.log("\nVerifying tables...");
  for (const table of ["page_views", "click_events", "user_sessions"]) {
    const { error } = await supabase.from(table).select("id").limit(0);
    console.log(`  ${table}: ${error ? "MISSING" : "OK"}`);
  }

  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
