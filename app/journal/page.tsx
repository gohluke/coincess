"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  Plus,
  X,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Smile,
  Frown,
  Meh,
  GraduationCap,
  LogIn,
  Edit3,
  Sparkles,
  Globe,
  Lock,
  Link2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";

interface LinkedTrade {
  platform: string;
  fills: Array<{
    coin: string;
    side: string;
    size: string;
    price: string;
    pnl: string;
    fee: string;
    time: string;
  }>;
  summary: { totalPnl: number; tradeCount: number; coins: string[] };
}

interface JournalEntry {
  id: string;
  wallet_address: string;
  title: string;
  content: string;
  tags: string[];
  trade_data: unknown;
  pnl_amount: number | null;
  coin: string | null;
  mood: "confident" | "tilted" | "neutral" | "learning" | null;
  is_public: boolean;
  slug: string | null;
  published_at: string | null;
  linked_trades: LinkedTrade[];
  created_at: string;
  updated_at: string;
}

const MOOD_CONFIG = {
  confident: { icon: Smile, label: "Confident", color: "text-emerald-400 bg-emerald-400/10" },
  tilted: { icon: Frown, label: "Tilted", color: "text-red-400 bg-red-400/10" },
  neutral: { icon: Meh, label: "Neutral", color: "text-[#848e9c] bg-[#848e9c]/10" },
  learning: { icon: GraduationCap, label: "Learning", color: "text-amber-400 bg-amber-400/10" },
} as const;

const SUGGESTED_TAGS = [
  "revenge-trading", "no-stop-loss", "overleverage", "good-entry",
  "trend-following", "scalp", "swing", "funding-farm",
  "brentoil", "btc", "eth", "sol", "lesson", "win", "loss",
];

