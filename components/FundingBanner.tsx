"use client";

import { useState } from "react";
import {
  CreditCard,
  ArrowDownToLine,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Wallet,
  Smartphone,
} from "lucide-react";

const HYPERLIQUID_DEPOSIT_URL = "https://app.hyperliquid.xyz/trade";

function buildOnRampUrl(address: string): string {
  return `https://app.hyperliquid.xyz/buy?address=${address}`;
}

interface FundingBannerProps {
  address: string;
  balance: number;
  compact?: boolean;
}

export function FundingBanner({ address, balance, compact = false }: FundingBannerProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (balance > 0 && compact) return null;

  if (compact && balance <= 0) {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-amber-200 font-medium">Fund your account to start trading</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        {expanded && <FundingOptions address={address} onCopy={handleCopy} copied={copied} />}
      </div>
    );
  }

  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Wallet className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">
            {balance <= 0 ? "Fund Your Account" : "Deposit & Buy"}
          </h3>
          <p className="text-[11px] text-[#848e9c]">
            {balance <= 0
              ? "Deposit USDC to start trading perpetuals on Hyperliquid"
              : "Add more funds to your trading account"}
          </p>
        </div>
      </div>
      <FundingOptions address={address} onCopy={handleCopy} copied={copied} />
    </div>
  );
}

function FundingOptions({
  address,
  onCopy,
  copied,
}: {
  address: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-2 mt-3">
      {/* Buy with Card / Apple Pay */}
      <a
        href={buildOnRampUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full p-3 rounded-lg bg-gradient-to-r from-[#FF455B]/15 to-[#FF455B]/5 border border-[#FF455B]/20 hover:border-[#FF455B]/40 transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-[#FF455B]/20 flex items-center justify-center shrink-0">
          <CreditCard className="h-4 w-4 text-[#FF455B]" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white group-hover:text-[#FF455B] transition-colors">
            Buy with Card or Apple Pay
          </p>
          <p className="text-[10px] text-[#848e9c]">
            Purchase USDC instantly with debit/credit card
          </p>
        </div>
        <div className="flex items-center gap-1 text-[#848e9c] group-hover:text-[#FF455B] transition-colors">
          <Smartphone className="h-3.5 w-3.5" />
          <ExternalLink className="h-3 w-3" />
        </div>
      </a>

      {/* Deposit from Exchange */}
      <a
        href={HYPERLIQUID_DEPOSIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15 hover:border-emerald-500/30 transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
          <ArrowDownToLine className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
            Deposit on Hyperliquid
          </p>
          <p className="text-[10px] text-[#848e9c]">
            Bridge &amp; deposit USDC from Arbitrum to Hyperliquid
          </p>
        </div>
        <ExternalLink className="h-3 w-3 text-[#848e9c] group-hover:text-emerald-400 transition-colors" />
      </a>

      {/* Copy wallet address */}
      <button
        onClick={onCopy}
        className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#1a1d26] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-[#2a2e3e] flex items-center justify-center shrink-0">
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4 text-[#848e9c]" />
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-white">
            {copied ? "Copied!" : "Copy Wallet Address"}
          </p>
          <p className="text-[10px] text-[#848e9c] font-mono truncate max-w-[200px]">
            {address}
          </p>
        </div>
      </button>

      <p className="text-[10px] text-[#848e9c] text-center pt-1">
        Trades execute on Hyperliquid L1 &middot; USDC (Arbitrum) required
      </p>
    </div>
  );
}
