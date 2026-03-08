"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Bell, BellOff, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAutomationStore } from "@/lib/automation/store";
import { AlertForm } from "@/components/automate/AlertForm";
import { startAlertEngine } from "@/lib/alerts/engine";

function formatCondition(alert: { condition: { type: string; coin?: string; price?: number; amount?: number } }): string {
  const c = alert.condition;
  switch (c.type) {
    case "price_above": return `${c.coin} above $${c.price}`;
    case "price_below": return `${c.coin} below $${c.price}`;
    case "pnl_above": return `${c.coin} PnL above $${c.amount}`;
    case "pnl_below": return `${c.coin} PnL below $${c.amount}`;
    default: return c.type;
  }
}

export default function AlertsPage() {
  const { alerts, alertHistory, init, removeAlert, updateAlert, refreshAlertHistory } = useAutomationStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    init();
    startAlertEngine();
  }, [init]);

  useEffect(() => {
    refreshAlertHistory();
  }, [refreshAlertHistory]);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <header className="sticky top-0 z-50 border-b border-[#2a2e39] bg-[#0b0e11]/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/automate" className="flex items-center gap-2 text-[#848e9c] hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <Logo />
            </Link>
            <span className="text-sm font-semibold">Alerts</span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Alert
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {showForm && (
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-4 mb-6">
            <AlertForm onDone={() => setShowForm(false)} />
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4">Active Alerts ({alerts.length})</h2>
        {alerts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#2a2e3e] rounded-xl">
            <Bell className="h-10 w-10 mx-auto mb-3 text-[#2a2e3e]" />
            <p className="text-sm text-[#848e9c]">No alerts set up</p>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{alert.name}</p>
                  <p className="text-xs text-[#848e9c]">{formatCondition(alert)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {alert.triggered && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Triggered</span>
                  )}
                  <button
                    onClick={() => updateAlert({ ...alert, enabled: !alert.enabled })}
                    className={`p-1.5 rounded-lg transition-colors ${alert.enabled ? "text-emerald-400 hover:bg-emerald-500/10" : "text-[#848e9c] hover:bg-[#1a1d2e]"}`}
                    title={alert.enabled ? "Disable" : "Enable"}
                  >
                    {alert.enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => removeAlert(alert.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4">Alert History</h2>
        {alertHistory.length === 0 ? (
          <p className="text-sm text-[#848e9c]">No alerts triggered yet.</p>
        ) : (
          <div className="space-y-1">
            {alertHistory.map((h) => (
              <div key={h.id} className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-[#141620]">
                <Bell className="h-3.5 w-3.5 text-[#7C3AED] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#c8ccd8]">{h.message}</p>
                  <span className="text-[10px] text-[#848e9c]">{new Date(h.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
