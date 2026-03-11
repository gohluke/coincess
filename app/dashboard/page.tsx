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
import { fetchCombinedClearinghouseState, fetchOpenOrders, fetchAllMarkets, fetchUserFills, fetchUserFunding, fetchSpotClearinghouseState } from "@/lib/hyperliquid/api";
import type { ClearinghouseState, OpenOrder, MarketInfo, AssetPosition, Fill, FundingPayment, SpotClearinghouseState } from "@/lib/hyperliquid/types";
import { useAutomationStore } from "@/lib/automation/store";
import { FundingBanner } from "@/components/FundingBanner";
import { BRAND, BRAND_CONFIG } from "@/lib/brand";
import { Skeleton, SkeletonCard, SkeletonChart } from "@/components/ui/Skeleton";
import PortfolioChart from "@/components/dashboard/PortfolioChart";

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
  const [spot, setSpot] = useState<SpotClearinghouseState | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [funding, setFunding] = useState<FundingPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [historyView, setHistoryView] = useState<"trades" | "fills" | "calendar">("trades");
  const [portfolioTab, setPortfolioTab] = useState<"assets" | "history" | "calendar">("assets");

  const automationInit = useAutomationStore((s) => s.init);
  const browserStrategies = useAutomationStore((s) => s.strategies);
  const [serverStrategies, setServerStrategies] = useState<{ status: string }[]>([]);

  const loadData = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const [chState, spotState, openOrders, allMarkets, userFills, userFunding, quantStatus] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchSpotClearinghouseState(addr).catch(() => null),
        fetchOpenOrders(addr),
        fetchAllMarkets(),
        fetchUserFills(addr),
        fetchUserFunding(addr),
        fetch("/api/quant/status").then((r) => r.json()).catch(() => ({ strategies: [] })),
      ]);
      setCh(chState);
      setSpot(spotState);
      setOrders(openOrders);
      setMarkets(allMarkets);
      setFills(userFills);
      setFunding(userFunding);
      setServerStrategies(quantStatus.strategies ?? []);
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
  const totalClosedPnl = fills.reduce((s, f) => s + parseFloat(f.closedPnl), 0);
  const totalFeesPaid = fills.reduce((s, f) => s + parseFloat(f.fee), 0);
  const totalFundingPnl = funding.reduce((s, fp) => s + parseFloat(fp.delta.usdc), 0);
  const totalPnlAll = totalClosedPnl - totalFeesPaid + totalFundingPnl;
  const winCount = closedTrades.filter((t) => t.netPnl > 0).length;
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length * 100).toFixed(0) : "–";

  const dailyPnl = useMemo(() => {
    const toLocalDate = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const map = new Map<string, { closed: number; fees: number; funding: number }>();
    for (const f of fills) {
      const day = toLocalDate(f.time);
      const entry = map.get(day) ?? { closed: 0, fees: 0, funding: 0 };
      entry.closed += parseFloat(f.closedPnl);
      entry.fees += parseFloat(f.fee);
      map.set(day, entry);
    }
    for (const fp of funding) {
      const day = toLocalDate(fp.time);
      const entry = map.get(day) ?? { closed: 0, fees: 0, funding: 0 };
      entry.funding += parseFloat(fp.delta.usdc);
      map.set(day, entry);
    }
    return map;
  }, [fills, funding]);

  const dailyFills = useMemo(() => {
    const toLocalDate = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const map = new Map<string, Fill[]>();
    for (const f of fills) {
      const day = toLocalDate(f.time);
      const arr = map.get(day) ?? [];
      arr.push(f);
      map.set(day, arr);
    }
    return map;
  }, [fills]);

  const totalPnl = positions.reduce((sum, ap) => sum + parseFloat(ap.position.unrealizedPnl), 0);
  const perpsAccountValue = parseFloat(ch?.marginSummary.accountValue ?? "0");
  const availableBalance = parseFloat(ch?.withdrawable ?? "0");
  const spotUsdcBalance = useMemo(() => {
    if (!spot?.balances) return 0;
    return spot.balances.reduce((sum, b) => {
      if (b.coin === "USDC" || b.coin === "USDT0" || b.coin === "USDE") {
        return sum + parseFloat(b.total);
      }
      return sum;
    }, 0);
  }, [spot]);

  const spotUsdcHold = useMemo(() => {
    if (!spot?.balances) return 0;
    return spot.balances.reduce((sum, b) => {
      if (b.coin === "USDC" || b.coin === "USDT0" || b.coin === "USDE") {
        return sum + parseFloat(b.hold);
      }
      return sum;
    }, 0);
  }, [spot]);

  // In unified mode, spot USDC `total` already includes perps backing — don't add them.
  const accountValue = spotUsdcBalance > 0 ? spotUsdcBalance : perpsAccountValue;
  const activeStrategies =
    serverStrategies.filter((s) => s.status === "active").length +
    browserStrategies.filter((s) => s.status === "active").length;

  const assetDistribution = useMemo(() => {
    const items: { label: string; value: number; color: string }[] = [];
    const freeUsdc = spotUsdcBalance > 0 ? spotUsdcBalance - spotUsdcHold : availableBalance;
    if (freeUsdc > 0.01) items.push({ label: "USDC", value: freeUsdc, color: "#2775CA" });
    for (const ap of positions) {
      const pos = ap.position;
      const bare = stripPrefix(pos.coin);
      const margin = parseFloat(pos.marginUsed);
      if (margin > 0.01) items.push({ label: bare, value: margin, color: parseFloat(pos.szi) > 0 ? "#0ecb81" : "#f6465d" });
    }
    if (items.length === 0 && accountValue > 0) items.push({ label: "USDC", value: accountValue, color: BRAND.hex });
    return items;
  }, [spotUsdcBalance, spotUsdcHold, availableBalance, positions, accountValue]);

  const assetTotal = assetDistribution.reduce((s, a) => s + a.value, 0);

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_CONFIG.assets.logoSvg}
            alt={BRAND_CONFIG.name}
            className="w-20 h-20 mb-8"
          />
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
            Welcome to {BRAND_CONFIG.name}
          </h1>
          <p className="text-sm text-[#848e9c] mb-10 max-w-md leading-relaxed">
            {BRAND_CONFIG.description}
          </p>
          <button
            onClick={connect}
            className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-brand/25"
          >
            <LogIn className="h-4 w-4" />
            Connect Wallet
          </button>
          <div className="flex gap-6 mt-10">
            <Link href="/trade/BTC" className="text-xs text-[#848e9c] hover:text-white transition-colors flex items-center gap-1">
              Trade <span className="text-brand">&rarr;</span>
            </Link>
            <Link href="/predict" className="text-xs text-[#848e9c] hover:text-white transition-colors flex items-center gap-1">
              Predict <span className="text-brand">&rarr;</span>
            </Link>
            <Link href="/coins" className="text-xs text-[#848e9c] hover:text-white transition-colors flex items-center gap-1">
              Discover <span className="text-brand">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const perpsBalance = perpsAccountValue;
  const freeSpotBalance = spotUsdcBalance > 0 ? spotUsdcBalance - spotUsdcHold : availableBalance;
  const evmBalance = 0;
  const firstLoad = !ch && loading;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ─── Tabs ─── */}
        <div className="flex items-center gap-6 border-b border-[#2a2e3e] pb-0">
          {([
            ["assets", "Assets"],
            ["history", "Transaction History"],
            ["calendar", "PnL Calendar"],
          ] as ["assets" | "history" | "calendar", string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setPortfolioTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                portfolioTab === t ? "text-white border-brand" : "text-[#848e9c] border-transparent hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── Assets Tab ─── */}
        {portfolioTab === "assets" && (
          <>
            {/* Hero: Total Balance */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#848e9c] mb-1">Total Balance</p>
                {firstLoad ? (
                  <Skeleton className="h-12 w-48 mt-1" />
                ) : (
                  <p className="text-4xl sm:text-5xl font-bold tracking-tight">{formatUsd(accountValue)}</p>
                )}
                {!firstLoad && fills.length > 0 && (
                  <p className="mt-1.5">
                    <span className={`text-sm font-semibold ${totalPnlAll >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ({totalPnlAll >= 0 ? "+" : ""}{formatUsd(totalPnlAll)})
                    </span>
                    {accountValue > 0 && (
                      <span className={`text-sm font-medium ml-1.5 ${totalPnlAll >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {totalPnlAll >= 0 ? "+" : ""}{((totalPnlAll / Math.max(accountValue, 1)) * 100).toFixed(2)}%
                      </span>
                    )}
                  </p>
                )}
                {firstLoad && <Skeleton className="h-4 w-32 mt-2" />}
              </div>
              <div className="flex items-center gap-2">
                {lastRefresh && (
                  <span className="text-[10px] text-[#848e9c] hidden sm:inline">
                    Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
                <button onClick={() => loadData(address)} className="p-2 text-[#848e9c] hover:text-white transition-colors" disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <span className="text-xs text-[#848e9c] font-mono hidden sm:inline">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
            </div>

            {/* Balance cards 2x2 */}
            {firstLoad ? (
              <div className="grid grid-cols-2 gap-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">Available Balance</p>
                  <p className="text-xl font-bold">{formatUsd(freeSpotBalance)}</p>
                </div>
                <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">USDC (Perps)</p>
                  <p className="text-xl font-bold">{formatUsd(perpsBalance)}</p>
                </div>
                <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">Spot Balance</p>
                  <p className="text-xl font-bold">{formatUsd(freeSpotBalance)}</p>
                </div>
                <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">EVM Balance</p>
                  <p className="text-xl font-bold">{formatUsd(evmBalance)}</p>
                </div>
              </div>
            )}

            {/* Portfolio chart — Account Value / PNL over time */}
            {firstLoad ? (
              <SkeletonChart className="h-[280px]" />
            ) : fills.length > 0 ? (
              <PortfolioChart fills={fills} currentAccountValue={accountValue} />
            ) : null}

            {/* Donut chart */}
            {firstLoad ? (
              <SkeletonChart className="h-[280px]" />
            ) : (
              <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-6">
                <div className="flex items-center justify-center">
                  <DonutChart items={assetDistribution} total={assetTotal > 0 ? assetTotal : accountValue} />
                </div>

                {/* Asset Distribution list */}
                {assetDistribution.length > 0 && (
                  <div className="mt-6 space-y-1">
                    <p className="text-sm font-semibold text-brand mb-2">Asset Distribution</p>
                    {assetDistribution.map((a) => (
                      <div key={a.label} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                          <span className="text-sm text-white">{a.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-brand">{assetTotal > 0 ? ((a.value / assetTotal) * 100).toFixed(1) : "0.0"}%</span>
                          <span className="text-sm font-semibold">{formatUsd(a.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Funding banner when no balance */}
            {accountValue <= 0 && (
              <FundingBanner address={address} balance={availableBalance} />
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <Link href="/trade/BTC" className="flex items-center gap-3 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5 hover:border-brand/50 transition-colors">
                <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Trade</p>
                  <p className="text-[10px] text-[#848e9c]">Perps</p>
                </div>
              </Link>
              <Link href="/predict" className="flex items-center gap-3 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5 hover:border-brand/50 transition-colors">
                <BarChart3 className="h-5 w-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Predict</p>
                  <p className="text-[10px] text-[#848e9c]">Markets</p>
                </div>
              </Link>
              <Link href="/automate" className="flex items-center gap-3 bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5 hover:border-brand/50 transition-colors">
                <Bot className="h-5 w-5 text-brand shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Automate</p>
                  <p className="text-[10px] text-[#848e9c]">
                    {firstLoad ? <Skeleton className="h-3 w-12 inline-block" /> : `${activeStrategies} active`}
                  </p>
                </div>
              </Link>
            </div>

            {/* Positions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">
                  Positions {firstLoad ? "" : `(${positions.length})`}
                </h2>
                <Link href="/trade/BTC" className="text-xs text-brand hover:underline">Open Trade &rarr;</Link>
              </div>
              {firstLoad ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-10 rounded" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-8 bg-[#141620] border border-[#2a2e3e] rounded-xl">
                  <Wallet className="h-6 w-6 text-[#848e9c] mx-auto mb-2" />
                  <p className="text-sm text-[#848e9c]">No open positions</p>
                  {accountValue > 0 && (
                    <p className="text-xs text-[#848e9c] mt-1">{formatUsd(accountValue)} USDC available to trade</p>
                  )}
                  <Link href="/trade/BTC" className="inline-block mt-3 text-xs text-brand hover:underline">Open a position &rarr;</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((ap) => (
                    <PositionRow key={ap.position.coin} ap={ap} markets={markets} funding={funding} fills={fills} />
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
            {browserStrategies.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Automation</h2>
                  <Link href="/automate" className="text-xs text-brand hover:underline">Manage &rarr;</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {browserStrategies.slice(0, 4).map((s) => (
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
          </>
        )}

        {/* ─── Transaction History Tab ─── */}
        {portfolioTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex bg-[#1a1d2e] rounded-lg p-0.5 text-[10px]">
                {(["trades", "fills"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setHistoryView(v === "trades" ? "trades" : "fills")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${historyView === v ? "bg-brand text-white" : "text-[#848e9c] hover:text-white"}`}
                  >
                    {v === "trades" ? `Trades (${trades.length})` : `Fills (${fills.length})`}
                  </button>
                ))}
              </div>
              <a
                href={`https://app.hyperliquid.xyz/explorer/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand hover:underline inline-flex items-center gap-1"
              >
                Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Aggregate stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Total PnL</p>
                <p className={`text-sm font-bold ${totalPnlAll >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalPnlAll >= 0 ? "+" : ""}{formatUsd(totalPnlAll)}
                </p>
              </div>
              <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Closed PnL</p>
                <p className={`text-sm font-bold ${totalClosedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalClosedPnl >= 0 ? "+" : ""}{formatUsd(totalClosedPnl)}
                </p>
              </div>
              <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Funding</p>
                <p className={`text-sm font-bold ${totalFundingPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalFundingPnl >= 0 ? "+" : ""}{formatUsd(totalFundingPnl)}
                </p>
              </div>
              <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Win Rate</p>
                <p className="text-sm font-bold text-white">
                  {winRate}%
                  <span className="text-[10px] text-[#848e9c] font-normal ml-1">({winCount}/{closedTrades.length})</span>
                </p>
              </div>
            </div>

            {historyView === "trades" || historyView === "fills" ? (
              historyView === "trades" ? (
                trades.length > 0 ? (
                  <div className="space-y-2">
                    {trades.map((trade, i) => (
                      <TradeRow key={`${trade.coin}-${trade.openTime}-${i}`} trade={trade} positions={positions} markets={markets} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#848e9c] text-sm">No trades yet</div>
                )
              ) : (
                fills.length > 0 ? (
                  <TransactionTable fills={fills} />
                ) : (
                  <div className="text-center py-12 text-[#848e9c] text-sm">No fills yet</div>
                )
              )
            ) : null}
          </div>
        )}

        {/* ─── PnL Calendar Tab ─── */}
        {portfolioTab === "calendar" && (
          <PnlCalendar dailyPnl={dailyPnl} dailyFills={dailyFills} totalClosedPnl={totalClosedPnl} totalFundingPnl={totalFundingPnl} totalPnlAll={totalPnlAll} />
        )}

        
      </div>
    </div>
  );
}

/* ---------- Donut Chart ---------- */

function DonutChart({ items, total }: { items: { label: string; value: number; color: string }[]; total: number }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 85;
  const stroke = 24;

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#2a2e3e" strokeWidth={stroke} />
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#848e9c" fontSize="12">Total</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">$0.00</text>
      </svg>
    );
  }

  let cumAngle = -90;
  const arcs = items.map((item) => {
    const pct = item.value / total;
    const angle = pct * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    return { ...item, startAngle, angle };
  });

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc, i) => {
        const largeArc = arc.angle > 180 ? 1 : 0;
        const startX = cx + radius * Math.cos(toRad(arc.startAngle));
        const startY = cy + radius * Math.sin(toRad(arc.startAngle));
        const endX = cx + radius * Math.cos(toRad(arc.startAngle + arc.angle - 0.5));
        const endY = cy + radius * Math.sin(toRad(arc.startAngle + arc.angle - 0.5));

        return (
          <path
            key={i}
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#848e9c" fontSize="12">Total</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
        {formatUsd(total)}
      </text>
    </svg>
  );
}

function stripPrefix(coin: string): string {
  const idx = coin.indexOf(":");
  return idx >= 0 ? coin.slice(idx + 1) : coin;
}

function TradeRow({ trade, positions, markets }: { trade: RoundTripTrade; positions: AssetPosition[]; markets: MarketInfo[] }) {
  const [expanded, setExpanded] = useState(false);
  const bare = stripPrefix(trade.coin);
  const duration = trade.closeTime ? trade.closeTime - trade.openTime : Date.now() - trade.openTime;
  const isWin = trade.netPnl > 0;

  const matchPos = trade.isOpen ? positions.find((ap) => stripPrefix(ap.position.coin) === bare) : null;
  const leverage = matchPos ? `${matchPos.position.leverage.value}x` : null;

  const market = markets.find((m) => stripPrefix(m.name) === bare) ?? markets.find((m) => m.name === trade.coin);
  const markPx = market ? parseFloat(market.markPx) : 0;

  const hasPhantom = !trade.isOpen && trade.exitPx != null && markPx > 0;
  let phantomPnl = 0;
  let ifHeldPnl = 0;
  if (hasPhantom) {
    phantomPnl = trade.direction === "Long"
      ? (markPx - trade.exitPx!) * trade.maxSize
      : (trade.exitPx! - markPx) * trade.maxSize;
    ifHeldPnl = trade.direction === "Long"
      ? (markPx - trade.entryPx) * trade.maxSize
      : (trade.entryPx - markPx) * trade.maxSize;
  }

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
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                  {trade.netPnl >= 0 ? "+" : ""}{formatUsd(trade.netPnl)}
                </span>
                {hasPhantom && Math.abs(phantomPnl) > 0.01 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    phantomPnl > 0
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    {phantomPnl > 0 ? `Missed ${formatUsd(phantomPnl)}` : `Saved ${formatUsd(Math.abs(phantomPnl))}`}
                  </span>
                )}
              </div>
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
          {hasPhantom && (
            <span>Now: <span className="text-brand font-medium">${markPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
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

          {/* Phantom P&L for closed trades */}
          {hasPhantom && (
            <div className="bg-[#0b0e11]/80 border border-[#2a2e3e]/60 rounded-lg px-3 py-2">
              <p className="text-[10px] text-[#848e9c] font-medium mb-1.5 flex items-center gap-1">
                <span className="text-brand">&#9673;</span> Phantom P&L <span className="text-[#848e9c]/60">— if you had kept this position</span>
              </p>
              <div className="flex flex-wrap items-center gap-4 text-[10px]">
                <div>
                  <span className="text-[#848e9c]">If Held P&L: </span>
                  <span className={`font-bold ${ifHeldPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {ifHeldPnl >= 0 ? "+" : ""}{formatUsd(ifHeldPnl)}
                  </span>
                </div>
                <div>
                  <span className="text-[#848e9c]">You Made: </span>
                  <span className={`font-medium ${trade.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {trade.netPnl >= 0 ? "+" : ""}{formatUsd(trade.netPnl)}
                  </span>
                </div>
                <div>
                  <span className="text-[#848e9c]">{phantomPnl > 0 ? "Missed: " : "Saved: "}</span>
                  <span className={`font-bold ${phantomPnl > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {formatUsd(Math.abs(phantomPnl))}
                  </span>
                </div>
                <div>
                  <span className="text-[#848e9c]">Mark: </span>
                  <span className="text-brand font-medium">${markPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                {(() => {
                  const moveFromExit = trade.exitPx! > 0
                    ? ((markPx - trade.exitPx!) / trade.exitPx!) * 100
                    : 0;
                  return (
                    <div>
                      <span className="text-[#848e9c]">Since Exit: </span>
                      <span className={`font-medium ${moveFromExit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {moveFromExit >= 0 ? "+" : ""}{moveFromExit.toFixed(2)}%
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

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

function PositionRow({ ap, markets, funding, fills }: { ap: AssetPosition; markets: MarketInfo[]; funding: FundingPayment[]; fills: Fill[] }) {
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
  const margin = parseFloat(pos.marginUsed);
  const displayCoin = market?.displayName ?? bare;
  const tradeCoin = market?.name ?? pos.coin;
  const leverageType = pos.leverage.type === "cross" ? "Cross" : "Isolated";
  const currentFundingRate = market ? parseFloat(market.funding) : 0;

  const cumFunding = useMemo(() =>
    funding.filter((fp) => stripPrefix(fp.delta.coin) === bare).reduce((s, fp) => s + parseFloat(fp.delta.usdc), 0),
    [funding, bare]
  );

  const entryTime = useMemo(() => {
    const openFills = fills
      .filter((f) => stripPrefix(f.coin) === bare && f.dir.toLowerCase().includes("open"))
      .sort((a, b) => a.time - b.time);
    return openFills.length > 0 ? openFills[0].time : null;
  }, [fills, bare]);

  return (
    <Link href={`/trade/${tradeCoin}`} className="block bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden hover:border-[#3a3e4e] transition-colors">
      {/* Top: coin name, direction, and PnL */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${size > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {size > 0 ? "LONG" : "SHORT"}
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
            <PnlBadge value={pnl} />
            <span className={`text-[10px] font-medium ${roe >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              ({roe >= 0 ? "+" : ""}{roe.toFixed(1)}%)
            </span>
          </div>
          <p className="text-[10px] text-[#848e9c]">{Math.abs(size).toFixed(size < 1 ? 5 : 2)} @ ${markPx.toLocaleString()}</p>
        </div>
      </div>

      {/* Coinglass-style detail grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#2a2e3e]/30 border-t border-[#2a2e3e]/50">
        <DetailCell label="Entry Price" value={`$${entry.toLocaleString(undefined, { maximumFractionDigits: 4 })}`} />
        <DetailCell
          label="Liq. Price"
          value={liqPx != null && liqPx > 0 ? `$${liqPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "–"}
          valueColor={liqDistance != null && liqDistance < 10 ? "text-red-400" : "text-amber-400"}
          sub={liqDistance != null ? `${liqDistance.toFixed(1)}% away` : undefined}
        />
        <DetailCell label="Margin" value={formatUsd(margin)} />
        <DetailCell
          label="Funding Fee"
          value={`${cumFunding >= 0 ? "+" : ""}${formatUsd(cumFunding)}`}
          valueColor={cumFunding >= 0 ? "text-emerald-400" : "text-red-400"}
          sub={`${(currentFundingRate * 100).toFixed(4)}%/h`}
        />
        <DetailCell label="Notional" value={formatUsd(notional)} />
        <DetailCell
          label="Entry Time"
          value={entryTime ? new Date(entryTime).toLocaleString([], { hour: "2-digit", minute: "2-digit" }) : "–"}
          sub={entryTime ? new Date(entryTime).toLocaleDateString([], { month: "2-digit", day: "2-digit" }) : undefined}
        />
      </div>
    </Link>
  );
}

function DetailCell({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
  return (
    <div className="bg-[#141620] px-3 py-2">
      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[11px] font-semibold ${valueColor ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-[9px] text-[#848e9c]">{sub}</p>}
    </div>
  );
}

// ── Based-style Transaction History table ──────────────────

function TransactionTable({ fills }: { fills: Fill[] }) {
  const sorted = [...fills].sort((a, b) => b.time - a.time);
  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e3e]">
        <p className="text-xs font-semibold text-white">Transaction History</p>
        <p className="text-[10px] text-[#848e9c]">Total: {fills.length}</p>
      </div>
      {/* Header */}
      <div className="grid grid-cols-7 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
        <span>Date</span>
        <span>Pair</span>
        <span>Type</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
        <span className="text-right">Status</span>
      </div>
      {/* Rows */}
      {sorted.map((f) => {
        const px = parseFloat(f.px);
        const sz = parseFloat(f.sz);
        const total = px * sz;
        const isBuy = f.side === "B";
        return (
          <div key={f.tid} className="grid grid-cols-7 items-center px-4 py-2.5 text-xs border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors">
            <span className="text-[#848e9c]">
              {new Date(f.time).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="text-white font-medium">{stripPrefix(f.coin)}-USDC</span>
            <span className={`font-medium ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
              {isBuy ? "Buy" : "Sell"}
            </span>
            <span className="text-right text-white">{px.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 4 })}</span>
            <span className="text-right text-white">{sz.toFixed(sz < 1 ? 5 : 2)}</span>
            <span className="text-right text-white">{formatUsd(total)}</span>
            <span className="text-right text-[#848e9c]">Completed</span>
          </div>
        );
      })}
    </div>
  );
}

// ── PnL Calendar ──────────────────────────────────────────

function PnlCalendar({
  dailyPnl,
  dailyFills,
  totalClosedPnl,
  totalFundingPnl,
  totalPnlAll,
}: {
  dailyPnl: Map<string, { closed: number; fees: number; funding: number }>;
  dailyFills: Map<string, Fill[]>;
  totalClosedPnl: number;
  totalFundingPnl: number;
  totalPnlAll: number;
}) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const firstDay = new Date(calMonth.year, calMonth.month, 1);
  const lastDay = new Date(calMonth.year, calMonth.month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const today = new Date();
  const isToday = (d: number) =>
    calMonth.year === today.getFullYear() && calMonth.month === today.getMonth() && d === today.getDate();

  const monthStr = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  const prevMonth = () => {
    setCalMonth((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    setCalMonth((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }));
    setSelectedDay(null);
  };

  let monthTotalPnl = 0;
  let monthClosedPnl = 0;
  let monthFunding = 0;
  let profitDays = 0;
  let lossDays = 0;
  let profitAmt = 0;
  let lossAmt = 0;

  const dayKeys: string[] = [];
  const dayPnls: (number | null)[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const key = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dayKeys.push(key);
    const entry = dailyPnl.get(key);
    if (entry) {
      const dayNet = entry.closed - entry.fees + entry.funding;
      dayPnls.push(dayNet);
      monthTotalPnl += dayNet;
      monthClosedPnl += entry.closed;
      monthFunding += entry.funding;
      if (dayNet > 0) { profitDays++; profitAmt += dayNet; }
      else if (dayNet < 0) { lossDays++; lossAmt += dayNet; }
    } else {
      dayPnls.push(null);
    }
  }

  const totalBarWidth = Math.abs(profitAmt) + Math.abs(lossAmt);
  const profitPct = totalBarWidth > 0 ? (Math.abs(profitAmt) / totalBarWidth) * 100 : 50;

  const selectedFills = selectedDay ? (dailyFills.get(selectedDay) ?? []).sort((a, b) => b.time - a.time) : [];
  const selectedPnlEntry = selectedDay ? dailyPnl.get(selectedDay) : null;

  return (
    <div className="space-y-3">
      {/* Header with month nav */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="text-[#848e9c] hover:text-white p-1">&lt;</button>
        <h3 className="text-base font-bold text-white">{monthStr}</h3>
        <button onClick={nextMonth} className="text-[#848e9c] hover:text-white p-1">&gt;</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Total PnL</p>
          <p className={`text-sm font-bold ${monthTotalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {monthTotalPnl >= 0 ? "+" : ""}{formatUsd(monthTotalPnl)}
          </p>
        </div>
        <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Closed PnL</p>
          <p className={`text-sm font-bold ${monthClosedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {monthClosedPnl >= 0 ? "+" : ""}{formatUsd(monthClosedPnl)}
          </p>
        </div>
        <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Profitable Days</p>
          <p className="text-sm font-bold text-white">{profitDays} / {profitDays + lossDays}</p>
        </div>
        <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Funding</p>
          <p className={`text-sm font-bold ${monthFunding >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {monthFunding >= 0 ? "+" : ""}{formatUsd(monthFunding)}
          </p>
        </div>
      </div>

      {/* Profit/Loss ratio bar */}
      <div>
        <p className="text-[10px] text-[#848e9c] mb-1">Profit/Loss Ratio</p>
        <div className="h-2.5 rounded-full overflow-hidden flex bg-[#1a1d2e]">
          <div className="bg-emerald-500 transition-all" style={{ width: `${profitPct}%` }} />
          <div className="bg-red-500 transition-all" style={{ width: `${100 - profitPct}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[10px]">
          <span className="text-emerald-400">{profitDays}/{formatUsd(profitAmt)}</span>
          <span className="text-red-400">{lossDays}/{formatUsd(lossAmt)}</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#2a2e3e]">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
            <div key={d} className="text-center text-[10px] text-[#848e9c] font-medium py-2 border-r border-[#2a2e3e]/30 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square border-r border-b border-[#2a2e3e]/20" />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const key = dayKeys[i];
            const pnl = dayPnls[i];
            const hasData = pnl !== null;
            const isProfit = hasData && pnl > 0;
            const isLoss = hasData && pnl < 0;
            const isSelected = selectedDay === key;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : (hasData ? key : null))}
                className={`aspect-square border-r border-b border-[#2a2e3e]/20 p-1 relative transition-colors text-left ${
                  isSelected
                    ? "ring-2 ring-brand ring-inset bg-brand/10"
                    : isProfit ? "bg-emerald-500/15 hover:bg-emerald-500/25" : isLoss ? "bg-red-500/15 hover:bg-red-500/25" : hasData ? "hover:bg-[#1a1d2e]" : ""
                } ${hasData ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`text-[10px] font-medium ${isToday(day) ? "text-brand font-bold" : "text-[#848e9c]"}`}>
                  {day}
                </span>
                {hasData && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-[10px] font-bold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                      {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && selectedPnlEntry && (
        <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e3e]">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-white">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              {(() => {
                const net = selectedPnlEntry.closed - selectedPnlEntry.fees + selectedPnlEntry.funding;
                return (
                  <span className={`text-xs font-bold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {net >= 0 ? "+" : ""}{formatUsd(net)}
                  </span>
                );
              })()}
            </div>
            <button onClick={() => setSelectedDay(null)} className="text-[#848e9c] hover:text-white text-xs px-2 py-1 rounded hover:bg-[#2a2e3e] transition-colors">
              Close
            </button>
          </div>

          {/* Day P&L summary */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2 text-[10px] border-b border-[#2a2e3e]/50">
            <div>
              <span className="text-[#848e9c]">Closed P&L: </span>
              <span className={selectedPnlEntry.closed >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {selectedPnlEntry.closed >= 0 ? "+" : ""}{formatUsd(selectedPnlEntry.closed)}
              </span>
            </div>
            <div>
              <span className="text-[#848e9c]">Fees: </span>
              <span className="text-amber-400 font-medium">-{formatUsd(selectedPnlEntry.fees)}</span>
            </div>
            <div>
              <span className="text-[#848e9c]">Funding: </span>
              <span className={selectedPnlEntry.funding >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {selectedPnlEntry.funding >= 0 ? "+" : ""}{formatUsd(selectedPnlEntry.funding)}
              </span>
            </div>
          </div>

          {/* Fill list */}
          {selectedFills.length > 0 ? (
            <div className="divide-y divide-[#2a2e3e]/30 max-h-[300px] overflow-y-auto">
              {selectedFills.map((f) => {
                const px = parseFloat(f.px);
                const sz = parseFloat(f.sz);
                const pnl = parseFloat(f.closedPnl);
                const isBuy = f.side === "B";
                return (
                  <div key={f.tid} className="flex items-center justify-between px-4 py-2 text-[10px] hover:bg-[#1a1d2e]/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                      <span className="text-white font-medium">{stripPrefix(f.coin)}</span>
                      <span className="text-[#848e9c]">{f.dir}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white">{sz.toFixed(sz < 1 ? 5 : 2)} @ ${px.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                      {pnl !== 0 && (
                        <span className={`font-medium ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                        </span>
                      )}
                      <span className="text-[#848e9c]">
                        {new Date(f.time).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-4 text-center text-[10px] text-[#848e9c]">No fills for this day (funding only)</div>
          )}
        </div>
      )}
    </div>
  );
}
