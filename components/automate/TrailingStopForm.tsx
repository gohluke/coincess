"use client";

import { useState } from "react";
import type { Strategy, TrailingStopConfig } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";
import { useRouter } from "next/navigation";

export function TrailingStopForm() {
  const addStrategy = useAutomationStore((s) => s.addStrategy);
  const router = useRouter();

  const [coin, setCoin] = useState("BTC");
  const [side, setSide] = useState<"long" | "short">("long");
  const [trail, setTrail] = useState("2");
  const [activation, setActivation] = useState("");
  const [size, setSize] = useState("0.001");

  const handleSubmit = async () => {
    const config: TrailingStopConfig = {
      coin,
      side,
      trailPercent: parseFloat(trail) || 2,
      activationPrice: activation ? parseFloat(activation) : undefined,
      size: parseFloat(size) || 0.001,
    };

    const strategy: Strategy = {
      id: `trail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Trail Stop ${side.toUpperCase()} ${coin} ${config.trailPercent}%`,
      type: "trailing_stop",
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
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Market</label>
        <input value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Position Side</label>
        <div className="grid grid-cols-2 gap-2">
          {(["long", "short"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`py-2 rounded-lg text-sm font-medium transition-colors ${side === s ? (s === "long" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30") : "bg-[#0b0e17] text-[#848e9c] border border-[#2a2e3e]"}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Trail Distance (%)</label>
        <input value={trail} onChange={(e) => setTrail(e.target.value)} type="number" step="0.1" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Activation Price (optional)</label>
        <input value={activation} onChange={(e) => setActivation(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="Start trailing after reaching this price" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Position Size</label>
        <input value={size} onChange={(e) => setSize(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors">
        Start Trailing Stop
      </button>
    </div>
  );
}
