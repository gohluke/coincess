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
  Star,
  Trophy,
  Crosshair,
  TrendingUp,
  TrendingDown,
  Loader2,
  Flame,
} from "lucide-react";
import {
  fetchAllMarkets,
  fetchCombinedClearinghouseState,
  fetchLeaderboard,
  fetchUserFills,
  fetchCoincessTraderStats,
} from "@/lib/hyperliquid/api";
import type { MarketInfo, Fill } from "@/lib/hyperliquid/types";
import type { LeaderboardEntry, CoincessTraderStats } from "@/lib/hyperliquid/api";
import { getTrackedAddresses, starTrader, unstarTrader, getStarredTraders, fetchTrackedTradersFromSupabase } from "@/lib/coincess/tracker";
import { useWallet } from "@/hooks/useWallet";

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
  const { address: myAddress } = useWallet();

  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("allTime");
  const [lbSearch, setLbSearch] = useState("");
  const [mainTab, setMainTab] = useState<"starred" | "coincess" | "leaderboard" | "scanner">(
    "coincess"
  );

  const [coincessStats, setCoincessStats] = useState<CoincessTraderStats[]>([]);
  const [coincessLoading, setCoincessLoading] = useState(true);
  const [coincessSort, setCoincessSort] = useState<"volume" | "pnl" | "trades">("volume");

  const [scanCoin, setScanCoin] = useState("");
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [allMarkets, setAllMarkets] = useState<MarketInfo[]>([]);

  const [starred, setStarred] = useState<Set<string>>(new Set());

  // Load starred traders when wallet connects
  useEffect(() => {
    if (!myAddress) return;
    getStarredTraders(myAddress).then((addrs) => setStarred(new Set(addrs)));
  }, [myAddress]);

  const toggleStar = useCallback(async (traderAddr: string) => {
    if (!myAddress) return;
    const key = traderAddr.toLowerCase();
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        unstarTrader(myAddress, traderAddr);
      } else {
        next.add(key);
        starTrader(myAddress, traderAddr);
      }
      return next;
    });
  }, [myAddress]);

  useEffect(() => {
    fetchLeaderboard()
      .then(async (lb) => {
        setLeaderboard(lb);
        try {
          const tracked = await fetchTrackedTradersFromSupabase();
          const addresses = tracked.map((t) => t.address);
          if (addresses.length === 0) {
            const local = getTrackedAddresses();
            if (local.length > 0) {
              const stats = await fetchCoincessTraderStats(local, lb);
              setCoincessStats(stats);
            }
          } else {
            const volumeMap = new Map(
              tracked.map((t) => [
                t.address,
                { coincessVolume: t.coincessVolume, coincessTradeCount: t.orderCount },
              ]),
            );
            const stats = await fetchCoincessTraderStats(addresses, lb, volumeMap);
            setCoincessStats(stats);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setCoincessLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setCoincessLoading(false);
      })
      .finally(() => setLbLoading(false));
    fetchAllMarkets().then(setAllMarkets).catch(console.error);
  }, []);

  const sortedCoincess = useMemo(() => {
    return [...coincessStats].sort((a, b) => {
      if (coincessSort === "pnl") return b.pnlAll - a.pnlAll;
      if (coincessSort === "trades") return b.coincessTradeCount - a.coincessTradeCount;
      return b.coincessVolume - a.coincessVolume;
    });
  }, [coincessStats, coincessSort]);

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

  const handleSearch = () => {
    const addr = searchInput.trim();
    if (!addr.startsWith("0x") || addr.length < 10) return;
    router.push(`/trader/${addr}`);
  };

  const selectTrader = (addr: string) => {
    router.push(`/trader/${addr}`);
  };

  useEffect(() => {
    if (addrParam && addrParam.startsWith("0x")) {
      router.replace(`/trader/${addrParam}`);
    }
  }, [addrParam, router]);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white pb-20 md:pb-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" />
              Trader Lookup
            </h1>
            <p className="text-xs text-[#848e9c] mt-1">
              {`Search any wallet or browse the top ${leaderboard.length.toLocaleString()} traders on Hyperliquid`}
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
              className="w-full bg-[#141620] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>

        {/* ── Tab Switch ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-1 bg-[#141620] rounded-lg p-0.5 w-fit">
              {starred.size > 0 && (
                <button
                  onClick={() => setMainTab("starred")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mainTab === "starred" ? "bg-amber-400/20 text-amber-400" : "text-[#848e9c] hover:text-white"
                  }`}
                >
                  <Star className="h-3.5 w-3.5 fill-current" /> Starred ({starred.size})
                </button>
              )}
              <button
                onClick={() => setMainTab("coincess")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mainTab === "coincess" ? "bg-brand/20 text-brand" : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Flame className="h-3.5 w-3.5" /> Coincess
              </button>
              <button
                onClick={() => setMainTab("leaderboard")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mainTab === "leaderboard" ? "bg-brand/20 text-brand" : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Trophy className="h-3.5 w-3.5" /> Hyperliquid
              </button>
              <button
                onClick={() => setMainTab("scanner")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mainTab === "scanner" ? "bg-brand/20 text-brand" : "text-[#848e9c] hover:text-white"
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" /> Scanner
              </button>
            </div>

            {/* ── Starred Traders ── */}
            {mainTab === "starred" && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  Starred Traders
                  <span className="text-[10px] text-[#848e9c] font-normal ml-1">{starred.size} trader{starred.size !== 1 ? "s" : ""}</span>
                </h2>
                <div className="bg-[#141620] rounded-xl overflow-hidden">
                  <div className="hidden sm:grid grid-cols-12 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
                    <span className="col-span-1"></span>
                    <span className="col-span-5">Address</span>
                    <span className="col-span-3 text-right">Account Value</span>
                    <span className="col-span-3 text-right">Actions</span>
                  </div>
                  {[...starred].map((addr, i) => {
                    const lbEntry = leaderboard.find((e) => e.ethAddress.toLowerCase() === addr);
                    const name = lbEntry?.displayName || shortAddr(addr);
                    const av = lbEntry ? parseFloat(lbEntry.accountValue) : null;
                    return (
                      <div
                        key={addr}
                        className="grid grid-cols-12 items-center px-4 py-2.5 text-xs hover:bg-[#1a1d2e]/50 transition-colors border-b border-[#2a2e3e]/10 last:border-0"
                      >
                        <span className="col-span-1 text-[#848e9c]">{i + 1}</span>
                        <button onClick={() => selectTrader(addr)} className="col-span-5 text-left">
                          <span className="text-white font-medium text-xs truncate block">{name}</span>
                          <span className="text-[9px] text-[#848e9c] font-mono">{shortAddr(addr)}</span>
                        </button>
                        <button onClick={() => selectTrader(addr)} className="col-span-3 text-right text-white font-medium">
                          {av !== null ? formatUsd(av) : "–"}
                        </button>
                        <div className="col-span-3 flex items-center justify-end gap-2">
                          <button
                            onClick={() => selectTrader(addr)}
                            className="px-2.5 py-1 text-[10px] text-brand bg-brand/10 rounded-md hover:bg-brand/20 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => toggleStar(addr)}
                            className="p-1 text-amber-400 hover:text-red-400 transition-colors"
                            title="Unstar"
                          >
                            <Star className="h-3 w-3 fill-current" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Coincess Traders ── */}
            {mainTab === "coincess" && (
              <>
                {coincessLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="h-5 w-5 animate-spin text-[#848e9c]" />
                  </div>
                ) : sortedCoincess.length === 0 ? (
                  /* ── Empty state ── */
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#141620] via-[#141620] to-[#1a1020]">
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                      backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                      backgroundSize: "24px 24px",
                    }} />
                    <div className="relative flex flex-col items-center justify-center py-20 px-6 text-center">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 blur-2xl bg-brand/20 rounded-full scale-150" />
                        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center">
                          <Trophy className="h-9 w-9 text-brand" />
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">
                        The Leaderboard Awaits
                      </h3>
                      <p className="text-sm text-[#848e9c] max-w-md mb-8 leading-relaxed">
                        Be among the first traders on Coincess. Top volume and PnL traders
                        earn rewards, recognition, and future CNC token airdrops.
                      </p>
                      <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8">
                        <div className="bg-[#0b0e11]/60 rounded-xl px-3 py-4/50">
                          <div className="text-2xl mb-1">🥇</div>
                          <p className="text-[10px] text-[#848e9c] uppercase tracking-wider">Top Volume</p>
                          <p className="text-xs text-white font-semibold mt-1">Unclaimed</p>
                        </div>
                        <div className="bg-[#0b0e11]/60 rounded-xl px-3 py-4/50">
                          <div className="text-2xl mb-1">📈</div>
                          <p className="text-[10px] text-[#848e9c] uppercase tracking-wider">Top PnL</p>
                          <p className="text-xs text-white font-semibold mt-1">Unclaimed</p>
                        </div>
                        <div className="bg-[#0b0e11]/60 rounded-xl px-3 py-4/50">
                          <div className="text-2xl mb-1">⚡</div>
                          <p className="text-[10px] text-[#848e9c] uppercase tracking-wider">Most Active</p>
                          <p className="text-xs text-white font-semibold mt-1">Unclaimed</p>
                        </div>
                      </div>
                      <Link
                        href="/trade/BTC"
                        className="px-6 py-2.5 bg-brand text-white rounded-full text-sm font-semibold hover:bg-brand-hover transition-colors"
                      >
                        Start Trading
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* ── Coincess leaderboard with data ── */
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-brand" />
                        Coincess Traders
                        <span className="text-[10px] text-[#848e9c] font-normal ml-1">
                          {sortedCoincess.length} trader{sortedCoincess.length !== 1 ? "s" : ""}
                        </span>
                      </h2>
                      <div className="flex items-center bg-[#141620] rounded-lg overflow-hidden">
                        {([["volume", "Volume"], ["pnl", "P&L"], ["trades", "Trades"]] as [typeof coincessSort, string][]).map(([k, label]) => (
                          <button
                            key={k}
                            onClick={() => setCoincessSort(k)}
                            className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
                              coincessSort === k ? "bg-brand/20 text-brand" : "text-[#848e9c] hover:text-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#141620] rounded-xl overflow-hidden">
                      <div className="hidden sm:grid grid-cols-12 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
                        <span className="col-span-1">#</span>
                        <span className="col-span-3">Trader</span>
                        <span className="col-span-2 text-right">Volume</span>
                        <span className="col-span-2 text-right">P&L</span>
                        <span className="col-span-1 text-right">Trades</span>
                        <span className="col-span-1 text-right">Top Coin</span>
                        <span className="col-span-2 text-right">Account Value</span>
                      </div>
                      {sortedCoincess.map((trader, i) => {
                        const isTop3 = i < 3;
                        const isStarred = starred.has(trader.address.toLowerCase());
                        return (
                          <div
                            key={trader.address}
                            className="w-full grid grid-cols-12 items-center px-4 py-2.5 text-xs border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors text-left gap-y-1"
                          >
                            <span className={`col-span-1 font-bold flex items-center gap-1 ${isTop3 ? "text-amber-400" : "text-[#848e9c]"}`}>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleStar(trader.address); }}
                                className="shrink-0"
                              >
                                <Star className={`h-3 w-3 transition-colors ${isStarred ? "fill-amber-400 text-amber-400" : "text-[#2a2e3e] hover:text-[#848e9c]"}`} />
                              </button>
                              {i + 1}
                            </span>
                            <button onClick={() => selectTrader(trader.address)} className="col-span-5 sm:col-span-3 text-left">
                              <span className="text-white font-medium text-xs truncate block">
                                {trader.displayName || shortAddr(trader.address)}
                              </span>
                              <span className="text-[9px] text-[#848e9c] font-mono">{shortAddr(trader.address)}</span>
                            </button>
                            <button onClick={() => selectTrader(trader.address)} className="col-span-3 sm:col-span-2 text-right text-white font-medium">
                              {formatUsd(trader.coincessVolume || trader.volumeAll)}
                            </button>
                            <button onClick={() => selectTrader(trader.address)} className={`col-span-3 sm:col-span-2 text-right font-bold ${trader.pnlAll >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {trader.pnlAll >= 0 ? "+" : ""}{formatUsd(trader.pnlAll)}
                            </button>
                            <button onClick={() => selectTrader(trader.address)} className="hidden sm:block col-span-1 text-right text-[#848e9c]">
                              {(trader.coincessTradeCount || trader.tradeCount).toLocaleString()}
                            </button>
                            <button onClick={() => selectTrader(trader.address)} className="hidden sm:block col-span-1 text-right text-white text-[10px]">
                              {trader.topCoin ?? "–"}
                            </button>
                            <button onClick={() => selectTrader(trader.address)} className="hidden sm:block col-span-2 text-right text-white">
                              {formatUsd(trader.accountValue)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

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
                      className="w-full bg-[#141620] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand transition-colors"
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
                    className="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
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
                      className="px-2.5 py-1 bg-[#1a1d2e] rounded-md text-[10px] text-[#848e9c] hover:text-white hover:border-brand/50 transition-colors"
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
                        className="bg-brand h-1.5 rounded-full transition-all duration-300"
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
                    <div className="bg-[#141620] rounded-xl overflow-hidden">
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
                        className="bg-[#141620] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-[#848e9c] focus:outline-none focus:border-brand transition-colors w-full sm:w-52"
                      />
                    </div>
                    <div className="flex items-center bg-[#141620] rounded-lg overflow-hidden">
                      {(["day", "week", "month", "allTime"] as TimeWindow[]).map((tw) => (
                        <button
                          key={tw}
                          onClick={() => setTimeWindow(tw)}
                          className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                            timeWindow === tw ? "bg-brand/20 text-brand" : "text-[#848e9c] hover:text-white"
                          }`}
                        >
                          {tw === "allTime" ? "All" : tw === "day" ? "24h" : tw === "week" ? "7d" : "30d"}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center bg-[#141620] rounded-lg overflow-hidden">
                      {([["pnl", "P&L"], ["roi", "ROI"], ["accountValue", "Value"], ["dayPnl", "24h"]] as [SortKey, string][]).map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => setSortKey(k)}
                          className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                            sortKey === k ? "bg-brand/20 text-brand" : "text-[#848e9c] hover:text-white"
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
                  <div className="bg-[#141620] rounded-xl overflow-hidden">
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
                      const isStarred = starred.has(entry.ethAddress.toLowerCase());

                      return (
                        <div
                          key={entry.ethAddress}
                          className="w-full grid grid-cols-12 items-center px-4 py-2.5 text-xs border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors text-left gap-y-1"
                        >
                          <span className={`col-span-1 font-bold flex items-center gap-1 ${isTop3 ? "text-amber-400" : "text-[#848e9c]"}`}>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStar(entry.ethAddress); }}
                              className="shrink-0"
                            >
                              <Star className={`h-3 w-3 transition-colors ${isStarred ? "fill-amber-400 text-amber-400" : "text-[#2a2e3e] hover:text-[#848e9c]"}`} />
                            </button>
                            {i + 1}
                          </span>
                          <button onClick={() => selectTrader(entry.ethAddress)} className="col-span-5 sm:col-span-3 text-left">
                            <span className="text-white font-medium text-xs truncate block">{name}</span>
                            <span className="text-[9px] text-[#848e9c] font-mono sm:hidden">{shortAddr(entry.ethAddress)}</span>
                            {entry.displayName && (
                              <span className="text-[9px] text-[#848e9c] font-mono hidden sm:block">{shortAddr(entry.ethAddress)}</span>
                            )}
                          </button>
                          <button onClick={() => selectTrader(entry.ethAddress)} className="col-span-2 text-right text-white hidden sm:block">{formatUsd(av)}</button>
                          <button onClick={() => selectTrader(entry.ethAddress)} className={`col-span-3 sm:col-span-2 text-right font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                          </button>
                          <button onClick={() => selectTrader(entry.ethAddress)} className={`col-span-3 sm:col-span-2 text-right font-medium ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                          </button>
                          <button onClick={() => selectTrader(entry.ethAddress)} className={`col-span-2 text-right hidden sm:block ${dayPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {dayPnl >= 0 ? "+" : ""}{formatUsd(dayPnl)}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
      </div>
    </div>
  );
}