function formatUsd(val: number): string {
  if (!Number.isFinite(val)) return "$0.00";
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function TradeCard({ trade }: { trade: LinkedTrade }) {
  const platformLabel = trade.platform === "hyperliquid" ? "Hyperliquid" : "Polymarket";
  const pnl = trade.summary.totalPnl;

  return (
    <div className="bg-[#0b0e11] rounded-lg p-3 border border-[#2a2e3e]/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#848e9c]">
          {platformLabel}
        </span>
        <span className={`text-xs font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {trade.summary.coins.map((c) => (
          <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1d2e] text-[#848e9c] font-medium">
            {c}
          </span>
        ))}
      </div>
      <div className="text-[10px] text-[#5a6070]">
        {trade.summary.tradeCount} fills
      </div>
    </div>
  );
}

export default function JournalPage() {
  const { address, connect, loading: walletLoading } = useEffectiveAddress();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [pnlAmount, setPnlAmount] = useState("");
  const [coin, setCoin] = useState("");
  const [mood, setMood] = useState<JournalEntry["mood"]>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [linkedTrades, setLinkedTrades] = useState<LinkedTrade[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/journal?wallet=${address}`);
      if (res.ok) setEntries(await res.json());
    } catch (err) {
      console.error("Failed to load journal:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) fetchEntries();
  }, [address, fetchEntries]);

  const resetForm = () => {
    setEditing(false);
    setEditId(null);
    setTitle("");
    setContent("");
    setTags([]);
    setTagInput("");
    setPnlAmount("");
    setCoin("");
    setMood(null);
    setIsPublic(false);
    setLinkedTrades([]);
  };

  const openEditor = (entry?: JournalEntry) => {
    if (entry) {
      setEditId(entry.id);
      setTitle(entry.title);
      setContent(entry.content);
      setTags(entry.tags);
      setPnlAmount(entry.pnl_amount != null ? String(entry.pnl_amount) : "");
      setCoin(entry.coin ?? "");
      setMood(entry.mood);
      setIsPublic(entry.is_public);
      setLinkedTrades(entry.linked_trades ?? []);
    } else {
      resetForm();
    }
    setEditing(true);
  };

  const handleGenerate = async () => {
    if (!address) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/journal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: address }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || err.error || "Failed to generate draft");
        return;
      }
      const data = await res.json();
      if (!data.draft) {
        alert(data.message || "No trades found for today.");
        return;
      }

      setContent(data.draft);
      setLinkedTrades(data.linked_trades ?? []);

      if (!title) {
        const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        setTitle(`Trade Journal — ${today}`);
      }

      const allCoins = (data.linked_trades as LinkedTrade[])
        .flatMap((lt) => lt.summary.coins)
        .map((c) => c.toLowerCase());
      const totalPnl = (data.linked_trades as LinkedTrade[])
        .reduce((s, lt) => s + lt.summary.totalPnl, 0);

      if (allCoins.length > 0 && !coin) setCoin(allCoins[0].toUpperCase());
      if (totalPnl !== 0 && !pnlAmount) setPnlAmount(totalPnl.toFixed(2));

      const autoTags = [...new Set(allCoins)].filter((t) => !tags.includes(t));
      if (autoTags.length > 0) setTags((prev) => [...prev, ...autoTags]);

      if (!editing) setEditing(true);
    } catch (err) {
      console.error("Generate failed:", err);
      alert("Failed to generate journal draft.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!address || !title.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ...(editId ? { id: editId } : {}),
        wallet_address: address,
        title: title.trim(),
        content,
        tags,
        pnl_amount: pnlAmount ? parseFloat(pnlAmount) : null,
        coin: coin.trim() || null,
        mood,
        is_public: isPublic,
        linked_trades: linkedTrades,
      };

      const res = await fetch("/api/journal", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        fetchEntries();
      }
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this journal entry?")) return;
    try {
      await fetch(`/api/journal?id=${id}`, { method: "DELETE" });
      fetchEntries();
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const addTag = (tag: string) => {
    const t = tag.toLowerCase().trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeLinkedTrade = (idx: number) => {
    setLinkedTrades((prev) => prev.filter((_, i) => i !== idx));
  };

  const filtered = entries.filter((e) => {
    if (filterTag && !e.tags.includes(filterTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.coin?.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q))
      );
    }
    return true;
  });

  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort();

  if (!address && !walletLoading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white flex items-center justify-center pb-20">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 text-[#2a2e3e] mx-auto" />
          <h2 className="text-lg font-semibold">Trade Journal</h2>
          <p className="text-sm text-[#848e9c]">Connect a wallet to start journaling</p>
          <button onClick={connect} className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors flex items-center gap-2 mx-auto">
            <LogIn className="h-4 w-4" /> Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand" />
              Trade Journal
            </h1>
            <p className="text-xs text-[#848e9c] mt-1">
              Record your trades, lessons, and reflections
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-3 py-2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium hover:bg-purple-500/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Generate journal draft from today's trades"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? "Generating..." : "Generate from Trades"}
            </button>
            <button
              onClick={fetchEntries}
              disabled={loading}
              className="p-2 text-[#848e9c] hover:text-white transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => openEditor()}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> New Entry
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#848e9c]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              className="w-full bg-[#141620] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand transition-colors"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <button
                onClick={() => setFilterTag("")}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  !filterTag ? "bg-brand/20 text-brand" : "bg-[#1a1d2e] text-[#848e9c] hover:text-white"
                }`}
              >
                All
              </button>
              {allTags.slice(0, 8).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTag(filterTag === t ? "" : t)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    filterTag === t ? "bg-brand/20 text-brand" : "bg-[#1a1d2e] text-[#848e9c] hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editor Modal */}
        {editing && (
          <div className="bg-[#141620] border border-brand/30 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{editId ? "Edit Entry" : "New Journal Entry"}</h2>
              <button onClick={resetForm} className="text-[#848e9c] hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. BRENTOIL blowup analysis)"
              className="w-full bg-[#0b0e11] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand"
            />

            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What happened? What did you learn? Write in markdown..."
                rows={12}
                className="w-full bg-[#0b0e11] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand font-mono text-xs leading-relaxed resize-y"
              />
              {!content && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="absolute top-3 right-3 px-2.5 py-1.5 bg-purple-500/15 text-purple-400 rounded-md text-[10px] font-medium hover:bg-purple-500/25 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI Draft
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-1 block">Coin</label>
                <input
                  type="text"
                  value={coin}
                  onChange={(e) => setCoin(e.target.value.toUpperCase())}
                  placeholder="e.g. BRENTOIL"
                  className="w-full bg-[#0b0e11] rounded-lg px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-1 block">P&L Amount</label>
                <input
                  type="number"
                  value={pnlAmount}
                  onChange={(e) => setPnlAmount(e.target.value)}
                  placeholder="e.g. -70.53"
                  step="0.01"
                  className="w-full bg-[#0b0e11] rounded-lg px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-1 block">Mood</label>
                <div className="flex gap-1.5">
                  {(Object.entries(MOOD_CONFIG) as [keyof typeof MOOD_CONFIG, typeof MOOD_CONFIG[keyof typeof MOOD_CONFIG]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setMood(mood === key ? null : key)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                          mood === key ? cfg.color : "bg-[#0b0e11] text-[#848e9c] hover:text-white"
                        } border ${mood === key ? "border-current/20" : "border-[#2a2e3e]"}`}
                      >
                        <Icon className="h-3 w-3" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Publish Toggle */}
            <div className="flex items-center justify-between bg-[#0b0e11] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                {isPublic ? <Globe className="h-3.5 w-3.5 text-emerald-400" /> : <Lock className="h-3.5 w-3.5 text-[#848e9c]" />}
                <span className="text-xs text-[#848e9c]">
                  {isPublic ? "Public — visible on the feed" : "Private — only you can see this"}
                </span>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  isPublic ? "bg-emerald-400/30" : "bg-[#2a2e3e]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                    isPublic ? "translate-x-5 bg-emerald-400" : "translate-x-0 bg-[#5a6070]"
                  }`}
                />
              </button>
            </div>

            {/* Linked Trades */}
            {linkedTrades.length > 0 && (
              <div>
                <label className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-2 block flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Linked Trades
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {linkedTrades.map((lt, i) => (
                    <div key={i} className="relative group">
                      <TradeCard trade={lt} />
                      <button
                        onClick={() => removeLinkedTrade(i)}
                        className="absolute top-2 right-2 p-1 bg-[#141620] rounded-md text-[#5a6070] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/15 text-brand rounded text-[10px] font-medium">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-white">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="Add tag..."
                  className="flex-1 bg-[#0b0e11] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#848e9c] focus:outline-none focus:border-brand"
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 10).map((t) => (
                  <button
                    key={t}
                    onClick={() => addTag(t)}
                    className="px-1.5 py-0.5 bg-[#1a1d2e] text-[#5a6070] rounded text-[9px] hover:text-[#848e9c] transition-colors"
                  >
                    +{t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={resetForm} className="px-4 py-2 text-xs text-[#848e9c] rounded-lg hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : editId ? "Update" : "Save Entry"}
              </button>
            </div>
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-5 w-5 animate-spin text-[#848e9c]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-[#2a2e3e] mb-3" />
            <p className="text-sm text-[#848e9c]">
              {entries.length === 0 ? "No journal entries yet" : "No entries match your filter"}
            </p>
            {entries.length === 0 && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => openEditor()}
                  className="px-4 py-2 bg-brand/10 text-brand rounded-lg text-xs font-medium hover:bg-brand/20 transition-colors"
                >
                  Write your first entry
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-4 py-2 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate from trades
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => {
              const expanded = expandedId === entry.id;
              const moodCfg = entry.mood ? MOOD_CONFIG[entry.mood] : null;
              const MoodIcon = moodCfg?.icon;
              const pnl = entry.pnl_amount;
              const trades = entry.linked_trades ?? [];

              return (
                <div key={entry.id} className="bg-[#141620] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#1a1d2e]/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white truncate">{entry.title}</span>
                        {pnl != null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            pnl >= 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
                          }`}>
                            {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                          </span>
                        )}
                        {entry.coin && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2a2e3e] text-[#848e9c] font-medium">
                            {entry.coin}
                          </span>
                        )}
                        {moodCfg && MoodIcon && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${moodCfg.color} font-medium inline-flex items-center gap-0.5`}>
                            <MoodIcon className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {entry.is_public && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400 font-medium inline-flex items-center gap-0.5">
                            <Globe className="h-2.5 w-2.5" /> Published
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#5a6070]">
                          {new Date(entry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        {entry.tags.length > 0 && (
                          <div className="flex gap-1">
                            {entry.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-[9px] text-[#5a6070]">#{t}</span>
                            ))}
                            {entry.tags.length > 3 && (
                              <span className="text-[9px] text-[#3a3e4e]">+{entry.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                        {trades.length > 0 && (
                          <span className="text-[9px] text-[#5a6070] flex items-center gap-0.5">
                            <Link2 className="h-2.5 w-2.5" /> {trades.length} linked
                          </span>
                        )}
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-[#848e9c] shrink-0" /> : <ChevronDown className="h-4 w-4 text-[#848e9c] shrink-0" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 border-t border-[#2a2e3e]/50">
                      <div className="pt-3 journal-prose">
                        {entry.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {entry.content}
                          </ReactMarkdown>
                        ) : (
                          <p className="text-xs text-[#5a6070] italic">No content</p>
                        )}
                      </div>

                      {/* Linked Trades Display */}
                      {trades.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#2a2e3e]/30">
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#848e9c] mb-2 flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> Linked Trades
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {trades.map((lt, i) => (
                              <TradeCard key={i} trade={lt} />
                            ))}
                          </div>
                        </div>
                      )}

                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {entry.tags.map((t) => (
                            <span key={t} className="px-2 py-0.5 bg-brand/10 text-brand rounded text-[10px] font-medium">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2a2e3e]/30">
                        <button
                          onClick={() => openEditor(entry)}
                          className="px-3 py-1.5 text-[10px] text-[#848e9c] rounded-lg hover:text-white transition-colors flex items-center gap-1"
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </button>
                        {entry.is_public && entry.slug && (
                          <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/journal/${entry.slug}`)}
                            className="px-3 py-1.5 text-[10px] text-emerald-400/70 rounded-lg hover:text-emerald-400 transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Copy Link
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="px-3 py-1.5 text-[10px] text-red-400/70 border border-red-400/20 rounded-lg hover:text-red-400 hover:border-red-400/40 transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
