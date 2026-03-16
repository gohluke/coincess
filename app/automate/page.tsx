"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Play,
  Pause,
  Square,
  Plus,
  RefreshCw,
  Zap,
  ZapOff,
  BarChart3,
  Bell,
  Copy,
  Server,
  Monitor,
  FlaskConical,
  Database,
  CheckCircle2,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { useAutomationStore } from "@/lib/automation/store";
import { Skeleton } from "@/components/ui/Skeleton";
import { StrategyCard } from "@/components/automate/StrategyCard";
import { ActivityLog } from "@/components/automate/ActivityLog";
import type { QuantStrategy, QuantState, QuantTrade, AiAgentConfig } from "@/lib/quant/types";
import { AI_AGENT_DEFAULTS } from "@/lib/quant/types";
import type { MarketInfo, AssetPosition, FundingPayment } from "@/lib/hyperliquid/types";
import { fetchAllMarkets, fetchCombinedClearinghouseState, fetchOpenOrders, fetchUserFunding } from "@/lib/hyperliquid/api";

type Tab = "server" | "browser" | "lab";

interface AiLogEntry {
  id: string;
  strategy_id: string;
  event_type: string;
  market_sentiment: string | null;
  opportunities: Array<{ coin: string; direction: string; strength: number; reason: string }>;
  decision: { actions: Array<{ coin: string; action: string; side: string; confidence: number; reasoning: string; sizeUsd: number }> } | null;
  signals_generated: number;
  analyst_model: string | null;
  trader_model: string | null;
  error_message: string | null;
  created_at: string;
}

