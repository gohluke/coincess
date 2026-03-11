"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Wallet,
  Zap,
  CreditCard,
  Link2,
  Copy,
  Check,
  ExternalLink,
  ArrowDownToLine,
  ChevronLeft,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { fetchCombinedClearinghouseState } from "@/lib/hyperliquid/api";

const BALANCE_OF_SIG = "0x70a08231";

interface ChainConfig {
  id: string;
  name: string;
  rpc: string;
  color: string;
  icon: string;
  nativeSymbol: string;
  nativeDecimals: number;
  tokens: { symbol: string; name: string; address: string; decimals: number }[];
}

const CHAINS: ChainConfig[] = [
  {
    id: "ethereum", name: "Ethereum", rpc: "https://eth.llamarpc.com", color: "#627EEA", icon: "⟠",
    nativeSymbol: "ETH", nativeDecimals: 18,
    tokens: [
      { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { symbol: "USDT", name: "Tether", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { symbol: "DAI", name: "Dai", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
      { symbol: "WBTC", name: "Wrapped BTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
      { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
      { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
    ],
  },
  {
    id: "arbitrum", name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc", color: "#28A0F0", icon: "🔷",
    nativeSymbol: "ETH", nativeDecimals: 18,
    tokens: [
      { symbol: "USDC", name: "USD Coin", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      { symbol: "USDC.e", name: "Bridged USDC", address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", decimals: 6 },
      { symbol: "ARB", name: "Arbitrum", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 },
      { symbol: "WBTC", name: "Wrapped BTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
      { symbol: "UNI", name: "Uniswap", address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", decimals: 18 },
      { symbol: "LINK", name: "Chainlink", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18 },
    ],
  },
  {
    id: "polygon", name: "Polygon", rpc: "https://polygon-rpc.com", color: "#8247E5", icon: "⬟",
    nativeSymbol: "POL", nativeDecimals: 18,
    tokens: [
      { symbol: "USDC", name: "USD Coin", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
      { symbol: "USDT", name: "Tether", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
      { symbol: "WETH", name: "Wrapped ETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
      { symbol: "1INCH", name: "1inch", address: "0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f", decimals: 18 },
      { symbol: "UNI", name: "Uniswap", address: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f", decimals: 18 },
    ],
  },
  {
    id: "bsc", name: "BNB Chain", rpc: "https://bsc-dataseed1.binance.org", color: "#F0B90B", icon: "🟡",
    nativeSymbol: "BNB", nativeDecimals: 18,
    tokens: [
      { symbol: "USDT", name: "Tether", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
      { symbol: "USDC", name: "USD Coin", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    ],
  },
  {
    id: "base", name: "Base", rpc: "https://mainnet.base.org", color: "#0052FF", icon: "🔵",
    nativeSymbol: "ETH", nativeDecimals: 18,
    tokens: [
      { symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    ],
  },
  {
    id: "optimism", name: "Optimism", rpc: "https://mainnet.optimism.io", color: "#FF0420", icon: "🔴",
    nativeSymbol: "ETH", nativeDecimals: 18,
    tokens: [
      { symbol: "USDC", name: "USD Coin", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
      { symbol: "OP", name: "Optimism", address: "0x4200000000000000000000000000000000000042", decimals: 18 },
    ],
  },
];

interface TokenBalance {
  symbol: string;
  name: string;
  chain: string;
  chainIcon: string;
  chainColor: string;
  balance: number;
  usdValue: number;
  decimals: number;
  color: string;
}

function fmtUsd(n: number) {
  return "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PRICE_STABLES = new Set(["USDC", "USDC.e", "USDT", "DAI"]);
const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum", WETH: "ethereum", WBTC: "wrapped-bitcoin", ARB: "arbitrum",
  UNI: "uniswap", LINK: "chainlink", BNB: "binancecoin", POL: "matic-network",
  OP: "optimism", "1INCH": "1inch",
};

async function fetchTokenPrices(): Promise<Record<string, number>> {
  const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",");
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const [sym, cgId] of Object.entries(COINGECKO_IDS)) {
      prices[sym] = data[cgId]?.usd ?? 0;
    }
    return prices;
  } catch {
    return {};
  }
}

async function rpcCall(rpc: string, method: string, params: unknown[]): Promise<string> {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const data = await res.json();
    return data.result ?? "0x0";
  } catch {
    return "0x0";
  }
}

async function fetchAllChainBalances(wallet: string): Promise<TokenBalance[]> {
  const prices = await fetchTokenPrices();
  const results: TokenBalance[] = [];

  await Promise.all(CHAINS.map(async (chain) => {
    const paddedWallet = "0x" + wallet.slice(2).toLowerCase().padStart(64, "0");

    // Native balance
    try {
      const hex = await rpcCall(chain.rpc, "eth_getBalance", [wallet, "latest"]);
      const raw = Number(BigInt(hex)) / 10 ** chain.nativeDecimals;
      if (raw > 0.0001) {
        const price = PRICE_STABLES.has(chain.nativeSymbol) ? 1 : (prices[chain.nativeSymbol] ?? 0);
        results.push({
          symbol: chain.nativeSymbol, name: chain.nativeSymbol, chain: chain.name,
          chainIcon: chain.icon, chainColor: chain.color, balance: raw,
          usdValue: raw * price, decimals: chain.nativeDecimals, color: chain.color,
        });
      }
    } catch { /* skip */ }

    // ERC-20 balances
    await Promise.all(chain.tokens.map(async (tok) => {
      try {
        const callData = BALANCE_OF_SIG + paddedWallet.slice(2);
        const hex = await rpcCall(chain.rpc, "eth_call", [{ to: tok.address, data: callData }, "latest"]);
        const raw = Number(BigInt(hex || "0x0")) / 10 ** tok.decimals;
        if (raw > 0.0001) {
          const price = PRICE_STABLES.has(tok.symbol) ? 1 : (prices[tok.symbol] ?? 0);
          results.push({
            symbol: tok.symbol, name: tok.name, chain: chain.name,
            chainIcon: chain.icon, chainColor: chain.color, balance: raw,
            usdValue: raw * price, decimals: tok.decimals, color: chain.color,
          });
        }
      } catch { /* skip */ }
    }));
  }));

  results.sort((a, b) => b.usdValue - a.usdValue);
  return results;
}

// ─── Exported button ────────────────────────────────────────

export function DepositButton({ variant = "default" }: { variant?: "default" | "icon" }) {
  const { address } = useEffectiveAddress();
  const [open, setOpen] = useState(false);

  if (!address) return null;

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[#1a1d26] hover:bg-[#252830] border border-[#2a2e3e] transition-colors"
          title="Deposit"
        >
          <ArrowDownToLine className="h-4 w-4 text-[#848e9c]" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-colors"
        >
          Deposit
        </button>
      )}
      {open && createPortal(
        <DepositModal address={address} onClose={() => setOpen(false)} />,
        document.body
      )}
    </>
  );
}

// ─── Modal ──────────────────────────────────────────────────

type Step = "methods" | "tokens" | "amount";

function DepositModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>("methods");
  const [hlBalance, setHlBalance] = useState<number | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const [walletTotal, setWalletTotal] = useState<number | null>(null);

  useEffect(() => {
    fetchCombinedClearinghouseState(address)
      .then((ch) => setHlBalance(parseFloat(ch.marginSummary.accountValue || "0")))
      .catch(() => {});
    // Eagerly load cross-chain balances for the wallet total
    loadWalletBalances();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const loadWalletBalances = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const balances = await fetchAllChainBalances(address);
      setTokenBalances(balances);
      setWalletTotal(balances.reduce((s, b) => s + b.usdValue, 0));
    } catch {
      // silent
    }
    setLoadingTokens(false);
  }, [address]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const selectToken = (tb: TokenBalance) => {
    setSelectedToken(tb);
    setAmount("");
    setStep("amount");
  };

  const goToTokens = () => {
    setStep("tokens");
    if (tokenBalances.length === 0) loadWalletBalances();
  };

  const pctAmount = (pct: number) => {
    if (!selectedToken) return;
    const val = selectedToken.balance * pct;
    setAmount(val.toFixed(selectedToken.decimals <= 6 ? 5 : 8));
  };

  const parsedAmount = parseFloat(amount) || 0;
  const usdAmount = selectedToken
    ? parsedAmount * (PRICE_STABLES.has(selectedToken.symbol) ? 1 : selectedToken.usdValue / (selectedToken.balance || 1))
    : 0;

  const shortAddr = `...${address.slice(-4)}`;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1d2e] border border-[#2a2e3e] rounded-2xl shadow-2xl shadow-black/50 w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          {step !== "methods" ? (
            <button onClick={() => setStep(step === "amount" ? "tokens" : "methods")} className="p-1 text-[#848e9c] hover:text-white transition-colors rounded-lg hover:bg-[#2a2e3e]">
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-6" />
          )}
          <h2 className="text-sm font-bold text-white">Deposit USDC</h2>
          <button onClick={onClose} className="p-1 text-[#848e9c] hover:text-white transition-colors rounded-lg hover:bg-[#2a2e3e]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          {step === "methods" && (
            <MethodsStep
              address={address}
              shortAddr={shortAddr}
              hlBalance={hlBalance}
              walletTotal={walletTotal}
              loadingTokens={loadingTokens}
              copied={copied}
              onCopy={handleCopy}
              onTransfer={goToTokens}
              onWalletClick={goToTokens}
            />
          )}
          {step === "tokens" && (
            <TokensStep
              balances={tokenBalances}
              loading={loadingTokens}
              onSelect={selectToken}
            />
          )}
          {step === "amount" && selectedToken && (
            <AmountStep
              token={selectedToken}
              amount={amount}
              setAmount={setAmount}
              usdAmount={usdAmount}
              onPct={pctAmount}
              address={address}
            />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Step 1: Methods ────────────────────────────────────────

function MethodsStep({
  address,
  shortAddr,
  hlBalance,
  walletTotal,
  loadingTokens,
  copied,
  onCopy,
  onTransfer,
  onWalletClick,
}: {
  address: string;
  shortAddr: string;
  hlBalance: number | null;
  walletTotal: number | null;
  loadingTokens: boolean;
  copied: boolean;
  onCopy: () => void;
  onTransfer: () => void;
  onWalletClick: () => void;
}) {
  return (
    <div className="space-y-2">
      {/* Wallet balance card — shows total across all chains */}
      <button
        onClick={onWalletClick}
        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#141620] border border-[#3a3e4e] hover:border-[#4a4e5e] transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
          <Wallet className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-semibold text-white">Wallet ({shortAddr})</p>
          <p className="text-[11px] text-[#848e9c]">
            {loadingTokens ? "Loading..." : walletTotal !== null ? fmtUsd(walletTotal) : "..."} &middot; Instant
          </p>
        </div>
        <ChevronLeft className="h-3.5 w-3.5 text-[#848e9c] rotate-180 shrink-0 group-hover:text-white transition-colors" />
      </button>

      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-[#2a2e3e]" />
        <span className="text-[10px] text-[#848e9c]">more</span>
        <div className="flex-1 h-px bg-[#2a2e3e]" />
      </div>

      {/* Transfer crypto (→ token select) */}
      <button
        onClick={onTransfer}
        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-blue-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">Transfer Crypto</p>
          <p className="text-[11px] text-[#848e9c]">No limit &middot; Instant</p>
        </div>
        <div className="flex -space-x-1.5">
          {["⟠", "💲", "🔷", "₿"].map((e, i) => (
            <span key={i} className="w-5 h-5 rounded-full bg-[#2a2e3e] flex items-center justify-center text-[10px]">{e}</span>
          ))}
        </div>
      </button>

      {/* Deposit with card */}
      <a
        href={`https://app.hyperliquid.xyz/buy?address=${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
          <CreditCard className="h-4 w-4 text-brand" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white group-hover:text-brand transition-colors">Deposit with Card</p>
          <p className="text-[11px] text-[#848e9c]">$20,000 &middot; 5 min</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-orange-400">●</span>
          <span className="text-[10px] font-bold text-blue-400">VISA</span>
        </div>
      </a>

      {/* Bridge from Arbitrum */}
      <a
        href="https://app.hyperliquid.xyz/trade"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
          <ArrowDownToLine className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">Bridge from Arbitrum</p>
          <p className="text-[11px] text-[#848e9c]">No limit &middot; 2 min</p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-[#848e9c] group-hover:text-emerald-400 transition-colors shrink-0" />
      </a>

      {/* Connect exchange */}
      <a
        href="https://app.hyperliquid.xyz/trade"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-[#848e9c]/10 flex items-center justify-center shrink-0">
          <Link2 className="h-4 w-4 text-[#848e9c]" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white group-hover:text-white/80 transition-colors">Connect Exchange</p>
          <p className="text-[11px] text-[#848e9c]">No limit &middot; 2 min</p>
        </div>
        <div className="flex -space-x-1.5">
          {["🟠", "🟡", "🟢", "🔵"].map((e, i) => (
            <span key={i} className="w-5 h-5 rounded-full bg-[#2a2e3e] flex items-center justify-center text-[10px]">{e}</span>
          ))}
        </div>
      </a>
    </div>
  );
}

// ─── Step 2: Token selection ────────────────────────────────

function TokensStep({
  balances,
  loading,
  onSelect,
}: {
  balances: TokenBalance[];
  loading: boolean;
  onSelect: (tb: TokenBalance) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 text-brand animate-spin" />
        <p className="text-xs text-[#848e9c]">Loading wallet balances...</p>
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="text-center py-16">
        <Wallet className="h-8 w-8 text-[#848e9c] mx-auto mb-3" />
        <p className="text-sm text-[#848e9c]">No tokens found</p>
        <p className="text-[11px] text-[#848e9c] mt-1">No token balances detected across supported chains</p>
      </div>
    );
  }

  const total = balances.reduce((s, b) => s + b.usdValue, 0);

  return (
    <div className="space-y-1">
      <div className="text-center py-2 mb-1">
        <p className="text-2xl font-bold text-white">{fmtUsd(total)}</p>
        <p className="text-[10px] text-[#848e9c]">{balances.length} tokens across {new Set(balances.map((b) => b.chain)).size} chains</p>
      </div>
      {balances.map((tb, i) => (
        <button
          key={`${tb.chain}-${tb.symbol}-${i}`}
          onClick={() => onSelect(tb)}
          className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[#141620] transition-colors group"
        >
          <div className="relative shrink-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
              style={{ backgroundColor: tb.color + "22" }}
            >
              {tb.symbol === "ETH" || tb.symbol === "WETH" ? "⟠" : tb.symbol === "BNB" ? "🟡" : tb.symbol === "POL" ? "⬟" : tb.symbol === "USDC" || tb.symbol === "USDC.e" || tb.symbol === "USDT" ? "💲" : tb.symbol === "WBTC" ? "₿" : tb.symbol === "ARB" ? "🔷" : tb.symbol === "UNI" ? "🦄" : tb.symbol === "LINK" ? "⬡" : tb.symbol === "OP" ? "🔴" : tb.symbol[0]}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] border-2 border-[#1a1d2e]"
              style={{ backgroundColor: tb.chainColor + "33" }}
              title={tb.chain}
            >
              {tb.chainIcon}
            </span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-white">{tb.symbol}</p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full text-[#848e9c]" style={{ backgroundColor: tb.chainColor + "15" }}>
                {tb.chain}
              </span>
            </div>
            <p className="text-[11px] text-[#848e9c]">
              {tb.balance.toFixed(tb.decimals <= 6 ? 5 : 5)} {tb.symbol}
            </p>
          </div>
          <p className="text-xs font-semibold text-white">{fmtUsd(tb.usdValue)}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Step 3: Amount input ───────────────────────────────────

function AmountStep({
  token,
  amount,
  setAmount,
  usdAmount,
  onPct,
  address,
}: {
  token: TokenBalance;
  amount: string;
  setAmount: (v: string) => void;
  usdAmount: number;
  onPct: (pct: number) => void;
  address: string;
}) {
  const isUsdc = PRICE_STABLES.has(token.symbol);
  const displayUsd = isUsdc ? parseFloat(amount) || 0 : usdAmount;
  const hasAmount = displayUsd > 0.01;
  const exceedsBalance = (parseFloat(amount) || 0) > token.balance;

  return (
    <div className="flex flex-col items-center">
      {/* Big USD amount */}
      <div className="py-8 text-center w-full">
        <p className="text-4xl font-bold text-white tabular-nums">
          {fmtUsd(displayUsd)}
        </p>
        <p className="text-xs text-[#848e9c] mt-2 flex items-center justify-center gap-1.5">
          <ArrowRightLeft className="h-3 w-3" />
          {(parseFloat(amount) || 0).toFixed(5)} {token.symbol} (Perps)
        </p>
      </div>

      {/* Amount input */}
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        className="w-full text-center bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3 text-sm text-white font-medium focus:border-brand focus:outline-none transition-colors mb-4"
        step="any"
        min="0"
        max={token.balance}
      />

      {/* Percentage buttons */}
      <div className="flex gap-2 mb-8">
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <button
            key={pct}
            onClick={() => onPct(pct)}
            className="px-4 py-2 rounded-lg bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] text-xs font-medium text-white transition-colors hover:bg-[#1a1d26]"
          >
            {pct === 1 ? "Max" : `${pct * 100}%`}
          </button>
        ))}
      </div>

      {/* Flow indicator */}
      <div className="flex items-center justify-center gap-3 mb-6 py-2.5 px-4 rounded-full bg-[#141620] border border-[#2a2e3e]">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: token.color + "22" }}>
            {token.symbol[0]}
          </span>
          <div>
            <p className="text-[9px] text-[#848e9c] leading-none">You send</p>
            <p className="text-[10px] text-white font-medium">{token.symbol} <span className="text-[#848e9c]">({token.chain})</span></p>
          </div>
        </div>
        <span className="text-[#848e9c]">→</span>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px]">💲</span>
          <div>
            <p className="text-[9px] text-[#848e9c] leading-none">You receive</p>
            <p className="text-[10px] text-white font-medium">USDC (Perps)</p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {exceedsBalance && (
        <p className="text-[11px] text-red-400 mb-3">Amount exceeds wallet balance</p>
      )}

      {/* Continue button */}
      <a
        href={`https://app.hyperliquid.xyz/trade`}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full py-3.5 rounded-xl text-sm font-bold text-center transition-colors block ${
          hasAmount && !exceedsBalance
            ? "bg-[#FF4D00] hover:bg-[#FF6620] text-white"
            : "bg-[#2a2e3e] text-[#848e9c] pointer-events-none"
        }`}
      >
        Continue
      </a>
    </div>
  );
}
