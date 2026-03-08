"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Bot,
  ExternalLink,
  RefreshCw,
  Zap,
  LogIn,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { fetchClearinghouseState, fetchOpenOrders, fetchAllMarkets } from "@/lib/hyperliquid/api";
import type { ClearinghouseState, OpenOrder, MarketInfo, AssetPosition } from "@/lib/hyperliquid/types";
import { useAutomationStore } from "@/lib/automation/store";
import { FundingBanner } from "@/components/FundingBanner";

function formatUsd(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function PnlBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatUsd(Math.abs(value))}
    </span>
  );
}

export default function DashboardPage() {
  const { address, loading: walletLoading, connect } = useWallet();
  const [ch, setCh] = useState<ClearinghouseState | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const automationInit = useAutomationStore((s) => s.init);
  const strategies = useAutomationStore((s) => s.strategies);

  const loadData = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const [chState, openOrders, allMarkets] = await Promise.all([
        fetchClearinghouseState(addr),
        fetchOpenOrders(addr),
        fetchAllMarkets(),
      ]);
      setCh(chState);
      setOrders(openOrders);
      setMarkets(allMarkets);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    automationInit();
  }, [automationInit]);

  useEffect(() => {
    if (address) loadData(address);
  }, [address, loadData]);

  const positions = ch?.assetPositions.filter((ap) => parseFloat(ap.position.szi) !== 0) ?? [];
  const totalPnl = positions.reduce((sum, ap) => sum + parseFloat(ap.position.unrealizedPnl), 0);
  const accountValue = parseFloat(ch?.marginSummary.accountValue ?? "0");
  const totalMarginUsed = parseFloat(ch?.marginSummary.totalMarginUsed ?? "0");
  const availableBalance = parseFloat(ch?.withdrawable ?? "0");
  const activeStrategies = strategies.filter((s) => s.status === "active").length;

  if (walletLoading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white flex items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-[#848e9c]" />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/20 flex items-center justify-center mb-6">
            <Wallet className="h-8 w-8 text-[#7C3AED]" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to Coincess</h1>
          <p className="text-sm text-[#848e9c] mb-8 max-w-sm">
            Trade perpetuals on Hyperliquid, bet on prediction markets, and automate your strategies — all in one app.
          </p>
          <button
            onClick={connect}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm transition-colors shadow-lg shadow-[#7C3AED]/25"
          >
            <LogIn className="h-4 w-4" />
            Sign In / Connect Wallet
          </button>
          <div className="flex gap-4 mt-8">
            <Link href="/trade" className="text-xs text-[#848e9c] hover:text-white transition-colors">Trade &rarr;</Link>
            <Link href="/predictions" className="text-xs text-[#848e9c] hover:text-white transition-colors">Predictions &rarr;</Link>
            <Link href="/coins" className="text-xs text-[#848e9c] hover:text-white transition-colors">Discover &rarr;</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Portfolio</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => loadData(address)} className="p-2 text-[#848e9c] hover:text-white transition-colors" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <span className="text-xs text-[#848e9c] font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        </div>
        {/* Account overview */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
            <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-1">Account Value</p>
            <p className="text-lg font-bold">{formatUsd(accountValue)}</p>
          </div>
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
            <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-1">Available</p>
            <p className="text-lg font-bold text-emerald-400">{formatUsd(availableBalance)}</p>
          </div>
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
            <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-1">Unrealized PnL</p>
            <PnlBadge value={totalPnl} />
          </div>
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
            <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-1">Margin Used</p>
            <p className="text-lg font-bold">{formatUsd(totalMarginUsed)}</p>
          </div>
          <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
            <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-1">Active Bots</p>
            <p className="text-lg font-bold">{activeStrategies}</p>
          </div>
        </div>

        {/* Funding banner when no balance */}
        {accountValue <= 0 && (
          <FundingBanner address={address} balance={availableBalance} />
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/trade" className="flex items-center gap-2 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3 hover:border-[#7C3AED]/50 transition-colors">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold">Trade</p>
              <p className="text-[10px] text-[#848e9c]">Perps</p>
            </div>
          </Link>
          <Link href="/predictions" className="flex items-center gap-2 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3 hover:border-[#7C3AED]/50 transition-colors">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-semibold">Predict</p>
              <p className="text-[10px] text-[#848e9c]">Markets</p>
            </div>
          </Link>
          <Link href="/automate" className="flex items-center gap-2 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3 hover:border-[#7C3AED]/50 transition-colors">
            <Bot className="h-5 w-5 text-[#7C3AED]" />
            <div>
              <p className="text-sm font-semibold">Automate</p>
              <p className="text-[10px] text-[#848e9c]">{activeStrategies} active</p>
            </div>
          </Link>
        </div>

        {/* Positions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Positions ({positions.length})</h2>
            <Link href="/trade" className="text-xs text-[#7C3AED] hover:underline">Open Trade &rarr;</Link>
          </div>
          {positions.length === 0 ? (
            <div className="text-center py-8 bg-[#141620] border border-[#2a2e3e] rounded-xl">
              <p className="text-sm text-[#848e9c]">No open positions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((ap) => (
                <PositionRow key={ap.position.coin} ap={ap} markets={markets} />
              ))}
            </div>
          )}
        </div>

        {/* Open Orders */}
        {orders.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Open Orders ({orders.length})</h2>
            <div className="space-y-1">
              {orders.slice(0, 10).map((o) => (
                <div key={o.oid} className="flex items-center justify-between bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${o.side === "B" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {o.side === "B" ? "BUY" : "SELL"}
                    </span>
                    <span className="text-xs font-medium">{o.coin}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">{o.sz} @ ${parseFloat(o.limitPx).toLocaleString()}</p>
                    <p className="text-[10px] text-[#848e9c]">{o.orderType}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Strategies preview */}
        {strategies.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Automation</h2>
              <Link href="/automate" className="text-xs text-[#7C3AED] hover:underline">Manage &rarr;</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {strategies.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold">{s.name}</p>
                    <p className="text-[10px] text-[#848e9c]">{s.type} · {s.totalTrades} trades</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    s.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                    s.status === "paused" ? "bg-amber-500/20 text-amber-400" :
                    s.status === "error" ? "bg-red-500/20 text-red-400" :
                    "bg-[#848e9c]/20 text-[#848e9c]"
                  }`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hyperliquid link */}
        <div className="text-center py-4">
          <a href={`https://app.hyperliquid.xyz/trade`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#848e9c] hover:text-white transition-colors">
            Powered by Hyperliquid <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function PositionRow({ ap, markets }: { ap: AssetPosition; markets: MarketInfo[] }) {
  const pos = ap.position;
  const size = parseFloat(pos.szi);
  const pnl = parseFloat(pos.unrealizedPnl);
  const entry = parseFloat(pos.entryPx ?? "0");
  const market = markets.find((m) => m.name === pos.coin);
  const markPx = market ? parseFloat(market.markPx) : 0;
  const roe = parseFloat(pos.returnOnEquity) * 100;

  return (
    <Link href={`/trade?coin=${pos.coin}`} className="flex items-center justify-between bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3 hover:border-[#3a3e4e] transition-colors">
      <div className="flex items-center gap-3">
        <div>
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-bold mb-0.5 ${size > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            {size > 0 ? "LONG" : "SHORT"} {pos.leverage.value}x
          </span>
          <p className="text-sm font-semibold">{pos.coin}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 justify-end">
          <PnlBadge value={pnl} />
          <span className={`text-[10px] ${roe >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            ({roe >= 0 ? "+" : ""}{roe.toFixed(1)}%)
          </span>
        </div>
        <p className="text-[10px] text-[#848e9c]">
          {Math.abs(size).toFixed(4)} @ ${entry.toLocaleString()} → ${markPx.toLocaleString()}
        </p>
      </div>
    </Link>
  );
}
