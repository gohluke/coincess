/**
 * Read all generated account addresses from Supabase and update
 * brand.config.ts feeWhitelist array to include them all.
 *
 * Usage:
 *   cd /path/to/coincess
 *   npx tsx scripts/whitelist-accounts.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: accounts, error } = await supabase
    .from("coincess_accounts")
    .select("address")
    .eq("is_whitelisted", true);

  if (error || !accounts) {
    console.error("Failed to fetch accounts:", error?.message);
    process.exit(1);
  }

  const configPath = resolve(process.cwd(), "lib/brand.config.ts");
  let content = readFileSync(configPath, "utf-8");

  // Collect all addresses to whitelist
  const existingMatch = content.match(/feeWhitelist:\s*\[([\s\S]*?)\]\s*as\s*readonly/);
  const existingAddresses: string[] = [];

  if (existingMatch) {
    const inner = existingMatch[1];
    const addrRegex = /"(0x[a-fA-F0-9]{40})"/g;
    let m;
    while ((m = addrRegex.exec(inner))) {
      existingAddresses.push(m[1].toLowerCase());
    }
  }

  const botAddresses = accounts.map((a) => a.address.toLowerCase());
  const all = [...new Set([...existingAddresses, ...botAddresses])];

  // Build the new whitelist block
  const indent = "      ";
  const lines = all.map((addr) => `${indent}"${addr}",`);
  const newWhitelist = `feeWhitelist: [\n${lines.join("\n")}\n    ] as readonly`;

  content = content.replace(
    /feeWhitelist:\s*\[[\s\S]*?\]\s*as\s*readonly/,
    newWhitelist,
  );

  writeFileSync(configPath, content);
  console.log(`Updated brand.config.ts with ${all.length} whitelisted addresses.`);
  console.log(`  - ${existingAddresses.length} existing`);
  console.log(`  - ${botAddresses.length} bot accounts`);
  console.log(`  - ${all.length} total (deduplicated)`);
}

main().catch(console.error);
