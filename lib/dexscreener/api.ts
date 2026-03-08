const BASE = "https://api.dexscreener.com";

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: { m5: number; h1: number; h6: number; h24: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export interface BoostedToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { label: string; type: string; url: string }[];
  amount: number;
  totalAmount: number;
}

export async function fetchTrendingTokens(): Promise<BoostedToken[]> {
  const res = await fetch(`${BASE}/token-boosts/top/v1`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchLatestBoosted(): Promise<BoostedToken[]> {
  const res = await fetch(`${BASE}/token-boosts/latest/v1`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchLatestProfiles(): Promise<BoostedToken[]> {
  const res = await fetch(`${BASE}/token-profiles/latest/v1`);
  if (!res.ok) return [];
  return res.json();
}

export async function searchTokens(query: string): Promise<DexPair[]> {
  const res = await fetch(`${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.pairs ?? [];
}

export async function fetchTokenPairs(address: string): Promise<DexPair[]> {
  const res = await fetch(`${BASE}/latest/dex/tokens/${address}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.pairs ?? [];
}

export async function fetchPairsByChain(chain: string, pairAddress: string): Promise<DexPair[]> {
  const res = await fetch(`${BASE}/latest/dex/pairs/${chain}/${pairAddress}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.pairs ?? [];
}

export function chainLabel(chainId: string): string {
  const map: Record<string, string> = {
    solana: "Solana",
    ethereum: "Ethereum",
    bsc: "BSC",
    base: "Base",
    arbitrum: "Arbitrum",
    polygon: "Polygon",
    avalanche: "Avalanche",
    optimism: "Optimism",
    blast: "Blast",
    sui: "Sui",
    ton: "TON",
  };
  return map[chainId] ?? chainId;
}

export function chainColor(chainId: string): string {
  const map: Record<string, string> = {
    solana: "#9945FF",
    ethereum: "#627EEA",
    bsc: "#F0B90B",
    base: "#0052FF",
    arbitrum: "#28A0F0",
    polygon: "#8247E5",
    avalanche: "#E84142",
    optimism: "#FF0420",
    blast: "#FCFC03",
    sui: "#4DA2FF",
    ton: "#0098EA",
  };
  return map[chainId] ?? "#848e9c";
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatUsd(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  if (val <= 0) return "$0.00";
  const s = val.toFixed(20);
  const afterDot = s.split(".")[1] ?? "";
  let zeros = 0;
  for (const ch of afterDot) {
    if (ch === "0") zeros++;
    else break;
  }
  const sig = afterDot.slice(zeros, zeros + 4);
  return `$0.0…${zeros}${sig}`;
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
export function formatPrice(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  if (val <= 0) return "$0.00";
  const s = val.toFixed(20);
  const afterDot = s.split(".")[1] ?? "";
  let zeros = 0;
  for (const ch of afterDot) {
    if (ch === "0") zeros++;
    else break;
  }
  const sig = afterDot.slice(zeros, zeros + 4);
  const sub = String(zeros).split("").map((d) => SUBSCRIPT_DIGITS[parseInt(d)]).join("");
  return `$0.0${sub}${sig}`;
}
