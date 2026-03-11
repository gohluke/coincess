/**
 * Fleet Runner - runs trading strategies across all managed Coincess accounts.
 *
 * Each account gets its own QuantEngine instance running its assigned strategy.
 * Performance stats are tracked in Supabase per-account.
 *
 * Usage:
 *   cd /path/to/coincess
 *   npx tsx scripts/fleet-runner.ts
 *   npx tsx scripts/fleet-runner.ts --strategy momentum   # only run momentum bots
 *   npx tsx scripts/fleet-runner.ts --limit 10            # run first 10 accounts
 *   npx tsx scripts/fleet-runner.ts --status              # show fleet status
 */

import { privateKeyToAccount } from "viem/accounts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HL_API = "https://api.hyperliquid.xyz";
const EXCHANGE_URL = `${HL_API}/exchange`;
const INFO_URL = `${HL_API}/info`;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface ManagedAccount {
  id: number;
  address: string;
  private_key: string;
  agent_key: string | null;
  agent_address: string | null;
  label: string;
  strategy: string;
  is_active: boolean;
  deposited_usd: number;
  total_pnl: number;
  total_volume: number;
  trade_count: number;
}

interface AccountState {
  accountValue: number;
  positions: Array<{
    coin: string;
    szi: string;
    entryPx: string;
    unrealizedPnl: string;
  }>;
}

async function fetchAccountState(address: string): Promise<AccountState | null> {
  try {
    const res = await fetch(INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: address }),
    });
    const data = await res.json();
    return {
      accountValue: parseFloat(data.marginSummary?.accountValue ?? "0"),
      positions: (data.assetPositions ?? [])
        .filter((p: { position: { szi: string } }) => parseFloat(p.position.szi) !== 0)
        .map((p: { position: { coin: string; szi: string; entryPx: string; unrealizedPnl: string } }) => ({
          coin: p.position.coin,
          szi: p.position.szi,
          entryPx: p.position.entryPx,
          unrealizedPnl: p.position.unrealizedPnl,
        })),
    };
  } catch {
    return null;
  }
}

async function showFleetStatus(db: SupabaseClient) {
  const { data: accounts } = await db
    .from("coincess_accounts")
    .select("*")
    .eq("is_active", true)
    .order("strategy");

  if (!accounts?.length) {
    console.log("No active accounts found.");
    return;
  }

  console.log("\n=== COINCESS FLEET STATUS ===\n");

  const stratGroups = new Map<string, typeof accounts>();
  for (const acc of accounts) {
    const list = stratGroups.get(acc.strategy) ?? [];
    list.push(acc);
    stratGroups.set(acc.strategy, list);
  }

  let totalValue = 0;
  let totalPnl = 0;
  let totalVolume = 0;
  let totalTrades = 0;
  let funded = 0;
  let withAgent = 0;

  for (const [strategy, accs] of stratGroups) {
    console.log(`\n--- ${strategy.toUpperCase()} (${accs.length} accounts) ---`);

    for (const acc of accs) {
      const state = await fetchAccountState(acc.address);
      const value = state?.accountValue ?? 0;
      const positions = state?.positions?.length ?? 0;

      if (value > 0) funded++;
      if (acc.agent_key) withAgent++;

      totalValue += value;
      totalPnl += acc.total_pnl;
      totalVolume += acc.total_volume;
      totalTrades += acc.trade_count;

      const status = [
        value > 0 ? `$${value.toFixed(2)}` : "unfunded",
        acc.agent_key ? "agent" : "no-agent",
        positions > 0 ? `${positions} pos` : "",
        acc.trade_count > 0 ? `${acc.trade_count} trades` : "",
        acc.total_pnl !== 0 ? `PnL: $${acc.total_pnl.toFixed(2)}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      console.log(`  ${acc.label}: ${status}`);
    }
  }

  console.log("\n=== FLEET SUMMARY ===");
  console.log(`  Accounts:     ${accounts.length} total, ${funded} funded, ${withAgent} with agents`);
  console.log(`  Total Value:  $${totalValue.toFixed(2)}`);
  console.log(`  Total Volume: $${totalVolume.toFixed(2)}`);
  console.log(`  Total Trades: ${totalTrades}`);
  console.log(`  Total PnL:    $${totalPnl.toFixed(2)}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    await showFleetStatus(supabase);
    return;
  }

  const stratFilter = args.includes("--strategy")
    ? args[args.indexOf("--strategy") + 1]
    : undefined;

  const limit = args.includes("--limit")
    ? parseInt(args[args.indexOf("--limit") + 1], 10)
    : undefined;

  let query = supabase
    .from("coincess_accounts")
    .select("*")
    .eq("is_active", true)
    .not("agent_key", "is", null);

  if (stratFilter) query = query.eq("strategy", stratFilter);
  if (limit) query = query.limit(limit);

  const { data: accounts, error } = await query;

  if (error || !accounts?.length) {
    console.error("No ready accounts found.", error?.message);
    console.log("\nMake sure accounts have been generated and agents approved:");
    console.log("  1. npx tsx scripts/generate-accounts.ts");
    console.log("  2. Fund accounts with USDC on Hyperliquid");
    console.log("  3. npx tsx scripts/approve-agents.ts");
    return;
  }

  // Check which accounts are funded
  const funded: ManagedAccount[] = [];
  for (const acc of accounts) {
    const state = await fetchAccountState(acc.address);
    if (state && state.accountValue > 1) {
      funded.push(acc as ManagedAccount);
    }
  }

  if (!funded.length) {
    console.log(`\n${accounts.length} accounts have agents, but none are funded.`);
    console.log("Deposit USDC to any of these addresses on Hyperliquid:");
    for (const acc of accounts.slice(0, 5)) {
      console.log(`  ${acc.label}: ${acc.address}`);
    }
    if (accounts.length > 5) console.log(`  ... and ${accounts.length - 5} more`);
    return;
  }

  console.log(`\nStarting fleet with ${funded.length} funded accounts...\n`);

  // Import the engine dynamically since it uses supabase env vars
  const { QuantEngine } = await import("../lib/quant/engine");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engines: Array<{ account: ManagedAccount; engine: any }> = [];

  for (const acc of funded) {
    // Set the credentials for this account's engine
    process.env.HL_ACCOUNT_ADDRESS = acc.address;
    process.env.HL_PRIVATE_KEY = acc.agent_key!;

    const engine = new QuantEngine();
    engines.push({ account: acc, engine });

    console.log(`  [${acc.label}] Starting ${acc.strategy} strategy ($${(await fetchAccountState(acc.address))?.accountValue.toFixed(2)})`);
  }

  // Start all engines
  for (const { account, engine } of engines) {
    process.env.HL_ACCOUNT_ADDRESS = account.address;
    process.env.HL_PRIVATE_KEY = account.agent_key!;
    await engine.start();
  }

  console.log(`\n Fleet running with ${engines.length} accounts. Press Ctrl+C to stop.\n`);

  // Periodic stats update
  const statsInterval = setInterval(async () => {
    for (const { account } of engines) {
      const state = await fetchAccountState(account.address);
      if (!state) continue;

      await supabase
        .from("coincess_accounts")
        .update({
          deposited_usd: state.accountValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
    }
  }, 60_000);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nStopping fleet...");
    clearInterval(statsInterval);

    for (const { account, engine } of engines) {
      process.env.HL_ACCOUNT_ADDRESS = account.address;
      process.env.HL_PRIVATE_KEY = account.agent_key!;
      await engine.stop();
      console.log(`  [${account.label}] Stopped`);
    }

    console.log("Fleet stopped.");
    process.exit(0);
  });
}

main().catch(console.error);
