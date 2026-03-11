"use client";

import type { Strategy } from "@/lib/automation/types";
import { useAutomationStore } from "@/lib/automation/store";
import {
  Play,
  Pause,
  Square,
  Trash2,
  RefreshCw,
  TrendingUp,
  Grid3X3,
  ShieldAlert,
  Bot,
  Target,
  Clock,
  Copy,
} from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  dca: { label: "DCA", icon: <RefreshCw className="h-4 w-4" />, color: "text-blue-400" },
  grid: { label: "Grid", icon: <Grid3X3 className="h-4 w-4" />, color: "text-emerald-400" },
  trailing_stop: { label: "Trail Stop", icon: <ShieldAlert className="h-4 w-4" />, color: "text-amber-400" },
  conditional: { label: "Conditional", icon: <Target className="h-4 w-4" />, color: "text-rose-400" },
  prediction_auto_bet: { label: "Auto Bet", icon: <Bot className="h-4 w-4" />, color: "text-pink-400" },
  prediction_exit: { label: "Auto Exit", icon: <Clock className="h-4 w-4" />, color: "text-orange-400" },
  copy_trade: { label: "Copy Trade", icon: <Copy className="h-4 w-4" />, color: "text-cyan-400" },
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  stopped: "bg-[#848e9c]/20 text-[#848e9c] border-[#848e9c]/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

function formatTime(ts: number | null): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getConfigSummary(strategy: Strategy): string {
  const c = strategy.config;
  switch (strategy.type) {
    case "dca": {
      const d = c as Strategy["config"] & { coin: string; side: string; amountUsd: number; intervalMs: number };
      const interval = d.intervalMs >= 86_400_000 ? `${(d.intervalMs / 86_400_000).toFixed(0)}d`
        : d.intervalMs >= 3_600_000 ? `${(d.intervalMs / 3_600_000).toFixed(0)}h`
        : `${(d.intervalMs / 60_000).toFixed(0)}m`;
      return `${d.side.toUpperCase()} $${d.amountUsd} ${d.coin} every ${interval}`;
    }
    case "grid": {
      const g = c as Strategy["config"] & { coin: string; gridCount: number; lowerPrice: number; upperPrice: number };
      return `${g.gridCount} grids on ${g.coin} ($${g.lowerPrice}–$${g.upperPrice})`;
    }
    case "trailing_stop": {
      const t = c as Strategy["config"] & { coin: string; side: string; trailPercent: number };
      return `${t.side.toUpperCase()} ${t.coin} trail ${t.trailPercent}%`;
    }
    case "copy_trade": {
      const ct = c as Strategy["config"] & { targetAddress: string; targetLabel?: string; sizeMultiplier: number };
      return `Copy ${ct.targetLabel || ct.targetAddress.slice(0, 8) + "…"} @ ${ct.sizeMultiplier}x`;
    }
    case "prediction_auto_bet": {
      const p = c as Strategy["config"] & { eventTitle: string; outcome: string; triggerPrice: number };
      return `Buy ${p.outcome} on "${p.eventTitle?.slice(0, 30)}…" when < ${(p.triggerPrice * 100).toFixed(0)}¢`;
    }
    case "prediction_exit": {
      const pe = c as Strategy["config"] & { eventTitle: string; exitBeforeMs: number };
      const mins = pe.exitBeforeMs / 60_000;
      return `Exit "${pe.eventTitle?.slice(0, 30)}…" ${mins >= 60 ? `${(mins / 60).toFixed(0)}h` : `${mins}m`} before close`;
    }
    default:
      return "";
  }
}

export function StrategyCard({ strategy }: { strategy: Strategy }) {
  const updateStatus = useAutomationStore((s) => s.updateStrategyStatus);
  const remove = useAutomationStore((s) => s.removeStrategy);
  const meta = TYPE_META[strategy.type] ?? { label: strategy.type, icon: <Bot className="h-4 w-4" />, color: "text-white" };

  return (
    <div className="bg-[#141620] rounded-xl p-4 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={meta.color}>{meta.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{strategy.name}</h3>
            <span className="text-[10px] text-[#848e9c] uppercase tracking-wide">{meta.label} · {strategy.platform}</span>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${STATUS_STYLES[strategy.status]}`}>
          {strategy.status}
        </span>
      </div>

      <p className="text-xs text-[#c8ccd8] mb-3">{getConfigSummary(strategy)}</p>

      {strategy.errorMessage && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 mb-3 truncate">{strategy.errorMessage}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-[10px] text-[#848e9c]">
          <span>Trades: {strategy.totalTrades}</span>
          <span>Last: {formatTime(strategy.lastExecutedAt)}</span>
        </div>
        <div className="flex gap-1">
          {strategy.status === "active" && (
            <button onClick={() => updateStatus(strategy.id, "paused")} className="p-1.5 rounded-lg hover:bg-[#1a1d2e] text-amber-400" title="Pause">
              <Pause className="h-3.5 w-3.5" />
            </button>
          )}
          {(strategy.status === "paused" || strategy.status === "error") && (
            <button onClick={() => updateStatus(strategy.id, "active")} className="p-1.5 rounded-lg hover:bg-[#1a1d2e] text-emerald-400" title="Resume">
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {strategy.status !== "stopped" && (
            <button onClick={() => updateStatus(strategy.id, "stopped")} className="p-1.5 rounded-lg hover:bg-[#1a1d2e] text-[#848e9c]" title="Stop">
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => remove(strategy.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
