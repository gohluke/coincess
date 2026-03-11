/**
 * Approve agent wallets for all generated accounts.
 * Since we own every private key, we can sign the EIP-712 approval directly
 * without MetaMask.
 *
 * Usage:
 *   cd /path/to/coincess
 *   npx tsx scripts/approve-agents.ts
 *   npx tsx scripts/approve-agents.ts --dry-run
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { arbitrum } from "viem/chains";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";
const BRAND_NAME = "Coincess";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const isDryRun = process.argv.includes("--dry-run");

const ApproveAgentTypes = {
  "HyperliquidTransaction:ApproveAgent": [
    { name: "hyperliquidChain", type: "string" },
    { name: "agentAddress", type: "address" },
    { name: "agentName", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

const EIP712_DOMAIN = {
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: 421614, // Arbitrum Sepolia for signing (0x66eee)
  verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

async function approveAgent(
  mainPrivateKey: `0x${string}`,
  mainAddress: string,
): Promise<{ agentKey: string; agentAddress: string } | null> {
  const agentKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentKey);

  const nonce = Date.now();
  const action = {
    type: "approveAgent" as const,
    signatureChainId: "0x66eee" as `0x${string}`,
    hyperliquidChain: "Mainnet" as const,
    agentAddress: agentAccount.address.toLowerCase() as `0x${string}`,
    agentName: BRAND_NAME,
    nonce,
  };

  const mainAccount = privateKeyToAccount(mainPrivateKey);
  const walletClient = createWalletClient({
    account: mainAccount,
    chain: arbitrum,
    transport: http(),
  });

  const signature = await walletClient.signTypedData({
    domain: EIP712_DOMAIN,
    types: ApproveAgentTypes,
    primaryType: "HyperliquidTransaction:ApproveAgent",
    message: {
      hyperliquidChain: "Mainnet",
      agentAddress: agentAccount.address.toLowerCase() as `0x${string}`,
      agentName: BRAND_NAME,
      nonce: BigInt(nonce),
    },
  });

  const res = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, signature, nonce }),
  });

  const data = await res.json();

  if (data.status === "ok") {
    return { agentKey, agentAddress: agentAccount.address.toLowerCase() };
  }

  console.error(`  Failed for ${mainAddress}:`, JSON.stringify(data));
  return null;
}

async function main() {
  const { data: accounts, error } = await supabase
    .from("coincess_accounts")
    .select("id, address, private_key, agent_key, agent_address")
    .eq("is_active", true);

  if (error || !accounts) {
    console.error("Failed to fetch accounts:", error?.message);
    process.exit(1);
  }

  const needApproval = accounts.filter((a) => !a.agent_key);
  console.log(
    `Found ${accounts.length} accounts, ${needApproval.length} need agent approval.`,
  );

  if (isDryRun) {
    console.log("Dry run - skipping approvals.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < needApproval.length; i++) {
    const acc = needApproval[i];
    const pct = `[${i + 1}/${needApproval.length}]`;

    try {
      const result = await approveAgent(
        acc.private_key as `0x${string}`,
        acc.address,
      );

      if (result) {
        await supabase
          .from("coincess_accounts")
          .update({
            agent_key: result.agentKey,
            agent_address: result.agentAddress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", acc.id);

        console.log(`${pct} Approved: ${acc.address} -> agent ${result.agentAddress}`);
        success++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`${pct} Error for ${acc.address}:`, (err as Error).message);
      failed++;
    }

    // Hyperliquid rate limiting: ~100ms between requests
    if (i < needApproval.length - 1) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  console.log(`\nDone: ${success} approved, ${failed} failed.`);
}

main().catch(console.error);
