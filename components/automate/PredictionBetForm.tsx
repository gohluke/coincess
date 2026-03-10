"use client";

import { useState } from "react";
import type { Strategy, PredictionBetConfig } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";
import { useRouter } from "next/navigation";

export function PredictionBetForm() {
  const addStrategy = useAutomationStore((s) => s.addStrategy);
  const router = useRouter();

  const [eventTitle, setEventTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [outcome, setOutcome] = useState<"Yes" | "No">("Yes");
  const [triggerPrice, setTriggerPrice] = useState("30");
  const [betSize, setBetSize] = useState("10");

  const handleSubmit = async () => {
    if (!tokenId || !eventId) return;

    const config: PredictionBetConfig = {
      eventId,
      eventTitle: eventTitle || "Prediction Market",
      marketId,
      marketQuestion: "",
      outcome,
      triggerPrice: (parseFloat(triggerPrice) || 30) / 100,
      betSize: parseFloat(betSize) || 10,
      tokenId,
    };

    const strategy: Strategy = {
      id: `pred-bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Auto Bet ${outcome} "${eventTitle.slice(0, 30)}"`,
      type: "prediction_auto_bet",
      platform: "polymarket",
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
        Find the event on the <a href="/predict" className="text-brand hover:underline">Predict</a> page, then copy the event ID and token ID from the URL or market data.
      </p>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Event Title</label>
        <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="Fed decision in March?" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Event ID</label>
        <input value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="Polymarket event ID" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Market ID</label>
        <input value={marketId} onChange={(e) => setMarketId(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="Condition ID" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Token ID (outcome token)</label>
        <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="CLOB token ID for Yes/No" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Outcome</label>
        <div className="grid grid-cols-2 gap-2">
          {(["Yes", "No"] as const).map((o) => (
            <button key={o} onClick={() => setOutcome(o)} className={`py-2 rounded-lg text-sm font-medium transition-colors ${outcome === o ? (o === "Yes" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30") : "bg-[#0b0e17] text-[#848e9c] border border-[#2a2e3e]"}`}>
              {o}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Trigger Price (cents) — buy when below this</label>
        <input value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="30" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Bet Size (USD)</label>
        <input value={betSize} onChange={(e) => setBetSize(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="10" />
      </div>
      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors">
        Start Auto Bet
      </button>
    </div>
  );
}
