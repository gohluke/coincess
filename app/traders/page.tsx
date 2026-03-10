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
  Crosshair,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import {
  fetchCombinedClearinghouseState,
  fetchOpenOrders,
  fetchAllMarkets,
  fetchUserFills,
  fetchUserFunding,
  fetchLeaderboard,
  fetchSpotClearinghouseState,
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
import type { SpotClearinghouseState } from "@/lib/hyperliquid/types";

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

interface ScanResult {
  address: string;
  displayName: string | null;
  coin: string;
  side: "Long" | "Short";
  size: number;
  entryPx: number;
  markPx: number;
  leverage: number;
  unrealizedPnl: number;
  positionValue: number;
  accountValue: number;
  returnOnPosition: number;
  entryTime: number | null;
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ${min % 60}m`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ${hrs % 24}h`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d`;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
  const [spotState, setSpotState] = useState<SpotClearinghouseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyTab, setHistoryTab] = useState<"positions" | "fills" | "spot">("positions");

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("allTime");
  const [lbSearch, setLbSearch] = useState("");
  const [mainTab, setMainTab] = useState<"leaderboard" | "scanner">("leaderboard");

  const [scanCoin, setScanCoin] = useState("");
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [allMarkets, setAllMarkets] = useState<MarketInfo[]>([]);

  useEffect(() => {
    fetchLeaderboard()
      .then(setLeaderboard)
      .catch(console.error)
      .finally(() => setLbLoading(false));
    fetchAllMarkets().then(setAllMarkets).catch(console.error);
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

  const coinSuggestions = useMemo(() => {
    const names = allMarkets.map((m) => stripPrefix(m.name));
    return [...new Set(names)].sort();
  }, [allMarkets]);

  const scanForContract = useCallback(async (coin: string) => {
    if (!coin || leaderboard.length === 0) return;
    setScanning(true);
    setScanResults([]);
    const target = coin.toUpperCase();
    const topTraders = [...leaderboard]
      .sort((a, b) => parseFloat(b.accountValue) - parseFloat(a.accountValue))
      .slice(0, 100);
    setScanProgress({ done: 0, total: topTraders.length });

    const results: ScanResult[] = [];
    const BATCH = 10;
    for (let i = 0; i < topTraders.length; i += BATCH) {
      const batch = topTraders.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map((t) => fetchCombinedClearinghouseState(t.ethAddress).then((ch) => ({ trader: t, ch })))
      );
      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        const { trader, ch } = r.value;
        for (const ap of ch.assetPositions) {
          const name = stripPrefix(ap.position.coin).toUpperCase();
          if (name !== target) continue;
          const szi = parseFloat(ap.position.szi);
          if (Math.abs(szi) === 0) continue;
          const entryPx = parseFloat(ap.position.entryPx ?? "0");
          const markInfo = allMarkets.find(
            (m) => stripPrefix(m.name).toUpperCase() === target
          );
          const markPrice = markInfo ? parseFloat(markInfo.markPx) : entryPx;
          const uPnl = parseFloat(ap.position.unrealizedPnl);
          const posVal = parseFloat(ap.position.positionValue);
          results.push({
            address: trader.ethAddress,
            displayName: trader.displayName,
            coin: ap.position.coin,
            side: szi > 0 ? "Long" : "Short",
            size: Math.abs(szi),
            entryPx,
            markPx: markPrice,
            leverage: ap.position.leverage?.value ?? 0,
            unrealizedPnl: uPnl,
            positionValue: posVal,
            accountValue: parseFloat(trader.accountValue),
            returnOnPosition: posVal > 0 ? (uPnl / posVal) * 100 : 0,
            entryTime: null,
          });
        }
      }
      setScanProgress({ done: Math.min(i + BATCH, topTraders.length), total: topTraders.length });
      setScanResults([...results].sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl)));
    }

    // Second pass: fetch fills for matched traders to find entry time
    if (results.length > 0) {
      const uniqueAddrs = [...new Set(results.map((r) => r.address))];
      const FILL_BATCH = 5;
      for (let i = 0; i < uniqueAddrs.length; i += FILL_BATCH) {
        const batch = uniqueAddrs.slice(i, i + FILL_BATCH);
        const settled = await Promise.allSettled(
          batch.map((addr) => fetchUserFills(addr).then((f) => ({ addr, fills: f })))
        );
        for (const r of settled) {
          if (r.status !== "fulfilled") continue;
          const { addr, fills: traderFills } = r.value;
          const coinFills = traderFills
            .filter((f) => stripPrefix(f.coin).toUpperCase() === target)
            .sort((a, b) => a.time - b.time);
          if (coinFills.length > 0) {
            for (const sr of results) {
              if (sr.address === addr) {
                sr.entryTime = coinFills[0].time;
              }
            }
          }
        }
        setScanResults([...results].sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl)));
      }
    }

    setScanning(false);
  }, [leaderboard, allMarkets]);

  const loadTrader = useCallback(async (addr: string) => {
    if (!addr || !addr.startsWith("0x")) return;
    setLoading(true);
    try {
      const [chData, ordersData, marketsData, fillsData, fundingData, spotData] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchOpenOrders(addr),
        fetchAllMarkets(),
        fetchUserFills(addr),
        fetchUserFunding(addr),
        fetchSpotClearinghouseState(addr).catch(() => null),
      ]);
      setCh(chData);
      setOrders(ordersData);
      setMarkets(marketsData);
      setFills(fillsData);
      setFunding(fundingData);
      setSpotState(spotData);
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
    setSpotState(null);
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

  const spotTotalUsd = useMemo(() => {
    if (!spotState?.balances) return 0;
    return spotState.balances.reduce((sum, b) => {
      const total = parseFloat(b.total);
      if (b.coin === "USDC" || b.coin === "USDT") return sum + total;
      return sum + parseFloat(b.entryNtl || "0");
    }, 0);
  }, [spotState]);

  const totalAccountValue = accountValue + spotTotalUsd;

  const realizedPnl = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let total = 0, d1 = 0, d2 = 0, d7 = 0, d30 = 0;
    for (const f of fills) {
      const pnl = parseFloat(f.closedPnl);
      if (pnl === 0) continue;
      total += pnl;
      const age = now - f.time;
      if (age <= day) d1 += pnl;
      if (age <= 2 * day) d2 += pnl;
      if (age <= 7 * day) d7 += pnl;
      if (age <= 30 * day) d30 += pnl;
    }
    return { total, d1, d2, d7, d30 };
  }, [fills]);

  const totalPnl = realizedPnl.total + totalUnrealizedPnl;

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
                <Users className="h-5 w-5 text-[#FF455B]" />
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
              className="w-full bg-[#141620] border border-[#2a2e3e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-[#FF455B] transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-[#FF455B] text-white rounded-lg text-sm font-medium hover:bg-[#E63B50] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>

        {/* ── Tab Switch (when no address selected) ── */}
        {!activeAddress && (
          <div className="space-y-3">
            <div className="flex items-center gap-1 bg-[#141620] border border-[#2a2e3e] rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setMainTab("leaderboard")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mainTab === "leaderboard" ? "bg-[#FF455B]/20 text-[#FF455B]" : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Trophy className="h-3.5 w-3.5" /> Leaderboard
              </button>
              <button
                onClick={() => setMainTab("scanner")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mainTab === "scanner" ? "bg-[#FF455B]/20 text-[#FF455B]" : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" /> Contract Scanner
              </button>
            </div>

            {/* ── Contract Scanner ── */}
            {mainTab === "scanner" && (
              <div className="space-y-3">
                <p className="text-[11px] text-[#848e9c]">
                  Search a contract to see who among the top 100 traders (by account value) has open positions.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Crosshair className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#848e9c]" />
                    <input
                      type="text"
                      value={scanCoin}
                      onChange={(e) => setScanCoin(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && scanForContract(scanCoin)}
                      placeholder="Type contract name (e.g. BRENTOIL, BTC, WTI, GOLD...)"
                      className="w-full bg-[#141620] border border-[#2a2e3e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-[#FF455B] transition-colors"
                      list="coin-suggestions"
                    />
                    <datalist id="coin-suggestions">
                      {coinSuggestions.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    onClick={() => scanForContract(scanCoin)}
                    disabled={scanning || !scanCoin}
                    className="px-5 py-2.5 bg-[#FF455B] text-white rounded-lg text-sm font-medium hover:bg-[#E63B50] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                  >
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Scan
                  </button>
                </div>

                {/* Quick picks */}
                <div className="flex flex-wrap gap-1.5">
                  {["BRENTOIL", "BTC", "ETH", "SOL", "GOLD", "WTI", "HYPE", "DOGE", "XRP", "SUI"].map((c) => (
                    <button
                      key={c}
                      onClick={() => { setScanCoin(c); scanForContract(c); }}
                      className="px-2.5 py-1 bg-[#1a1d2e] border border-[#2a2e3e] rounded-md text-[10px] text-[#848e9c] hover:text-white hover:border-[#FF455B]/50 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Progress bar */}
                {scanning && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#848e9c]">
                      <span>Scanning top traders for {scanCoin} positions...</span>
                      <span>{scanProgress.done}/{scanProgress.total}</span>
                    </div>
                    <div className="w-full bg-[#2a2e3e] rounded-full h-1.5">
                      <div
                        className="bg-[#FF455B] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: scanProgress.total > 0 ? `${(scanProgress.done / scanProgress.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                )}

                {/* Results */}
                {scanResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-white">
                      {scanResults.length} trader{scanResults.length === 1 ? "" : "s"} holding {scanCoin}
                    </h3>
                    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
                      <div className="hidden lg:grid grid-cols-[2.5fr_0.7fr_1.2fr_1.5fr_0.6fr_1.5fr_0.7fr_1.8fr] px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium gap-2">
                        <span>Trader</span>
                        <span className="text-center">Side</span>
                        <span className="text-right">Size</span>
                        <span className="text-right">Entry / Mark</span>
                        <span className="text-right">Lev</span>
                        <span className="text-right">Unrealized P&L</span>
                        <span className="text-right">ROI</span>
                        <span className="text-right">Opened</span>
                      </div>
                      {scanResults.map((r, i) => {
                        const now = Date.now();
                        const ago = r.entryTime ? formatDuration(now - r.entryTime) : null;
                        return (
                        <button
                          key={`${r.address}-${i}`}
                          onClick={() => selectTrader(r.address)}
                          className="w-full grid grid-cols-12 lg:grid-cols-[2.5fr_0.7fr_1.2fr_1.5fr_0.6fr_1.5fr_0.7fr_1.8fr] items-center px-4 py-3 text-xs border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors text-left gap-y-1 gap-x-2"
                        >
                          <div className="col-span-6 lg:col-span-1">
                            <span className="text-white font-medium text-xs truncate block">
                              {r.displayName || shortAddr(r.address)}
                            </span>
                            {r.displayName && (
                              <span className="text-[9px] text-[#848e9c] font-mono">{shortAddr(r.address)}</span>
                            )}
                          </div>
                          <div className="col-span-3 lg:col-span-1 text-center">
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              r.side === "Long" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
                            }`}>
                              {r.side === "Long" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {r.side}
                            </span>
                          </div>
                          <span className="col-span-3 lg:col-span-1 text-right text-white">{formatUsd(r.positionValue)}</span>
                          <div className="hidden lg:block text-right">
                            <span className="text-[#848e9c] text-[10px]">{r.entryPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            <span className="text-[#848e9c] mx-0.5">/</span>
                            <span className="text-white text-[10px]">{r.markPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                          <span className="hidden lg:block text-right text-[#848e9c]">{r.leverage}x</span>
                          <span className={`col-span-6 lg:col-span-1 text-right font-bold ${r.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {r.unrealizedPnl >= 0 ? "+" : ""}{formatUsd(r.unrealizedPnl)}
                          </span>
                          <span className={`hidden lg:block text-right text-[10px] font-medium ${r.returnOnPosition >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {r.returnOnPosition >= 0 ? "+" : ""}{r.returnOnPosition.toFixed(1)}%
                          </span>
                          <div className="col-span-6 lg:col-span-1 text-right">
                            {r.entryTime ? (
                              <div>
                                <span className="text-[10px] text-[#848e9c]">{formatDateTime(r.entryTime)}</span>
                                <span className="flex items-center justify-end gap-0.5 text-[9px] text-[#5a6070]">
                                  <Clock className="h-2.5 w-2.5" /> {ago} ago
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#2a2e3e]">loading...</span>
                            )}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!scanning && scanResults.length === 0 && scanProgress.total > 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Crosshair className="h-8 w-8 text-[#2a2e3e] mb-3" />
                    <p className="text-sm text-[#848e9c]">No top-100 traders have open {scanCoin} positions</p>
                    <p className="text-xs text-[#2a2e3e] mt-1">Try a different contract or check back later</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Leaderboard ── */}
            {mainTab === "leaderboard" && (
              <>
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
                        className="bg-[#141620] border border-[#2a2e3e] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-[#848e9c] focus:outline-none focus:border-[#FF455B] transition-colors w-full sm:w-52"
                      />
                    </div>
                    <div className="flex items-center bg-[#141620] border border-[#2a2e3e] rounded-lg overflow-hidden">
                      {(["day", "week", "month", "allTime"] as TimeWindow[]).map((tw) => (
                        <button
                          key={tw}
                          onClick={() => setTimeWindow(tw)}
                          className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                            timeWindow === tw ? "bg-[#FF455B]/20 text-[#FF455B]" : "text-[#848e9c] hover:text-white"
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
                            sortKey === k ? "bg-[#FF455B]/20 text-[#FF455B]" : "text-[#848e9c] hover:text-white"
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
              </>
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
                        if (atPnl > 1_000_000) return <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FF455B]/15 text-[#FF455B] font-medium">Top Trader</span>;
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
                  <button onClick={() => loadTrader(activeAddress)} disabled={loading} className="px-3 py-1.5 text-xs text-[#FF455B] border border-[#FF455B]/30 rounded-lg hover:bg-[#FF455B]/10 transition-colors disabled:opacity-50 flex items-center gap-1">
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {ch && (
                <>
                  {/* P&L Summary Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5 border-l-2 border-[#FF455B]">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Total P&L</p>
                      <p className={`text-sm font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {totalPnl >= 0 ? "+" : ""}{formatUsd(totalPnl)}
                      </p>
                    </div>
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">24h P&L</p>
                      <p className={`text-sm font-bold ${realizedPnl.d1 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {realizedPnl.d1 >= 0 ? "+" : ""}{formatUsd(realizedPnl.d1)}
                      </p>
                    </div>
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">48h P&L</p>
                      <p className={`text-sm font-bold ${realizedPnl.d2 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {realizedPnl.d2 >= 0 ? "+" : ""}{formatUsd(realizedPnl.d2)}
                      </p>
                    </div>
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">7d P&L</p>
                      <p className={`text-sm font-bold ${realizedPnl.d7 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {realizedPnl.d7 >= 0 ? "+" : ""}{formatUsd(realizedPnl.d7)}
                      </p>
                    </div>
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">30d P&L</p>
                      <p className={`text-sm font-bold ${realizedPnl.d30 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {realizedPnl.d30 >= 0 ? "+" : ""}{formatUsd(realizedPnl.d30)}
                      </p>
                    </div>
                  </div>

                  {/* Account Overview Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Perps Position Value</p>
                      <p className="text-sm font-bold text-white">{formatUsd(accountValue)}</p>
                      <div className="text-[10px] text-[#5a6070] mt-0.5 space-y-px">
                        <p>Positions: {positions.length}</p>
                        <p>Margin: {formatUsd(totalMargin)}</p>
                      </div>
                    </div>
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Account Total Value</p>
                      <p className="text-sm font-bold text-white">{formatUsd(totalAccountValue)}</p>
                      <div className="text-[10px] text-[#5a6070] mt-0.5 space-y-px">
                        <p>Perpetual: {formatUsd(accountValue)}</p>
                        <p>Spot: {formatUsd(spotTotalUsd)}</p>
                      </div>
                    </div>
                    <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Free Margin Available</p>
                      <p className="text-sm font-bold text-white">{formatUsd(withdrawable)}</p>
                      <div className="text-[10px] text-[#5a6070] mt-0.5 space-y-px">
                        <p>Withdrawable: {accountValue > 0 ? `${((withdrawable / accountValue) * 100).toFixed(1)}%` : "–"}</p>
                        <p>Unrealized: <span className={totalUnrealizedPnl >= 0 ? "text-emerald-400/70" : "text-red-400/70"}>{totalUnrealizedPnl >= 0 ? "+" : ""}{formatUsd(totalUnrealizedPnl)}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Spot Balances (if any) */}
                  {spotState && spotState.balances.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1.5">Spot Holdings</p>
                      <div className="flex flex-wrap gap-2">
                        {spotState.balances
                          .filter((b) => parseFloat(b.total) > 0)
                          .map((b) => (
                          <div key={b.coin} className="bg-[#0b0e11] rounded-lg px-3 py-1.5 flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{b.coin}</span>
                            <span className="text-xs text-[#848e9c]">{parseFloat(b.total).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {lbMatch && (
                <div className="mt-3">
                  <p className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1.5">Leaderboard Stats</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  {(["positions", "fills", "spot"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setHistoryTab(tab)}
                      className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                        historyTab === tab ? "text-white border-[#FF455B]" : "text-[#848e9c] border-transparent hover:text-white"
                      }`}
                    >
                      {tab === "positions" ? `Positions (${positions.length})` : tab === "fills" ? `Recent Fills (${Math.min(fills.length, 100)})` : `Spot Holdings (${spotState?.balances.filter((b) => parseFloat(b.total) > 0).length ?? 0})`}
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

                {historyTab === "spot" && (
                  spotState && spotState.balances.filter((b) => parseFloat(b.total) > 0).length > 0 ? (
                    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
                      <div className="grid grid-cols-3 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
                        <span>Token</span>
                        <span className="text-right">Balance</span>
                        <span className="text-right">On Hold</span>
                      </div>
                      {spotState.balances
                        .filter((b) => parseFloat(b.total) > 0)
                        .map((b) => {
                          const total = parseFloat(b.total);
                          const hold = parseFloat(b.hold);
                          return (
                            <div key={b.coin} className="grid grid-cols-3 items-center px-4 py-2.5 text-xs border-b border-[#2a2e3e]/20">
                              <span className="text-white font-medium">{b.coin}</span>
                              <span className="text-right text-white">{total.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                              <span className="text-right text-[#848e9c]">{hold > 0 ? hold.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "–"}</span>
                            </div>
                          );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[#848e9c] text-sm">No spot holdings</div>
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
