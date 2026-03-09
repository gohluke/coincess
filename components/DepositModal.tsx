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

const ARB_RPC = "https://arb1.arbitrum.io/rpc";
const BALANCE_OF_SIG = "0x70a08231";

interface TokenInfo {
  symbol: string;
  name: string;
  address: string | null; // null = native ETH
  decimals: number;
  color: string;
  icon: string;
}

const ARBITRUM_TOKENS: TokenInfo[] = [
  { symbol: "USDC", name: "USD Coin", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, color: "#2775CA", icon: "💲" },
  { symbol: "ETH", name: "Ethereum", address: null, decimals: 18, color: "#627EEA", icon: "⟠" },
  { symbol: "USDC.e", name: "Bridged USDC", address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", decimals: 6, color: "#2775CA", icon: "💲" },
  { symbol: "WETH", name: "Wrapped ETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18, color: "#627EEA", icon: "⟠" },
  { symbol: "ARB", name: "Arbitrum", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18, color: "#28A0F0", icon: "🔷" },
  { symbol: "WBTC", name: "Wrapped BTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8, color: "#F7931A", icon: "₿" },
  { symbol: "DAI", name: "Dai", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18, color: "#F5AC37", icon: "◈" },
  { symbol: "UNI", name: "Uniswap", address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", decimals: 18, color: "#FF007A", icon: "🦄" },
  { symbol: "LINK", name: "Chainlink", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18, color: "#2A5ADA", icon: "⬡" },
];

interface TokenBalance {
  token: TokenInfo;
  balance: number;
  usdValue: number;
}

function fmtUsd(n: number) {
  return "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function rpcCall(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(ARB_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  return data.result ?? "0x0";
}

async function getEthBalance(addr: string): Promise<bigint> {
  const hex = await rpcCall("eth_getBalance", [addr, "latest"]);
  return BigInt(hex);
}

async function getErc20Balance(tokenAddr: string, wallet: string): Promise<bigint> {
  const paddedWallet = "0x" + wallet.slice(2).toLowerCase().padStart(64, "0");
  const data = BALANCE_OF_SIG + paddedWallet.slice(2);
  const hex = await rpcCall("eth_call", [{ to: tokenAddr, data }, "latest"]);
  return BigInt(hex || "0x0");
}

const PRICE_STABLES = new Set(["USDC", "USDC.e", "DAI"]);

async function fetchTokenPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum,wrapped-bitcoin,arbitrum,uniswap,chainlink&vs_currencies=usd");
    const data = await res.json();
    return {
      ETH: data.ethereum?.usd ?? 0,
      WETH: data.ethereum?.usd ?? 0,
      WBTC: data["wrapped-bitcoin"]?.usd ?? 0,
      ARB: data.arbitrum?.usd ?? 0,
      UNI: data.uniswap?.usd ?? 0,
      LINK: data.chainlink?.usd ?? 0,
    };
  } catch {
    return {};
  }
}

// ─── Exported button ────────────────────────────────────────

export function DepositButton() {
  const { address } = useEffectiveAddress();
  const [open, setOpen] = useState(false);

  if (!address) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors"
      >
        Deposit
      </button>
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

  useEffect(() => {
    fetchCombinedClearinghouseState(address)
      .then((ch) => setHlBalance(parseFloat(ch.marginSummary.accountValue || "0")))
      .catch(() => {});
  }, [address]);

  const loadWalletBalances = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const prices = await fetchTokenPrices();
      const results: TokenBalance[] = [];

      const balancePromises = ARBITRUM_TOKENS.map(async (token) => {
        try {
          const raw = token.address
            ? await getErc20Balance(token.address, address)
            : await getEthBalance(address);
          const balance = Number(raw) / 10 ** token.decimals;
          if (balance < 0.0001) return null;
          const price = PRICE_STABLES.has(token.symbol) ? 1 : (prices[token.symbol] ?? 0);
          return { token, balance, usdValue: balance * price };
        } catch {
          return null;
        }
      });

      const settled = await Promise.all(balancePromises);
      for (const r of settled) if (r) results.push(r);
      results.sort((a, b) => b.usdValue - a.usdValue);
      setTokenBalances(results);
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
    setAmount(val.toFixed(selectedToken.token.decimals <= 6 ? 5 : 8));
  };

  const parsedAmount = parseFloat(amount) || 0;
  const usdAmount = selectedToken
    ? parsedAmount * (PRICE_STABLES.has(selectedToken.token.symbol) ? 1 : selectedToken.usdValue / (selectedToken.balance || 1))
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
              copied={copied}
              onCopy={handleCopy}
              onTransfer={goToTokens}
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
  copied,
  onCopy,
  onTransfer,
}: {
  address: string;
  shortAddr: string;
  hlBalance: number | null;
  copied: boolean;
  onCopy: () => void;
  onTransfer: () => void;
}) {
  return (
    <div className="space-y-2">
      {/* HL balance card */}
      <button
        onClick={onCopy}
        className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#141620] border border-[#3a3e4e] hover:border-[#4a4e5e] transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
          <Wallet className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-semibold text-white">Wallet ({shortAddr})</p>
          <p className="text-[11px] text-[#848e9c]">
            {hlBalance !== null ? fmtUsd(hlBalance) : "..."} &middot; Instant
          </p>
        </div>
        {copied ? <Check className="h-4 w-4 text-emerald-400 shrink-0" /> : <Copy className="h-4 w-4 text-[#848e9c] shrink-0 group-hover:text-white transition-colors" />}
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
        <div className="w-9 h-9 rounded-full bg-[#7C3AED]/15 flex items-center justify-center shrink-0">
          <CreditCard className="h-4 w-4 text-[#7C3AED]" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white group-hover:text-[#7C3AED] transition-colors">Deposit with Card</p>
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
        <Loader2 className="h-6 w-6 text-[#7C3AED] animate-spin" />
        <p className="text-xs text-[#848e9c]">Loading wallet balances...</p>
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="text-center py-16">
        <Wallet className="h-8 w-8 text-[#848e9c] mx-auto mb-3" />
        <p className="text-sm text-[#848e9c]">No tokens found on Arbitrum</p>
        <p className="text-[11px] text-[#848e9c] mt-1">Make sure your wallet has tokens on Arbitrum One</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {balances.map((tb) => (
        <button
          key={tb.token.symbol}
          onClick={() => onSelect(tb)}
          className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[#141620] transition-colors group"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm"
            style={{ backgroundColor: tb.token.color + "22" }}
          >
            {tb.token.icon}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-semibold text-white">{tb.token.symbol}</p>
            <p className="text-[11px] text-[#848e9c]">
              {tb.balance.toFixed(tb.token.decimals <= 6 ? 5 : 5)} {tb.token.symbol}
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
  const isUsdc = PRICE_STABLES.has(token.token.symbol);
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
          {(parseFloat(amount) || 0).toFixed(5)} {token.token.symbol} (Perps)
        </p>
      </div>

      {/* Amount input (hidden but functional) */}
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        className="w-full text-center bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3 text-sm text-white font-medium focus:border-[#7C3AED] focus:outline-none transition-colors mb-4"
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
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: token.token.color + "22" }}>
            {token.token.icon}
          </span>
          <div>
            <p className="text-[9px] text-[#848e9c] leading-none">You send</p>
            <p className="text-[10px] text-white font-medium">{token.token.symbol}</p>
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
