"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  ExternalLink,
  Clock,
  Users,
  Copy,
  Check,
  Star,
  Trophy,
  ArrowUpDown,
  ChevronLeft,
} from "lucide-react";
import {
  fetchCombinedClearinghouseState,
  fetchOpenOrders,
  fetchAllMarkets,
  fetchUserFills,
  fetchUserFunding,
  fetchLeaderboard,
} from "@/lib/hyperliquid/api";
import type {
  ClearinghouseState,
  OpenOrder,
  MarketInfo,
  AssetPosition,
  Fill,
  FundingPayment,
} from "@/lib/hyperliquid/types";
import type { LeaderboardEntry } from "@/lib/hyperliquid/api";

function stripPrefix(coin: string): string {
  const idx = coin.indexOf(":");
  return idx >= 0 ? coin.slice(idx + 1) : coin;
}

function formatUsd(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (!Number.isFinite(n)) return "$0.00";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

type SortKey = "pnl" | "roi" | "accountValue" | "dayPnl";
type TimeWindow = "day" | "week" | "month" | "allTime";

function getPerf(entry: LeaderboardEntry, window: TimeWindow) {
  const p = entry.windowPerformances.find((w) => w[0] === window);
  return p ? p[1] : { pnl: "0", roi: "0", vlm: "0" };
}

export default function TradersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addrParam = searchParams.get("address") ?? "";

  const [searchInput, setSearchInput] = useState(addrParam);
  const [activeAddress, setActiveAddress] = useState(addrParam);
  const [ch, setCh] = useState<ClearinghouseState | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [funding, setFunding] = useState<FundingPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyTab, setHistoryTab] = useState<"positions" | "fills">("positions");

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("allTime");
  const [lbSearch, setLbSearch] = useState("");

  useEffect(() => {
    fetchLeaderboard()
      .then(setLeaderboard)
      .catch(console.error)
      .finally(() => setLbLoading(false));
  }, []);

  const sortedLb = useMemo(() => {
    let filtered = leaderboard;
    if (lbSearch) {
      const q = lbSearch.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.ethAddress.toLowerCase().includes(q) ||
          (e.displayName && e.displayName.toLowerCase().includes(q))
      );
    }
    return [...filtered]
      .sort((a, b) => {
        if (sortKey === "accountValue") return parseFloat(b.accountValue) - parseFloat(a.accountValue);
        if (sortKey === "dayPnl") return parseFloat(getPerf(b, "day").pnl) - parseFloat(getPerf(a, "day").pnl);
        if (sortKey === "roi") return parseFloat(getPerf(b, timeWindow).roi) - parseFloat(getPerf(a, timeWindow).roi);
        return parseFloat(getPerf(b, timeWindow).pnl) - parseFloat(getPerf(a, timeWindow).pnl);
      })
      .slice(0, 50);
  }, [leaderboard, sortKey, timeWindow, lbSearch]);

  const loadTrader = useCallback(async (addr: string) => {
    if (!addr || !addr.startsWith("0x")) return;
    setLoading(true);
    try {
      const [chData, ordersData, marketsData, fillsData, fundingData] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchOpenOrders(addr),
        fetchAllMarkets(),
        fetchUserFills(addr),
        fetchUserFunding(addr),
      ]);
      setCh(chData);
      setOrders(ordersData);
      setMarkets(marketsData);
      setFills(fillsData);
      setFunding(fundingData);
    } catch (err) {
      console.error("Failed to load trader data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    const addr = searchInput.trim();
    if (!addr.startsWith("0x") || addr.length < 10) return;
    setActiveAddress(addr);
    router.push(`/traders?address=${addr}`, { scroll: false });
    loadTrader(addr);
  };

  const selectTrader = (addr: string) => {
    setSearchInput(addr);
    setActiveAddress(addr);
    router.push(`/traders?address=${addr}`, { scroll: false });
    loadTrader(addr);
  };

  const goBack = () => {
    setActiveAddress("");
    setSearchInput("");
    setCh(null);
    setFills([]);
    setFunding([]);
    router.push("/traders", { scroll: false });
  };

  useEffect(() => {
    if (addrParam && addrParam.startsWith("0x")) {
      setActiveAddress(addrParam);
      setSearchInput(addrParam);
      loadTrader(addrParam);
    }
  }, [addrParam, loadTrader]);

  const positions = ch?.assetPositions?.filter(
    (ap) => Math.abs(parseFloat(ap.position.szi)) > 0
  ) ?? [];

  const accountValue = parseFloat(ch?.marginSummary.accountValue ?? "0");
  const totalMargin = parseFloat(ch?.marginSummary.totalMarginUsed ?? "0");
  const withdrawable = parseFloat(ch?.withdrawable ?? "0");
  const totalUnrealizedPnl = positions.reduce(
    (s, ap) => s + parseFloat(ap.position.unrealizedPnl), 0
  );

  const copyAddress = () => {
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lbMatch = leaderboard.find(
    (e) => e.ethAddress.toLowerCase() === activeAddress.toLowerCase()
  );

  const sortedFills = useMemo(
    () => [...fills].sort((a, b) => b.time - a.time).slice(0, 100),
    [fills]
  );

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white pb-20 md:pb-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {activeAddress ? (
                <button onClick={goBack} className="text-[#848e9c] hover:text-white transition-colors mr-1">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : (
                <Users className="h-5 w-5 text-[#7C3AED]" />
              )}
              {activeAddress ? "Trader Profile" : "Trader Lookup"}
            </h1>
            <p className="text-xs text-[#848e9c] mt-1">
              {activeAddress
                ? "Live positions and trade history from Hyperliquid"
                : `Search any wallet or browse the top ${leaderboard.length.toLocaleString()} traders on Hyperliquid`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#848e9c]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Paste wallet address (0x...)"
              className="w-full bg-[#141620] border border-[#2a2e3e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-[#7C3AED] transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-[#7C3AED] text-white rounded-lg text-sm font-medium hover:bg-[#6D28D9] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>

        {/* ── Leaderboard (when no address selected) ── */}
        {!activeAddress && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                Leaderboard
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#848e9c]" />
                  <input
                    type="text"
                    value={lbSearch}
                    onChange={(e) => setLbSearch(e.target.value)}
                    placeholder="Filter by name or address..."
                    className="bg-[#141620] border border-[#2a2e3e] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-[#848e9c] focus:outline-none focus:border-[#7C3AED] transition-colors w-full sm:w-52"
                  />
                </div>
                <div className="flex items-center bg-[#141620] border border-[#2a2e3e] rounded-lg overflow-hidden">
                  {(["day", "week", "month", "allTime"] as TimeWindow[]).map((tw) => (
                    <button
                      key={tw}
                      onClick={() => setTimeWindow(tw)}
                      className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                        timeWindow === tw ? "bg-[#7C3AED]/20 text-[#7C3AED]" : "text-[#848e9c] hover:text-white"
                      }`}
                    >
                      {tw === "allTime" ? "All" : tw === "day" ? "24h" : tw === "week" ? "7d" : "30d"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center bg-[#141620] border border-[#2a2e3e] rounded-lg overflow-hidden">
                  {([["pnl", "P&L"], ["roi", "ROI"], ["accountValue", "Value"], ["dayPnl", "24h"]] as [SortKey, string][]).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setSortKey(k)}
                      className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                        sortKey === k ? "bg-[#7C3AED]/20 text-[#7C3AED]" : "text-[#848e9c] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {lbLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-5 w-5 animate-spin text-[#848e9c]" />
              </div>
            ) : (
              <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
                  <span className="col-span-1">#</span>
                  <span className="col-span-3">Trader</span>
                  <span className="col-span-2 text-right">Account Value</span>
                  <span className="col-span-2 text-right">{timeWindow === "allTime" ? "All-Time" : timeWindow === "day" ? "24h" : timeWindow === "week" ? "7d" : "30d"} P&L</span>
                  <span className="col-span-2 text-right">ROI</span>
                  <span className="col-span-2 text-right">24h P&L</span>
                </div>
                {sortedLb.map((entry, i) => {
                  const perf = getPerf(entry, timeWindow);
                  const dayPerf = getPerf(entry, "day");
                  const pnl = parseFloat(perf.pnl);
                  const roi = parseFloat(perf.roi) * 100;
                  const dayPnl = parseFloat(dayPerf.pnl);
                  const av = parseFloat(entry.accountValue);
                  const name = entry.displayName || shortAddr(entry.ethAddress);
                  const isTop3 = i < 3;

                  return (
                    <button
                      key={entry.ethAddress}
                      onClick={() => selectTrader(entry.ethAddress)}
                      className="w-full grid grid-cols-12 items-center px-4 py-2.5 text-xs border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors text-left gap-y-1"
                    >
                      <span className={`col-span-1 font-bold ${isTop3 ? "text-amber-400" : "text-[#848e9c]"}`}>
                        {i + 1}
                      </span>
                      <div className="col-span-5 sm:col-span-3">
                        <span className="text-white font-medium text-xs truncate block">{name}</span>
                        <span className="text-[9px] text-[#848e9c] font-mono sm:hidden">{shortAddr(entry.ethAddress)}</span>
                        {entry.displayName && (
                          <span className="text-[9px] text-[#848e9c] font-mono hidden sm:block">{shortAddr(entry.ethAddress)}</span>
                        )}
                      </div>
                      <span className="col-span-2 text-right text-white hidden sm:block">{formatUsd(av)}</span>
                      <span className={`col-span-3 sm:col-span-2 text-right font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                      </span>
                      <span className={`col-span-3 sm:col-span-2 text-right font-medium ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                      </span>
                      <span className={`col-span-2 text-right hidden sm:block ${dayPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {dayPnl >= 0 ? "+" : ""}{formatUsd(dayPnl)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Trader Profile (when address selected) ── */}
        {activeAddress && (
          <div className="space-y-4">
            <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  {lbMatch?.displayName && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold">{lbMatch.displayName}</span>
                      {(() => {
                        const atPerf = getPerf(lbMatch, "allTime");
                        const atPnl = parseFloat(atPerf.pnl);
                        if (atPnl > 10_000_000) return <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">Whale</span>;
                        if (atPnl > 1_000_000) return <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#7C3AED]/15 text-[#7C3AED] font-medium">Top Trader</span>;
                        return null;
                      })()}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#848e9c] break-all">{activeAddress}</span>
                    <button onClick={copyAddress} className="text-[#848e9c] hover:text-white transition-colors shrink-0">
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <a href={`https://app.hyperliquid.xyz/explorer/address/${activeAddress}`} target="_blank" rel="noopener noreferrer" className="text-[#848e9c] hover:text-white transition-colors shrink-0">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={goBack} className="px-3 py-1.5 text-xs text-[#848e9c] border border-[#2a2e3e] rounded-lg hover:text-white hover:border-[#3a3e4e] transition-colors">
                    Back
                  </button>
                  <button onClick={() => loadTrader(activeAddress)} disabled={loading} className="px-3 py-1.5 text-xs text-[#7C3AED] border border-[#7C3AED]/30 rounded-lg hover:bg-[#7C3AED]/10 transition-colors disabled:opacity-50 flex items-center gap-1">
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {ch && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                    <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Account Value</p>
                    <p className="text-sm font-bold text-white">{formatUsd(accountValue)}</p>
                  </div>
                  <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                    <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Unrealized P&L</p>
                    <p className={`text-sm font-bold ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalUnrealizedPnl >= 0 ? "+" : ""}{formatUsd(totalUnrealizedPnl)}
                    </p>
                  </div>
                  <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                    <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Margin Used</p>
                    <p className="text-sm font-bold text-white">{formatUsd(totalMargin)}</p>
                  </div>
                  <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                    <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Available</p>
                    <p className="text-sm font-bold text-white">{formatUsd(withdrawable)}</p>
                  </div>
                </div>
              )}

              {lbMatch && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {(["day", "week", "month", "allTime"] as TimeWindow[]).map((tw) => {
                    const p = getPerf(lbMatch, tw);
                    const pnl = parseFloat(p.pnl);
                    const roi = parseFloat(p.roi) * 100;
                    const label = tw === "allTime" ? "All-Time" : tw === "day" ? "24h" : tw === "week" ? "7d" : "30d";
                    return (
                      <div key={tw} className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                        <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">{label} P&L</p>
                        <p className={`text-sm font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                        </p>
                        <p className={`text-[10px] ${roi >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                          {roi >= 0 ? "+" : ""}{roi.toFixed(2)}% ROI
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {loading && !ch && (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-5 w-5 animate-spin text-[#848e9c]" />
              </div>
            )}

            {ch && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 border-b border-[#2a2e3e]">
                  {(["positions", "fills"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setHistoryTab(tab)}
                      className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                        historyTab === tab ? "text-white border-[#7C3AED]" : "text-[#848e9c] border-transparent hover:text-white"
                      }`}
                    >
                      {tab === "positions" ? `Positions (${positions.length})` : `Recent Fills (${Math.min(fills.length, 100)})`}
                    </button>
                  ))}
                </div>

                {historyTab === "positions" && (
                  positions.length > 0 ? (
                    <div className="space-y-2">
                      {positions.map((ap) => {
                        const pos = ap.position;
                        const size = parseFloat(pos.szi);
                        const isLong = size > 0;
                        const pnl = parseFloat(pos.unrealizedPnl);
                        const roe = parseFloat(pos.returnOnEquity) * 100;
                        const entry = parseFloat(pos.entryPx ?? "0");
                        const bare = stripPrefix(pos.coin);
                        const market = markets.find((m) => stripPrefix(m.name) === bare) ?? markets.find((m) => m.name === pos.coin);
                        const markPx = market ? parseFloat(market.markPx) : 0;
                        const liqPx = pos.liquidationPx ? parseFloat(pos.liquidationPx) : null;
                        const margin = parseFloat(pos.marginUsed);
                        const notional = Math.abs(size) * markPx;
                        const displayCoin = market?.displayName ?? bare;
                        const leverageType = pos.leverage.type === "cross" ? "Cross" : "Isolated";
                        const fundingRate = market ? parseFloat(market.funding) : 0;

                        return (
                          <Link key={pos.coin} href={`/trade?coin=${market?.name ?? pos.coin}`} className="block bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden hover:border-[#3a3e4e] transition-colors">
                            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                              <div className="flex items-center gap-2.5">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                      {isLong ? "LONG" : "SHORT"}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2e3e] text-[#c0c4cc] font-medium">
                                      {pos.leverage.value}x {leverageType}
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold">{displayCoin} <span className="text-[10px] text-[#848e9c] font-normal">{bare}-USDC</span></p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <span className={`text-sm font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                                  </span>
                                  <span className={`text-[10px] font-medium ${roe >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    ({roe >= 0 ? "+" : ""}{roe.toFixed(1)}%)
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#848e9c]">{Math.abs(size).toFixed(size < 1 ? 5 : 2)} @ ${markPx.toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#2a2e3e]/30 border-t border-[#2a2e3e]/50">
                              <StatCell label="Entry Price" value={`$${entry.toLocaleString(undefined, { maximumFractionDigits: 4 })}`} />
                              <StatCell label="Liq. Price" value={liqPx ? `$${liqPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "–"} color="text-amber-400" />
                              <StatCell label="Margin" value={formatUsd(margin)} />
                              <StatCell label="Notional" value={formatUsd(notional)} />
                              <StatCell label="Mark Price" value={`$${markPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}`} />
                              <StatCell label="Funding" value={`${(fundingRate * 100).toFixed(4)}%/h`} color={fundingRate >= 0 ? "text-emerald-400" : "text-red-400"} />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[#848e9c] text-sm">No open positions</div>
                  )
                )}

                {historyTab === "fills" && (
                  sortedFills.length > 0 ? (
                    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
                      <div className="hidden sm:grid grid-cols-7 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
                        <span>Time</span>
                        <span>Pair</span>
                        <span>Side</span>
                        <span>Direction</span>
                        <span className="text-right">Price</span>
                        <span className="text-right">Size</span>
                        <span className="text-right">Closed P&L</span>
                      </div>
                      {sortedFills.map((f) => {
                        const px = parseFloat(f.px);
                        const sz = parseFloat(f.sz);
                        const pnl = parseFloat(f.closedPnl);
                        const isBuy = f.side === "B";
                        return (
                          <div key={f.tid} className="grid grid-cols-4 sm:grid-cols-7 items-center px-4 py-2 text-[11px] border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors gap-y-1">
                            <span className="text-[#848e9c] col-span-2 sm:col-span-1">
                              {new Date(f.time).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="text-white font-medium">{stripPrefix(f.coin)}</span>
                            <span className={`font-medium ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                              {isBuy ? "Buy" : "Sell"}
                            </span>
                            <span className="text-[#848e9c] hidden sm:block">{f.dir}</span>
                            <span className="text-right text-white">${px.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            <span className="text-right text-white">{sz.toFixed(sz < 1 ? 5 : 2)}</span>
                            <span className={`text-right font-medium ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pnl !== 0 ? `${pnl >= 0 ? "+" : ""}${formatUsd(pnl)}` : "–"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[#848e9c] text-sm">No fills found</div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#141620] px-3 py-2">
      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[11px] font-semibold ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}
