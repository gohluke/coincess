"use client";

import { useState } from "react";
import type { Strategy, DCAConfig } from "@/lib/automation/types";
import { INTERVAL_PRESETS } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";
import { useRouter } from "next/navigation";

export function DCAForm() {
  const addStrategy = useAutomationStore((s) => s.addStrategy);
  const router = useRouter();

  const [coin, setCoin] = useState("BTC");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [interval, setInterval] = useState(INTERVAL_PRESETS[3].ms.toString());
  const [totalOrders, setTotalOrders] = useState("");
  const [priceLimit, setPriceLimit] = useState("");

  const handleSubmit = async () => {
    const config: DCAConfig = {
      coin,
      side,
      amountUsd: parseFloat(amount) || 10,
      intervalMs: parseInt(interval),
      totalOrders: totalOrders ? parseInt(totalOrders) : undefined,
      priceLimit: priceLimit ? parseFloat(priceLimit) : undefined,
    };

    const strategy: Strategy = {
      id: `dca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `DCA ${side.toUpperCase()} ${coin}`,
      type: "dca",
      platform: "hyperliquid",
      status: "active",
      config,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastExecutedAt: null,
      nextExecuteAt: Date.now(),
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
        <input value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="BTC" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Side</label>
        <div className="grid grid-cols-2 gap-2">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`py-2 rounded-lg text-sm font-medium transition-colors ${side === s ? (s === "buy" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30") : "bg-[#0b0e17] text-[#848e9c] border border-[#2a2e3e]"}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Amount (USD per order)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="10" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Interval</label>
        <select value={interval} onChange={(e) => setInterval(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]">
          {INTERVAL_PRESETS.map((p) => (
            <option key={p.ms} value={p.ms}>{p.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Max Orders (optional)</label>
        <input value={totalOrders} onChange={(e) => setTotalOrders(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder="Unlimited" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Price Limit (optional)</label>
        <input value={priceLimit} onChange={(e) => setPriceLimit(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C3AED]" placeholder={`Don't ${side} ${side === "buy" ? "above" : "below"} this price`} />
      </div>
      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold transition-colors">
        Start DCA Bot
      </button>
    </div>
  );
}