const STRATEGY_LABELS: Record<string, { name: string; tag: string; color: string }> = {
  rebate_farmer: { name: "Rebate Farmer", tag: "RF", color: "#22d3ee" },
  funding_rate: { name: "Funding Rate Harvester", tag: "FR", color: "#10b981" },
  momentum: { name: "Momentum Scalper", tag: "MOM", color: "#8b5cf6" },
  grid: { name: "Grid Trading", tag: "GRID", color: "#3b82f6" },
  mean_reversion: { name: "Mean Reversion", tag: "MR", color: "#f59e0b" },
  market_maker: { name: "Market Making", tag: "MM", color: "#ec4899" },
  ai_agent: { name: "AI Agent", tag: "AI", color: "#06b6d4" },
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
      <div className="border-b border-[#2a2e3e]/30 bg-[#0b0e11]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-[0.2em]">Automation</span>
            <div className="flex items-center gap-0.5 border-l border-[#2a2e3e]/30 pl-4">
              <button
                onClick={() => setTab("server")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-medium transition-all ${
                  tab === "server"
                    ? "bg-[#1a1d2e] text-white"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Server className="h-3 w-3" />
                Server
              </button>
              <button
                onClick={() => setTab("browser")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-medium transition-all ${
                  tab === "browser"
                    ? "bg-[#1a1d2e] text-white"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Monitor className="h-3 w-3" />
                Browser
              </button>
              <button
                onClick={() => setTab("lab")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-medium transition-all ${
                  tab === "lab"
                    ? "bg-[#1a1d2e] text-white"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                <FlaskConical className="h-3 w-3" />
                Lab
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/automate/alerts"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] text-[#848e9c] hover:text-white hover:bg-[#1a1d2e] transition-colors"
            >
              <Bell className="h-3 w-3" />
              Alerts
            </Link>
            <Link
              href="/automate/copy"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] text-[#848e9c] hover:text-white hover:bg-[#1a1d2e] transition-colors"
            >
              <Copy className="h-3 w-3" />
              Copy
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {tab === "server" ? (
          <ServerStrategies address={address} />
        ) : tab === "browser" ? (
          <BrowserBots />
        ) : (
          <QuantLab />
        )}
      </div>
    </div>
  );
}

/* ─── SERVER STRATEGIES (Quant Engine - runs 24/7 on Contabo) ─── */

function ServerStrategies({ address }: { address: string | null }) {
  const [engine, setEngine] = useState<QuantState | null>(null);
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [quantTrades, setQuantTrades] = useState<QuantTrade[]>([]);
  const [trades, setTrades] = useState<QuantTrade[]>([]);
  const [tradesSummary, setTradesSummary] = useState<{ totalPnl: number; totalFees: number; netPnl: number }>({ totalPnl: 0, totalFees: 0, netPnl: 0 });
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [walletPositions, setWalletPositions] = useState<AssetPosition[]>([]);
  const [fundingPayments, setFundingPayments] = useState<FundingPayment[]>([]);
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [accountValue, setAccountValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingStrategy, setAddingStrategy] = useState(false);
  const [aiConfigOpen, setAiConfigOpen] = useState<string | null>(null);
  const [aiLogs, setAiLogs] = useState<AiLogEntry[]>([]);
  const [aiConfigDraft, setAiConfigDraft] = useState<Partial<AiAgentConfig>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rfStats, setRfStats] = useState<Record<string, any> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const fetches: Promise<unknown>[] = [
        fetch("/api/quant/status"),
        fetch("/api/quant/trades?limit=50"),
        fetchAllMarkets().catch(() => [] as MarketInfo[]),
        fetch("/api/quant/rebate-farmer").then(r => r.ok ? r.json() : null).catch(() => null),
      ];
      if (address) {
        fetches.push(
          fetchCombinedClearinghouseState(address).catch(() => null),
          fetchOpenOrders(address).catch(() => []),
          fetchUserFunding(address).catch(() => [] as FundingPayment[]),
        );
      }

      const results = await Promise.all(fetches);
      const statusData = await (results[0] as Response).json();
      const tradesData = await (results[1] as Response).json();
      const marketsData = results[2] as MarketInfo[];
      const rfData = results[3] as Record<string, unknown> | null;

      setEngine(statusData.engine);
      setStrategies(statusData.strategies ?? []);
      setQuantTrades(statusData.openTrades ?? []);
      setTrades(tradesData.trades ?? []);
      setTradesSummary(tradesData.summary ?? { totalPnl: 0, totalFees: 0, netPnl: 0 });
      setMarkets(marketsData);
      if (rfData && !rfData.error) setRfStats(rfData);

      if (address && results[4]) {
        const ch = results[4] as { assetPositions: AssetPosition[]; marginSummary: { accountValue: string } };
        const positions = ch.assetPositions?.filter(
          (ap) => parseFloat(ap.position.szi) !== 0
        ) ?? [];
        setWalletPositions(positions);
        setAccountValue(parseFloat(ch.marginSummary?.accountValue ?? "0"));
      }
      if (address && results[5]) {
        const orders = results[5] as { coin: string }[];
        setOpenOrderCount(Array.isArray(orders) ? orders.length : 0);
      }
      if (address && results[6]) {
        const fp = results[6] as FundingPayment[];
        setFundingPayments(Array.isArray(fp) ? fp : []);
      }
    } catch (err) {
      console.error("Failed to fetch quant data:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const fetchAiLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/quant/ai-logs?limit=50");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAiLogs(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchAiLogs();
    const interval = setInterval(() => { fetchData(); fetchAiLogs(); }, 10_000);
    return () => clearInterval(interval);
  }, [fetchData, fetchAiLogs]);

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
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    try {
      const res = await fetch("/api/quant/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, wallet_address: address, config: {} }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add strategy");
        return;
      }
      toast.success(`${STRATEGY_LABELS[type]?.name ?? type} strategy added`);
      setAddingStrategy(false);
      fetchData();
    } catch {
      toast.error("Network error — try again");
    }
  };

  const deleteStrategy = async (id: string) => {
    await fetch(`/api/quant/strategies?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const resetEngine = async () => {
    await fetch("/api/quant/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine_status: "paused",
        error_message: null,
        max_drawdown: 0,
        peak_equity: accountValue > 0 ? accountValue : 0,
      }),
    });
    fetchData();
  };

  const saveAiConfig = async (stratId: string) => {
    await fetch("/api/quant/strategies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stratId, config: { ...AI_AGENT_DEFAULTS, ...aiConfigDraft } }),
    });
    setAiConfigOpen(null);
    fetchData();
  };

  const totalFundingIncome = fundingPayments.reduce(
    (sum, fp) => sum + parseFloat(fp.delta.usdc ?? "0"), 0
  );
  const closedPnl = tradesSummary.netPnl;
  const unrealizedPnl = walletPositions.reduce(
    (sum, ap) => sum + parseFloat(ap.position.unrealizedPnl), 0
  );
  const totalPnl = closedPnl + unrealizedPnl + totalFundingIncome;
  const drawdown = engine?.max_drawdown ?? 0;
  const exposure = walletPositions.reduce(
    (sum, ap) => sum + Math.abs(parseFloat(ap.position.positionValue)), 0
  );
  const totalMarginUsed = walletPositions.reduce(
    (sum, ap) => sum + parseFloat(ap.position.marginUsed), 0
  );
  const utilizationPct = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0;

  const statusColor =
    engine?.engine_status === "running" ? "#34d399" :
    engine?.engine_status === "error" ? "#ef4444" :
    engine?.engine_status === "paused" ? "#eab308" : "#6b7280";

  return (
    <div className="space-y-5">
      {/* Engine Status Bar */}
      <div className="flex items-center justify-between border-b border-[#2a2e3e]/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {engine?.engine_status === "running" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }} />
            </span>
            <span className="text-xs font-medium text-[#9ca3af] uppercase tracking-widest">
              Quant Engine
            </span>
          </div>
          <span
            className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded"
            style={{
              color: statusColor,
              backgroundColor: statusColor + "15",
            }}
          >
            {engine?.engine_status?.toUpperCase() ?? "OFFLINE"}
          </span>
          {engine?.last_tick_at && (
            <span className="text-[10px] font-mono text-[#848e9c]">
              {relativeTime(engine.last_tick_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {engine?.engine_status === "error" && (
            <button
              onClick={resetEngine}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium text-red-400 hover:text-white hover:bg-red-500/20 transition-colors"
            >
              Reset Engine
            </button>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium text-[#848e9c] hover:text-white hover:bg-[#1a1d2e] transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="bg-[#141620] rounded-xl p-3">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <MetricCell
            label="Total P&L"
            value={formatPnl(totalPnl)}
            valueColor={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <MetricCell
            label="Funding Income"
            value={formatPnl(totalFundingIncome)}
            valueColor={totalFundingIncome >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <MetricCell
            label="Unrealized"
            value={formatPnl(unrealizedPnl)}
            valueColor={unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <MetricCell label="NAV" value={`$${accountValue.toFixed(2)}`} />
          <MetricCell label="Gross Exposure" value={`$${exposure.toFixed(0)}`} />
          <MetricCell
            label="Max Drawdown"
            value={`${(drawdown * 100).toFixed(2)}%`}
            valueColor={drawdown > 0.1 ? "text-red-400" : drawdown > 0.05 ? "text-yellow-400" : "text-white"}
          />
        </div>
      )}

      {/* Risk Warning */}
      {engine?.engine_status === "error" && engine?.error_message && (
        <div className="bg-red-950/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <div>
              <p className="text-red-400 text-xs font-medium">{engine.error_message}</p>
              {drawdown > 0 && <p className="text-red-500/60 text-[10px]">Stored drawdown: {(drawdown * 100).toFixed(1)}%</p>}
            </div>
          </div>
          <button
            onClick={resetEngine}
            className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-white transition-colors font-medium"
          >
            Reset
          </button>
        </div>
      )}

      {/* Rebate Farmer — Primary Active Strategy */}
      {rfStats && (
        <div className="bg-gradient-to-br from-cyan-950/30 to-[#141620] rounded-xl border border-cyan-500/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider text-cyan-400 bg-cyan-400/10 border border-cyan-400/20">
                RF
              </span>
              <div>
                <p className="text-[13px] font-medium text-white">Rebate Farmer v5</p>
                <p className="text-[10px] text-[#848e9c] font-mono">
                  {rfStats.config?.coinCount ?? 0} coins &middot; ${rfStats.config?.orderSize ?? 50}/trade &middot; {rfStats.config?.maxConcurrent ?? 3} concurrent &middot; stop-loss {rfStats.config?.stopLossBps ?? 8}bps
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${(rfStats.netPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(rfStats.netPnl ?? 0) >= 0 ? "+" : ""}${(rfStats.netPnl ?? 0).toFixed(4)}
                </p>
                <span className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full inline-block bg-emerald-400 animate-pulse" />
                  {(rfStats.status === "active" ? "ACTIVE" : "STOPPED")}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#0b0e11]/50">
            <MetricCell label="Win Rate" value={`${rfStats.winRate ?? 0}%`} valueColor={rfStats.winRate >= 60 ? "text-emerald-400" : "text-yellow-400"} compact />
            <MetricCell label="Trades" value={`${rfStats.sessionWins ?? 0}W / ${rfStats.sessionLosses ?? 0}L`} compact />
            <MetricCell label="Hourly Rate" value={`$${(rfStats.hourlyRate ?? 0).toFixed(2)}/hr`} valueColor={(rfStats.hourlyRate ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"} compact />
            <MetricCell label="Session Vol" value={`$${((rfStats.sessionVolume ?? 0) / 1000).toFixed(1)}K`} compact />
            <MetricCell label="Fee Tier" value={rfStats.feeTier ?? "Tier 0"} valueColor="text-cyan-400" compact />
            <MetricCell label="Maker Fee" value={`${rfStats.makerFeeBps ?? 1.5}bps`} compact />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#0b0e11]/50">
            <MetricCell label="Daily Proj" value={`$${(rfStats.dailyProjected ?? 0).toFixed(2)}`} valueColor={(rfStats.dailyProjected ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"} compact />
            <MetricCell label="Gross P&L" value={`$${(rfStats.grossPnl ?? 0).toFixed(4)}`} compact />
            <MetricCell label="Total Fees" value={`-$${(rfStats.fees ?? 0).toFixed(4)}`} valueColor="text-red-400" compact />
            <MetricCell label="All-time Vol" value={`$${((rfStats.allTimeVolume ?? 0) / 1000).toFixed(1)}K`} compact />
            <MetricCell label="Vol/hr" value={`$${((rfStats.volumeRate ?? 0) / 1000).toFixed(1)}K`} compact />
            <MetricCell label="Daily Vol Proj" value={`$${((rfStats.dailyVolumeProjected ?? 0) / 1000).toFixed(0)}K`} compact />
          </div>

          {rfStats.activeTrades && rfStats.activeTrades.length > 0 && (
            <div className="px-4 py-2 border-t border-cyan-500/10 bg-cyan-950/20 space-y-1">
              <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Active Trades ({rfStats.activeTrades.length}/{rfStats.config?.maxConcurrent ?? 3})</p>
              {rfStats.activeTrades.map((t: { coin: string; phase: string; side: string; entryPx: number; size: number }, i: number) => (
                <p key={i} className="text-[10px] text-cyan-400 font-mono">
                  {t.phase} {t.side?.toUpperCase()} {t.coin} @ ${t.entryPx} ({t.size?.toFixed(2)} units)
                </p>
              ))}
            </div>
          )}

          {rfStats.coins && Object.keys(rfStats.coins).length > 0 && (
            <div className="px-4 py-2 border-t border-[#2a2e3e]/30">
              <p className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-1.5">Top Coins</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(rfStats.coins as Record<string, { trades: number; wins: number; netPnl: number }>)
                  .sort(([, a], [, b]) => b.netPnl - a.netPnl)
                  .slice(0, 8)
                  .map(([coin, perf]) => (
                    <span key={coin} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1a1d2e] text-[#848e9c]">
                      {coin} <span className={perf.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{perf.netPnl >= 0 ? "+" : ""}${perf.netPnl.toFixed(3)}</span>
                      <span className="text-[#4a4e59] ml-0.5">{perf.wins}/{perf.trades}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legacy Strategies */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest">Other Strategies</span>
          <button
            onClick={() => setAddingStrategy(!addingStrategy)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium text-[#848e9c] hover:text-white hover:bg-[#1a1d2e] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {addingStrategy && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {Object.entries(STRATEGY_LABELS).map(([type, { name, tag, color }]) => {
              const isAi = type === "ai_agent";
              return (
                <button
                  key={type}
                  onClick={() => addStrategy(type)}
                  className={`px-3 py-2.5 rounded-xl transition-colors text-left ${
                    isAi
                      ? "bg-gradient-to-br from-cyan-950/40 to-[#141620] border border-cyan-500/20 hover:border-cyan-500/40"
                      : "bg-[#141620] hover:bg-[#1a1d2e]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isAi && <Brain className="h-3 w-3 text-cyan-400" />}
                    <span className="text-[9px] font-bold tracking-wider" style={{ color }}>{tag}</span>
                  </div>
                  <p className="text-[11px] text-white mt-0.5">{name}</p>
                  {isAi && <p className="text-[8px] text-cyan-400/50 mt-0.5">Gemini + GPT-4o</p>}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="p-4 bg-[#141620] rounded-xl">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="text-center text-[#848e9c] text-xs py-10 bg-[#141620] rounded-xl">
            No strategies configured
          </div>
        ) : (
          <div className="space-y-2">
            {strategies.map((strat) => {
              const meta = STRATEGY_LABELS[strat.type] ?? { name: strat.type, tag: "?", color: "#6b7280" };
              const isFundingRate = strat.type === "funding_rate";
              const stratFundingPnl = isFundingRate ? totalFundingIncome : 0;
              const effectivePnl = strat.total_pnl + stratFundingPnl;
              const stratPositions = walletPositions.filter(ap => {
                const coin = ap.position.coin;
                return quantTrades.some(qt => qt.coin === coin && qt.status === "open" && qt.strategy_type === strat.type);
              });
              const stratUnrealized = stratPositions.reduce(
                (sum, ap) => sum + parseFloat(ap.position.unrealizedPnl), 0
              );
              const netPnl = effectivePnl + stratUnrealized;

              return (
                <div
                  key={strat.id}
                  className="bg-[#141620] rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                        style={{ color: meta.color, backgroundColor: meta.color + "15", border: `1px solid ${meta.color}30` }}
                      >
                        {meta.tag}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          {strat.type === "ai_agent" && <Brain className="h-3.5 w-3.5 text-cyan-400" />}
                          <p className="text-[13px] font-medium text-white">{meta.name}</p>
                        </div>
                        <p className="text-[10px] text-[#848e9c] font-mono">
                          {strat.total_trades} executions &middot; last {relativeTime(strat.last_executed_at)}
                          {strat.type === "ai_agent" && (
                            <span className="text-cyan-400/50 ml-2">
                              {((strat.config as Partial<AiAgentConfig> | null)?.analystModel ?? "gemini-2.0-flash")} + {((strat.config as Partial<AiAgentConfig> | null)?.traderModel ?? "gpt-4o")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-semibold tabular-nums ${netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatPnl(netPnl)}
                        </p>
                        <div className="flex items-center gap-1.5 justify-end">
                          {isFundingRate && stratFundingPnl !== 0 && (
                            <span className="text-[9px] text-[#848e9c]">
                              fund: {formatPnl(stratFundingPnl)}
                            </span>
                          )}
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-medium"
                            style={{ color: strat.status === "active" ? "#34d399" : strat.status === "paused" ? "#eab308" : "#6b7280" }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{
                              backgroundColor: strat.status === "active" ? "#34d399" : strat.status === "paused" ? "#eab308" : "#6b7280"
                            }} />
                            {strat.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 border-l border-[#2a2e3e]/30 pl-3 ml-1">
                        <button
                          onClick={() => toggleStrategy(strat.id, strat.status)}
                          className="p-1.5 rounded hover:bg-[#1a1d2e] transition-colors"
                          title={strat.status === "active" ? "Pause" : "Resume"}
                        >
                          {strat.status === "active" ? (
                            <Pause className="h-3.5 w-3.5 text-[#848e9c] hover:text-yellow-400" />
                          ) : (
                            <Play className="h-3.5 w-3.5 text-[#848e9c] hover:text-emerald-400" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteStrategy(strat.id)}
                          className="p-1.5 rounded hover:bg-[#1a1d2e] transition-colors"
                          title="Remove"
                        >
                          <Square className="h-3.5 w-3.5 text-[#848e9c] hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isFundingRate && stratPositions.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2 border-t border-[#2a2e3e]/30 px-4 pb-3">
                      <MetricCell
                        label="Funding Income"
                        value={formatPnl(stratFundingPnl)}
                        valueColor={stratFundingPnl >= 0 ? "text-emerald-400" : "text-red-400"}
                        compact
                      />
                      <MetricCell
                        label="Unrealized"
                        value={formatPnl(stratUnrealized)}
                        valueColor={stratUnrealized >= 0 ? "text-emerald-400" : "text-red-400"}
                        compact
                      />
                      <MetricCell
                        label="Positions"
                        value={stratPositions.length.toString()}
                        compact
                      />
                      <MetricCell
                        label="Realized"
                        value={formatPnl(strat.total_pnl)}
                        valueColor={strat.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}
                        compact
                      />
                      <MetricCell
                        label="Net P&L"
                        value={formatPnl(netPnl)}
                        valueColor={netPnl >= 0 ? "text-emerald-400" : "text-red-400"}
                        compact
                      />
                    </div>
                  )}

                  {strat.type === "ai_agent" && (
                    <AiAgentPanel
                      strat={strat}
                      isOpen={aiConfigOpen === strat.id}
                      onToggle={() => setAiConfigOpen(aiConfigOpen === strat.id ? null : strat.id)}
                      configDraft={aiConfigDraft}
                      onConfigChange={setAiConfigDraft}
                      onSave={() => saveAiConfig(strat.id)}
                    />
                  )}

                  {strat.error_message && (
                    <div className="px-4 py-2 border-t border-red-900/30 bg-red-950/20">
                      <p className="text-[10px] text-red-400">{strat.error_message}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Positions */}
      {walletPositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest">
              Open Positions ({walletPositions.length})
            </span>
            <div className="flex items-center gap-4 text-[10px] text-[#848e9c]">
              {openOrderCount > 0 && <span>{openOrderCount} order{openOrderCount !== 1 ? "s" : ""}</span>}
              {accountValue > 0 && <span>NAV <span className="text-[#9ca3af]">${accountValue.toFixed(2)}</span></span>}
              {totalMarginUsed > 0 && <span>Margin <span className="text-[#9ca3af]">${totalMarginUsed.toFixed(2)}</span> ({utilizationPct.toFixed(1)}%)</span>}
            </div>
          </div>

          {/* Position table header */}
          <div className="bg-[#141620] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[80px_40px_1fr_repeat(5,minmax(0,1fr))_80px] px-4 py-2 text-[9px] font-medium text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/30">
              <span>Side</span>
              <span>Lev</span>
              <span>Instrument</span>
              <span className="text-right">Entry</span>
              <span className="text-right">Mark</span>
              <span className="text-right">Size</span>
              <span className="text-right">Fund/8h</span>
              <span className="text-right">Unrealized</span>
              <span className="text-right">ROE</span>
            </div>

            {walletPositions.map((ap) => {
              const pos = ap.position;
              const sz = parseFloat(pos.szi);
              const isLong = sz > 0;
              const absSz = Math.abs(sz);
              const entryPx = parseFloat(pos.entryPx ?? "0");
              const uPnl = parseFloat(pos.unrealizedPnl);
              const roe = parseFloat(pos.returnOnEquity) * 100;
              const lev = pos.leverage.value;
              const coin = pos.coin;
              const displayCoin = coin.includes(":") ? coin.split(":")[1] : coin;
              const market = markets.find((m) => m.name === coin);
              const markPx = market ? parseFloat(market.markPx) : 0;
              const fundingRate = market ? parseFloat(market.funding) : 0;
              const fundingPct = (fundingRate * 100).toFixed(4);

              const quantMatch = quantTrades.find(
                (qt) => qt.coin === coin && qt.status === "open"
              );
              const isAuto = !!quantMatch;
              const autoMeta = isAuto
                ? STRATEGY_LABELS[quantMatch!.strategy_type] ?? { name: quantMatch!.strategy_type, tag: "?", color: "#6b7280" }
                : null;

              return (
                <Link key={coin} href={`/trade/${displayCoin}`} className="block">
                  <div className="grid grid-cols-[80px_40px_1fr_repeat(5,minmax(0,1fr))_80px] items-center px-4 py-2.5 text-xs hover:bg-[#1a1d2e]/50 transition-colors">
                    <span className={`font-semibold text-[10px] ${isLong ? "text-emerald-400" : "text-red-400"}`}>
                      {isLong ? "LONG" : "SHORT"}
                    </span>
                    <span className="text-[10px] text-[#848e9c]">{lev}x</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">{displayCoin}</span>
                      {isAuto && autoMeta && (
                        <span
                          className="text-[8px] font-bold px-1 py-px rounded"
                          style={{ color: autoMeta.color, backgroundColor: autoMeta.color + "15" }}
                        >
                          {autoMeta.tag}
                        </span>
                      )}
                    </div>
                    <span className="text-right text-[#9ca3af] tabular-nums">${entryPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    <span className="text-right text-white tabular-nums">{markPx > 0 ? `$${markPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "--"}</span>
                    <span className="text-right text-[#9ca3af] tabular-nums">{absSz.toFixed(4)}</span>
                    <span className={`text-right tabular-nums ${fundingRate >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                      {fundingRate >= 0 ? "+" : ""}{fundingPct}%
                    </span>
                    <span className={`text-right font-semibold tabular-nums ${uPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {uPnl >= 0 ? "+" : ""}${uPnl.toFixed(2)}
                    </span>
                    <span className={`text-right text-[10px] tabular-nums ${roe >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
                      {roe >= 0 ? "+" : ""}{roe.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!loading && walletPositions.length === 0 && address && (
        <div className="text-center text-[#848e9c] text-xs py-10 bg-[#141620] rounded-xl font-mono">
          No open positions
        </div>
      )}

      {/* Trade Log */}
      <div className="space-y-3">
        <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest">
          Execution Log ({trades.length})
        </span>

        {trades.length === 0 ? (
          <p className="text-[#848e9c] text-xs py-6 text-center font-mono">No executions recorded</p>
        ) : (
          <div className="bg-[#141620] rounded-xl overflow-hidden">
            <div className="grid grid-cols-8 px-4 py-2 text-[9px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/30 font-medium">
              <span>Time</span>
              <span>Instrument</span>
              <span>Side</span>
              <span>Strategy</span>
              <span className="text-right">Entry</span>
              <span className="text-right">Exit</span>
              <span className="text-right">P&L</span>
              <span className="text-right">Status</span>
            </div>
            {trades.slice(0, 30).map((trade) => {
              const meta = STRATEGY_LABELS[trade.strategy_type] ?? { name: trade.strategy_type, tag: "?", color: "#6b7280" };
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
                <div key={trade.id} className="grid grid-cols-8 items-center px-4 py-2 text-xs border-b border-[#2a2e3e]/30 hover:bg-[#1a1d2e]/50 transition-colors group">
                  <span className="text-[10px] text-[#848e9c]">
                    {trade.opened_at
                      ? new Date(trade.opened_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "--"}
                  </span>
                  <div>
                    <span className="text-white font-medium">{trade.coin}</span>
                    {reason && (
                      <p className="text-[9px] text-[#555a66] truncate max-w-[140px] hidden group-hover:block font-mono">{reason}</p>
                    )}
                  </div>
                  <span className={`font-medium text-[10px] ${trade.side === "long" ? "text-emerald-400" : "text-red-400"}`}>
                    {trade.side === "long" ? "LONG" : "SHORT"}
                  </span>
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: meta.color }}
                  >
                    {meta.tag}
                  </span>
                  <span className="text-right text-[#9ca3af] tabular-nums">${entryPx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                  <span className="text-right tabular-nums text-[#9ca3af]">
                    {trade.exit_px ? `$${Number(trade.exit_px).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : isOpen && markPx > 0 ? (
                      <span className="text-[#848e9c]">${markPx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                    ) : "--"}
                  </span>
                  <span className={`text-right font-medium tabular-nums ${(pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {pnl != null ? formatPnl(pnl) : "--"}
                  </span>
                  <span className="text-right">
                    <span className={`text-[9px] font-medium ${
                      trade.status === "open" ? "text-blue-400"
                        : trade.status === "closed" ? "text-emerald-400/70"
                        : "text-[#848e9c]"
                    }`}>
                      {trade.status.toUpperCase()}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Agent Logs */}
      {strategies.some((s) => s.type === "ai_agent") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-cyan-400" />
              AI Agent Logs ({aiLogs.length})
            </span>
            <button
              onClick={fetchAiLogs}
              className="text-[9px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="bg-[#141620] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
            {aiLogs.length === 0 ? (
              <div className="text-center text-[#555a66] text-[10px] py-6">
                No AI logs yet — activate the AI Agent strategy to see activity
              </div>
            ) : (
              <div className="divide-y divide-[#2a2e3e]/20">
                {aiLogs.map((log) => {
                  const time = new Date(log.created_at).toLocaleString([], {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
                  });
                  const eventColors: Record<string, string> = {
                    trade_decision: "text-emerald-400",
                    analysis: "text-cyan-400",
                    cycle: "text-[#555a66]",
                    error: "text-red-400",
                  };
                  const eventLabels: Record<string, string> = {
                    trade_decision: "TRADE",
                    analysis: "SCAN",
                    cycle: "IDLE",
                    error: "ERR",
                  };
                  return (
                    <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                      <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
                        <span className={`text-[9px] font-bold tracking-wider ${eventColors[log.event_type] ?? "text-[#555a66]"}`}>
                          {eventLabels[log.event_type] ?? log.event_type.toUpperCase()}
                        </span>
                        <span className="text-[8px] text-[#4a4e59]">{time}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {log.market_sentiment && (
                          <span className="text-[10px] text-[#848e9c]">
                            Sentiment: <span className={log.market_sentiment === "bullish" ? "text-emerald-400" : log.market_sentiment === "bearish" ? "text-red-400" : "text-yellow-400"}>{log.market_sentiment}</span>
                          </span>
                        )}
                        {log.opportunities && log.opportunities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {log.opportunities.slice(0, 5).map((opp, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1d2e] text-[#9ca3af]">
                                {opp.coin} <span className={opp.direction === "long" ? "text-emerald-400" : "text-red-400"}>{opp.direction}</span> {opp.strength}%
                              </span>
                            ))}
                          </div>
                        )}
                        {log.decision?.actions && log.decision.actions.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {log.decision.actions.map((act, i) => (
                              <div key={i} className="text-[10px]">
                                <span className={act.side === "long" ? "text-emerald-400" : "text-red-400"}>
                                  {act.action.toUpperCase()}
                                </span>{" "}
                                <span className="text-white">{act.coin}</span>{" "}
                                <span className="text-[#848e9c]">${act.sizeUsd?.toFixed(0)}</span>{" "}
                                <span className="text-[#555a66]">({(act.confidence * 100).toFixed(0)}%)</span>
                                {act.reasoning && <span className="text-[#4a4e59] ml-1">— {act.reasoning}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {log.signals_generated > 0 && (
                          <span className="text-[9px] text-emerald-400/60 mt-0.5 block">{log.signals_generated} signal(s) sent to engine</span>
                        )}
                        {log.error_message && (
                          <span className="text-[9px] text-red-400/80 mt-0.5 block">{log.error_message}</span>
                        )}
                      </div>
                      <div className="text-[8px] text-[#4a4e59] text-right min-w-[60px]">
                        {log.analyst_model && <div>{log.analyst_model}</div>}
                        {log.trader_model && log.event_type === "trade_decision" && <div>{log.trader_model}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {engine && (
        <div className="text-[10px] text-[#555a66] flex items-center gap-4 border-t border-[#2a2e3e]/30 pt-3">
          <span>Peak: ${engine.peak_equity?.toFixed(2) ?? "0.00"}</span>
          <span>Tick: {relativeTime(engine.last_tick_at)}</span>
          <span>Funding payments: {fundingPayments.length}</span>
          {engine.error_message && (
            <span className="text-red-500">ERR: {engine.error_message}</span>
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
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-[#2a2e3e]/30 pb-4">
        <div className="flex items-center gap-3">
          <Monitor className="h-4 w-4 text-[#848e9c]" />
          <span className="text-xs font-medium text-[#9ca3af] uppercase tracking-widest">Browser Engine</span>
          <button
            onClick={toggleEngine}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-all border ${
              engineRunning
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-[#141620] text-[#848e9c] hover:text-white border-transparent"
            }`}
          >
            {engineRunning ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            {engineRunning ? "ACTIVE" : "OFF"}
          </button>
        </div>
        <Link
          href="/automate/create"
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium text-[#848e9c] hover:text-white hover:bg-[#1a1d2e] transition-colors"
        >
          <Plus className="h-3 w-3" />
          New Strategy
        </Link>
      </div>

      <div className="bg-yellow-950/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
        <Monitor className="h-3.5 w-3.5 text-yellow-500/70 shrink-0" />
        <p className="text-[10px] text-yellow-500/60">
          Browser strategies only run while this tab is open. Use <span className="text-yellow-400/80">Server Strategies</span> for 24/7 execution.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCell label="Strategies" value={strategies.length.toString()} />
        <MetricCell label="Active" value={activeCount.toString()} valueColor={activeCount > 0 ? "text-emerald-400" : "text-white"} />
        <MetricCell label="Executions" value={totalTrades.toString()} />
        <MetricCell label="Engine" value={engineRunning ? "Running" : "Stopped"} valueColor={engineRunning ? "text-emerald-400" : "text-[#848e9c]"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest block mb-3">Strategies</span>
          {loading ? (
            <div className="text-center py-12 text-[#848e9c] text-xs font-mono">Loading...</div>
          ) : strategies.length === 0 ? (
            <div className="text-center py-12 bg-[#141620] rounded-xl">
              <p className="text-xs text-[#848e9c] mb-3 font-mono">No browser strategies configured</p>
              <Link href="/automate/create" className="text-xs text-brand hover:underline">Create strategy</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {strategies.map((s) => <StrategyCard key={s.id} strategy={s} />)}
            </div>
          )}
        </div>

        <div>
          <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest block mb-3">Activity Log</span>
          <div className="bg-[#141620] rounded-xl p-3">
            <ActivityLog />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── QUANT LAB (Backtesting + Performance Analytics) ─── */

interface BacktestRun {
  id: string;
  strategy_type: string;
  config: Record<string, unknown>;
  start_time: number;
  end_time: number;
  coins: string[];
  interval: string;
  total_trades: number;
  winning_trades: number;
  total_pnl: number;
  max_drawdown: number;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  avg_trade_pnl: number | null;
  equity_curve: number[];
  created_at: string;
}

interface DataStatus {
  coin: string;
  total_candles: number;
}

function QuantLab() {
  const [backtests, setBacktests] = useState<BacktestRun[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus[]>([]);
  const [totalCandles, setTotalCandles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBacktest, setSelectedBacktest] = useState<BacktestRun | null>(null);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [btStrategy, setBtStrategy] = useState("momentum");
  const [btDays, setBtDays] = useState(7);

  const fetchLabData = useCallback(async () => {
    try {
      const [btRes, candleRes] = await Promise.all([
        fetch("/api/quant/backtest?limit=30"),
        fetch("/api/quant/candles"),
      ]);
      const btData = await btRes.json();
      const candleData = await candleRes.json();
      setBacktests(btData.runs ?? []);
      setDataStatus(candleData.coins ?? []);
      setTotalCandles(candleData.totalCandles ?? 0);
    } catch (err) {
      console.error("Lab fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabData();
  }, [fetchLabData]);

  const runBacktest = async () => {
    setRunningBacktest(true);
    try {
      const res = await fetch("/api/quant/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_type: btStrategy, days: btDays }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert("Backtest queued. Run via CLI:\nnpx tsx scripts/backtest.ts run " + btStrategy);
      }
    } finally {
      setRunningBacktest(false);
    }
  };

  const bestBacktest = backtests.length > 0
    ? backtests.reduce((best, bt) => (bt.sharpe_ratio ?? 0) > (best.sharpe_ratio ?? 0) ? bt : best)
    : null;

  const avgSharpe = backtests.length > 0
    ? backtests.reduce((s, bt) => s + (bt.sharpe_ratio ?? 0), 0) / backtests.length
    : 0;

  const totalBacktestTrades = backtests.reduce((s, bt) => s + bt.total_trades, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#2a2e3e]/30 pb-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-4 w-4 text-[#848e9c]" />
          <span className="text-xs font-medium text-[#9ca3af] uppercase tracking-widest">Quant Lab</span>
          <span className="text-[10px] text-[#555a66]">Backtesting + Analytics</span>
        </div>
        <button
          onClick={fetchLabData}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium text-[#848e9c] hover:text-white hover:bg-[#1a1d2e] transition-colors border border-[#2a2e3e]"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricCell label="Candles Stored" value={totalCandles.toLocaleString()} />
        <MetricCell label="Instruments" value={dataStatus.length.toString()} />
        <MetricCell label="Backtests" value={backtests.length.toString()} />
        <MetricCell
          label="Avg Sharpe"
          value={avgSharpe.toFixed(2)}
          valueColor={avgSharpe > 1 ? "text-emerald-400" : avgSharpe > 0 ? "text-yellow-400" : "text-red-400"}
        />
      </div>

      <div className="p-4 rounded-xl bg-[#141620] border border-[#2a2e3e] space-y-4">
        <h3 className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest flex items-center gap-2">
          <Play className="h-3.5 w-3.5" />
          Run Backtest
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium block mb-1">Strategy</label>
            <select
              value={btStrategy}
              onChange={(e) => setBtStrategy(e.target.value)}
              className="bg-[#141620] border border-[#2a2e3e] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
            >
              <option value="momentum">Momentum Scalper</option>
              <option value="grid">Grid Trading</option>
              <option value="mean_reversion">Mean Reversion</option>
              <option value="funding_rate">Funding Rate</option>
              <option value="market_maker">Market Making</option>
              <option value="ai_agent">AI Agent</option>
              <option value="all">All Strategies</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium block mb-1">Lookback</label>
            <select
              value={btDays}
              onChange={(e) => setBtDays(Number(e.target.value))}
              className="bg-[#141620] border border-[#2a2e3e] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          <button
            onClick={runBacktest}
            disabled={runningBacktest || totalCandles < 10}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-brand text-white hover:bg-brand/80 transition-colors disabled:opacity-40"
          >
            {runningBacktest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {runningBacktest ? "Running..." : "Execute"}
          </button>
        </div>
        {totalCandles < 10 && (
          <p className="text-[10px] text-yellow-500/70">
            No candle data. Run: <code className="bg-[#1a1d2e] px-1 rounded text-yellow-400/80">npx tsx scripts/backtest.ts backfill</code>
          </p>
        )}
      </div>

      {dataStatus.length > 0 && (
        <div className="space-y-3">
          <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest flex items-center gap-2">
            <Database className="h-3.5 w-3.5" />
            Data Coverage
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
            {dataStatus.slice(0, 24).map((d) => (
              <div key={d.coin} className="bg-[#141620] border border-[#2a2e3e] rounded px-2.5 py-2 text-center">
                <p className="text-[10px] font-medium text-white">{d.coin}</p>
                <p className="text-[9px] text-[#555a66]">{d.total_candles.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <span className="text-[10px] font-medium text-[#848e9c] uppercase tracking-widest flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Backtest Results ({backtests.length})
        </span>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4 rounded-xl bg-[#141620] border border-[#2a2e3e]">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : backtests.length === 0 ? (
          <div className="text-center text-[#848e9c] text-xs py-10 bg-[#141620] rounded-xl font-mono">
            No backtests recorded. Run one above or via CLI.
          </div>
        ) : (
          <div className="space-y-2">
            {backtests.map((bt) => {
              const meta = STRATEGY_LABELS[bt.strategy_type] ?? { name: bt.strategy_type, tag: "?", color: "#6b7280" };
              const isSelected = selectedBacktest?.id === bt.id;
              const profitable = bt.total_pnl > 0;
              const sharpe = bt.sharpe_ratio ?? 0;

              return (
                <div key={bt.id}>
                  <button
                    onClick={() => setSelectedBacktest(isSelected ? null : bt)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-brand/40 bg-brand/5"
                        : "border-[#2a2e3e] bg-[#141620]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                          style={{ color: meta.color, backgroundColor: meta.color + "15" }}
                        >
                          {meta.tag}
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-white">{meta.name}</p>
                          <p className="text-[10px] text-[#848e9c] font-mono">
                            {bt.coins.slice(0, 5).join(", ")}{bt.coins.length > 5 ? ` +${bt.coins.length - 5}` : ""} |{" "}
                            {new Date(bt.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className={`text-sm font-semibold tabular-nums ${profitable ? "text-emerald-400" : "text-red-400"}`}>
                            {profitable ? "+" : ""}${bt.total_pnl.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-[#848e9c]">{bt.total_trades} trades</p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          sharpe > 1 ? "bg-emerald-500/10 border-emerald-500/20" : sharpe > 0 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20"
                        }`}>
                          <span className={`text-xs font-bold ${
                            sharpe > 1 ? "text-emerald-400" : sharpe > 0 ? "text-yellow-400" : "text-red-400"
                          }`}>
                            {sharpe.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-[#2a2e3e]/30">
                      <BacktestMetric label="Win Rate" value={bt.win_rate != null ? `${(bt.win_rate * 100).toFixed(1)}%` : "--"} good={bt.win_rate != null && bt.win_rate > 0.5} />
                      <BacktestMetric label="Max DD" value={`${(bt.max_drawdown * 100).toFixed(1)}%`} good={bt.max_drawdown < 0.1} />
                      <BacktestMetric label="Sharpe" value={sharpe.toFixed(2)} good={sharpe > 1} />
                      <BacktestMetric label="Avg P&L" value={bt.avg_trade_pnl != null ? `$${bt.avg_trade_pnl.toFixed(2)}` : "--"} good={bt.avg_trade_pnl != null && bt.avg_trade_pnl > 0} />
                    </div>
                  </button>

                  {isSelected && (
                    <div className="ml-4 mr-4 -mt-1 p-4 rounded-b-lg border border-t-0 border-brand/20 bg-[#090b10] space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <DetailMetric label="Total P&L" value={`$${bt.total_pnl.toFixed(2)}`} />
                        <DetailMetric label="Winning" value={`${bt.winning_trades}/${bt.total_trades}`} />
                        <DetailMetric label="Profit Factor" value={bt.profit_factor?.toFixed(2) ?? "--"} />
                        <DetailMetric label="Sortino" value={bt.sortino_ratio?.toFixed(2) ?? "--"} />
                        <DetailMetric label="Period" value={`${Math.round((bt.end_time - bt.start_time) / 86400_000)}d`} />
                        <DetailMetric label="Interval" value={bt.interval} />
                        <DetailMetric label="Coins" value={bt.coins.length.toString()} />
                        <DetailMetric label="Max Drawdown" value={`${(bt.max_drawdown * 100).toFixed(2)}%`} />
                      </div>

                      {bt.equity_curve && bt.equity_curve.length > 1 && (
                        <div>
                          <p className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium mb-2">Equity Curve</p>
                          <MiniEquityCurve data={bt.equity_curve} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {bestBacktest && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">Best Performing Strategy</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-[13px] font-medium">
                {STRATEGY_LABELS[bestBacktest.strategy_type]?.name ?? bestBacktest.strategy_type}
              </p>
              <p className="text-[10px] text-emerald-400/60">
                Sharpe {(bestBacktest.sharpe_ratio ?? 0).toFixed(2)} | WR {((bestBacktest.win_rate ?? 0) * 100).toFixed(1)}% | {bestBacktest.total_trades} trades
              </p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${bestBacktest.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {bestBacktest.total_pnl >= 0 ? "+" : ""}${bestBacktest.total_pnl.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BacktestMetric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div>
      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${good ? "text-emerald-400" : "text-[#848e9c]"}`}>{value}</p>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2">
      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-xs font-medium text-white tabular-nums">{value}</p>
    </div>
  );
}

function MiniEquityCurve({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 60;
  const width = 100;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const startVal = data[0];
  const endVal = data[data.length - 1];
  const color = endVal >= startVal ? "#10b981" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`eq-grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#eq-grad-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ─── AI Agent Panel ─── */

function AiAgentPanel({
  strat,
  isOpen,
  onToggle,
  configDraft,
  onConfigChange,
  onSave,
}: {
  strat: QuantStrategy;
  isOpen: boolean;
  onToggle: () => void;
  configDraft: Partial<AiAgentConfig>;
  onConfigChange: (c: Partial<AiAgentConfig>) => void;
  onSave: () => void;
}) {
  const cfg = { ...AI_AGENT_DEFAULTS, ...((strat.config ?? {}) as Partial<AiAgentConfig>), ...configDraft };
  const marketOptions: { key: AiAgentConfig["allowedMarkets"][number]; label: string }[] = [
    { key: "perps", label: "Perpetuals" },
    { key: "spot", label: "Spot" },
    { key: "stocks", label: "Stocks" },
    { key: "commodities", label: "Commodities" },
  ];

  return (
    <div className="border-t border-[#2a2e3e]/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#1a1d2e]/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">AI Configuration</span>
        </div>
        {isOpen ? <ChevronUp className="h-3 w-3 text-[#848e9c]" /> : <ChevronDown className="h-3 w-3 text-[#848e9c]" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* Market Selection */}
          <div>
            <label className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium block mb-1.5">Markets</label>
            <div className="flex flex-wrap gap-1.5">
              {marketOptions.map((opt) => {
                const active = cfg.allowedMarkets.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      const markets = active
                        ? cfg.allowedMarkets.filter((m) => m !== opt.key)
                        : [...cfg.allowedMarkets, opt.key];
                      onConfigChange({ ...configDraft, allowedMarkets: markets as AiAgentConfig["allowedMarkets"] });
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors border ${
                      active
                        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                        : "bg-[#141620] text-[#848e9c] border-[#2a2e3e] hover:border-[#4a4e59]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SliderInput
              label="Capital Allocation"
              value={cfg.capitalAllocationPct}
              min={0.05} max={1} step={0.05}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => onConfigChange({ ...configDraft, capitalAllocationPct: v })}
            />
            <SliderInput
              label="Confidence Threshold"
              value={cfg.confidenceThreshold}
              min={0.3} max={0.95} step={0.05}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => onConfigChange({ ...configDraft, confidenceThreshold: v })}
            />
            <SliderInput
              label="Max Trades/Hour"
              value={cfg.maxTradesPerHour}
              min={1} max={30} step={1}
              format={(v) => v.toString()}
              onChange={(v) => onConfigChange({ ...configDraft, maxTradesPerHour: v })}
            />
            <SliderInput
              label="Max Positions"
              value={cfg.maxPositions}
              min={1} max={20} step={1}
              format={(v) => v.toString()}
              onChange={(v) => onConfigChange({ ...configDraft, maxPositions: v })}
            />
            <SliderInput
              label="Default Leverage"
              value={cfg.defaultLeverage}
              min={1} max={20} step={1}
              format={(v) => `${v}x`}
              onChange={(v) => onConfigChange({ ...configDraft, defaultLeverage: v })}
            />
            <SliderInput
              label="Stop Loss %"
              value={cfg.stopLossPct}
              min={0.01} max={0.15} step={0.01}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => onConfigChange({ ...configDraft, stopLossPct: v })}
            />
            <SliderInput
              label="Take Profit %"
              value={cfg.takeProfitPct}
              min={0.02} max={0.50} step={0.01}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => onConfigChange({ ...configDraft, takeProfitPct: v })}
            />
          </div>

          {/* Models */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium block mb-1">Analyst Model</label>
              <select
                value={cfg.analystModel}
                onChange={(e) => onConfigChange({ ...configDraft, analystModel: e.target.value })}
                className="w-full bg-[#0b0e11] border border-[#2a2e3e] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium block mb-1">Trader Model</label>
              <select
                value={cfg.traderModel}
                onChange={(e) => onConfigChange({ ...configDraft, traderModel: e.target.value })}
                className="w-full bg-[#0b0e11] border border-[#2a2e3e] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          </div>

          {/* Cost estimate */}
          <div className="bg-[#0b0e11] rounded-lg px-3 py-2 border border-[#2a2e3e]/50">
            <p className="text-[9px] text-[#555a66] uppercase tracking-wider font-medium mb-1">Estimated Daily Cost</p>
            <p className="text-xs text-[#848e9c]">
              Analyst: ~$2.88/day (2,880 calls) &middot; Trader: ~$0.50-1.00/day &middot;{" "}
              <span className="text-cyan-400 font-medium">Total: ~$3-4/day</span>
            </p>
          </div>

          <button
            onClick={onSave}
            className="w-full py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
          >
            Save Configuration
          </button>
        </div>
      )}
    </div>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[9px] text-[#848e9c] uppercase tracking-wider font-medium">{label}</label>
        <span className="text-[10px] text-white font-medium tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer bg-[#2a2e3e] accent-cyan-400"
      />
    </div>
  );
}

/* ─── Shared Components ─── */

function MetricCell({
  label,
  value,
  valueColor,
  compact,
}: {
  label: string;
  value: string;
  valueColor?: string;
  compact?: boolean;
}) {
  return (
    <div className={`bg-[#141620] rounded-xl ${compact ? "px-3 py-2" : "px-3 py-2.5"}`}>
      <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`font-bold tabular-nums ${compact ? "text-[11px]" : "text-sm"} ${valueColor ?? "text-white"}`}>{value}</p>
    </div>
  );
}

