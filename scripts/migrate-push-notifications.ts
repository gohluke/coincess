#!/usr/bin/env npx tsx
/**
 * Create push notification tables in Supabase.
 * Usage: source .env.local && npx tsx scripts/migrate-push-notifications.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address text NOT NULL,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    device_name text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_push_subs_wallet ON push_subscriptions(wallet_address)`,
  `CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active) WHERE is_active = true`,

  `CREATE TABLE IF NOT EXISTS notification_alerts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address text NOT NULL,
    type text NOT NULL,
    coin text,
    threshold numeric,
    enabled boolean DEFAULT true,
    triggered_at timestamptz,
    one_shot boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notif_alerts_wallet ON notification_alerts(wallet_address)`,

  `CREATE TABLE IF NOT EXISTS notification_preferences (
    wallet_address text PRIMARY KEY,
    fills_enabled boolean DEFAULT true,
    funding_enabled boolean DEFAULT false,
    whale_enabled boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,

  `ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE notification_alerts ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='service_full_push_subs') THEN
      CREATE POLICY "service_full_push_subs" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_alerts' AND policyname='service_full_notif_alerts') THEN
      CREATE POLICY "service_full_notif_alerts" ON notification_alerts FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_preferences' AND policyname='service_full_notif_prefs') THEN
      CREATE POLICY "service_full_notif_prefs" ON notification_preferences FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,

  `GRANT ALL ON push_subscriptions TO anon, authenticated, service_role`,
  `GRANT ALL ON notification_alerts TO anon, authenticated, service_role`,
  `GRANT ALL ON notification_preferences TO anon, authenticated, service_role`,
  `NOTIFY pgrst, 'reload schema'`,
];

async function run() {
  console.log("Running push notification schema migration...\n");

  let rpcAvailable = false;
  const testRes = await supabase.rpc("exec_sql", { query: "SELECT 1 as test" });
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
    console.log("Please run the following SQL in your Supabase Dashboard SQL Editor:\n");
    console.log("=".repeat(70));
    console.log(STATEMENTS.join(";\n\n") + ";");
    console.log("=".repeat(70));
    console.log("\nAfter running, re-run this script to verify.\n");
  }

  console.log("\nVerifying tables...");
  for (const table of ["push_subscriptions", "notification_alerts", "notification_preferences"]) {
    const { error } = await supabase.from(table).select("*").limit(0);
    console.log(`  ${table}: ${error ? "MISSING - " + error.message : "OK"}`);
  }

  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
