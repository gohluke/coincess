"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, BellRing, X, Plus, Trash2, Send, Smartphone, CheckCircle, AlertTriangle } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";

interface AlertRule {
  id: string;
  type: string;
  coin: string | null;
  threshold: number | null;
  enabled: boolean;
  one_shot: boolean;
}

interface Preferences {
  fills_enabled: boolean;
  funding_enabled: boolean;
  whale_enabled: boolean;
}

export function NotificationBell() {
  const { address } = useEffectiveAddress();
  const {
    state,
    isSubscribed,
    isStandalone,
    error: pushError,
    subscribe,
    unsubscribe,
    testPush,
  } = usePushNotifications(address ?? null);

  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({
    fills_enabled: true,
    funding_enabled: false,
    whale_enabled: false,
  });
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({ type: "price_above", coin: "BTC", threshold: "" });
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const loadData = useCallback(async () => {
    if (!address) return;
    try {
      const [alertsRes, prefsRes] = await Promise.all([
        fetch(`/api/notifications/alerts?walletAddress=${address}`),
        fetch(`/api/notifications/preferences?walletAddress=${address}`),
      ]);
      const alertsData = await alertsRes.json();
      const prefsData = await prefsRes.json();
      if (alertsData.alerts) setAlerts(alertsData.alerts);
      if (prefsData.preferences) setPrefs(prefsData.preferences);
    } catch {
      // silent
    }
  }, [address]);

  useEffect(() => {
    if (open && address) loadData();
  }, [open, address, loadData]);

  const handleSubscribe = async () => {
    setStatusMsg(null);
    const result = await subscribe();
    if (result.ok) {
      setStatusMsg({ type: "success", text: "Notifications enabled!" });
      loadData();
      setTimeout(() => setStatusMsg(null), 4000);
    } else {
      setStatusMsg({ type: "error", text: result.error || "Failed to enable notifications" });
      setTimeout(() => setStatusMsg(null), 6000);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const ok = await testPush();
    setTesting(false);
    if (ok) {
      setStatusMsg({ type: "success", text: "Test notification sent!" });
    } else {
      setStatusMsg({ type: "error", text: "Failed to send test notification" });
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const updatePref = async (key: keyof Preferences, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address, ...updated }),
    });
  };

  const addAlert = async () => {
    if (!address || !newAlert.threshold) return;
    const res = await fetch("/api/notifications/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: address,
        type: newAlert.type,
        coin: newAlert.coin,
        threshold: parseFloat(newAlert.threshold),
      }),
    });
    const data = await res.json();
    if (data.alert) {
      setAlerts((a) => [data.alert, ...a]);
      setShowAddAlert(false);
      setNewAlert({ type: "price_above", coin: "BTC", threshold: "" });
    }
  };

  const deleteAlert = async (id: string) => {
    await fetch(`/api/notifications/alerts?id=${id}`, { method: "DELETE" });
    setAlerts((a) => a.filter((x) => x.id !== id));
  };

  if (!address) return null;

  const isIos = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  const needsInstall = isIos && !isStandalone;

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
          isSubscribed
            ? "bg-brand/12 border-brand/25 text-brand"
            : "bg-[#1a1d26] border-[#2a2e3e] text-[#848e9c] hover:bg-[#252830] hover:text-white"
        }`}
        title="Notifications"
      >
        {isSubscribed ? (
          <BellRing className="h-[18px] w-[18px]" />
        ) : (
          <Bell className="h-[18px] w-[18px]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#141620] rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e3e]">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-[#555a66] hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
            {/* Status Message */}
            {statusMsg && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
                statusMsg.type === "success"
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-red-400/10 text-red-400"
              }`}>
                {statusMsg.type === "success" ? (
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* iOS Install Prompt */}
            {needsInstall && (
              <div className="bg-[#1a1d26] rounded-xl p-3 text-xs text-[#848e9c] space-y-1">
                <div className="flex items-center gap-2 text-[#f0b90b] font-medium">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Install Required for iOS</span>
                </div>
                <p>
                  Tap the <strong className="text-white">Share</strong> button in Safari, then{" "}
                  <strong className="text-white">Add to Home Screen</strong> to enable push notifications.
                </p>
              </div>
            )}

            {/* Push Enable/Disable */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#848e9c] uppercase tracking-wider">Push Notifications</label>
              {state === "denied" ? (
                <p className="text-xs text-[#f6465d]">
                  Notifications blocked. Enable in browser/device settings.
                </p>
              ) : state === "unsupported" ? (
                <p className="text-xs text-[#848e9c]">
                  Push not supported in this browser.
                </p>
              ) : isSubscribed ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#0ecb81] font-medium">Enabled</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#1a1d26] text-[#848e9c] hover:text-white hover:bg-[#252830] transition-colors disabled:opacity-50"
                    >
                      <Send className="h-3 w-3 inline mr-1" />
                      {testing ? "Sending..." : "Test"}
                    </button>
                    <button
                      onClick={unsubscribe}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#1a1d26] text-[#f6465d] hover:bg-[#252830] transition-colors"
                    >
                      Disable
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={state === "loading"}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-brand/15 text-brand hover:bg-brand/25 transition-colors font-medium disabled:opacity-50"
                >
                  {state === "loading" ? "Enabling..." : "Enable Push Notifications"}
                </button>
              )}
            </div>

            {/* Notification Preferences */}
            {isSubscribed && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#848e9c] uppercase tracking-wider">Notify me about</label>
                  <Toggle label="Order Fills" description="Limit orders filled, liquidations" checked={prefs.fills_enabled} onChange={(v) => updatePref("fills_enabled", v)} />
                  <Toggle label="Funding Payments" description="Hourly funding rate payments" checked={prefs.funding_enabled} onChange={(v) => updatePref("funding_enabled", v)} />
                  <Toggle label="Whale Moves" description="Large trades on watched coins" checked={prefs.whale_enabled} onChange={(v) => updatePref("whale_enabled", v)} />
                </div>

                {/* Price Alerts */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#848e9c] uppercase tracking-wider">Price Alerts</label>
                    <button
                      onClick={() => setShowAddAlert(!showAddAlert)}
                      className="text-xs text-brand hover:text-brand/80 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 inline" /> Add
                    </button>
                  </div>

                  {showAddAlert && (
                    <div className="bg-[#1a1d26] rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={newAlert.type}
                          onChange={(e) => setNewAlert((a) => ({ ...a, type: e.target.value }))}
                          className="flex-1 bg-[#0f1116] text-white text-xs rounded-lg px-2 py-1.5 border border-[#2a2e3e]"
                        >
                          <option value="price_above">Price Above</option>
                          <option value="price_below">Price Below</option>
                          <option value="pnl_above">PnL Above</option>
                          <option value="pnl_below">PnL Below</option>
                        </select>
                        {(newAlert.type === "price_above" || newAlert.type === "price_below") && (
                          <input
                            type="text"
                            value={newAlert.coin}
                            onChange={(e) => setNewAlert((a) => ({ ...a, coin: e.target.value.toUpperCase() }))}
                            placeholder="Coin"
                            className="w-16 bg-[#0f1116] text-white text-xs rounded-lg px-2 py-1.5 border border-[#2a2e3e]"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={newAlert.threshold}
                          onChange={(e) => setNewAlert((a) => ({ ...a, threshold: e.target.value }))}
                          placeholder="Threshold ($)"
                          className="flex-1 bg-[#0f1116] text-white text-xs rounded-lg px-2 py-1.5 border border-[#2a2e3e]"
                        />
                        <button
                          onClick={addAlert}
                          disabled={!newAlert.threshold}
                          className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {alerts.length === 0 ? (
                    <p className="text-xs text-[#555a66]">No alerts set</p>
                  ) : (
                    <div className="space-y-1">
                      {alerts.map((a) => (
                        <div key={a.id} className="flex items-center justify-between bg-[#1a1d26] rounded-lg px-3 py-2">
                          <div className="text-xs">
                            <span className="text-white font-medium">{a.coin ?? "PnL"}</span>{" "}
                            <span className="text-[#848e9c]">
                              {a.type.replace("_", " ")} ${a.threshold?.toLocaleString()}
                            </span>
                          </div>
                          <button onClick={() => deleteAlert(a.id)} className="text-[#555a66] hover:text-[#f6465d] transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between bg-[#1a1d26] rounded-xl px-3 py-2.5 text-left"
    >
      <div>
        <div className="text-xs font-medium text-white">{label}</div>
        <div className="text-[10px] text-[#555a66]">{description}</div>
      </div>
      <div
        className={`w-8 h-[18px] rounded-full transition-colors relative ${
          checked ? "bg-brand" : "bg-[#2a2e3e]"
        }`}
      >
        <div
          className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
            checked ? "translate-x-[16px]" : "translate-x-[2px]"
          }`}
        />
      </div>
    </button>
  );
}
