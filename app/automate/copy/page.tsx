"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Copy, Plus } from "lucide-react";
import { useAutomationStore } from "@/lib/automation/store";
import { StrategyCard } from "@/components/automate/StrategyCard";
import { fetchClearinghouseState } from "@/lib/hyperliquid/api";
import type { AssetPosition } from "@/lib/hyperliquid/types";
import type { CopyTradeConfig } from "@/lib/automation/types";

interface WalletPreview {
  address: string;
  label: string;
  positions: AssetPosition[];
  accountValue: string;
  loading: boolean;
}

export default function CopyTradingPage() {
  const { strategies, init } = useAutomationStore();
  const [previews, setPreviews] = useState<WalletPreview[]>([]);

  useEffect(() => { init(); }, [init]);

  const copyStrategies = strategies.filter((s) => s.type === "copy_trade");

  useEffect(() => {
    const addresses = copyStrategies.map((s) => {
      const config = s.config as CopyTradeConfig;
      return { address: config.targetAddress, label: config.targetLabel || config.targetAddress.slice(0, 8) + "…" };
    });

    const unique = Array.from(new Map(addresses.map((a) => [a.address, a])).values());

    setPreviews(unique.map((a) => ({ ...a, positions: [], accountValue: "0", loading: true })));

    unique.forEach(async (a, i) => {
      try {
        const state = await fetchClearinghouseState(a.address);
        setPreviews((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            positions: state.assetPositions.filter((ap) => parseFloat(ap.position.szi) !== 0),
            accountValue: state.marginSummary.accountValue,
            loading: false,
          };
          return next;
        });
      } catch {
        setPreviews((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], loading: false };
          return next;
        });
      }
    });
  }, [copyStrategies.length]);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Copy Trading</h2>
          <Link href="/automate/create" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium transition-colors">
            <Plus className="h-3.5 w-3.5" />
            New Copy Bot
          </Link>
        </div>
        {/* Active copy strategies */}
        {copyStrategies.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4">Active Copy Bots</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {copyStrategies.map((s) => <StrategyCard key={s.id} strategy={s} />)}
            </div>
          </>
        )}

        {/* Wallet previews */}
        <h2 className="text-lg font-semibold mb-4">
          <Eye className="h-4 w-4 inline-block mr-2" />
          Tracked Wallets
        </h2>
        {previews.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#2a2e3e] rounded-xl">
            <Copy className="h-10 w-10 mx-auto mb-3 text-[#2a2e3e]" />
            <p className="text-sm text-[#848e9c] mb-3">No wallets being tracked</p>
            <Link href="/automate/create" className="text-sm text-[#7C3AED] hover:underline">Set up a copy trading bot</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {previews.map((wallet) => (
              <div key={wallet.address} className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">{wallet.label}</h3>
                    <p className="text-[10px] text-[#848e9c] font-mono">{wallet.address}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    ${parseFloat(wallet.accountValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                {wallet.loading ? (
                  <p className="text-xs text-[#848e9c]">Loading positions...</p>
                ) : wallet.positions.length === 0 ? (
                  <p className="text-xs text-[#848e9c]">No open positions</p>
                ) : (
                  <div className="space-y-1">
                    {wallet.positions.map((ap) => {
                      const size = parseFloat(ap.position.szi);
                      const pnl = parseFloat(ap.position.unrealizedPnl);
                      return (
                        <div key={ap.position.coin} className="flex items-center justify-between bg-[#0b0e17] rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${size > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                              {size > 0 ? "LONG" : "SHORT"}
                            </span>
                            <span className="text-xs font-medium">{ap.position.coin}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs">{Math.abs(size).toFixed(4)}</p>
                            <p className={`text-[10px] ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} USDC
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
