"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Play,
  Pause,
  Square,
  Plus,
  RefreshCw,
  Zap,
  ZapOff,
  BarChart3,
  Shield,
  DollarSign,
  Clock,
  Bot,
  Bell,
  Copy,
  Server,
  Monitor,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { useAutomationStore } from "@/lib/automation/store";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { StrategyCard } from "@/components/automate/StrategyCard";
import { ActivityLog } from "@/components/automate/ActivityLog";
import type { QuantStrategy, QuantState, QuantTrade } from "@/lib/quant/types";
import type { MarketInfo } from "@/lib/hyperliquid/types";
import { fetchAllMarkets } from "@/lib/hyperliquid/api";

type Tab = "server" | "browser";

const STRATEGY_LABELS: Record<string, { name: string; emoji: string; color: string }> = {
  funding_rate: { name: "Funding Rate Harvester", emoji: "🌾", color: "#10b981" },
  momentum: { name: "Momentum Scalper", emoji: "⚡", color: "#8b5cf6" },
  grid: { name: "Grid Bot", emoji: "📊", color: "#3b82f6" },
  mean_reversion: { name: "Mean Reversion", emoji: "🔄", color: "#f59e0b" },
};

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatElapsed(ms: number): string {
  if (ms < 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function LiveTimer({ iso }: { iso: string | null }) {
  const now = useTick();
  if (!iso) return <span>—</span>;
  const opened = new Date(iso).getTime();
  const elapsed = now - opened;
  const dateStr = new Date(iso).toLocaleString([], {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return (
    <div>
      <p className="text-[11px] font-semibold text-white">{formatElapsed(elapsed)}</p>
      <p className="text-[8px] text-[#4a4e59] mt-0.5">{dateStr}</p>
    </div>
  );
}

export default function AutomatePage() {
  const { address } = useEffectiveAddress();
  const [tab, setTab] = useState<Tab>("server");

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      {/* Toolbar */}
      <div className="border-b border-[#2a2e39] bg-[#0b0e11]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#7C3AED]" />
              Automation
            </h1>
            <div className="flex items-center bg-[#141620] rounded-lg p-0.5">
              <button
                onClick={() => setTab("server")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === "server"
                    ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Server className="h-3 w-3" />
                Server 24/7
              </button>
              <button
                onClick={() => setTab("browser")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === "browser"
                    ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Monitor className="h-3 w-3" />
                Browser Bots
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/automate/alerts"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#848e9c] hover:text-white hover:bg-[#1a1d26] transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              Alerts
            </Link>
            <Link
              href="/automate/copy"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#848e9c] hover:text-white hover:bg-[#1a1d26] transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Trade
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "server" ? (
          <ServerStrategies address={address} />
        ) : (
          <BrowserBots />
        )}
      </div>
    </div>
  );
}

/* ─── SERVER STRATEGIES (Quant Engine - runs 24/7 on Contabo) ─── */

function ServerStrategies({ address }: { address: string | null }) {
  const [engine, setEngine] = useState<QuantState | null>(null);
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [openTrades, setOpenTrades] = useState<QuantTrade[]>([]);
  const [trades, setTrades] = useState<QuantTrade[]>([]);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStrategy, setAddingStrategy] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, tradesRes, marketsData] = await Promise.all([
        fetch("/api/quant/status"),
        fetch("/api/quant/trades?limit=50"),
        fetchAllMarkets().catch(() => [] as MarketInfo[]),
      ]);
      const statusData = await statusRes.json();
      const tradesData = await tradesRes.json();

      setEngine(statusData.engine);
      setStrategies(statusData.strategies ?? []);
      setOpenTrades(statusData.openTrades ?? []);
      setTrades(tradesData.trades ?? []);
      setMarkets(marketsData);
    } catch (err) {
      console.error("Failed to fetch quant data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleStrategy = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await fetch("/api/quant/strategies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    fetchData();
  };

  const addStrategy = async (type: string) => {
    if (!address) return;
    await fetch("/api/quant/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, wallet_address: address, config: {} }),
    });
    setAddingStrategy(false);
    fetchData();
  };

  const deleteStrategy = async (id: string) => {
    await fetch(`/api/quant/strategies?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const statusColor =
    engine?.engine_status === "running" ? "#10b981" :
    engine?.engine_status === "error" ? "#ef4444" :
    engine?.engine_status === "paused" ? "#f59e0b" : "#848e9c";

  const realizedPnl = strategies.reduce((s, st) => s + (st.total_pnl ?? 0), 0);
  const unrealizedPnl = openTrades.reduce((sum, trade) => {
    const market = markets.find((m) => m.name === trade.coin);
    const markPx = market ? parseFloat(market.markPx) : 0;
    if (markPx === 0) return sum;
    const entryPx = Number(trade.entry_px);
    const sz = Number(trade.size);
    return sum + (trade.side === "long" ? (markPx - entryPx) * sz : (entryPx - markPx) * sz);
  }, 0);
  const totalPnl = realizedPnl + unrealizedPnl;
  const dailyPnl = (engine?.daily_pnl ?? 0) + unrealizedPnl;
  const drawdown = engine?.max_drawdown ?? 0;
  const exposure = openTrades.reduce((sum, trade) => {
    const market = markets.find((m) => m.name === trade.coin);
    const markPx = market ? parseFloat(market.markPx) : Number(trade.entry_px);
    return sum + Math.abs(Number(trade.size) * markPx);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-[#7C3AED]" />
          <span className="text-sm font-semibold text-white">Quant Engine</span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: statusColor + "20", color: statusColor }}
          >
            {engine?.engine_status?.toUpperCase() ?? "OFFLINE"}
          </span>
          {engine?.last_tick_at && (
            <span className="text-[10px] text-[#4a4e59]">
              Last tick: {relativeTime(engine.last_tick_at)}
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#848e9c] hover:text-white hover:bg-[#1a1d26] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total P&L"
            value={formatPnl(totalPnl)}
            icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
            color={totalPnl >= 0 ? "#10b981" : "#ef4444"}
          />
          <StatCard
            label="Daily P&L"
            value={formatPnl(dailyPnl)}
            icon={DollarSign}
            color={dailyPnl >= 0 ? "#10b981" : "#ef4444"}
          />
          <StatCard
            label="Max Drawdown"
            value={`${(drawdown * 100).toFixed(2)}%`}
            icon={Shield}
            color={drawdown > 0.1 ? "#ef4444" : drawdown > 0.05 ? "#f59e0b" : "#10b981"}
          />
          <StatCard
            label="Exposure"
            value={`$${exposure.toFixed(0)}`}
            icon={BarChart3}
            color="#8b5cf6"
          />
        </div>
      )}

      {/* Risk Warning */}
      {drawdown > 0.1 && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-red-300 text-sm font-medium">High Drawdown Warning</p>
            <p className="text-red-400/70 text-xs">
              Drawdown at {(drawdown * 100).toFixed(1)}%. Kill switch triggers at 20%.
            </p>
          </div>
        </div>
      )}

      {/* Strategies */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Server Strategies</h2>
          <button
            onClick={() => setAddingStrategy(!addingStrategy)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-[#7C3AED]/15 text-[#7C3AED] hover:bg-[#7C3AED]/25 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Strategy
          </button>
        </div>

        {addingStrategy && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(STRATEGY_LABELS).map(([type, { name, emoji }]) => (
              <button
                key={type}
                onClick={() => addStrategy(type)}
                className="p-3 rounded-xl border border-[#2a2e39] bg-[#12141a] hover:border-[#7C3AED]/40 transition-colors text-left"
              >
                <span className="text-lg">{emoji}</span>
                <p className="text-xs text-white mt-1">{name}</p>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl border border-[#2a2e39] bg-[#12141a] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-14 rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <div className="flex gap-1">
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="text-center text-[#848e9c] text-sm py-8 border border-dashed border-[#2a2e39] rounded-xl">
            No server strategies configured. Click &ldquo;Add Strategy&rdquo; to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {strategies.map((strat) => {
              const meta = STRATEGY_LABELS[strat.type] ?? { name: strat.type, emoji: "🤖", color: "#848e9c" };
              return (
                <div
                  key={strat.id}
                  className="p-4 rounded-xl border border-[#2a2e39] bg-[#12141a] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{meta.name}</p>
                        <p className="text-xs text-[#848e9c]">
                          {strat.total_trades} trades | Last: {relativeTime(strat.last_executed_at)}
                        </p>
                      </div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: meta.color + "20", color: meta.color }}
                    >
                      {strat.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={strat.total_pnl >= 0 ? "text-green-400" : "text-red-400"}>
                      P&L: {formatPnl(strat.total_pnl)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleStrategy(strat.id, strat.status)}
                        className="p-1.5 rounded-lg hover:bg-[#1a1d26] transition-colors"
                        title={strat.status === "active" ? "Pause" : "Start"}
                      >
                        {strat.status === "active" ? (
                          <Pause className="h-3.5 w-3.5 text-yellow-400" />
                        ) : (
                          <Play className="h-3.5 w-3.5 text-green-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteStrategy(strat.id)}
                        className="p-1.5 rounded-lg hover:bg-[#1a1d26] transition-colors"
                        title="Delete"
                      >
                        <Square className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {strat.error_message && (
                    <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                      {strat.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Open Positions */}
      {openTrades.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Open Positions ({openTrades.length})
          </h2>
          <div className="space-y-2">
            {openTrades.map((trade) => {
              const market = markets.find((m) => m.name === trade.coin);
              const markPx = market ? parseFloat(market.markPx) : 0;
              const entryPx = Number(trade.entry_px);
              const sz = Number(trade.size);
              const uPnl = trade.side === "long"
                ? (markPx - entryPx) * sz
                : (entryPx - markPx) * sz;
              const roe = entryPx > 0 ? (uPnl / (entryPx * sz)) * 100 : 0;
              const fundingRate = market ? parseFloat(market.funding) : 0;
              const fundingPct = (fundingRate * 100).toFixed(4);
              const meta = STRATEGY_LABELS[trade.strategy_type] ?? { name: trade.strategy_type, emoji: "🤖", color: "#848e9c" };
              const reason = (trade.meta as { reason?: string } | null)?.reason;

              return (
                <div key={trade.id} className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        trade.side === "long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7C3AED]/15 text-[#7C3AED] font-medium flex items-center gap-0.5">
                        <Bot className="h-2.5 w-2.5" /> {meta.emoji} {meta.name}
                      </span>
                      <span className="text-sm font-semibold">{trade.coin}</span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`text-sm font-bold ${uPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {uPnl >= 0 ? "+" : ""}${uPnl.toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-medium ${roe >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          ({roe >= 0 ? "+" : ""}{roe.toFixed(2)}%)
                        </span>
                      </div>
                      <p className="text-[10px] text-[#848e9c]">{sz.toFixed(4)} @ ${markPx.toLocaleString()}</p>
                    </div>
                  </div>
                  {reason && (
                    <div className="px-4 pb-1.5">
                      <p className="text-[10px] text-[#848e9c]">{reason}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-px bg-[#2a2e3e]/30 border-t border-[#2a2e3e]/50">
                    <QuantDetailCell label="Entry" value={`$${entryPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}`} />
                    <QuantDetailCell label="Mark" value={markPx > 0 ? `$${markPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"} />
                    <QuantDetailCell
                      label="Fund/8h"
                      value={`${fundingRate >= 0 ? "+" : ""}${fundingPct}%`}
                      valueColor={fundingRate >= 0 ? "text-emerald-400" : "text-red-400"}
                    />
                    <QuantDetailCell label="Notional" value={`$${(sz * (markPx || entryPx)).toFixed(2)}`} />
                    <div className="bg-[#141620] px-3 py-2">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-0.5">Opened</p>
                      <LiveTimer iso={trade.opened_at} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade Log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Transaction History ({trades.length})
          </h2>
        </div>
        {trades.length === 0 ? (
          <p className="text-[#848e9c] text-xs py-4 text-center">No trades yet.</p>
        ) : (
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-8 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
              <span>Date</span>
              <span>Pair</span>
              <span>Side</span>
              <span>Strategy</span>
              <span className="text-right">Entry</span>
              <span className="text-right">Exit</span>
              <span className="text-right">P&L</span>
              <span className="text-right">Status</span>
            </div>
            {/* Rows */}
            {trades.slice(0, 30).map((trade) => {
              const meta = STRATEGY_LABELS[trade.strategy_type] ?? { name: trade.strategy_type, emoji: "🤖", color: "#848e9c" };
              const reason = (trade.meta as { reason?: string } | null)?.reason;
              const market = markets.find((m) => m.name === trade.coin);
              const markPx = market ? parseFloat(market.markPx) : 0;
              const entryPx = Number(trade.entry_px);
              const sz = Number(trade.size);
              const isOpen = trade.status === "open";

              let pnl = trade.pnl;
              if (isOpen && markPx > 0) {
                pnl = trade.side === "long"
                  ? (markPx - entryPx) * sz
                  : (entryPx - markPx) * sz;
              }

              return (
                <div key={trade.id} className="grid grid-cols-8 items-center px-4 py-2.5 text-xs border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors group">
                  <span className="text-[#848e9c]">
                    {trade.opened_at
                      ? new Date(trade.opened_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                  <div>
                    <span className="text-white font-medium">{trade.coin}</span>
                    {reason && (
                      <p className="text-[9px] text-[#4a4e59] truncate max-w-[140px] hidden group-hover:block">{reason}</p>
                    )}
                  </div>
                  <span className={`font-medium ${trade.side === "long" ? "text-emerald-400" : "text-red-400"}`}>
                    {trade.side === "long" ? "Long" : "Short"}
                  </span>
                  <span className="text-[#848e9c] text-[10px]">{meta.emoji} {meta.name}</span>
                  <span className="text-right text-white">${entryPx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                  <span className="text-right text-white">
                    {trade.exit_px ? `$${Number(trade.exit_px).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : isOpen && markPx > 0 ? (
                      <span className="text-[#7C3AED]">${markPx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                    ) : "—"}
                  </span>
                  <span className={`text-right font-medium ${(pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {pnl != null ? formatPnl(pnl) : "—"}
                  </span>
                  <span className="text-right">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      trade.status === "open" ? "bg-blue-500/20 text-blue-400"
                        : trade.status === "closed" ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}>
                      {trade.status}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Engine Footer */}
      {engine && (
        <div className="text-[10px] text-[#4a4e59] flex items-center gap-4 border-t border-[#2a2e39] pt-3">
          <span>Peak Equity: ${engine.peak_equity?.toFixed(2) ?? "0.00"}</span>
          <span>Last Tick: {relativeTime(engine.last_tick_at)}</span>
          {engine.error_message && (
            <span className="text-red-400">Error: {engine.error_message}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── BROWSER BOTS (client-side, runs while tab is open) ─── */

function BrowserBots() {
  const {
    strategies, loading, engineRunning,
    init, toggleEngine,
  } = useAutomationStore();

  useEffect(() => { init(); }, [init]);

  const activeCount = strategies.filter((s) => s.status === "active").length;
  const totalTrades = strategies.reduce((sum, s) => sum + s.totalTrades, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="h-5 w-5 text-[#7C3AED]" />
          <span className="text-sm font-semibold text-white">Browser Engine</span>
          <button
            onClick={toggleEngine}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
              engineRunning
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-[#1a1d2e] text-[#848e9c] border border-[#2a2e3e] hover:text-white"
            }`}
          >
            {engineRunning ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            {engineRunning ? "ON" : "OFF"}
          </button>
        </div>
        <Link
          href="/automate/create"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#7C3AED]/15 text-[#7C3AED] hover:bg-[#7C3AED]/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Strategy
        </Link>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-900/10 border border-amber-800/20 rounded-xl px-4 py-3 flex items-center gap-3">
        <Monitor className="h-4 w-4 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-400/80">
          Browser bots only run while this tab is open. For 24/7 automation, use <strong>Server Strategies</strong>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat icon={<Bot className="h-4 w-4 text-[#7C3AED]" />} label="Strategies" value={strategies.length.toString()} />
        <MiniStat icon={<Zap className="h-4 w-4 text-emerald-400" />} label="Active" value={activeCount.toString()} />
        <MiniStat icon={<BarChart3 className="h-4 w-4 text-blue-400" />} label="Total Trades" value={totalTrades.toString()} />
        <MiniStat icon={<Activity className="h-4 w-4 text-amber-400" />} label="Engine" value={engineRunning ? "Running" : "Stopped"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategies */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Browser Strategies</h2>
          {loading ? (
            <div className="text-center py-12 text-[#848e9c] text-sm">Loading...</div>
          ) : strategies.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#2a2e3e] rounded-xl">
              <Bot className="h-10 w-10 mx-auto mb-3 text-[#2a2e3e]" />
              <p className="text-sm text-[#848e9c] mb-3">No browser strategies yet</p>
              <Link href="/automate/create" className="text-sm text-[#7C3AED] hover:underline">Create your first strategy</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {strategies.map((s) => <StrategyCard key={s.id} strategy={s} />)}
            </div>
          )}
        </div>

        {/* Activity */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Activity</h2>
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-3">
            <ActivityLog />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Components ─── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <div className="p-3 rounded-xl border border-[#2a2e39] bg-[#12141a]">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}><Icon className="h-3.5 w-3.5" /></span>
        <span className="text-[10px] text-[#848e9c] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[10px] text-[#848e9c] uppercase tracking-wide">{label}</span></div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function QuantDetailCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-[#141620] px-3 py-2">
      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[11px] font-semibold ${valueColor ?? "text-white"}`}>{value}</p>
    </div>
  );
}
