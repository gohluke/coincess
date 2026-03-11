"use client";

import { useState } from "react";
import type { Strategy, PredictionExitConfig } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";
import { useRouter } from "next/navigation";

const EXIT_PRESETS = [
  { label: "5 minutes", ms: 300_000 },
  { label: "15 minutes", ms: 900_000 },
  { label: "1 hour", ms: 3_600_000 },
  { label: "6 hours", ms: 21_600_000 },
  { label: "1 day", ms: 86_400_000 },
];

export function PredictionExitForm() {
  const addStrategy = useAutomationStore((s) => s.addStrategy);
  const router = useRouter();

  const [eventTitle, setEventTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exitBefore, setExitBefore] = useState(EXIT_PRESETS[2].ms.toString());

  const handleSubmit = async () => {
    if (!tokenId || !eventId || !endDate) return;

    const config: PredictionExitConfig = {
      eventId,
      eventTitle: eventTitle || "Prediction Market",
      marketId,
      tokenId,
      exitBeforeMs: parseInt(exitBefore),
      endDate,
    };

    const strategy: Strategy = {
      id: `pred-exit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Auto Exit "${eventTitle.slice(0, 30)}"`,
      type: "prediction_exit",
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
      <p className="text-xs text-[#848e9c] bg-[#141620] rounded-lg p-3">
        Automatically exit your position before a prediction market closes to avoid resolution risk.
      </p>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Event Title</label>
        <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Event ID</label>
        <input value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Market ID</label>
        <input value={marketId} onChange={(e) => setMarketId(e.target.value)} className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Token ID</label>
        <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Market End Date</label>
        <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="datetime-local" className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Exit Before Close</label>
        <select value={exitBefore} onChange={(e) => setExitBefore(e.target.value)} className="w-full bg-[#0b0e17] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand">
          {EXIT_PRESETS.map((p) => (
            <option key={p.ms} value={p.ms}>{p.label}</option>
          ))}
        </select>
      </div>
      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors">
        Start Auto Exit
      </button>
    </div>
  );
}
