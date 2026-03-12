"use client";

import { useEffect, useState, useCallback } from "react";
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
  FlaskConical,
  Database,
  LineChart,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { useAutomationStore } from "@/lib/automation/store";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { StrategyCard } from "@/components/automate/StrategyCard";
import { ActivityLog } from "@/components/automate/ActivityLog";
import type { QuantStrategy, QuantState, QuantTrade } from "@/lib/quant/types";
import type { MarketInfo, AssetPosition } from "@/lib/hyperliquid/types";
import { fetchAllMarkets, fetchCombinedClearinghouseState, fetchOpenOrders } from "@/lib/hyperliquid/api";

type Tab = "server" | "browser" | "lab";

const STRATEGY_LABELS: Record<string, { name: string; emoji: string; color: string }> = {
  funding_rate: { name: "Funding Rate Harvester", emoji: "🌾", color: "#10b981" },
  momentum: { name: "Momentum Scalper", emoji: "⚡", color: "#8b5cf6" },
  grid: { name: "Grid Bot", emoji: "📊", color: "#3b82f6" },
  mean_reversion: { name: "Mean Reversion", emoji: "🔄", color: "#f59e0b" },
  market_maker: { name: "Market Maker", emoji: "🏪", color: "#ec4899" },
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
              <Bot className="h-4 w-4 text-brand" />
              Automation
            </h1>
            <div className="flex items-center bg-[#141620] rounded-lg p-0.5">
              <button
                onClick={() => setTab("server")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === "server"
                    ? "bg-brand/20 text-brand"
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
                    ? "bg-brand/20 text-brand"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Monitor className="h-3 w-3" />
                Browser Bots
              </button>
              <button
                onClick={() => setTab("lab")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === "lab"
                    ? "bg-brand/20 text-brand"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                <FlaskConical className="h-3 w-3" />
                Quant Lab
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
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [walletPositions, setWalletPositions] = useState<AssetPosition[]>([]);
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [accountValue, setAccountValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingStrategy, setAddingStrategy] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const fetches: Promise<unknown>[] = [
        fetch("/api/quant/status"),
        fetch("/api/quant/trades?limit=50"),
        fetchAllMarkets().catch(() => [] as MarketInfo[]),
      ];
      if (address) {
        fetches.push(
          fetchCombinedClearinghouseState(address).catch(() => null),
          fetchOpenOrders(address).catch(() => []),
        );
      }

      const results = await Promise.all(fetches);
      const statusData = await (results[0] as Response).json();
      const tradesData = await (results[1] as Response).json();
      const marketsData = results[2] as MarketInfo[];

      setEngine(statusData.engine);
      setStrategies(statusData.strategies ?? []);
      setQuantTrades(statusData.openTrades ?? []);
      setTrades(tradesData.trades ?? []);
      setMarkets(marketsData);

      if (address && results[3]) {
        const ch = results[3] as { assetPositions: AssetPosition[]; marginSummary: { accountValue: string } };
        const positions = ch.assetPositions?.filter(
          (ap) => parseFloat(ap.position.szi) !== 0
        ) ?? [];
        setWalletPositions(positions);
        setAccountValue(parseFloat(ch.marginSummary?.accountValue ?? "0"));
      }
      if (address && results[4]) {
        const orders = results[4] as { coin: string }[];
        setOpenOrderCount(Array.isArray(orders) ? orders.length : 0);
      }
    } catch (err) {
      console.error("Failed to fetch quant data:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

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
  const unrealizedPnl = walletPositions.reduce(
    (sum, ap) => sum + parseFloat(ap.position.unrealizedPnl), 0
  );
  const totalPnl = realizedPnl + unrealizedPnl;
  const dailyPnl = (engine?.daily_pnl ?? 0) + unrealizedPnl;
  const drawdown = engine?.max_drawdown ?? 0;
  const exposure = walletPositions.reduce(
    (sum, ap) => sum + Math.abs(parseFloat(ap.position.positionValue)), 0
  );
  const totalMarginUsed = walletPositions.reduce(
    (sum, ap) => sum + parseFloat(ap.position.marginUsed), 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-brand" />
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Unrealized P&L"
            value={formatPnl(unrealizedPnl)}
            icon={unrealizedPnl >= 0 ? TrendingUp : TrendingDown}
            color={unrealizedPnl >= 0 ? "#10b981" : "#ef4444"}
          />
          <StatCard
            label="Account Value"
            value={`$${accountValue.toFixed(2)}`}
            icon={DollarSign}
            color="#3b82f6"
          />
          <StatCard
            label="Positions"
            value={walletPositions.length.toString()}
            icon={Activity}
            color="#8b5cf6"
          />
          <StatCard
            label="Exposure"
            value={`$${exposure.toFixed(0)}`}
            icon={BarChart3}
            color="#ec4899"
          />
          <StatCard
            label="Max Drawdown"
            value={`${(drawdown * 100).toFixed(2)}%`}
            icon={Shield}
            color={drawdown > 0.1 ? "#ef4444" : drawdown > 0.05 ? "#f59e0b" : "#10b981"}
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
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-brand/15 text-brand hover:bg-brand/25 transition-colors"
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
                className="p-3 rounded-xl bg-[#12141a] hover:border-brand/40 transition-colors text-left"
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
              <div key={i} className="p-4 rounded-xl bg-[#12141a] space-y-3">
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
                  className="p-4 rounded-xl bg-[#12141a] space-y-3"
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

      {/* Wallet Positions (source of truth from Hyperliquid clearinghouse) */}
      {walletPositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Wallet Positions ({walletPositions.length})
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-[#848e9c]">
              {openOrderCount > 0 && <span>{openOrderCount} open order{openOrderCount !== 1 ? "s" : ""}</span>}
              {accountValue > 0 && <span>Equity: <span className="text-white font-medium">${accountValue.toFixed(2)}</span></span>}
              {totalMarginUsed > 0 && <span>Margin: <span className="text-white">${totalMarginUsed.toFixed(2)}</span></span>}
            </div>
          </div>
          <div className="space-y-2">
            {walletPositions.map((ap) => {
              const pos = ap.position;
              const sz = parseFloat(pos.szi);
              const isLong = sz > 0;
              const absSz = Math.abs(sz);
              const entryPx = parseFloat(pos.entryPx ?? "0");
              const uPnl = parseFloat(pos.unrealizedPnl);
              const roe = parseFloat(pos.returnOnEquity) * 100;
              const lev = pos.leverage.value;
              const margin = parseFloat(pos.marginUsed);
              const liqPx = pos.liquidationPx ? parseFloat(pos.liquidationPx) : null;
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
                ? STRATEGY_LABELS[quantMatch!.strategy_type] ?? { name: quantMatch!.strategy_type, emoji: "🤖", color: "#848e9c" }
                : null;

              return (
                <Link key={coin} href={`/trade/${displayCoin}`} className="block">
                  <div className="bg-[#141620] rounded-xl overflow-hidden hover:bg-[#181b28] transition-colors">
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {isLong ? "LONG" : "SHORT"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2e3e] text-[#c0c4cc] font-medium">
                          {lev}x
                        </span>
                        {isAuto && autoMeta && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-medium flex items-center gap-0.5">
                            <Bot className="h-2.5 w-2.5" /> {autoMeta.emoji} AUTO
                          </span>
                        )}
                        <span className="text-sm font-semibold text-white">{displayCoin}</span>
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
                        <p className="text-[10px] text-[#848e9c]">{absSz.toFixed(4)} @ ${markPx > 0 ? markPx.toLocaleString() : entryPx.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#2a2e3e]/30 border-t border-[#2a2e3e]/50">
                      <QuantDetailCell label="Entry" value={`$${entryPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}`} />
                      <QuantDetailCell label="Mark" value={markPx > 0 ? `$${markPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"} />
                      <QuantDetailCell label="Margin" value={`$${margin.toFixed(2)}`} />
                      <QuantDetailCell
                        label="Fund/8h"
                        value={`${fundingRate >= 0 ? "+" : ""}${fundingPct}%`}
                        valueColor={fundingRate >= 0 ? "text-emerald-400" : "text-red-400"}
                      />
                      <QuantDetailCell label="Notional" value={`$${Math.abs(parseFloat(pos.positionValue)).toFixed(2)}`} />
                      <QuantDetailCell label="Liq. Price" value={liqPx ? `$${liqPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"} valueColor="text-amber-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* No positions state */}
      {!loading && walletPositions.length === 0 && address && (
        <div className="text-center text-[#848e9c] text-sm py-8 border border-dashed border-[#2a2e39] rounded-xl">
          No open positions in this wallet
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
          <div className="bg-[#141620] rounded-xl overflow-hidden">
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
                      <span className="text-brand">${markPx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
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
          <Monitor className="h-5 w-5 text-brand" />
          <span className="text-sm font-semibold text-white">Browser Engine</span>
          <button
            onClick={toggleEngine}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
              engineRunning
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-[#1a1d2e] text-[#848e9c] hover:text-white"
            }`}
          >
            {engineRunning ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            {engineRunning ? "ON" : "OFF"}
          </button>
        </div>
        <Link
          href="/automate/create"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-brand/15 text-brand hover:bg-brand/25 transition-colors"
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
        <MiniStat icon={<Bot className="h-4 w-4 text-brand" />} label="Strategies" value={strategies.length.toString()} />
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
              <Link href="/automate/create" className="text-sm text-brand hover:underline">Create your first strategy</Link>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-brand" />
          <span className="text-sm font-semibold text-white">Quant Lab</span>
          <span className="text-[10px] text-[#4a4e59]">Backtesting + Analytics</span>
        </div>
        <button
          onClick={fetchLabData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#848e9c] hover:text-white hover:bg-[#1a1d26] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Data Pipeline Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Candles Stored"
          value={totalCandles.toLocaleString()}
          icon={Database}
          color="#3b82f6"
        />
        <StatCard
          label="Coins Tracked"
          value={dataStatus.length.toString()}
          icon={Layers}
          color="#8b5cf6"
        />
        <StatCard
          label="Backtests Run"
          value={backtests.length.toString()}
          icon={FlaskConical}
          color="#ec4899"
        />
        <StatCard
          label="Avg Sharpe"
          value={avgSharpe.toFixed(2)}
          icon={LineChart}
          color={avgSharpe > 1 ? "#10b981" : avgSharpe > 0 ? "#f59e0b" : "#ef4444"}
        />
      </div>

      {/* Run Backtest Panel */}
      <div className="p-4 rounded-xl bg-[#12141a] space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Play className="h-4 w-4 text-brand" />
          Run Backtest
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] text-[#848e9c] uppercase tracking-wider block mb-1">Strategy</label>
            <select
              value={btStrategy}
              onChange={(e) => setBtStrategy(e.target.value)}
              className="bg-[#0b0e11] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
            >
              <option value="momentum">Momentum Scalper</option>
              <option value="grid">Grid Bot</option>
              <option value="mean_reversion">Mean Reversion</option>
              <option value="funding_rate">Funding Rate</option>
              <option value="market_maker">Market Maker</option>
              <option value="all">All Strategies</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#848e9c] uppercase tracking-wider block mb-1">Days</label>
            <select
              value={btDays}
              onChange={(e) => setBtDays(Number(e.target.value))}
              className="bg-[#0b0e11] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
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
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-brand text-white hover:bg-brand/80 transition-colors disabled:opacity-40"
          >
            {runningBacktest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {runningBacktest ? "Running..." : "Run Backtest"}
          </button>
        </div>
        {totalCandles < 10 && (
          <p className="text-[10px] text-amber-400">
            No candle data. Run: <code className="bg-[#1a1d26] px-1 rounded">npx tsx scripts/backtest.ts backfill</code>
          </p>
        )}
      </div>

      {/* Data Coverage */}
      {dataStatus.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Coverage
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
            {dataStatus.slice(0, 24).map((d) => (
              <div key={d.coin} className="bg-[#141620] rounded-lg px-2.5 py-2 text-center">
                <p className="text-[10px] font-medium text-white">{d.coin}</p>
                <p className="text-[9px] text-[#4a4e59]">{d.total_candles.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backtest Results */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Backtest Results ({backtests.length})
        </h3>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4 rounded-xl bg-[#12141a]">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : backtests.length === 0 ? (
          <div className="text-center text-[#848e9c] text-sm py-8 border border-dashed border-[#2a2e39] rounded-xl">
            No backtests yet. Run one above or via CLI.
          </div>
        ) : (
          <div className="space-y-2">
            {backtests.map((bt) => {
              const meta = STRATEGY_LABELS[bt.strategy_type] ?? { name: bt.strategy_type, emoji: "🤖", color: "#848e9c" };
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
                        : "border-[#2a2e39] bg-[#12141a]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{meta.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{meta.name}</p>
                          <p className="text-[10px] text-[#848e9c]">
                            {bt.coins.slice(0, 5).join(", ")}{bt.coins.length > 5 ? ` +${bt.coins.length - 5}` : ""} |{" "}
                            {new Date(bt.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className={`text-sm font-bold ${profitable ? "text-emerald-400" : "text-red-400"}`}>
                            {profitable ? "+" : ""}${bt.total_pnl.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-[#848e9c]">{bt.total_trades} trades</p>
                        </div>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          sharpe > 1 ? "bg-emerald-500/20" : sharpe > 0 ? "bg-amber-500/20" : "bg-red-500/20"
                        }`}>
                          <span className={`text-xs font-bold ${
                            sharpe > 1 ? "text-emerald-400" : sharpe > 0 ? "text-amber-400" : "text-red-400"
                          }`}>
                            {sharpe.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick metrics row */}
                    <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-[#2a2e39]/50">
                      <BacktestMetric label="Win Rate" value={bt.win_rate != null ? `${(bt.win_rate * 100).toFixed(1)}%` : "—"} good={bt.win_rate != null && bt.win_rate > 0.5} />
                      <BacktestMetric label="Max DD" value={`${(bt.max_drawdown * 100).toFixed(1)}%`} good={bt.max_drawdown < 0.1} />
                      <BacktestMetric label="Sharpe" value={sharpe.toFixed(2)} good={sharpe > 1} />
                      <BacktestMetric label="Avg P&L" value={bt.avg_trade_pnl != null ? `$${bt.avg_trade_pnl.toFixed(2)}` : "—"} good={bt.avg_trade_pnl != null && bt.avg_trade_pnl > 0} />
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isSelected && (
                    <div className="ml-4 mr-4 -mt-1 p-4 rounded-b-xl border border-t-0 border-brand/20 bg-[#0d0f14] space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <DetailMetric label="Total P&L" value={`$${bt.total_pnl.toFixed(2)}`} />
                        <DetailMetric label="Winning" value={`${bt.winning_trades}/${bt.total_trades}`} />
                        <DetailMetric label="Profit Factor" value={bt.profit_factor?.toFixed(2) ?? "—"} />
                        <DetailMetric label="Sortino" value={bt.sortino_ratio?.toFixed(2) ?? "—"} />
                        <DetailMetric label="Period" value={`${Math.round((bt.end_time - bt.start_time) / 86400_000)}d`} />
                        <DetailMetric label="Interval" value={bt.interval} />
                        <DetailMetric label="Coins" value={bt.coins.length.toString()} />
                        <DetailMetric label="Max Drawdown" value={`${(bt.max_drawdown * 100).toFixed(2)}%`} />
                      </div>

                      {/* Mini equity curve */}
                      {bt.equity_curve && bt.equity_curve.length > 1 && (
                        <div>
                          <p className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-2">Equity Curve</p>
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

      {/* Best Strategy Highlight */}
      {bestBacktest && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Best Performing Strategy</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">
                {STRATEGY_LABELS[bestBacktest.strategy_type]?.emoji ?? "🤖"}{" "}
                {STRATEGY_LABELS[bestBacktest.strategy_type]?.name ?? bestBacktest.strategy_type}
              </p>
              <p className="text-[10px] text-emerald-400/70">
                Sharpe: {(bestBacktest.sharpe_ratio ?? 0).toFixed(2)} | Win Rate: {((bestBacktest.win_rate ?? 0) * 100).toFixed(1)}% | {bestBacktest.total_trades} trades
              </p>
            </div>
            <p className={`text-lg font-bold ${bestBacktest.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-semibold ${good ? "text-emerald-400" : "text-[#848e9c]"}`}>{value}</p>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#12141a] rounded-lg px-3 py-2">
      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">{label}</p>
      <p className="text-xs font-medium text-white">{value}</p>
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
    <div className="p-3 rounded-xl bg-[#12141a]">
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
    <div className="bg-[#141620] rounded-xl px-4 py-3">
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
