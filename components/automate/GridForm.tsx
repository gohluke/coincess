"use client";

import { useState } from "react";
import type { Strategy, GridConfig } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";
import { useRouter } from "next/navigation";

export function GridForm() {
  const addStrategy = useAutomationStore((s) => s.addStrategy);
  const router = useRouter();

  const [coin, setCoin] = useState("BTC");
  const [upper, setUpper] = useState("");
  const [lower, setLower] = useState("");
  const [grids, setGrids] = useState("10");
  const [size, setSize] = useState("0.001");
  const [leverage, setLeverage] = useState("5");

  const handleSubmit = async () => {
    const config: GridConfig = {
      coin,
      upperPrice: parseFloat(upper),
      lowerPrice: parseFloat(lower),
      gridCount: parseInt(grids) || 10,
      orderSize: parseFloat(size) || 0.001,
      leverage: parseInt(leverage) || 5,
    };

    if (!config.upperPrice || !config.lowerPrice || config.upperPrice <= config.lowerPrice) return;

    const strategy: Strategy = {
      id: `grid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Grid ${coin} ($${config.lowerPrice}–$${config.upperPrice})`,
      type: "grid",
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
        <input value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())} className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Lower Price ($)</label>
          <input value={lower} onChange={(e) => setLower(e.target.value)} type="number" className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
        </div>
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Upper Price ($)</label>
          <input value={upper} onChange={(e) => setUpper(e.target.value)} type="number" className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Grid Count</label>
          <input value={grids} onChange={(e) => setGrids(e.target.value)} type="number" className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
        </div>
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Size per Grid</label>
          <input value={size} onChange={(e) => setSize(e.target.value)} type="number" className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Leverage</label>
        <input value={leverage} onChange={(e) => setLeverage(e.target.value)} type="number" min="1" max="100" className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      {upper && lower && grids && (
        <div className="bg-[#0b0e17] rounded-lg p-3 text-xs text-[#848e9c]">
          Grid spacing: ${((parseFloat(upper) - parseFloat(lower)) / (parseInt(grids) || 1)).toFixed(2)} per level
        </div>
      )}
      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors">
        Start Grid Bot
      </button>
    </div>
  );
}
