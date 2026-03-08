const BASE = "https://api.gopluslabs.io/api/v1";

export interface TokenSecurity {
  is_open_source: string;
  is_proxy: string;
  is_mintable: string;
  can_take_back_ownership: string;
  owner_change_balance: string;
  hidden_owner: string;
  selfdestruct: string;
  external_call: string;
  buy_tax: string;
  sell_tax: string;
  is_honeypot: string;
  honeypot_with_same_creator: string;
  is_blacklisted: string;
  is_whitelisted: string;
  transfer_pausable: string;
  trading_cooldown: string;
  is_anti_whale: string;
  anti_whale_modifiable: string;
  slippage_modifiable: string;
  personal_slippage_modifiable: string;
  cannot_buy: string;
  cannot_sell_all: string;
  holder_count: string;
  lp_holder_count: string;
  is_true_token: string;
  is_airdrop_scam: string;
  trust_list: string;
  token_name: string;
  token_symbol: string;
  total_supply: string;
  creator_address: string;
  owner_address: string;
  lp_total_supply: string;
}

export interface SecurityResult {
  address: string;
  chainId: string;
  data: TokenSecurity | null;
  score: number;
  risks: string[];
  warnings: string[];
  safe: string[];
}

const CHAIN_IDS: Record<string, string> = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  avalanche: "43114",
  base: "8453",
  solana: "solana",
};

export function getSupportedChains(): string[] {
  return Object.keys(CHAIN_IDS);
}

export async function checkTokenSecurity(
  chain: string,
  address: string
): Promise<SecurityResult> {
  const chainId = CHAIN_IDS[chain.toLowerCase()] ?? chain;
  const result: SecurityResult = {
    address,
    chainId,
    data: null,
    score: 0,
    risks: [],
    warnings: [],
    safe: [],
  };

  try {
    const endpoint =
      chainId === "solana"
        ? `${BASE}/solana/token_security?contract_addresses=${address}`
        : `${BASE}/token_security/${chainId}?contract_addresses=${address}`;

    const res = await fetch(endpoint);
    if (!res.ok) return result;

    const json = await res.json();
    const data = json?.result?.[address.toLowerCase()] ?? json?.result?.[address] ?? null;
    if (!data) return result;
    result.data = data;

    let score = 100;

    if (data.is_honeypot === "1") {
      result.risks.push("Honeypot — cannot sell");
      score -= 50;
    }
    if (data.cannot_buy === "1") {
      result.risks.push("Cannot buy");
      score -= 30;
    }
    if (data.cannot_sell_all === "1") {
      result.risks.push("Cannot sell all tokens");
      score -= 30;
    }
    if (data.is_mintable === "1") {
      result.warnings.push("Mintable — supply can increase");
      score -= 15;
    }
    if (data.is_proxy === "1") {
      result.warnings.push("Proxy contract — code can change");
      score -= 15;
    }
    if (data.hidden_owner === "1") {
      result.risks.push("Hidden owner detected");
      score -= 25;
    }
    if (data.selfdestruct === "1") {
      result.risks.push("Self-destruct function");
      score -= 30;
    }
    if (data.owner_change_balance === "1") {
      result.risks.push("Owner can change balances");
      score -= 30;
    }
    if (data.can_take_back_ownership === "1") {
      result.warnings.push("Ownership can be reclaimed");
      score -= 15;
    }
    if (data.transfer_pausable === "1") {
      result.warnings.push("Transfers can be paused");
      score -= 10;
    }
    if (data.trading_cooldown === "1") {
      result.warnings.push("Trading cooldown enabled");
      score -= 5;
    }
    if (data.is_blacklisted === "1") {
      result.warnings.push("Blacklist function exists");
      score -= 10;
    }
    if (data.slippage_modifiable === "1") {
      result.warnings.push("Tax/slippage can be modified");
      score -= 10;
    }
    if (data.is_airdrop_scam === "1") {
      result.risks.push("Airdrop scam detected");
      score -= 40;
    }

    const buyTax = parseFloat(data.buy_tax || "0");
    const sellTax = parseFloat(data.sell_tax || "0");
    if (buyTax > 0.1 || sellTax > 0.1) {
      result.warnings.push(`High tax: ${(buyTax * 100).toFixed(1)}% buy / ${(sellTax * 100).toFixed(1)}% sell`);
      score -= 10;
    }

    if (data.is_open_source === "1") result.safe.push("Open source");
    if (data.is_honeypot === "0") result.safe.push("Not a honeypot");
    if (data.is_mintable === "0") result.safe.push("Not mintable");
    if (data.is_proxy === "0") result.safe.push("Not a proxy");
    if (data.hidden_owner === "0") result.safe.push("No hidden owner");
    if (data.trust_list === "1") result.safe.push("On trust list");

    result.score = Math.max(0, Math.min(100, score));
  } catch (err) {
    console.error("GoPlus API error:", err);
  }

  return result;
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#0ECB81";
  if (score >= 60) return "#F0B90B";
  if (score >= 40) return "#F6465D";
  return "#FF3B3B";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Safe";
  if (score >= 60) return "Caution";
  if (score >= 40) return "Risky";
  return "Dangerous";
}
