"use client";

import { useEffect, useState, useCallback } from "react";
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
  BarChart3,
  Shield,
  DollarSign,
  Clock,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import type { QuantStrategy, QuantState, QuantTrade } from "@/lib/quant/types";

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

export default function QuantDashboard() {
  const address = useEffectiveAddress();
  const [engine, setEngine] = useState<QuantState | null>(null);
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [openTrades, setOpenTrades] = useState<QuantTrade[]>([]);
  const [recentPnl, setRecentPnl] = useState<Array<{ pnl: number; closed_at: string; strategy_type: string }>>([]);
  const [trades, setTrades] = useState<QuantTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStrategy, setAddingStrategy] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, tradesRes] = await Promise.all([
        fetch("/api/quant/status"),
        fetch("/api/quant/trades?limit=50"),
      ]);
      const statusData = await statusRes.json();
      const tradesData = await tradesRes.json();

      setEngine(statusData.engine);
      setStrategies(statusData.strategies ?? []);
      setOpenTrades(statusData.openTrades ?? []);
      setRecentPnl(statusData.recentPnl ?? []);
      setTrades(tradesData.trades ?? []);
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

  if (!address) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[#848e9c]">
        <p>Connect a wallet to view quant dashboard</p>
      </div>
    );
  }

  const statusColor =
    engine?.engine_status === "running" ? "#10b981" :
    engine?.engine_status === "error" ? "#ef4444" :
    engine?.engine_status === "paused" ? "#f59e0b" : "#848e9c";

  const totalPnl = strategies.reduce((s, st) => s + (st.total_pnl ?? 0), 0);
  const dailyPnl = engine?.daily_pnl ?? 0;
  const drawdown = engine?.max_drawdown ?? 0;
  const exposure = engine?.current_exposure ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-[#7C3AED]" />
          <h1 className="text-xl font-bold text-white">Quant Trading</h1>
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: statusColor + "20", color: statusColor }}
          >
            {engine?.engine_status?.toUpperCase() ?? "OFFLINE"}
          </span>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#848e9c] hover:text-white hover:bg-[#1a1d26] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
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

      {/* Risk Gauge */}
      {drawdown > 0.1 && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-red-300 text-sm font-medium">High Drawdown Warning</p>
            <p className="text-red-400/70 text-xs">
              Drawdown at {(drawdown * 100).toFixed(1)}%. Kill switch triggers at 15%.
            </p>
          </div>
        </div>
      )}

      {/* Strategies */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Strategies</h2>
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
          <div className="text-center text-[#848e9c] text-sm py-8">Loading...</div>
        ) : strategies.length === 0 ? (
          <div className="text-center text-[#848e9c] text-sm py-8 border border-dashed border-[#2a2e39] rounded-xl">
            No strategies configured. Click "Add Strategy" to get started.
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#2a2e39]">
                  <th className="text-left py-2 pr-4">Coin</th>
                  <th className="text-left py-2 pr-4">Side</th>
                  <th className="text-right py-2 pr-4">Size</th>
                  <th className="text-right py-2 pr-4">Entry</th>
                  <th className="text-left py-2">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-[#2a2e39]/50">
                    <td className="py-2 pr-4 text-white font-medium">{trade.coin}</td>
                    <td className={`py-2 pr-4 ${trade.side === "long" ? "text-green-400" : "text-red-400"}`}>
                      {trade.side.toUpperCase()}
                    </td>
                    <td className="py-2 pr-4 text-right text-[#c8ccd4]">{Number(trade.size).toFixed(4)}</td>
                    <td className="py-2 pr-4 text-right text-[#c8ccd4]">${Number(trade.entry_px).toFixed(2)}</td>
                    <td className="py-2">
                      <span className="text-[#848e9c]">
                        {STRATEGY_LABELS[trade.strategy_type]?.emoji ?? "🤖"}{" "}
                        {STRATEGY_LABELS[trade.strategy_type]?.name ?? trade.strategy_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade Log */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Trades
        </h2>
        {trades.length === 0 ? (
          <p className="text-[#848e9c] text-xs py-4 text-center">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#2a2e39]">
                  <th className="text-left py-2 pr-3">Time</th>
                  <th className="text-left py-2 pr-3">Coin</th>
                  <th className="text-left py-2 pr-3">Side</th>
                  <th className="text-right py-2 pr-3">Entry</th>
                  <th className="text-right py-2 pr-3">Exit</th>
                  <th className="text-right py-2 pr-3">P&L</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 20).map((trade) => (
                  <tr key={trade.id} className="border-b border-[#2a2e39]/50">
                    <td className="py-2 pr-3 text-[#848e9c]">{relativeTime(trade.opened_at)}</td>
                    <td className="py-2 pr-3 text-white font-medium">{trade.coin}</td>
                    <td className={`py-2 pr-3 ${trade.side === "long" ? "text-green-400" : "text-red-400"}`}>
                      {trade.side.toUpperCase()}
                    </td>
                    <td className="py-2 pr-3 text-right text-[#c8ccd4]">${Number(trade.entry_px).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-[#c8ccd4]">
                      {trade.exit_px ? `$${Number(trade.exit_px).toFixed(2)}` : "—"}
                    </td>
                    <td className={`py-2 pr-3 text-right ${(trade.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {trade.pnl != null ? formatPnl(trade.pnl) : "—"}
                    </td>
                    <td className="py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          trade.status === "open"
                            ? "bg-blue-500/20 text-blue-400"
                            : trade.status === "closed"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Engine Info */}
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
