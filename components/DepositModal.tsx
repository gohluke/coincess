"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { fetchCombinedClearinghouseState } from "@/lib/hyperliquid/api";

function formatUsd(n: number) {
  return "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
      {open && <DepositModal address={address} onClose={() => setOpen(false)} />}
    </>
  );
}

function DepositModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCombinedClearinghouseState(address).then((ch) => {
      setBalance(parseFloat(ch.withdrawable || "0"));
    }).catch(() => {});
  }, [address]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const shortAddr = `...${address.slice(-4)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1d2e] border border-[#2a2e3e] rounded-2xl shadow-2xl shadow-black/50 w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-bold text-white">Deposit USDC</h2>
          <button onClick={onClose} className="p-1 text-[#848e9c] hover:text-white transition-colors rounded-lg hover:bg-[#2a2e3e]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Wallet balance card */}
        <div className="mx-5 mb-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold text-white">Wallet ({shortAddr})</p>
              <p className="text-[11px] text-[#848e9c]">
                {balance !== null ? formatUsd(balance) : "..."} &middot; Instant
              </p>
            </div>
            {copied ? <Check className="h-4 w-4 text-emerald-400 shrink-0" /> : <Copy className="h-4 w-4 text-[#848e9c] shrink-0 group-hover:text-white transition-colors" />}
          </button>
        </div>

        <div className="flex items-center gap-3 mx-5 mb-3">
          <div className="flex-1 h-px bg-[#2a2e3e]" />
          <span className="text-[10px] text-[#848e9c]">more</span>
          <div className="flex-1 h-px bg-[#2a2e3e]" />
        </div>

        {/* Deposit options */}
        <div className="px-5 pb-5 space-y-2">
          {/* Transfer crypto */}
          <a
            href={`https://app.hyperliquid.xyz/trade`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">Transfer Crypto</p>
              <p className="text-[11px] text-[#848e9c]">No limit &middot; Instant</p>
            </div>
            <div className="flex -space-x-1">
              {["🔷", "🟡", "⬟"].map((e, i) => (
                <span key={i} className="text-xs">{e}</span>
              ))}
            </div>
          </a>

          {/* Buy with card */}
          <a
            href={`https://app.hyperliquid.xyz/buy?address=${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-[#7C3AED]/15 flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4 text-[#7C3AED]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-white group-hover:text-[#7C3AED] transition-colors">Deposit with Card</p>
              <p className="text-[11px] text-[#848e9c]">$20,000 &middot; 5 min</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-orange-400">●</span>
              <span className="text-[10px] font-bold text-blue-500">VISA</span>
            </div>
          </a>

          {/* Bridge from Arbitrum */}
          <a
            href={`https://app.hyperliquid.xyz/trade`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
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
            href={`https://app.hyperliquid.xyz/trade`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-[#3a3e4e] transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-[#848e9c]/10 flex items-center justify-center shrink-0">
              <Link2 className="h-4 w-4 text-[#848e9c]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-white group-hover:text-white/80 transition-colors">Connect Exchange</p>
              <p className="text-[11px] text-[#848e9c]">No limit &middot; 2 min</p>
            </div>
            <div className="flex -space-x-1">
              {["🟠", "🟡", "🟢", "🔵"].map((e, i) => (
                <span key={i} className="text-xs">{e}</span>
              ))}
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
