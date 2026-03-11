/**
 * Generate N trading accounts, store them in Supabase, and output
 * the addresses for whitelisting.
 *
 * Usage:
 *   cd /path/to/coincess
 *   npx tsx scripts/generate-accounts.ts [count] [strategy]
 *
 * Examples:
 *   npx tsx scripts/generate-accounts.ts 100
 *   npx tsx scripts/generate-accounts.ts 20 momentum
 *   npx tsx scripts/generate-accounts.ts 10 grid --label "grid-bots"
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STRATEGIES = [
  "funding_rate",
  "momentum",
  "grid",
  "mean_reversion",
  "market_maker",
] as const;

async function main() {
  const count = parseInt(process.argv[2] || "100", 10);
  const strategy = process.argv[3] || "auto";
  const label = process.argv.includes("--label")
    ? process.argv[process.argv.indexOf("--label") + 1]
    : undefined;

  console.log(`Generating ${count} accounts...`);

  const accounts: Array<{
    address: string;
    private_key: string;
    strategy: string;
    label: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);

    const strat =
      strategy === "auto"
        ? STRATEGIES[i % STRATEGIES.length]
        : strategy;

    accounts.push({
      address: account.address.toLowerCase(),
      private_key: pk,
      strategy: strat,
      label: label || `bot-${strat}-${String(i + 1).padStart(3, "0")}`,
    });
  }

  console.log(`Inserting ${accounts.length} accounts into Supabase...`);

  const rows = accounts.map((a) => ({
    address: a.address,
    private_key: a.private_key,
    label: a.label,
    strategy: a.strategy,
    is_active: true,
    is_whitelisted: true,
    deposited_usd: 0,
    total_pnl: 0,
    total_volume: 0,
    trade_count: 0,
  }));

  const { error } = await supabase
    .from("coincess_accounts")
    .upsert(rows, { onConflict: "address" });

  if (error) {
    console.error("Supabase insert error:", error.message);
    process.exit(1);
  }

  console.log(`Inserted ${accounts.length} accounts.`);

  // Output addresses for whitelisting in brand.config.ts
  const addresses = accounts.map((a) => a.address);
  const whitelistPath = resolve(process.cwd(), "scripts/generated-addresses.json");
  writeFileSync(whitelistPath, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses saved to ${whitelistPath}`);

  // Summary table
  const stratCounts = new Map<string, number>();
  for (const a of accounts) {
    stratCounts.set(a.strategy, (stratCounts.get(a.strategy) || 0) + 1);
  }

  console.log("\n--- Strategy Distribution ---");
  for (const [s, c] of stratCounts) {
    console.log(`  ${s}: ${c} accounts`);
  }

  console.log(`\nTotal: ${accounts.length} accounts generated`);
  console.log("\nNext steps:");
  console.log("  1. Run: npx tsx scripts/migrate-add-volume.sql  (in Supabase SQL Editor)");
  console.log("  2. Fund accounts with USDC on Hyperliquid");
  console.log("  3. Run: npx tsx scripts/approve-agents.ts       (approve agent wallets)");
  console.log("  4. Run: npx tsx scripts/fleet-runner.ts          (start all bots)");
}

main().catch(console.error);
