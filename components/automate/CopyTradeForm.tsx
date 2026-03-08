"use client";

import { useState } from "react";
import type { Strategy, CopyTradeConfig } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";
import { useRouter } from "next/navigation";

export function CopyTradeForm() {
  const addStrategy = useAutomationStore((s) => s.addStrategy);
  const router = useRouter();

  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [multiplier, setMultiplier] = useState("1");
  const [maxUsd, setMaxUsd] = useState("1000");
  const [allowedCoins, setAllowedCoins] = useState("");
  const [excludedCoins, setExcludedCoins] = useState("");

  const handleSubmit = async () => {
    if (!address || !address.startsWith("0x")) return;

    const config: CopyTradeConfig = {
      targetAddress: address,
      targetLabel: label || undefined,
      sizeMultiplier: parseFloat(multiplier) || 1,
      maxPositionUsd: parseFloat(maxUsd) || 1000,
      allowedCoins: allowedCoins ? allowedCoins.split(",").map((s) => s.trim().toUpperCase()) : undefined,
      excludedCoins: excludedCoins ? excludedCoins.split(",").map((s) => s.trim().toUpperCase()) : undefined,
    };

    const strategy: Strategy = {
      id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Copy ${label || address.slice(0, 8) + "…"}`,
      type: "copy_trade",
      platform: "hyperliquid",
      status: "active",
      config,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastExecutedAt: null,
      nextExecuteAt: null,
      totalTrades: 0,
      totalPnl: 0,
    };

    await addStrategy(strategy);
    router.push("/automate");
  };

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-xs text-[#848e9c] bg-[#141620] rounded-lg p-3 border border-[#2a2e3e]">
        Monitor a Hyperliquid wallet and automatically mirror new position changes. The bot checks every 15 seconds.
      </p>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Wallet Address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED] font-mono" placeholder="0x..." />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Label (optional)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="Whale #1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Size Multiplier</label>
          <input value={multiplier} onChange={(e) => setMultiplier(e.target.value)} type="number" step="0.1" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="1.0" />
          <p className="text-[10px] text-[#848e9c] mt-0.5">1.0 = same size, 0.5 = half, 2.0 = double</p>
        </div>
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Max Position (USD)</label>
          <input value={maxUsd} onChange={(e) => setMaxUsd(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="1000" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Allowed Coins (optional, comma-separated)</label>
        <input value={allowedCoins} onChange={(e) => setAllowedCoins(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="BTC, ETH, SOL (leave empty for all)" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Excluded Coins (optional, comma-separated)</label>
        <input value={excludedCoins} onChange={(e) => setExcludedCoins(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="DOGE, SHIB" />
      </div>
      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold transition-colors">
        Start Copy Trading
      </button>
    </div>
  );
}
