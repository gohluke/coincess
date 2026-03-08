"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Plus, Zap, ZapOff, Bot, BarChart3, Activity } from "lucide-react";
import { useAutomationStore } from "@/lib/automation/store";
import { StrategyCard } from "@/components/automate/StrategyCard";
import { ActivityLog } from "@/components/automate/ActivityLog";

export default function AutomatePage() {
  const {
    strategies, loading, engineRunning,
    init, toggleEngine,
  } = useAutomationStore();

  useEffect(() => { init(); }, [init]);

  const activeCount = strategies.filter((s) => s.status === "active").length;
  const totalTrades = strategies.reduce((sum, s) => sum + s.totalTrades, 0);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      {/* Page toolbar */}
      <div className="border-b border-[#2a2e39] bg-[#0b0e11]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#7C3AED]" />
            Automation
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleEngine}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                engineRunning
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-[#1a1d2e] text-[#848e9c] border border-[#2a2e3e] hover:text-white"
              }`}
            >
              {engineRunning ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
              Engine {engineRunning ? "ON" : "OFF"}
            </button>
            <Link
              href="/automate/create"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Strategy
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<Bot className="h-4 w-4 text-[#7C3AED]" />} label="Strategies" value={strategies.length.toString()} />
          <StatCard icon={<Zap className="h-4 w-4 text-emerald-400" />} label="Active" value={activeCount.toString()} />
          <StatCard icon={<BarChart3 className="h-4 w-4 text-blue-400" />} label="Total Trades" value={totalTrades.toString()} />
          <StatCard icon={<Activity className="h-4 w-4 text-amber-400" />} label="Engine" value={engineRunning ? "Running" : "Stopped"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Strategies */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Strategies</h2>
              <Link href="/automate/alerts" className="text-xs text-[#7C3AED] hover:underline">Alerts &rarr;</Link>
            </div>
            {loading ? (
              <div className="text-center py-12 text-[#848e9c] text-sm">Loading...</div>
            ) : strategies.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#2a2e3e] rounded-xl">
                <Bot className="h-10 w-10 mx-auto mb-3 text-[#2a2e3e]" />
                <p className="text-sm text-[#848e9c] mb-3">No strategies yet</p>
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
            <h2 className="text-lg font-semibold mb-4">Activity</h2>
            <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-3">
              <ActivityLog />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[10px] text-[#848e9c] uppercase tracking-wide">{label}</span></div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
