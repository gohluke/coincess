"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  Check,
  Star,
  ChevronLeft,
  RefreshCw,
  ExternalLink,
  ArrowRightLeft,
  Clock,
  TrendingUp,
  TrendingDown,
  Shield,
  Activity,
  BarChart3,
  Wallet,
  CircleDollarSign,
  Percent,
  Target,
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
  Fill,
  FundingPayment,
  SpotClearinghouseState,
} from "@/lib/hyperliquid/types";
import type { LeaderboardEntry } from "@/lib/hyperliquid/api";
import { getStarredTraders, starTrader, unstarTrader } from "@/lib/coincess/tracker";
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

type TimeWindow = "day" | "week" | "month" | "allTime";

function getPerf(entry: LeaderboardEntry, window: TimeWindow) {
  const p = entry.windowPerformances.find((w) => w[0] === window);
  return p ? p[1] : { pnl: "0", roi: "0", vlm: "0" };
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

function DonutChart({ segments, size = 120, strokeWidth = 14 }: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0);
  let offset = 0;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e2030" strokeWidth={strokeWidth} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e2030" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const rotation = (offset * 360) - 90;
        offset += pct;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            className="transition-all duration-700"
          />
        );
      })}
    </svg>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-[#1e2030] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

type PnlRange = "1D" | "1W" | "1M" | "ALL";

function PnlChart({ fills, range }: { fills: Fill[]; range: PnlRange }) {
  const data = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const cutoff = range === "1D" ? now - day : range === "1W" ? now - 7 * day : range === "1M" ? now - 30 * day : 0;
    const relevant = fills
      .filter((f) => f.time >= cutoff && parseFloat(f.closedPnl) !== 0)
      .sort((a, b) => a.time - b.time);
    if (relevant.length === 0) return [];

    let cumPnl = 0;
    const points: { time: number; pnl: number }[] = [{ time: relevant[0].time, pnl: 0 }];
    for (const f of relevant) {
      cumPnl += parseFloat(f.closedPnl);
      points.push({ time: f.time, pnl: cumPnl });
    }
    return points;
  }, [fills, range]);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-[#848e9c] text-xs">
        No P&L data for this period
      </div>
    );
  }

  const W = 600;
  const H = 200;
  const PAD_L = 0;
  const PAD_R = 55;
  const PAD_T = 10;
  const PAD_B = 28;

  const minTime = data[0].time;
  const maxTime = data[data.length - 1].time;
  const pnlValues = data.map((d) => d.pnl);
  const minPnl = Math.min(0, ...pnlValues);
  const maxPnl = Math.max(0, ...pnlValues);
  const pnlRange = maxPnl - minPnl || 1;

  const toX = (t: number) => PAD_L + ((t - minTime) / (maxTime - minTime || 1)) * (W - PAD_L - PAD_R);
  const toY = (p: number) => PAD_T + (1 - (p - minPnl) / pnlRange) * (H - PAD_T - PAD_B);
  const zeroY = toY(0);

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(d.time).toFixed(1)},${toY(d.pnl).toFixed(1)}`).join(" ");

  const lastPnl = data[data.length - 1].pnl;
  const isPositive = lastPnl >= 0;
  const mainColor = isPositive ? "#10b981" : "#ef4444";

  const positiveParts: string[] = [];
  const negativeParts: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const x = toX(d.time).toFixed(1);
    const y = toY(d.pnl).toFixed(1);
    const zy = zeroY.toFixed(1);
    if (d.pnl >= 0) {
      positiveParts.push(i === 0 || data[i - 1].pnl < 0 ? `M${x},${zy} L${x},${y}` : `L${x},${y}`);
    } else {
      negativeParts.push(i === 0 || data[i - 1].pnl >= 0 ? `M${x},${zy} L${x},${y}` : `L${x},${y}`);
    }
  }

  const areaAbove = data
    .filter((d) => d.pnl >= 0)
    .map((d) => `${toX(d.time).toFixed(1)},${toY(d.pnl).toFixed(1)}`)
    .join(" ");
  const areaBelow = data
    .filter((d) => d.pnl < 0)
    .map((d) => `${toX(d.time).toFixed(1)},${toY(d.pnl).toFixed(1)}`)
    .join(" ");

  const fullAreaPath = `M${toX(data[0].time).toFixed(1)},${zeroY.toFixed(1)} ${linePath.replace(/^M/, "L")} L${toX(data[data.length - 1].time).toFixed(1)},${zeroY.toFixed(1)} Z`;

  const formatDate = (t: number) => {
    const d = new Date(t);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const ticks = 5;
  const timeStep = (maxTime - minTime) / (ticks - 1);
  const pnlTicks = 5;
  const pnlStep = pnlRange / (pnlTicks - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pnl-grad-pos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="pnl-grad-neg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Zero line */}
      <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="#2a2e3e" strokeWidth="0.5" strokeDasharray="3,3" />

      {/* Area fill */}
      <path d={fullAreaPath} fill={isPositive ? "url(#pnl-grad-pos)" : "url(#pnl-grad-neg)"} />

      {/* Line */}
      <path d={linePath} fill="none" stroke={mainColor} strokeWidth="1.5" strokeLinejoin="round" />

      {/* Time axis labels */}
      {Array.from({ length: ticks }).map((_, i) => {
        const t = minTime + i * timeStep;
        return (
          <text key={i} x={toX(t)} y={H - 4} textAnchor="middle" className="fill-[#5a6070]" fontSize="9">
            {formatDate(t)}
          </text>
        );
      })}

      {/* PnL axis labels */}
      {Array.from({ length: pnlTicks }).map((_, i) => {
        const val = maxPnl - i * pnlStep;
        return (
          <text key={i} x={W - PAD_R + 4} y={toY(val) + 3} textAnchor="start" className="fill-[#5a6070]" fontSize="8">
            ${val >= 0 ? "" : ""}{Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toFixed(0)}
          </text>
        );
      })}

      {/* Current value annotation */}
      <rect x={W - PAD_R + 1} y={toY(lastPnl) - 7} width={PAD_R - 3} height={14} rx="2" fill={mainColor} />
      <text x={W - PAD_R + 4} y={toY(lastPnl) + 3} textAnchor="start" className="fill-white font-bold" fontSize="8">
        ${Math.abs(lastPnl) >= 1000 ? `${(lastPnl / 1000).toFixed(2)}K` : lastPnl.toFixed(2)}
      </text>
    </svg>
  );
}

export default function TraderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const address = (params.address as string) ?? "";
  const { address: myAddress } = useWallet();

  const [ch, setCh] = useState<ClearinghouseState | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [funding, setFunding] = useState<FundingPayment[]>([]);
  const [spotState, setSpotState] = useState<SpotClearinghouseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"perp" | "spot" | "orders" | "fills" | "funding">("perp");
  const [pnlRange, setPnlRange] = useState<PnlRange>("1W");
  const [lbMatch, setLbMatch] = useState<LeaderboardEntry | null>(null);
  const [starred, setStarred] = useState(false);

  const loadTrader = useCallback(async (addr: string) => {
    if (!addr || !addr.startsWith("0x")) return;
    setLoading(true);
    try {
      const [chData, ordersData, marketsData, fillsData, fundingData, spotData, lb] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchOpenOrders(addr),
        fetchAllMarkets(),
        fetchUserFills(addr),
        fetchUserFunding(addr),
        fetchSpotClearinghouseState(addr).catch(() => null),
        fetchLeaderboard().catch(() => [] as LeaderboardEntry[]),
      ]);
      setCh(chData);
      setOrders(ordersData);
      setMarkets(marketsData);
      setFills(fillsData);
      setFunding(fundingData);
      setSpotState(spotData);
      const match = lb.find((e) => e.ethAddress.toLowerCase() === addr.toLowerCase());
      setLbMatch(match ?? null);
    } catch (err) {
      console.error("Failed to load trader data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address) loadTrader(address);
  }, [address, loadTrader]);

  useEffect(() => {
    if (!myAddress || !address) return;
    getStarredTraders(myAddress).then((addrs) => {
      setStarred(addrs.includes(address.toLowerCase()));
    });
  }, [myAddress, address]);

  const toggleStar = async () => {
    if (!myAddress) return;
    if (starred) {
      await unstarTrader(myAddress, address);
      setStarred(false);
    } else {
      await starTrader(myAddress, address);
      setStarred(true);
    }
  };

  const positions = ch?.assetPositions?.filter(
    (ap) => Math.abs(parseFloat(ap.position.szi)) > 0
  ) ?? [];

  const accountValue = parseFloat(ch?.marginSummary.accountValue ?? "0");
  const totalNtlPos = parseFloat(ch?.marginSummary.totalNtlPos ?? "0");
  const totalMargin = parseFloat(ch?.marginSummary.totalMarginUsed ?? "0");
  const withdrawable = parseFloat(ch?.withdrawable ?? "0");
  const totalUnrealizedPnl = positions.reduce(
    (s, ap) => s + parseFloat(ap.position.unrealizedPnl), 0
  );

  const spotTotalUsd = useMemo(() => {
    if (!spotState?.balances) return 0;
    return spotState.balances.reduce((sum, b) => {
      const total = parseFloat(b.total);
      if (total === 0) return sum;
      if (b.coin === "USDC" || b.coin === "USDT") return sum + total;
      return sum + parseFloat(b.entryNtl || "0");
    }, 0);
  }, [spotState]);

  // In unified mode, spotTotalUsd already includes USDC locked as perp margin.
  // Only add unrealized PnL to avoid double-counting margin.
  const totalAccountValue = spotTotalUsd > 0
    ? spotTotalUsd + totalUnrealizedPnl
    : accountValue;

  const longExposure = positions.reduce((s, ap) => {
    const sz = parseFloat(ap.position.szi);
    if (sz > 0) {
      const bare = stripPrefix(ap.position.coin);
      const market = markets.find((m) => stripPrefix(m.name) === bare);
      return s + Math.abs(sz) * parseFloat(market?.markPx ?? "0");
    }
    return s;
  }, 0);

  const shortExposure = positions.reduce((s, ap) => {
    const sz = parseFloat(ap.position.szi);
    if (sz < 0) {
      const bare = stripPrefix(ap.position.coin);
      const market = markets.find((m) => stripPrefix(m.name) === bare);
      return s + Math.abs(sz) * parseFloat(market?.markPx ?? "0");
    }
    return s;
  }, 0);

  const totalExposure = longExposure + shortExposure;
  const totalPositionValue = totalExposure;
  const leverageRatio = accountValue > 0 ? totalPositionValue / accountValue : 0;
  const marginUsedPct = accountValue > 0 ? (totalMargin / accountValue) * 100 : 0;
  const freePct = accountValue > 0 ? (withdrawable / accountValue) * 100 : 0;

  const realizedPnl = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let total = 0, d1 = 0, d7 = 0, d30 = 0;
    let feesAll = 0, fees1 = 0, fees7 = 0, fees30 = 0;
    for (const f of fills) {
      const pnl = parseFloat(f.closedPnl);
      const fee = parseFloat(f.fee);
      const age = now - f.time;
      feesAll += fee;
      if (age <= day) fees1 += fee;
      if (age <= 7 * day) fees7 += fee;
      if (age <= 30 * day) fees30 += fee;
      if (pnl === 0) continue;
      total += pnl;
      if (age <= day) d1 += pnl;
      if (age <= 7 * day) d7 += pnl;
      if (age <= 30 * day) d30 += pnl;
    }
    return { total, d1, d7, d30, feesAll, fees1, fees7, fees30 };
  }, [fills]);

  const tradingStats = useMemo(() => {
    let wins = 0, losses = 0, closedPositions = 0;
    let maxDrawdown = 0, runningPnl = 0, peak = 0;
    const sorted = [...fills].filter((f) => parseFloat(f.closedPnl) !== 0).sort((a, b) => a.time - b.time);
    for (const f of sorted) {
      const pnl = parseFloat(f.closedPnl);
      closedPositions++;
      if (pnl > 0) wins++;
      else losses++;
      runningPnl += pnl;
      if (runningPnl > peak) peak = runningPnl;
      const dd = peak > 0 ? ((peak - runningPnl) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
    const winRate = closedPositions > 0 ? (wins / closedPositions) * 100 : 0;
    return { winRate, maxDrawdown, trades: fills.length, closedPositions };
  }, [fills]);

  const positionEntryTimes = useMemo(() => {
    const map = new Map<string, number>();
    if (!fills.length) return map;
    const sorted = [...fills].sort((a, b) => a.time - b.time);
    for (const f of sorted) {
      const coin = stripPrefix(f.coin).toUpperCase();
      if (!map.has(coin)) map.set(coin, f.time);
    }
    return map;
  }, [fills]);

  const sortedFills = useMemo(
    () => [...fills].sort((a, b) => b.time - a.time).slice(0, 100),
    [fills]
  );
  const longPct = totalExposure > 0 ? (longExposure / totalExposure) * 100 : 0;
  const shortPct = totalExposure > 0 ? (shortExposure / totalExposure) * 100 : 0;

  const directionBias = longPct > 60 ? "Bullish" : shortPct > 60 ? "Bearish" : "Neutral";

  const fundingPnl = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let total = 0, d1 = 0, d7 = 0, d30 = 0;
    for (const fp of funding) {
      const amt = parseFloat(fp.delta.usdc);
      total += amt;
      const age = now - fp.time;
      if (age <= day) d1 += amt;
      if (age <= 7 * day) d7 += amt;
      if (age <= 30 * day) d30 += amt;
    }
    return { total, d1, d7, d30 };
  }, [funding]);

  const totalPnl = realizedPnl.total - realizedPnl.feesAll + fundingPnl.total + totalUnrealizedPnl;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !ch) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-brand" />
          <p className="text-sm text-[#848e9c]">Loading trader profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Header Bar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/traders")} className="text-[#848e9c] hover:text-white transition-colors shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              {lbMatch?.displayName && (
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg font-bold truncate">{lbMatch.displayName}</span>
                  {(() => {
                    const atPerf = getPerf(lbMatch, "allTime");
                    const atPnl = parseFloat(atPerf.pnl);
                    if (atPnl > 10_000_000) return <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium shrink-0">Whale</span>;
                    if (atPnl > 1_000_000) return <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-medium shrink-0">Top Trader</span>;
                    return null;
                  })()}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#848e9c] truncate">{address}</span>
                <button onClick={copyAddress} className="text-[#848e9c] hover:text-white transition-colors shrink-0">
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
                <a href={`https://app.hyperliquid.xyz/explorer/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-[#848e9c] hover:text-white transition-colors shrink-0">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleStar}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                starred ? "bg-amber-400/10 text-amber-400" : "bg-[#141620] text-[#848e9c] hover:text-white"
              }`}
            >
              <Star className={`h-3 w-3 ${starred ? "fill-amber-400" : ""}`} />
              {starred ? "Starred" : "Star"}
            </button>
            <button
              onClick={() => loadTrader(address)}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-brand bg-brand/10 rounded-lg hover:bg-brand/20 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {ch && (
          <>
            {/* ── Top Cards Grid (Hyperbot-style) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

              {/* Card 1: Account Total Value */}
              <div className="bg-[#141620] rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#848e9c] mb-1">Account Total Equity</p>
                  <p className="text-2xl font-bold text-white tracking-tight">{formatUsd(totalAccountValue)}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                      <span className="text-[#848e9c]">Perpetual</span>
                      <span className="text-white font-medium">{formatUsd(accountValue)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                      <span className="text-[#848e9c]">Spot</span>
                      <span className="text-white font-medium">{formatUsd(Math.max(0, totalAccountValue - accountValue))}</span>
                    </span>
                  </div>
                </div>
                <DonutChart
                  size={80}
                  strokeWidth={10}
                  segments={[
                    { value: accountValue, color: "#3b82f6", label: "Perpetual" },
                    { value: Math.max(0, totalAccountValue - accountValue), color: "#f59e0b", label: "Spot" },
                  ]}
                />
              </div>

              {/* Card 2: Free Margin */}
              <div className="bg-[#141620] rounded-xl p-5">
                <p className="text-[11px] text-[#848e9c] mb-1">Free Margin Available</p>
                <p className="text-2xl font-bold text-white tracking-tight">{formatUsd(withdrawable)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-[#848e9c]">Withdrawable</span>
                  <span className="text-sm font-bold text-white">{freePct.toFixed(1)}%</span>
                </div>
                <div className="mt-1.5 w-full h-2 bg-[#1e2030] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.min(freePct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Card 3: Total Position Value */}
              <div className="bg-[#141620] rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#848e9c] mb-1">Total Position Value</p>
                  <p className="text-2xl font-bold text-white tracking-tight">{formatUsd(totalPositionValue)}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-[#848e9c]">
                    <Shield className="h-3 w-3 text-emerald-400" />
                    <span>Leverage Ratio</span>
                  </div>
                </div>
                <div className="relative flex items-center justify-center">
                  <DonutChart
                    size={80}
                    strokeWidth={10}
                    segments={[
                      { value: Math.min(leverageRatio, 1) * 100, color: leverageRatio > 5 ? "#ef4444" : leverageRatio > 2 ? "#f59e0b" : "#10b981", label: "Used" },
                      { value: Math.max(0, 100 - Math.min(leverageRatio, 1) * 100), color: "#1e2030", label: "Free" },
                    ]}
                  />
                  <span className="absolute text-sm font-bold">{leverageRatio.toFixed(2)}x</span>
                </div>
              </div>

              {/* Card 4: Trading Performance */}
              <div className="bg-[#141620] rounded-xl p-5">
                <p className="text-[11px] text-[#848e9c] mb-3">Trading Performance</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-[#848e9c]">Win Rate</p>
                    <p className="text-lg font-bold text-white">{tradingStats.winRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#848e9c]">Max Drawdown</p>
                    <p className="text-lg font-bold text-red-400">{tradingStats.maxDrawdown.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#848e9c]">Trades</p>
                    <p className="text-sm font-bold text-white flex items-center gap-1">
                      <Activity className="h-3 w-3 text-amber-400" />
                      {tradingStats.trades.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#848e9c]">Closed Positions</p>
                    <p className="text-sm font-bold text-white flex items-center gap-1">
                      <Target className="h-3 w-3 text-emerald-400" />
                      {tradingStats.closedPositions.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Second Row: Position Breakdown + PnL Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

              {/* Left: Perp Breakdown */}
              <div className="lg:col-span-2 bg-[#141620] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#848e9c]">Perp Total Value</p>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e2030] text-[#848e9c]">Current Positions</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatUsd(totalPositionValue)}</p>

                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-[#848e9c]">Average Margin Used Ratio</span>
                    <span className="text-white font-medium">{marginUsedPct.toFixed(2)}%</span>
                  </div>
                  <MiniBar value={marginUsedPct} max={100} color="#3b82f6" />
                </div>

                <div className="border-t border-[#1e2030] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#848e9c]">Direction Bias</span>
                    <span className={`text-xs font-bold ${directionBias === "Bullish" ? "text-emerald-400" : directionBias === "Bearish" ? "text-red-400" : "text-[#848e9c]"}`}>{directionBias}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#848e9c]">Long Exposure</span>
                      <span className="text-emerald-400 font-medium">{longPct.toFixed(0)}%</span>
                    </div>
                    <MiniBar value={longPct} max={100} color="#10b981" />
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#848e9c]">Short Exposure</span>
                      <span className="text-red-400 font-medium">{shortPct.toFixed(0)}%</span>
                    </div>
                    <MiniBar value={shortPct} max={100} color="#ef4444" />
                  </div>
                </div>

                {/* Position Distribution */}
                <div className="border-t border-[#1e2030] pt-3">
                  <p className="text-[10px] text-[#848e9c] mb-2">Position Distribution</p>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-[10px] text-[#848e9c]">Long Value</span>
                      <p className="text-sm font-bold text-white">{formatUsd(longExposure)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#848e9c]">Short Value</span>
                      <p className="text-sm font-bold text-white">{formatUsd(shortExposure)}</p>
                    </div>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-[#1e2030]">
                    {longExposure > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${longPct}%` }} />}
                    {shortExposure > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${shortPct}%` }} />}
                  </div>
                </div>

                <div className="border-t border-[#1e2030] pt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-[#848e9c]">ROE</p>
                    <p className={`text-sm font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {accountValue > 0 ? `${totalPnl >= 0 ? "+" : ""}${((totalPnl / accountValue) * 100).toFixed(2)}%` : "–"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#848e9c]">uPnL</p>
                    <p className={`text-sm font-bold ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalUnrealizedPnl >= 0 ? "+" : ""}{formatUsd(totalUnrealizedPnl)}
                    </p>
                  </div>
                </div>

                {spotState && spotState.balances.filter((b) => parseFloat(b.total) > 0 && b.coin !== "USDC" && b.coin !== "USDT").length > 0 && (
                  <div className="border-t border-[#1e2030] pt-3">
                    <p className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-2">Spot Holdings</p>
                    <div className="flex flex-wrap gap-1.5">
                      {spotState.balances.filter((b) => parseFloat(b.total) > 0 && b.coin !== "USDC" && b.coin !== "USDT").map((b) => (
                        <span key={b.coin} className="px-2 py-1 bg-[#1e2030] rounded-md text-[10px] text-white">
                          {b.coin} <span className="text-[#848e9c]">{parseFloat(b.total).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: PnL Chart + Summary */}
              <div className="lg:col-span-3 bg-[#141620] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-[11px] text-[#848e9c]">{pnlRange} Total PnL (Perp Only)</p>
                    <p className={`text-xl font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalPnl >= 0 ? "+" : ""}{formatUsd(totalPnl)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#0b0e11] rounded-lg p-0.5">
                    {(["1D", "1W", "1M", "ALL"] as PnlRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setPnlRange(r)}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                          pnlRange === r ? "bg-brand/20 text-brand" : "text-[#848e9c] hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chart */}
                <div className="h-[180px] w-full">
                  <PnlChart fills={fills} range={pnlRange} />
                </div>

                {/* P&L Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { label: "Total P&L", value: totalPnl, highlight: true },
                    { label: "24h P&L", value: realizedPnl.d1 - realizedPnl.fees1 + fundingPnl.d1, highlight: false },
                    { label: "7d P&L", value: realizedPnl.d7 - realizedPnl.fees7 + fundingPnl.d7, highlight: false },
                    { label: "30d P&L", value: realizedPnl.d30 - realizedPnl.fees30 + fundingPnl.d30, highlight: false },
                  ]).map((item) => (
                    <div key={item.label} className={`rounded-lg px-3 py-2.5 ${item.highlight ? "bg-brand/5 border border-brand/20" : "bg-[#0b0e11]"}`}>
                      <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">{item.label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${item.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {item.value >= 0 ? "+" : ""}{formatUsd(item.value)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                    <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Unrealized P&L</p>
                    <p className={`text-sm font-bold mt-0.5 ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalUnrealizedPnl >= 0 ? "+" : ""}{formatUsd(totalUnrealizedPnl)}
                    </p>
                  </div>
                  <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                    <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Realized P&L</p>
                    {(() => { const net = realizedPnl.total - realizedPnl.feesAll; return (
                    <p className={`text-sm font-bold mt-0.5 ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {net >= 0 ? "+" : ""}{formatUsd(net)}
                    </p>
                    ); })()}
                  </div>
                  <div className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                    <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Funding Income</p>
                    <p className={`text-sm font-bold mt-0.5 ${fundingPnl.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fundingPnl.total >= 0 ? "+" : ""}{formatUsd(fundingPnl.total)}
                    </p>
                  </div>
                </div>

                {lbMatch && (
                  <div className="border-t border-[#1e2030] pt-3">
                    <p className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-2">Leaderboard Stats</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["day", "week", "month", "allTime"] as TimeWindow[]).map((tw) => {
                        const p = getPerf(lbMatch, tw);
                        const pnl = parseFloat(p.pnl);
                        const roi = parseFloat(p.roi) * 100;
                        const label = tw === "allTime" ? "All-Time" : tw === "day" ? "24h" : tw === "week" ? "7d" : "30d";
                        return (
                          <div key={tw} className="bg-[#0b0e11] rounded-lg px-3 py-2.5">
                            <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">{label}</p>
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
            </div>

            {/* ── Tab Navigation ── */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {([
                { key: "perp" as const, label: `Perp Positions (${positions.length})` },
                { key: "orders" as const, label: `Open Orders (${orders.length})` },
                { key: "fills" as const, label: `Recent Fills (${Math.min(fills.length, 100)})` },
                { key: "spot" as const, label: `Spot Holdings (${spotState?.balances.filter((b) => parseFloat(b.total) > 0).length ?? 0})` },
                { key: "funding" as const, label: `Funding History` },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-lg transition-colors ${
                    tab === t.key ? "bg-brand/10 text-brand" : "text-[#848e9c] hover:text-white hover:bg-[#141620]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            {tab === "perp" && (
              positions.length > 0 ? (
                <div className="bg-[#141620] rounded-xl overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/30">
                        <th className="text-left px-4 py-2.5 font-medium">Market</th>
                        <th className="text-right px-3 py-2.5 font-medium">Size</th>
                        <th className="text-right px-3 py-2.5 font-medium">Entry Price</th>
                        <th className="text-right px-3 py-2.5 font-medium">Mark Price</th>
                        <th className="text-right px-3 py-2.5 font-medium">uPnL</th>
                        <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">Notional</th>
                        <th className="text-right px-3 py-2.5 font-medium hidden lg:table-cell">Margin</th>
                        <th className="text-right px-3 py-2.5 font-medium hidden lg:table-cell">Liq. Price</th>
                        <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">Duration</th>
                        <th className="text-center px-2 py-2.5 font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
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
                        const notional = Math.abs(size) * markPx;
                        const margin = parseFloat(pos.marginUsed);
                        const liqPx = pos.liquidationPx ? parseFloat(pos.liquidationPx) : null;
                        const displayCoin = market?.displayName ?? bare;
                        const leverageType = pos.leverage.type === "cross" ? "Cross" : "Iso";
                        const entryTime = positionEntryTimes.get(bare.toUpperCase());
                        const durationStr = entryTime ? formatDuration(Date.now() - entryTime) : "–";

                        return (
                          <tr key={pos.coin} className="hover:bg-[#1a1d2e]/50 transition-colors border-b border-[#2a2e3e]/10 last:border-0">
                            <td className="px-4 py-2.5">
                              <Link href={`/trade/${market?.name ?? pos.coin}`} className="flex items-center gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold leading-none ${isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                  {isLong ? "LONG" : "SHORT"}
                                </span>
                                <span className="text-white font-medium">{displayCoin}</span>
                                <span className="text-[9px] text-[#5a6070]">{pos.leverage.value}x {leverageType}</span>
                              </Link>
                            </td>
                            <td className="text-right px-3 py-2.5 text-white font-medium">{Math.abs(size).toFixed(size < 1 ? 5 : 2)}</td>
                            <td className="text-right px-3 py-2.5 text-white">${entry.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                            <td className="text-right px-3 py-2.5 text-[#848e9c]">${markPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                            <td className="text-right px-3 py-2.5">
                              <span className={`font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                              </span>
                              <span className={`block text-[9px] ${roe >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                                {roe >= 0 ? "+" : ""}{roe.toFixed(2)}%
                              </span>
                            </td>
                            <td className="text-right px-3 py-2.5 text-[#848e9c] hidden sm:table-cell">{formatUsd(notional)}</td>
                            <td className="text-right px-3 py-2.5 text-[#848e9c] hidden lg:table-cell">{formatUsd(margin)}</td>
                            <td className="text-right px-3 py-2.5 text-[#848e9c] hidden lg:table-cell">{liqPx ? `$${liqPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "–"}</td>
                            <td className="text-right px-3 py-2.5 hidden sm:table-cell">
                              <span className="text-[#f0b90b] text-[10px]">{durationStr}</span>
                            </td>
                            <td className="text-center px-2 py-2.5">
                              <Link
                                href={`/trade/${market?.name ?? pos.coin}?side=${isLong ? "buy" : "sell"}&size=${Math.abs(size)}&price=${entry}`}
                                className="inline-flex items-center justify-center w-6 h-6 text-brand hover:bg-brand/10 rounded transition-colors"
                                title="Copy this trade"
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-[#141620] rounded-xl flex flex-col items-center justify-center py-16 text-center">
                  <BarChart3 className="h-8 w-8 text-[#2a2e3e] mb-3" />
                  <p className="text-sm text-[#848e9c]">No open perp positions</p>
                </div>
              )
            )}

            {tab === "orders" && (
              orders.length > 0 ? (
                <div className="bg-[#141620] rounded-xl overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/30">
                        <th className="text-left px-4 py-2.5 font-medium">Market</th>
                        <th className="text-left px-3 py-2.5 font-medium">Side</th>
                        <th className="text-right px-3 py-2.5 font-medium">Price</th>
                        <th className="text-right px-3 py-2.5 font-medium">Size</th>
                        <th className="text-left px-3 py-2.5 font-medium">Type</th>
                        <th className="text-right px-3 py-2.5 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => {
                        const isBuy = o.side === "B";
                        return (
                          <tr key={o.oid} className="hover:bg-[#1a1d2e]/50 transition-colors border-b border-[#2a2e3e]/10 last:border-0">
                            <td className="px-4 py-2.5 text-white font-medium">{stripPrefix(o.coin)}</td>
                            <td className={`px-3 py-2.5 font-medium ${isBuy ? "text-emerald-400" : "text-red-400"}`}>{isBuy ? "Buy" : "Sell"}</td>
                            <td className="text-right px-3 py-2.5 text-white">${parseFloat(o.limitPx).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                            <td className="text-right px-3 py-2.5 text-white">{parseFloat(o.sz).toFixed(parseFloat(o.sz) < 1 ? 5 : 2)}</td>
                            <td className="px-3 py-2.5 text-[#848e9c]">{o.orderType}{o.isTrigger ? " (Trigger)" : ""}</td>
                            <td className="text-right px-3 py-2.5 text-[#848e9c]">{new Date(o.timestamp).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-[#141620] rounded-xl flex flex-col items-center justify-center py-16 text-center">
                  <CircleDollarSign className="h-8 w-8 text-[#2a2e3e] mb-3" />
                  <p className="text-sm text-[#848e9c]">No open orders</p>
                </div>
              )
            )}

            {tab === "fills" && (
              sortedFills.length > 0 ? (
                <div className="bg-[#141620] rounded-xl overflow-hidden">
                  <div className="hidden sm:grid grid-cols-7 px-4 py-2.5 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/30 font-medium">
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
                      <div key={f.tid} className="grid grid-cols-4 sm:grid-cols-7 items-center px-4 py-2 text-[11px] hover:bg-[#1a1d2e]/50 transition-colors border-b border-[#2a2e3e]/10 last:border-0 gap-y-1">
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
                <div className="bg-[#141620] rounded-xl flex flex-col items-center justify-center py-16 text-center">
                  <Activity className="h-8 w-8 text-[#2a2e3e] mb-3" />
                  <p className="text-sm text-[#848e9c]">No fills found</p>
                </div>
              )
            )}

            {tab === "spot" && (
              spotState && spotState.balances.filter((b) => parseFloat(b.total) > 0).length > 0 ? (
                <div className="bg-[#141620] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-3 px-4 py-2.5 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/30 font-medium">
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
                        <div key={b.coin} className="grid grid-cols-3 items-center px-4 py-2.5 text-xs hover:bg-[#1a1d2e]/50 transition-colors border-b border-[#2a2e3e]/10 last:border-0">
                          <span className="text-white font-medium">{b.coin}</span>
                          <span className="text-right text-white">{total.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                          <span className="text-right text-[#848e9c]">{hold > 0 ? hold.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "–"}</span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="bg-[#141620] rounded-xl flex flex-col items-center justify-center py-16 text-center">
                  <Wallet className="h-8 w-8 text-[#2a2e3e] mb-3" />
                  <p className="text-sm text-[#848e9c]">No spot holdings</p>
                </div>
              )
            )}

            {tab === "funding" && (
              funding.length > 0 ? (
                <div className="bg-[#141620] rounded-xl overflow-hidden">
                  <div className="hidden sm:grid grid-cols-5 px-4 py-2.5 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/30 font-medium">
                    <span>Time</span>
                    <span>Coin</span>
                    <span className="text-right">Payment</span>
                    <span className="text-right">Position Size</span>
                    <span className="text-right">Funding Rate</span>
                  </div>
                  {[...funding].sort((a, b) => b.time - a.time).slice(0, 100).map((f, i) => {
                    const usdc = parseFloat(f.delta.usdc);
                    return (
                      <div key={i} className="grid grid-cols-3 sm:grid-cols-5 items-center px-4 py-2 text-[11px] hover:bg-[#1a1d2e]/50 transition-colors border-b border-[#2a2e3e]/10 last:border-0">
                        <span className="text-[#848e9c]">
                          {new Date(f.time).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-white font-medium">{f.delta.coin}</span>
                        <span className={`text-right font-medium ${usdc >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {usdc >= 0 ? "+" : ""}{formatUsd(usdc)}
                        </span>
                        <span className="text-right text-[#848e9c] hidden sm:block">{parseFloat(f.delta.szi).toFixed(4)}</span>
                        <span className="text-right text-[#848e9c] hidden sm:block">{(parseFloat(f.delta.fundingRate) * 100).toFixed(4)}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#141620] rounded-xl flex flex-col items-center justify-center py-16 text-center">
                  <Percent className="h-8 w-8 text-[#2a2e3e] mb-3" />
                  <p className="text-sm text-[#848e9c]">No funding history</p>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
