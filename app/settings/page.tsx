"use client";

import { useState } from "react";
import {
  Wallet,
  Plus,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Check,
  Copy,
  Shield,
  AlertTriangle,
  Settings,
  Radio,
  Pencil,
  Link2,
  Unlink,
  RefreshCw,
} from "lucide-react";
import { useSettingsStore } from "@/lib/settings/store";
import type { LinkedWallet, DayzeConfig } from "@/lib/settings/store";
import { shortenAddress } from "@/lib/hyperliquid/wallet";

function WalletCard({
  wallet,
  isActive,
  onActivate,
  onRemove,
  onRename,
}: {
  wallet: LinkedWallet;
  isActive: boolean;
  onActivate: () => void;
  onRemove: () => void;
  onRename: (label: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(wallet.label);

  const copyAddr = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveLabel = () => {
    if (editLabel.trim()) onRename(editLabel.trim());
    setEditing(false);
  };

  return (
    <div
      className={`relative p-4 rounded-xl border transition-all ${
        isActive
          ? "border-brand bg-brand/5"
          : "border-[#2a2e39] bg-[#141620] hover:border-[#3a3e49]"
      }`}
    >
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-brand uppercase tracking-wider">
          <Radio className="h-3 w-3" />
          Active
        </div>
      )}

      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isActive ? "bg-brand/20" : "bg-[#1a1d26]"
          }`}
        >
          <Wallet className={`h-5 w-5 ${isActive ? "text-brand" : "text-[#848e9c]"}`} />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveLabel()}
                onBlur={saveLabel}
                autoFocus
                className="bg-[#0b0e11] border border-[#2a2e39] rounded px-2 py-0.5 text-sm text-white outline-none focus:border-brand w-full"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white truncate">{wallet.label}</span>
              <button onClick={() => setEditing(true)} className="text-[#848e9c] hover:text-white">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <code className="text-xs text-[#848e9c] font-mono">{shortenAddress(wallet.address)}</code>
            <button onClick={copyAddr} className="text-[#848e9c] hover:text-white">
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          <div className="text-[10px] text-[#5a6270] mt-1">
            Added {new Date(wallet.addedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2a2e39]/50">
        {!isActive && (
          <button
            onClick={onActivate}
            className="flex-1 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors"
          >
            Set Active
          </button>
        )}
        <button
          onClick={onRemove}
          className="flex items-center gap-1 py-1.5 px-3 text-xs font-medium text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
    </div>
  );
}

function AddWalletForm({ onAdd }: { onAdd: (label: string, address: string) => void }) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const addr = address.trim();
    if (!addr.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Invalid Ethereum address");
      return;
    }
    if (!label.trim()) {
      setError("Label is required");
      return;
    }

    onAdd(label.trim(), addr);
    setLabel("");
    setAddress("");
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-dashed border-[#2a2e39] bg-[#141620]/50 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Plus className="h-4 w-4 text-brand" />
        Add Wallet
      </div>

      <div>
        <label className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Main Trading, Funding Farm"
          className="mt-1 w-full bg-[#0b0e11] border border-[#2a2e39] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand placeholder:text-[#5a6270]"
        />
      </div>

      <div>
        <label className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold">
          Hyperliquid Address
        </label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="mt-1 w-full bg-[#0b0e11] border border-[#2a2e39] rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-brand placeholder:text-[#5a6270]"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        className="w-full py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors"
      >
        Add Wallet
      </button>
    </form>
  );
}

function ApiWalletSection() {
  const apiWallet = useSettingsStore((s) => s.apiWallet);
  const setApiWallet = useSettingsStore((s) => s.setApiWallet);
  const clearApiWallet = useSettingsStore((s) => s.clearApiWallet);

  const [name, setName] = useState(apiWallet?.name ?? "");
  const [address, setAddress] = useState(apiWallet?.address ?? "");
  const [privateKey, setPrivateKey] = useState(apiWallet?.privateKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");

    if (!name.trim()) {
      setError("Wallet name is required");
      return;
    }
    if (!address.trim().match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Invalid API wallet address");
      return;
    }
    if (!privateKey.trim().match(/^0x[a-fA-F0-9]{64}$/)) {
      setError("Invalid private key (must be 0x + 64 hex chars)");
      return;
    }

    setApiWallet({
      name: name.trim(),
      address: address.trim(),
      privateKey: privateKey.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/80 leading-relaxed">
          <strong>Security Notice:</strong> Your API private key is stored locally in your browser.
          Never share it. This key allows programmatic trading on your behalf. Only use API wallets
          with limited permissions created through Hyperliquid&apos;s API Wallet feature.
        </div>
      </div>

      <div className="p-4 rounded-xl border border-[#2a2e39] bg-[#141620] space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Key className="h-4 w-4 text-brand" />
          API Wallet Configuration
        </div>

        <div>
          <label className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold">
            Wallet Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Coincess API"
            className="mt-1 w-full bg-[#0b0e11] border border-[#2a2e39] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand placeholder:text-[#5a6270]"
          />
        </div>

        <div>
          <label className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold">
            API Wallet Address
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className="mt-1 w-full bg-[#0b0e11] border border-[#2a2e39] rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-brand placeholder:text-[#5a6270]"
          />
        </div>

        <div>
          <label className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold">
            Private Key
          </label>
          <div className="relative mt-1">
            <input
              type={showKey ? "text" : "password"}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x..."
              className="w-full bg-[#0b0e11] border border-[#2a2e39] rounded-lg px-3 py-2 pr-10 text-sm text-white font-mono outline-none focus:border-brand placeholder:text-[#5a6270]"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-white"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors"
          >
            {saved ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            {saved ? "Saved!" : "Save API Wallet"}
          </button>
          {apiWallet && (
            <button
              onClick={() => {
                clearApiWallet();
                setName("");
                setAddress("");
                setPrivateKey("");
              }}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 text-sm font-medium transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>

      {apiWallet && (
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <Check className="h-3.5 w-3.5" />
            API Wallet Configured
          </div>
          <p className="text-[11px] text-emerald-200/60 mt-1">
            <strong>{apiWallet.name}</strong> — {shortenAddress(apiWallet.address)}
          </p>
          <p className="text-[10px] text-emerald-200/40 mt-0.5">
            Programmatic trading is ready. Use the Automate page or the guard scripts.
          </p>
        </div>
      )}
    </div>
  );
}

function DayzeSection() {
  const dayze = useSettingsStore((s) => s.dayze);
  const setDayze = useSettingsStore((s) => s.setDayze);

  const [apiKey, setApiKey] = useState(dayze?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(dayze?.baseUrl ?? "https://ohmydayze.com");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    setDayze({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim().replace(/\/$/, ""),
      enabled: true,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${baseUrl.trim().replace(/\/$/, "")}/api/v1/activity?limit=1`, {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: "Connected to Dayze!" });
      } else {
        const body = await res.json().catch(() => ({}));
        setTestResult({ ok: false, msg: body.error || `HTTP ${res.status}` });
      }
    } catch {
      setTestResult({ ok: false, msg: "Could not reach Dayze server" });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-[#2a2e39] bg-[#141620] space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Link2 className="h-4 w-4 text-brand" />
          Dayze Connection
        </div>

        <p className="text-xs text-[#848e9c]">
          Connect to Dayze (your Life OS) to sync your trading activity, PnL, and positions
          into your personal timeline.
        </p>

        <div>
          <label className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold">
            Dayze API Key
          </label>
          <div className="relative mt-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="dayze_k_..."
              className="w-full bg-[#0b0e11] border border-[#2a2e39] rounded-lg px-3 py-2 pr-10 text-sm text-white font-mono outline-none focus:border-brand placeholder:text-[#5a6270]"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-white"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold">
            Dayze URL
          </label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://ohmydayze.com"
            className="mt-1 w-full bg-[#0b0e11] border border-[#2a2e39] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand placeholder:text-[#5a6270]"
          />
        </div>

        {testResult && (
          <p className={`text-xs ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
            {testResult.msg}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {saved ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            {saved ? "Saved!" : "Save"}
          </button>
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2e39] hover:bg-[#1a1d26] disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
            Test
          </button>
          {dayze && (
            <button
              onClick={() => {
                setDayze(null);
                setApiKey("");
              }}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 text-sm font-medium transition-colors"
            >
              <Unlink className="h-3.5 w-3.5" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {dayze?.enabled && (
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <Check className="h-3.5 w-3.5" />
            Dayze Connected
          </div>
          <p className="text-[11px] text-emerald-200/60 mt-1">
            Trading activity will sync to your Dayze timeline.
          </p>
        </div>
      )}

      <div className="p-4 rounded-xl border border-[#2a2e39] bg-[#141620]">
        <h3 className="text-xs font-bold text-white mb-2">How to get a Dayze API key</h3>
        <ol className="text-[11px] text-[#848e9c] space-y-1.5 list-decimal list-inside">
          <li>Log in to your Dayze account</li>
          <li>Go to Settings &rarr; Developer &rarr; API Keys</li>
          <li>Create a new key with the <strong>activity</strong> scope</li>
          <li>Copy the key (starts with <code className="text-brand">dayze_k_</code>) and paste above</li>
        </ol>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const wallets = useSettingsStore((s) => s.linkedWallets);
  const activeId = useSettingsStore((s) => s.activeWalletId);
  const addWallet = useSettingsStore((s) => s.addWallet);
  const removeWallet = useSettingsStore((s) => s.removeWallet);
  const setActive = useSettingsStore((s) => s.setActiveWallet);
  const updateLabel = useSettingsStore((s) => s.updateWalletLabel);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
            <Settings className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-xs text-[#848e9c]">Manage wallets, API keys, and preferences</p>
          </div>
        </div>

        {/* Linked Wallets */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand" />
              Linked Wallets
            </h2>
            <p className="text-xs text-[#848e9c] mt-1">
              Add Hyperliquid wallet addresses to monitor positions and trades.
              The active wallet is used for portfolio views and the trade page.
            </p>
          </div>

          {wallets.length > 0 ? (
            <div className="grid gap-3">
              {wallets.map((w) => (
                <WalletCard
                  key={w.id}
                  wallet={w}
                  isActive={w.id === activeId}
                  onActivate={() => setActive(w.id)}
                  onRemove={() => removeWallet(w.id)}
                  onRename={(label) => updateLabel(w.id, label)}
                />
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-[#2a2e39] text-center">
              <Wallet className="h-8 w-8 text-[#5a6270] mx-auto mb-2" />
              <p className="text-sm text-[#848e9c]">No wallets linked yet</p>
              <p className="text-xs text-[#5a6270] mt-1">
                Add a Hyperliquid address to monitor your trades
              </p>
            </div>
          )}

          <AddWalletForm onAdd={addWallet} />
        </section>

        {/* Divider */}
        <div className="border-t border-[#2a2e39]" />

        {/* API Wallet */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="h-4 w-4 text-brand" />
              Programmatic Trading (API Wallet)
            </h2>
            <p className="text-xs text-[#848e9c] mt-1">
              Configure an API wallet to enable automated trading, stop-losses, and strategy execution
              directly from Coincess.
            </p>
          </div>

          <ApiWalletSection />

          <div className="p-4 rounded-xl border border-[#2a2e39] bg-[#141620]">
            <h3 className="text-xs font-bold text-white mb-2">How to create an API wallet</h3>
            <ol className="text-[11px] text-[#848e9c] space-y-1.5 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://app.hyperliquid.xyz/API"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  app.hyperliquid.xyz/API
                </a>
              </li>
              <li>Click &quot;Generate API Wallet&quot;</li>
              <li>Give it a name (e.g. &quot;Coincess API&quot;)</li>
              <li>Copy the <strong>API Wallet Address</strong> and <strong>Private Key</strong></li>
              <li>Paste them into the fields above</li>
            </ol>
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-[#2a2e39]" />

        {/* Dayze Integration */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Link2 className="h-4 w-4 text-brand" />
              Dayze Integration
            </h2>
            <p className="text-xs text-[#848e9c] mt-1">
              Connect to Dayze &mdash; your Life OS &mdash; to see your trades, PnL, and positions
              in your personal timeline alongside everything else in your life.
            </p>
          </div>

          <DayzeSection />
        </section>
      </div>
    </div>
  );
}
