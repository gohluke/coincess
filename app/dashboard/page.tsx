"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { fetchCombinedClearinghouseState, fetchOpenOrders, fetchAllMarkets, fetchUserFills } from "@/lib/hyperliquid/api";
import type { ClearinghouseState, OpenOrder, MarketInfo, AssetPosition, Fill } from "@/lib/hyperliquid/types";
import { useAutomationStore } from "@/lib/automation/store";
import { FundingBanner } from "@/components/FundingBanner";

// ── Round-trip trade grouping ──────────────────────────────

interface RoundTripTrade {
  coin: string;
  direction: "Long" | "Short";
  entryPx: number;
  exitPx: number | null;
  maxSize: number;
  openTime: number;
  closeTime: number | null;
  realizedPnl: number;
  totalFees: number;
  netPnl: number;
  fills: Fill[];
  isOpen: boolean;
}

function groupFillsIntoTrades(fills: Fill[]): RoundTripTrade[] {
  const sorted = [...fills].sort((a, b) => a.time - b.time);
  const byCoin = new Map<string, Fill[]>();
  for (const f of sorted) {
    const arr = byCoin.get(f.coin) ?? [];
    arr.push(f);
    byCoin.set(f.coin, arr);
  }

  const trades: RoundTripTrade[] = [];

  for (const [coin, coinFills] of byCoin) {
    let pos = 0;
    let tradeFills: Fill[] = [];
    let openTime = 0;
    let direction: "Long" | "Short" = "Long";
    let entryCost = 0;
    let entrySize = 0;

    for (const f of coinFills) {
      const sz = parseFloat(f.sz);
      const px = parseFloat(f.px);
      const delta = f.side === "B" ? sz : -sz;

      if (tradeFills.length === 0) {
        openTime = f.time;
        direction = delta > 0 ? "Long" : "Short";
        entryCost = 0;
        entrySize = 0;
      }

      tradeFills.push(f);

      const isOpening = f.dir.toLowerCase().includes("open");
      if (isOpening) {
        entryCost += px * sz;
        entrySize += sz;
      }

      const prevPos = pos;
      pos += delta;

      const crossed = (prevPos > 0 && pos <= 0) || (prevPos < 0 && pos >= 0);
      if (crossed || Math.abs(pos) < 1e-10) {
        const pnl = tradeFills.reduce((s, tf) => s + parseFloat(tf.closedPnl), 0);
        const fees = tradeFills.reduce((s, tf) => s + parseFloat(tf.fee), 0);
        const closeFills = tradeFills.filter((tf) => tf.dir.toLowerCase().includes("close"));
        const exitCost = closeFills.reduce((s, tf) => s + parseFloat(tf.px) * parseFloat(tf.sz), 0);
        const exitSize = closeFills.reduce((s, tf) => s + parseFloat(tf.sz), 0);

        trades.push({
          coin,
          direction,
          entryPx: entrySize > 0 ? entryCost / entrySize : 0,
          exitPx: exitSize > 0 ? exitCost / exitSize : null,
          maxSize: entrySize || Math.abs(parseFloat(tradeFills[0].sz)),
          openTime,
          closeTime: tradeFills[tradeFills.length - 1].time,
          realizedPnl: pnl,
          totalFees: fees,
          netPnl: pnl - fees,
          fills: tradeFills,
          isOpen: false,
        });
        tradeFills = [];
        if (Math.abs(pos) > 1e-10) {
          tradeFills = [f];
          openTime = f.time;
          direction = pos > 0 ? "Long" : "Short";
          entryCost = px * sz;
          entrySize = sz;
        }
      }
    }

    if (tradeFills.length > 0) {
      const pnl = tradeFills.reduce((s, tf) => s + parseFloat(tf.closedPnl), 0);
      const fees = tradeFills.reduce((s, tf) => s + parseFloat(tf.fee), 0);

      trades.push({
        coin,
        direction,
        entryPx: entrySize > 0 ? entryCost / entrySize : parseFloat(tradeFills[0].px),
        exitPx: null,
        maxSize: entrySize || Math.abs(parseFloat(tradeFills[0].sz)),
        openTime,
        closeTime: null,
        realizedPnl: pnl,
        totalFees: fees,
        netPnl: pnl - fees,
        fills: tradeFills,
        isOpen: true,
      });
    }
  }

  trades.sort((a, b) => (b.closeTime ?? b.openTime) - (a.closeTime ?? a.openTime));
  return trades;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remMins}m`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return `${days}d ${remHrs}h`;
}

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
  const { address, loading: walletLoading, connect } = useEffectiveAddress();
  const [ch, setCh] = useState<ClearinghouseState | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [historyView, setHistoryView] = useState<"trades" | "fills">("trades");

  const automationInit = useAutomationStore((s) => s.init);
  const strategies = useAutomationStore((s) => s.strategies);

  const loadData = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const [chState, openOrders, allMarkets, userFills] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchOpenOrders(addr),
        fetchAllMarkets(),
        fetchUserFills(addr),
      ]);
      setCh(chState);
      setOrders(openOrders);
      setMarkets(allMarkets);
      setFills(userFills);
      setLastRefresh(new Date());
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

  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => loadData(address), positions.length > 0 ? 10000 : 30000);
    return () => clearInterval(interval);
  }, [address, loadData, positions.length]);
  const trades = useMemo(() => groupFillsIntoTrades(fills), [fills]);
  const closedTrades = trades.filter((t) => !t.isOpen);
  const totalRealizedPnl = closedTrades.reduce((s, t) => s + t.realizedPnl, 0);
  const totalFeesPaid = trades.reduce((s, t) => s + t.totalFees, 0);
  const winCount = closedTrades.filter((t) => t.netPnl > 0).length;
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length * 100).toFixed(0) : "–";

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
            {lastRefresh && (
              <span className="text-[10px] text-[#848e9c]">
                {positions.length > 0 ? "Live" : "Updated"}{" "}
                {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
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

        {/* Trade History */}
        {fills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Trade History</h2>
                <div className="flex bg-[#1a1d2e] rounded-lg p-0.5 text-[10px]">
                  <button
                    onClick={() => setHistoryView("trades")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${historyView === "trades" ? "bg-[#7C3AED] text-white" : "text-[#848e9c] hover:text-white"}`}
                  >
                    Trades ({trades.length})
                  </button>
                  <button
                    onClick={() => setHistoryView("fills")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${historyView === "fills" ? "bg-[#7C3AED] text-white" : "text-[#848e9c] hover:text-white"}`}
                  >
                    Fills ({fills.length})
                  </button>
                </div>
              </div>
              <a
                href={`https://app.hyperliquid.xyz/explorer/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#7C3AED] hover:underline inline-flex items-center gap-1"
              >
                Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Aggregate stats bar */}
            {closedTrades.length > 0 && historyView === "trades" && (
              <div className="flex flex-wrap items-center gap-4 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-2.5 mb-3">
                <div>
                  <span className="text-[10px] text-[#848e9c]">Realized P&L </span>
                  <span className={`text-xs font-semibold ${totalRealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {totalRealizedPnl >= 0 ? "+" : ""}{formatUsd(totalRealizedPnl)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#848e9c]">Fees Paid </span>
                  <span className="text-xs font-semibold text-amber-400">{formatUsd(totalFeesPaid)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#848e9c]">Net P&L </span>
                  <span className={`text-xs font-semibold ${(totalRealizedPnl - totalFeesPaid) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(totalRealizedPnl - totalFeesPaid) >= 0 ? "+" : ""}{formatUsd(totalRealizedPnl - totalFeesPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#848e9c]">Win Rate </span>
                  <span className="text-xs font-semibold text-white">{winRate}%</span>
                  <span className="text-[10px] text-[#848e9c] ml-1">({winCount}/{closedTrades.length})</span>
                </div>
              </div>
            )}

            {historyView === "trades" ? (
              <div className="space-y-2">
                {trades.map((trade, i) => (
                  <TradeRow key={`${trade.coin}-${trade.openTime}-${i}`} trade={trade} positions={positions} />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {fills.slice(0, 30).map((f) => {
                  const pnl = parseFloat(f.closedPnl);
                  const notional = parseFloat(f.px) * parseFloat(f.sz);
                  const isOpen = f.dir.toLowerCase().includes("open");
                  return (
                    <div key={f.tid} className="flex items-center justify-between bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          f.side === "B" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {f.side === "B" ? "BUY" : "SELL"}
                        </span>
                        <div>
                          <span className="text-xs font-medium">{stripPrefix(f.coin)}</span>
                          <span className="text-[10px] text-[#848e9c] ml-1.5">{f.dir}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs">
                          {parseFloat(f.sz).toFixed(4)} @ ${parseFloat(f.px).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-[10px] text-[#848e9c]">
                            ${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                          {!isOpen && pnl !== 0 && (
                            <span className={`text-[10px] font-medium ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                            </span>
                          )}
                          <span className="text-[10px] text-[#848e9c]">
                            {new Date(f.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

function stripPrefix(coin: string): string {
  const idx = coin.indexOf(":");
  return idx >= 0 ? coin.slice(idx + 1) : coin;
}

function TradeRow({ trade, positions }: { trade: RoundTripTrade; positions: AssetPosition[] }) {
  const [expanded, setExpanded] = useState(false);
  const bare = stripPrefix(trade.coin);
  const duration = trade.closeTime ? trade.closeTime - trade.openTime : Date.now() - trade.openTime;
  const isWin = trade.netPnl > 0;

  const matchPos = trade.isOpen ? positions.find((ap) => stripPrefix(ap.position.coin) === bare) : null;
  const leverage = matchPos ? `${matchPos.position.leverage.value}x` : null;

  const fmtTime = (t: number) =>
    new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)} className="w-full px-4 py-3 text-left hover:bg-[#1a1d2e]/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${trade.direction === "Long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {trade.direction.toUpperCase()}{leverage ? ` ${leverage}` : ""}
            </span>
            <div>
              <span className="text-sm font-semibold">{bare}</span>
              {trade.isOpen && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">OPEN</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!trade.isOpen && (
              <span className={`text-sm font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                {trade.netPnl >= 0 ? "+" : ""}{formatUsd(trade.netPnl)}
              </span>
            )}
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-[#848e9c]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#848e9c]" />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[10px] text-[#848e9c]">
          <span>Size: <span className="text-white">{trade.maxSize.toFixed(4)}</span></span>
          <span>Notional: <span className="text-white">{formatUsd(trade.entryPx * trade.maxSize)}</span></span>
          <span>Entry: <span className="text-white">${trade.entryPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
          {trade.exitPx != null && (
            <span>Exit: <span className="text-white">${trade.exitPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
          )}
          <span className="inline-flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {fmtTime(trade.openTime)}
            {trade.closeTime ? ` → ${fmtTime(trade.closeTime)}` : " → now"}
          </span>
          <span>Duration: <span className="text-white">{formatDuration(duration)}</span></span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2a2e3e]/50 px-4 py-2.5 space-y-2">
          {/* P&L breakdown */}
          <div className="flex flex-wrap items-center gap-4 text-[10px]">
            <div>
              <span className="text-[#848e9c]">Realized P&L: </span>
              <span className={trade.realizedPnl >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {trade.realizedPnl >= 0 ? "+" : ""}{formatUsd(trade.realizedPnl)}
              </span>
            </div>
            <div>
              <span className="text-[#848e9c]">Fees: </span>
              <span className="text-amber-400 font-medium">-{formatUsd(trade.totalFees)}</span>
            </div>
            <div>
              <span className="text-[#848e9c]">Net: </span>
              <span className={`font-bold ${trade.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {trade.netPnl >= 0 ? "+" : ""}{formatUsd(trade.netPnl)}
              </span>
            </div>
            {trade.exitPx != null && trade.entryPx > 0 && (
              <div>
                <span className="text-[#848e9c]">Return: </span>
                {(() => {
                  const ret = trade.direction === "Long"
                    ? ((trade.exitPx - trade.entryPx) / trade.entryPx) * 100
                    : ((trade.entryPx - trade.exitPx) / trade.entryPx) * 100;
                  return (
                    <span className={`font-medium ${ret >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {ret >= 0 ? "+" : ""}{ret.toFixed(2)}%
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Individual fills */}
          <div className="space-y-0.5">
            <p className="text-[10px] text-[#848e9c] font-medium mb-1">{trade.fills.length} fill{trade.fills.length > 1 ? "s" : ""}</p>
            {trade.fills.map((f) => {
              const pnl = parseFloat(f.closedPnl);
              return (
                <div key={f.tid} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-[#0b0e11]/50">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1 py-0.5 rounded font-bold ${f.side === "B" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      {f.side === "B" ? "BUY" : "SELL"}
                    </span>
                    <span className="text-[#848e9c]">{f.dir}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{parseFloat(f.sz).toFixed(4)} @ ${parseFloat(f.px).toLocaleString()}</span>
                    {pnl !== 0 && (
                      <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                      </span>
                    )}
                    <span className="text-[#848e9c]">fee: {formatUsd(parseFloat(f.fee))}</span>
                    <span className="text-[#848e9c]">
                      {new Date(f.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({ ap, markets }: { ap: AssetPosition; markets: MarketInfo[] }) {
  const pos = ap.position;
  const size = parseFloat(pos.szi);
  const pnl = parseFloat(pos.unrealizedPnl);
  const entry = parseFloat(pos.entryPx ?? "0");
  const bare = stripPrefix(pos.coin);
  const market = markets.find((m) => stripPrefix(m.name) === bare) ?? markets.find((m) => m.name === pos.coin);
  const markPx = market ? parseFloat(market.markPx) : 0;
  const roe = parseFloat(pos.returnOnEquity) * 100;
  const liqPx = pos.liquidationPx ? parseFloat(pos.liquidationPx) : null;
  const liqDistance = liqPx && markPx ? Math.abs((markPx - liqPx) / markPx * 100) : null;
  const notional = Math.abs(size) * markPx;
  const displayCoin = market?.displayName ?? bare;
  const tradeCoin = market?.name ?? pos.coin;

  return (
    <Link href={`/trade?coin=${tradeCoin}`} className="block bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3 hover:border-[#3a3e4e] transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-bold mb-0.5 ${size > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {size > 0 ? "LONG" : "SHORT"} {pos.leverage.value}x
            </span>
            <p className="text-sm font-semibold">{displayCoin} <span className="text-[10px] text-[#848e9c] font-normal">{bare}</span></p>
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
      </div>
      {/* Position details bar */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#2a2e3e]/50">
        <span className="text-[10px] text-[#848e9c]">
          Notional: <span className="text-white">{formatUsd(notional)}</span>
        </span>
        {liqPx != null && liqPx > 0 && (
          <span className="text-[10px] text-[#848e9c]">
            Liq: <span className={liqDistance != null && liqDistance < 10 ? "text-red-400 font-medium" : "text-amber-400"}>${liqPx.toLocaleString()}</span>
            {liqDistance != null && (
              <span className={liqDistance < 10 ? "text-red-400" : "text-[#848e9c]"}> ({liqDistance.toFixed(1)}% away)</span>
            )}
          </span>
        )}
        <span className="text-[10px] text-[#848e9c]">
          Margin: <span className="text-white">{formatUsd(parseFloat(pos.marginUsed))}</span>
        </span>
      </div>
    </Link>
  );
}
