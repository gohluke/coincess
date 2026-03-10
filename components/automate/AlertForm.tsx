"use client";

import { useState } from "react";
import type { AlertRule, AlertCondition } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";

export function AlertForm({ onDone }: { onDone?: () => void }) {
  const addAlert = useAutomationStore((s) => s.addAlert);

  const [name, setName] = useState("");
  const [alertType, setAlertType] = useState<"price_above" | "price_below">("price_above");
  const [coin, setCoin] = useState("BTC");
  const [value, setValue] = useState("");
  const [notify, setNotify] = useState<"browser" | "sound" | "both">("both");
  const [oneShot, setOneShot] = useState(true);

  const handleSubmit = async () => {
    if (!value) return;

    const condition: AlertCondition = {
      type: alertType,
      coin,
      price: parseFloat(value),
    } as AlertCondition;

    const alert: AlertRule = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name || `${coin} ${alertType.replace("_", " ")} $${value}`,
      type: "price_cross",
      platform: "hyperliquid",
      enabled: true,
      condition,
      notifyMethod: notify,
      oneShot,
      triggered: false,
      createdAt: Date.now(),
      lastTriggeredAt: null,
    };

    await addAlert(alert);
    onDone?.();
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Alert Name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" placeholder="My price alert" />
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Condition</label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setAlertType("price_above")} className={`py-2 rounded-lg text-xs font-medium transition-colors ${alertType === "price_above" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#0b0e17] text-[#848e9c] border border-[#2a2e3e]"}`}>
            Price Above
          </button>
          <button onClick={() => setAlertType("price_below")} className={`py-2 rounded-lg text-xs font-medium transition-colors ${alertType === "price_below" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-[#0b0e17] text-[#848e9c] border border-[#2a2e3e]"}`}>
            Price Below
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Market</label>
          <input value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
        </div>
        <div>
          <label className="block text-xs text-[#848e9c] mb-1">Price ($)</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} type="number" className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#848e9c] mb-1">Notification</label>
        <select value={notify} onChange={(e) => setNotify(e.target.value as typeof notify)} className="w-full bg-[#0b0e17] border border-[#2a2e3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand">
          <option value="both">Browser + Sound</option>
          <option value="browser">Browser Notification</option>
          <option value="sound">Sound Only</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs text-[#848e9c]">
        <input type="checkbox" checked={oneShot} onChange={(e) => setOneShot(e.target.checked)} className="rounded border-[#2a2e3e]" />
        One-time alert (disable after triggering)
      </label>
      <button onClick={handleSubmit} className="w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors">
        Create Alert
      </button>
    </div>
  );
}
