"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Trophy,
  Target,
  Flame,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { fetchAllMarkets, fetchUserFunding, fetchUserLedger, spotDisplayName } from "@/lib/hyperliquid/api";
import type { LedgerUpdate } from "@/lib/hyperliquid/api";
import type { ClearinghouseState, OpenOrder, MarketInfo, AssetPosition, Fill, FundingPayment, SpotClearinghouseState } from "@/lib/hyperliquid/types";
import { useUserDataStore } from "@/lib/hyperliquid/user-data-store";
import { useAutomationStore } from "@/lib/automation/store";
import { FundingBanner } from "@/components/FundingBanner";
import { CoinLogo } from "@/components/CoinLogo";
import { BRAND, BRAND_CONFIG } from "@/lib/brand";
import { Skeleton, SkeletonCard, SkeletonChart } from "@/components/ui/Skeleton";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import { DepositButton } from "@/components/DepositModal";
import { fetchPolymarketPositions, fetchPolymarketTrades } from "@/lib/polymarket/api";
import type { PolymarketPosition, PolymarketTrade } from "@/lib/polymarket/types";

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

function rebuildTrade(coin: string, fills: Fill[], isOpen: boolean): RoundTripTrade {
  const sortedFills = [...fills].sort((a, b) => a.time - b.time);
  const openFills = sortedFills.filter((f) => f.dir.toLowerCase().includes("open"));
  const closeFills = sortedFills.filter((f) => f.dir.toLowerCase().includes("close"));
  const entryCost = openFills.reduce((s, f) => s + parseFloat(f.px) * parseFloat(f.sz), 0);
  const entrySize = openFills.reduce((s, f) => s + parseFloat(f.sz), 0);
  const exitCost = closeFills.reduce((s, f) => s + parseFloat(f.px) * parseFloat(f.sz), 0);
  const exitSize = closeFills.reduce((s, f) => s + parseFloat(f.sz), 0);
  const pnl = sortedFills.reduce((s, f) => s + parseFloat(f.closedPnl), 0);
  const fees = sortedFills.reduce((s, f) => s + parseFloat(f.fee), 0);
  const first = sortedFills[0];
  const direction: "Long" | "Short" =
    openFills.length > 0
      ? openFills[0].side === "B" ? "Long" : "Short"
      : first.side === "B" ? "Long" : "Short";
  return {
    coin,
    direction,
    entryPx: entrySize > 0 ? entryCost / entrySize : parseFloat(first.px),
    exitPx: exitSize > 0 ? exitCost / exitSize : null,
    maxSize: entrySize || Math.abs(parseFloat(first.sz)),
    openTime: first.time,
    closeTime: isOpen ? null : sortedFills[sortedFills.length - 1].time,
    realizedPnl: pnl,
    totalFees: fees,
    netPnl: pnl - fees,
    fills: sortedFills,
    isOpen,
  };
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
    // Seed pos from the first fill's startPosition so truncated snapshots
    // don't create phantom trades (e.g. WS returns only recent fills).
    let pos = parseFloat(coinFills[0].startPosition ?? "0");
    let tradeFills: Fill[] = [];
    let openTime = 0;
    let direction: "Long" | "Short" = "Long";
    let entryCost = 0;
    let entrySize = 0;
    const coinTrades: RoundTripTrade[] = [];

    // If pos is already non-zero, we're mid-trade from before our fill window.
    // Consume closing fills until flat, then start fresh round-trips.
    const skipPrefix = Math.abs(pos) > 1e-10;
    let prefixFills: Fill[] = [];

    for (const f of coinFills) {
      const sz = parseFloat(f.sz);
      const px = parseFloat(f.px);
      const delta = f.side === "B" ? sz : -sz;

      // Still unwinding a pre-existing position we don't have open fills for
      if (skipPrefix && prefixFills !== null && Math.abs(pos) > 1e-10) {
        const prevPos = pos;
        pos += delta;
        prefixFills.push(f);
        const crossed = (prevPos > 0 && pos <= 0) || (prevPos < 0 && pos >= 0);
        if (crossed || Math.abs(pos) < 1e-10) {
          const pnl = prefixFills.reduce((s, tf) => s + parseFloat(tf.closedPnl), 0);
          const fees = prefixFills.reduce((s, tf) => s + parseFloat(tf.fee), 0);
          const cFills = prefixFills.filter((tf) => tf.dir.toLowerCase().includes("close"));
          const exitCost = cFills.reduce((s, tf) => s + parseFloat(tf.px) * parseFloat(tf.sz), 0);
          const exitSize = cFills.reduce((s, tf) => s + parseFloat(tf.sz), 0);
          coinTrades.push({
            coin,
            direction: prevPos > 0 ? "Long" : "Short",
            entryPx: 0,
            exitPx: exitSize > 0 ? exitCost / exitSize : null,
            maxSize: Math.abs(parseFloat(coinFills[0].startPosition ?? "0")),
            openTime: prefixFills[0].time,
            closeTime: f.time,
            realizedPnl: pnl,
            totalFees: fees,
            netPnl: pnl - fees,
            fills: prefixFills,
            isOpen: false,
          });
          prefixFills = [];
          if (Math.abs(pos) > 1e-10) {
            tradeFills = [f];
            openTime = f.time;
            direction = pos > 0 ? "Long" : "Short";
            entryCost = px * sz;
            entrySize = sz;
          }
        }
        continue;
      }
      // If we still have prefix fills left over (never closed), flush them
      if (prefixFills.length > 0) {
        prefixFills = [];
      }

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

        coinTrades.push({
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

    // Handle remaining prefix fills (pre-existing position never fully closed)
    if (prefixFills.length > 0) {
      const pnl = prefixFills.reduce((s, tf) => s + parseFloat(tf.closedPnl), 0);
      const fees = prefixFills.reduce((s, tf) => s + parseFloat(tf.fee), 0);
      const initPos = parseFloat(coinFills[0].startPosition ?? "0");
      coinTrades.push({
        coin,
        direction: initPos > 0 ? "Long" : "Short",
        entryPx: 0,
        exitPx: null,
        maxSize: Math.abs(initPos),
        openTime: prefixFills[0].time,
        closeTime: null,
        realizedPnl: pnl,
        totalFees: fees,
        netPnl: pnl - fees,
        fills: prefixFills,
        isOpen: true,
      });
    } else if (tradeFills.length > 0) {
      const pnl = tradeFills.reduce((s, tf) => s + parseFloat(tf.closedPnl), 0);
      const fees = tradeFills.reduce((s, tf) => s + parseFloat(tf.fee), 0);

      coinTrades.push({
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

    // Merge micro round-trips (duration < 2s) into adjacent trade
    const MICRO_MS = 2000;
    let i = 0;
    while (i < coinTrades.length) {
      const t = coinTrades[i];
      if (!t.isOpen && t.closeTime != null && t.closeTime - t.openTime < MICRO_MS && coinTrades.length > 1) {
        const neighborIdx = i + 1 < coinTrades.length ? i + 1 : i - 1;
        const neighbor = coinTrades[neighborIdx];
        const merged = rebuildTrade(coin, [...neighbor.fills, ...t.fills], neighbor.isOpen);
        coinTrades[neighborIdx] = merged;
        coinTrades.splice(i, 1);
        if (neighborIdx < i) i--;
      } else {
        i++;
      }
    }

    trades.push(...coinTrades);
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

const STABLECOINS = new Set(["USDC", "USDT0", "USDE", "USDH"]);

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

  // Real-time data from WebSocket via centralized store
  const userData = useUserDataStore();
  const ch = userData.clearinghouse;
  const spot = userData.spotClearinghouse;
  const orders = userData.openOrders;
  const fills = userData.fills;

  // Supplementary data fetched via REST (no WS equivalent)
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [funding, setFunding] = useState<FundingPayment[]>([]);
  const [ledger, setLedger] = useState<LedgerUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [historyView, setHistoryView] = useState<"trades" | "fills" | "polymarket">("trades");
  const [portfolioTab, setPortfolioTab] = useState<"assets" | "history" | "performance" | "calendar">("assets");

  const automationInit = useAutomationStore((s) => s.init);
  const browserStrategies = useAutomationStore((s) => s.strategies);
  const [serverStrategies, setServerStrategies] = useState<{ status: string }[]>([]);
  const [polyPositions, setPolyPositions] = useState<PolymarketPosition[]>([]);
  const [polyTrades, setPolyTrades] = useState<PolymarketTrade[]>([]);
  const [polyProxyWallet, setPolyProxyWallet] = useState<string | null>(null);

  // Supplementary REST fetch: markets, funding history, ledger, polymarket, quant status
  const loadSupplementary = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const [allMarkets, userFunding, userLedger, quantStatus, polyData, polyTradeData] = await Promise.all([
        fetchAllMarkets(),
        fetchUserFunding(addr),
        fetchUserLedger(addr).catch(() => [] as LedgerUpdate[]),
        fetch("/api/quant/status").then((r) => r.json()).catch(() => ({ strategies: [] })),
        fetchPolymarketPositions(addr).catch(() => ({ positions: [] as PolymarketPosition[], proxyWallet: null })),
        fetchPolymarketTrades(addr, 200).catch(() => ({ trades: [] as PolymarketTrade[], proxyWallet: null })),
      ]);
      setMarkets(allMarkets);
      setFunding(userFunding);
      setLedger(userLedger);
      setServerStrategies(quantStatus.strategies ?? []);
      setPolyPositions(polyData.positions);
      setPolyTrades(polyTradeData.trades);
      setPolyProxyWallet(polyData.proxyWallet ?? polyTradeData.proxyWallet);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load dashboard supplementary data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    automationInit();
  }, [automationInit]);

  // Connect WS user data stream + fetch supplementary data
  useEffect(() => {
    if (address) {
      userData.connect(address);
      loadSupplementary(address);
    } else {
      userData.disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, loadSupplementary]);

  const positions = ch?.assetPositions?.filter((ap) => parseFloat(ap.position.szi) !== 0) ?? [];

  // Slow supplementary data polling to 60s
  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => loadSupplementary(address), 60_000);
    return () => clearInterval(interval);
  }, [address, loadSupplementary]);
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
    const map = new Map<string, { closed: number; fees: number; funding: number; poly: number }>();
    for (const f of fills) {
      const day = toLocalDate(f.time);
      const entry = map.get(day) ?? { closed: 0, fees: 0, funding: 0, poly: 0 };
      entry.closed += parseFloat(f.closedPnl);
      entry.fees += parseFloat(f.fee);
      map.set(day, entry);
    }
    for (const fp of funding) {
      const day = toLocalDate(fp.time);
      const entry = map.get(day) ?? { closed: 0, fees: 0, funding: 0, poly: 0 };
      entry.funding += parseFloat(fp.delta.usdc);
      map.set(day, entry);
    }
    // Compute per-trade Polymarket P&L using running cost basis
    const polyCurPrices = new Map<string, number>();
    for (const p of polyPositions) {
      if (p.curPrice > 0) polyCurPrices.set(p.asset, p.curPrice);
    }
    const polyChron = [...polyTrades].sort((a, b) => a.timestamp - b.timestamp);
    const polyAssetState = new Map<string, { shares: number; costBasis: number }>();
    const polyTradePnl = new Map<string, number>();

    for (const t of polyChron) {
      const state = polyAssetState.get(t.asset) ?? { shares: 0, costBasis: 0 };
      if (t.side === "BUY") {
        state.costBasis = ((state.costBasis * state.shares) + (t.price * t.size)) / (state.shares + t.size);
        state.shares += t.size;
        polyTradePnl.set(t.transactionHash, 0);
      } else {
        polyTradePnl.set(t.transactionHash, (t.price - state.costBasis) * t.size);
        state.shares = Math.max(state.shares - t.size, 0);
      }
      polyAssetState.set(t.asset, state);
    }

    // Realized PnL from sells → assign to the sell's trade date
    for (const pt of polyTrades) {
      if (!pt.timestamp) continue;
      const pnl = polyTradePnl.get(pt.transactionHash) ?? 0;
      if (pnl === 0) continue;
      const day = toLocalDate(pt.timestamp * 1000);
      const entry = map.get(day) ?? { closed: 0, fees: 0, funding: 0, poly: 0 };
      entry.poly += pnl;
      map.set(day, entry);
    }

    // Unrealized PnL from remaining shares → assign to TODAY
    const todayStr = toLocalDate(Date.now());
    for (const [asset, state] of polyAssetState) {
      if (state.shares < 0.01) continue;
      const curPrice = polyCurPrices.get(asset);
      if (curPrice === undefined) continue;
      const unrealized = (curPrice - state.costBasis) * state.shares;
      if (Math.abs(unrealized) < 0.01) continue;
      const entry = map.get(todayStr) ?? { closed: 0, fees: 0, funding: 0, poly: 0 };
      entry.poly += unrealized;
      map.set(todayStr, entry);
    }
    return map;
  }, [fills, funding, polyTrades, polyPositions]);

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
  const perpsAccountValue = parseFloat(ch?.marginSummary?.accountValue ?? "0");
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

  const spotMarkets = useMemo(() => markets.filter((m) => m.dex === "spot"), [markets]);

  const spotHoldings = useMemo(() => {
    if (!spot?.balances || spotMarkets.length === 0) return [];
    return spot.balances
      .filter((b) => !STABLECOINS.has(b.coin) && parseFloat(b.total) > 0)
      .map((b) => {
        const dn = spotDisplayName(b.coin);
        const m = spotMarkets.find((s) => s.displayName === dn);
        const px = m ? parseFloat(m.markPx) : 0;
        const amount = parseFloat(b.total);
        const usd = amount * px;
        const costBasis = parseFloat(b.entryNtl ?? "0");
        const pnl = costBasis > 0 ? usd - costBasis : null;
        const pnlPct = costBasis > 0 ? ((usd - costBasis) / costBasis) * 100 : null;
        const internalName = b.coin;
        return { coin: b.coin, displayName: dn, amount, px, usd, costBasis, pnl, pnlPct, internalName, market: m };
      })
      .sort((a, b) => b.usd - a.usd);
  }, [spot, spotMarkets]);

  const spotTokensTotal = useMemo(
    () => spotHoldings.reduce((s, h) => s + h.usd, 0),
    [spotHoldings],
  );

  const activePolyPositions = useMemo(
    () => polyPositions.filter((p) => p.currentValue > 0.01),
    [polyPositions],
  );
  const polyTotalValue = useMemo(
    () => activePolyPositions.reduce((s, p) => s + p.currentValue, 0),
    [activePolyPositions],
  );
  const polyTotalPnl = useMemo(
    () => activePolyPositions.reduce((s, p) => s + p.cashPnl, 0),
    [activePolyPositions],
  );

  const accountValue = (spotUsdcBalance > 0
    ? spotUsdcBalance + totalPnl + spotTokensTotal
    : perpsAccountValue + spotTokensTotal) + polyTotalValue;
  const activeStrategies =
    serverStrategies.filter((s) => s.status === "active").length +
    browserStrategies.filter((s) => s.status === "active").length;

  const SPOT_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

  const assetDistribution = useMemo(() => {
    const items: { label: string; ticker: string; value: number; color: string }[] = [];
    let allocated = 0;

    for (const ap of positions) {
      const pos = ap.position;
      const bare = stripPrefix(pos.coin);
      const mkt = markets.find((m) => stripPrefix(m.name) === bare) ?? markets.find((m) => m.name === pos.coin);
      const posValue = parseFloat(pos.marginUsed) + parseFloat(pos.unrealizedPnl);
      if (posValue > 0.01) {
        items.push({ label: mkt?.displayName ?? bare, ticker: bare, value: posValue, color: parseFloat(pos.szi) > 0 ? "#0ecb81" : "#f6465d" });
        allocated += posValue;
      }
    }

    for (let i = 0; i < spotHoldings.length; i++) {
      const h = spotHoldings[i];
      if (h.usd > 0.01) {
        items.push({ label: h.displayName, ticker: h.displayName, value: h.usd, color: SPOT_COLORS[i % SPOT_COLORS.length] });
        allocated += h.usd;
      }
    }

    if (polyTotalValue > 0.01) {
      items.push({ label: "Polymarket", ticker: "POLY", value: polyTotalValue, color: "#3b82f6" });
      allocated += polyTotalValue;
    }

    const usdcSlice = accountValue - allocated;
    if (usdcSlice > 0.01) items.unshift({ label: "USDC", ticker: "USDC", value: usdcSlice, color: "#2775CA" });
    if (items.length === 0 && accountValue > 0) items.push({ label: "USDC", ticker: "USDC", value: accountValue, color: BRAND.hex });
    return items;
  }, [positions, spotHoldings, accountValue, markets, polyTotalValue]);

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
            ["performance", "Performance"],
            ["calendar", "PnL Calendar"],
          ] as ["assets" | "history" | "performance" | "calendar", string][]).map(([t, label]) => (
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
            {/* Hero: Total Equity */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#848e9c] mb-1">Total Equity</p>
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
                <button onClick={() => { if (address) loadSupplementary(address); userData.refreshUserState(); }} className="p-2 text-[#848e9c] hover:text-white transition-colors" disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <DepositButton variant="default" />
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
                <div className="bg-[#141620] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">Available Balance</p>
                  <p className="text-xl font-bold">{formatUsd(freeSpotBalance)}</p>
                </div>
                <div className="bg-[#141620] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">USDC (Perps)</p>
                  <p className="text-xl font-bold">{formatUsd(perpsBalance)}</p>
                </div>
                <div className="bg-[#141620] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">Spot Holdings</p>
                  <p className="text-xl font-bold">{formatUsd(spotTokensTotal)}</p>
                  {spotHoldings.length > 0 && (
                    <p className="text-[10px] text-[#555a66] mt-0.5">{spotHoldings.length} token{spotHoldings.length !== 1 ? "s" : ""}</p>
                  )}
                </div>
                <div className="bg-[#141620] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] text-[#848e9c] mb-1">Polymarket</p>
                  <p className="text-xl font-bold">{formatUsd(polyTotalValue)}</p>
                  {activePolyPositions.length > 0 && (
                    <p className={`text-[10px] mt-0.5 ${polyTotalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {polyTotalPnl >= 0 ? "+" : ""}{formatUsd(polyTotalPnl)} · {activePolyPositions.length} position{activePolyPositions.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Portfolio chart — Account Value / PNL over time */}
            {firstLoad ? (
              <SkeletonChart className="h-[280px]" />
            ) : fills.length > 0 ? (
              <PortfolioChart fills={fills} ledger={ledger} currentAccountValue={accountValue} />
            ) : null}

            {/* Donut chart */}
            {firstLoad ? (
              <SkeletonChart className="h-[280px]" />
            ) : (
              <div className="bg-[#141620] rounded-xl p-6">
                <div className="flex items-center justify-center">
                  <DonutChart items={assetDistribution} total={accountValue} />
                </div>

                {/* Asset Distribution list */}
                {assetDistribution.length > 0 && (
                  <div className="mt-6 space-y-1">
                    <p className="text-sm font-semibold text-brand mb-2">Asset Distribution</p>
                    {assetDistribution.map((a) => (
                      <div key={a.label} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <CoinLogo symbol={a.ticker} size={20} />
                          <span className="text-sm text-white">{a.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-brand">{accountValue > 0 ? ((a.value / accountValue) * 100).toFixed(1) : "0.0"}%</span>
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
              <Link href="/trade/BTC" className="flex items-center gap-3 bg-[#141620] rounded-xl px-4 py-3.5 hover:border-brand/50 transition-colors">
                <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Trade</p>
                  <p className="text-[10px] text-[#848e9c]">Perps</p>
                </div>
              </Link>
              <Link href="/predict" className="flex items-center gap-3 bg-[#141620] rounded-xl px-4 py-3.5 hover:border-brand/50 transition-colors">
                <BarChart3 className="h-5 w-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Predict</p>
                  <p className="text-[10px] text-[#848e9c]">Markets</p>
                </div>
              </Link>
              <Link href="/automate" className="flex items-center gap-3 bg-[#141620] rounded-xl px-4 py-3.5 hover:border-brand/50 transition-colors">
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
                    <div key={i} className="bg-[#141620] rounded-xl px-4 py-4 space-y-3">
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
                <div className="text-center py-8 bg-[#141620] rounded-xl">
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
                    <PositionRow key={ap.position.coin} ap={ap} markets={markets} fills={fills} trades={trades} />
                  ))}
                </div>
              )}
            </div>

            {/* Spot Holdings */}
            {!firstLoad && spotHoldings.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">
                    Spot Holdings ({spotHoldings.length})
                  </h2>
                  <Link href="/buy" className="text-xs text-brand hover:underline">Buy / Sell &rarr;</Link>
                </div>
                <div className="space-y-2">
                  {spotHoldings.map((h) => {
                    const spotRoute = h.market ? `/trade/spot-${h.market.name.replace("spot:", "")}` : "/buy";
                    return (
                      <Link key={h.coin} href={spotRoute} className="flex items-center gap-3 bg-[#141620] rounded-xl px-4 py-3.5 hover:bg-[#1a1d2e] transition-colors">
                        <CoinLogo symbol={h.displayName} size={32} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-white">{h.displayName}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">SPOT</span>
                          </div>
                          <p className="text-[11px] text-[#848e9c] tabular-nums">
                            {h.amount < 0.001 ? h.amount.toPrecision(3) : h.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} @ {formatUsd(h.px)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-white tabular-nums">{formatUsd(h.usd)}</p>
                          {h.pnl !== null ? (
                            <p className={`text-[11px] tabular-nums ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {h.pnl >= 0 ? "+" : ""}{formatUsd(h.pnl)}
                              {h.pnlPct !== null && (
                                <span className="ml-0.5">({h.pnl >= 0 ? "+" : ""}{h.pnlPct.toFixed(2)}%)</span>
                              )}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#4a4e59]">&mdash;</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Polymarket Positions */}
            {!firstLoad && activePolyPositions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">
                    Polymarket ({activePolyPositions.length})
                  </h2>
                  <div className="flex items-center gap-3">
                    {polyProxyWallet && (
                      <a
                        href={`https://polymarket.com/profile/${polyProxyWallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand hover:underline inline-flex items-center gap-1"
                      >
                        Profile <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <Link href="/predict" className="text-xs text-brand hover:underline">Trade &rarr;</Link>
                  </div>
                </div>
                <div className="space-y-2">
                  {activePolyPositions.map((p) => (
                    <PolyPositionRow key={p.asset} position={p} />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 bg-[#141620] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold">Total Polymarket Value</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{formatUsd(polyTotalValue)}</span>
                    <span className={`text-xs font-medium ml-2 ${polyTotalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {polyTotalPnl >= 0 ? "+" : ""}{formatUsd(polyTotalPnl)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Open Orders */}
            {orders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Open Orders ({orders.length})</h2>
                <div className="space-y-1">
                  {orders.slice(0, 10).map((o) => {
                    const limitPx = parseFloat(o.limitPx);
                    const sz = parseFloat(o.sz);
                    const notional = sz * limitPx;
                    const coinName = resolveOrderCoin(o.coin, markets);
                    const isSpotOrder = o.coin.startsWith("@");
                    const bare = stripPrefix(o.coin);
                    const mkt = isSpotOrder
                      ? markets.find((m) => m.dex === "spot" && m.assetIndex === 10000 + parseInt(o.coin.slice(1), 10))
                      : (markets.find((m) => stripPrefix(m.name) === bare) ?? markets.find((m) => m.name === o.coin));
                    const markPx = mkt ? parseFloat(mkt.markPx) : 0;
                    const distPct = markPx > 0 ? ((limitPx - markPx) / markPx * 100) : 0;
                    return (
                      <div key={o.oid} className="flex items-center gap-3 bg-[#141620] rounded-xl px-4 py-2.5">
                        <CoinLogo symbol={coinName} size={24} />
                        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold ${o.side === "B" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                          {o.side === "B" ? "BUY" : "SELL"}
                        </span>
                        <span className="text-xs font-semibold shrink-0">{coinName}{isSpotOrder && <span className="text-[9px] text-[#555a66] ml-1">SPOT</span>}</span>
                        <span className="hidden sm:block text-[10px] text-[#848e9c] tabular-nums shrink-0">
                          {sz} @ ${limitPx.toLocaleString()}
                        </span>
                        <span className="hidden md:block text-[10px] text-[#848e9c] tabular-nums shrink-0">
                          {formatUsd(notional)}
                        </span>
                        <div className="flex-1" />
                        {o.timestamp > 0 && (
                          <span className="text-[10px] text-[#555a66] font-mono tabular-nums shrink-0">
                            <LiveDuration since={o.timestamp} />
                          </span>
                        )}
                        {markPx > 0 && (
                          <span className={`text-[10px] font-medium tabular-nums shrink-0 ${Math.abs(distPct) < 2 ? "text-amber-400" : "text-[#848e9c]"}`}>
                            {distPct >= 0 ? "+" : ""}{distPct.toFixed(2)}%
                          </span>
                        )}
                        <span className="text-[10px] text-[#555a66] shrink-0">{o.orderType}</span>
                      </div>
                    );
                  })}
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
                    <div key={s.id} className="flex items-center justify-between bg-[#141620] rounded-xl px-4 py-3">
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
                {([
                  ["trades", `Trades (${trades.length})`],
                  ["fills", `Fills (${fills.length})`],
                  ["polymarket", `Polymarket (${polyTrades.length})`],
                ] as [typeof historyView, string][]).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setHistoryView(v)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${historyView === v ? "bg-brand text-white" : "text-[#848e9c] hover:text-white"}`}
                  >
                    {label}
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="bg-[#141620] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Total PnL</p>
                <p className={`text-sm font-bold ${(totalPnlAll + polyTotalPnl) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(totalPnlAll + polyTotalPnl) >= 0 ? "+" : ""}{formatUsd(totalPnlAll + polyTotalPnl)}
                </p>
              </div>
              <div className="bg-[#141620] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Closed PnL</p>
                <p className={`text-sm font-bold ${totalClosedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalClosedPnl >= 0 ? "+" : ""}{formatUsd(totalClosedPnl)}
                </p>
              </div>
              <div className="bg-[#141620] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Funding</p>
                <p className={`text-sm font-bold ${totalFundingPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalFundingPnl >= 0 ? "+" : ""}{formatUsd(totalFundingPnl)}
                </p>
              </div>
              <div className="bg-[#141620] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Polymarket P&L</p>
                <p className={`text-sm font-bold ${polyTotalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {polyTotalPnl >= 0 ? "+" : ""}{formatUsd(polyTotalPnl)}
                </p>
              </div>
              <div className="bg-[#141620] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Win Rate</p>
                <p className="text-sm font-bold text-white">
                  {winRate}%
                  <span className="text-[10px] text-[#848e9c] font-normal ml-1">({winCount}/{closedTrades.length})</span>
                </p>
              </div>
            </div>

            {historyView === "trades" ? (
              trades.length > 0 ? (
                <div className="space-y-2">
                  {trades.map((trade, i) => (
                    <TradeRow key={`${trade.coin}-${trade.openTime}-${i}`} trade={trade} positions={positions} markets={markets} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-[#848e9c] text-sm">No trades yet</div>
              )
            ) : historyView === "fills" ? (
              fills.length > 0 ? (
                <TransactionTable fills={fills} />
              ) : (
                <div className="text-center py-12 text-[#848e9c] text-sm">No fills yet</div>
              )
            ) : (
              polyTrades.length > 0 ? (
                <PolyTradeTable trades={polyTrades} positions={polyPositions} />
              ) : (
                <div className="text-center py-12 text-[#848e9c] text-sm">No Polymarket trades yet</div>
              )
            )}
          </div>
        )}

        {/* ─── Performance Tab ─── */}
        {portfolioTab === "performance" && (
          <CoinPerformance fills={fills} trades={trades} funding={funding} polyPositions={activePolyPositions} polyTrades={polyTrades} />
        )}

        {/* ─── PnL Calendar Tab ─── */}
        {portfolioTab === "calendar" && (
          <PnlCalendar dailyPnl={dailyPnl} dailyFills={dailyFills} totalClosedPnl={totalClosedPnl} totalFundingPnl={totalFundingPnl} totalPnlAll={totalPnlAll} polyTrades={polyTrades} />
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
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#848e9c" fontSize="12">Equity</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">$0.00</text>
      </svg>
    );
  }

  const gap = 1.5;
  let cumAngle = -90;
  const arcs = items.map((item) => {
    const pct = item.value / total;
    const angle = Math.max(pct * 360 - gap, 0.5);
    const startAngle = cumAngle + gap / 2;
    cumAngle += pct * 360;
    return { ...item, startAngle, angle };
  });

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc, i) => {
        const largeArc = arc.angle > 180 ? 1 : 0;
        const startX = cx + radius * Math.cos(toRad(arc.startAngle));
        const startY = cy + radius * Math.sin(toRad(arc.startAngle));
        const endX = cx + radius * Math.cos(toRad(arc.startAngle + arc.angle));
        const endY = cy + radius * Math.sin(toRad(arc.startAngle + arc.angle));

        return (
          <path
            key={i}
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#848e9c" fontSize="12">Equity</text>
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

// Resolve order coin name to display name.
// Spot orders arrive as "@156" (pair index); perps as "BTC", "kPEPE", etc.
function resolveOrderCoin(coin: string, mkts: MarketInfo[]): string {
  if (coin.startsWith("@")) {
    const pairIdx = parseInt(coin.slice(1), 10);
    if (!isNaN(pairIdx)) {
      const m = mkts.find((x) => x.dex === "spot" && x.assetIndex === 10000 + pairIdx);
      if (m) return m.displayName;
    }
    return coin;
  }
  const bare = stripPrefix(coin);
  const m = mkts.find((x) => stripPrefix(x.name) === bare);
  return m?.displayName ?? spotDisplayName(bare);
}

function TradeRow({ trade, positions, markets }: { trade: RoundTripTrade; positions: AssetPosition[]; markets: MarketInfo[] }) {
  const [expanded, setExpanded] = useState(false);
  const bare = stripPrefix(trade.coin);
  const coinName = resolveOrderCoin(trade.coin, markets);
  const isSpotTrade = trade.coin.startsWith("@");
  const duration = trade.closeTime ? trade.closeTime - trade.openTime : Date.now() - trade.openTime;
  const isWin = trade.netPnl > 0;

  const matchPos = trade.isOpen ? positions.find((ap) => stripPrefix(ap.position.coin) === bare) : null;
  const leverage = matchPos ? `${matchPos.position.leverage.value}x` : null;

  const market = isSpotTrade
    ? markets.find((m) => m.dex === "spot" && m.assetIndex === 10000 + parseInt(trade.coin.slice(1), 10))
    : (markets.find((m) => stripPrefix(m.name) === bare) ?? markets.find((m) => m.name === trade.coin));
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
    <div className="bg-[#141620] rounded-xl overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)} className="w-full px-4 py-3 text-left hover:bg-[#1a1d2e]/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CoinLogo symbol={coinName} size={24} />
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${trade.direction === "Long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {trade.direction.toUpperCase()}{leverage ? ` ${leverage}` : ""}
            </span>
            <div className="flex items-center">
              <Link
                href={isSpotTrade && market ? `/trade/spot-${market.name.replace("spot:", "")}` : `/trade/${bare}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold hover:text-brand transition-colors"
              >
                {coinName}{isSpotTrade && <span className="text-[9px] text-[#555a66] ml-1">SPOT</span>}
              </Link>
              {trade.isOpen && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">OPEN</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {trade.isOpen && markPx > 0 && (
              (() => {
                const unrealized = trade.direction === "Long"
                  ? (markPx - trade.entryPx) * trade.maxSize
                  : (trade.entryPx - markPx) * trade.maxSize;
                return (
                  <span className={`text-sm font-bold ${unrealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {unrealized >= 0 ? "+" : ""}{formatUsd(unrealized)}
                  </span>
                );
              })()
            )}
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
          {trade.isOpen && markPx > 0 && (
            <span>Now: <span className="text-brand font-medium">${markPx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
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
            {trade.isOpen && markPx > 0 && (
              (() => {
                const unrealized = trade.direction === "Long"
                  ? (markPx - trade.entryPx) * trade.maxSize
                  : (trade.entryPx - markPx) * trade.maxSize;
                const ret = trade.direction === "Long"
                  ? ((markPx - trade.entryPx) / trade.entryPx) * 100
                  : ((trade.entryPx - markPx) / trade.entryPx) * 100;
                return (
                  <>
                    <div>
                      <span className="text-[#848e9c]">Unrealized: </span>
                      <span className={`font-bold ${unrealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {unrealized >= 0 ? "+" : ""}{formatUsd(unrealized)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#848e9c]">Return: </span>
                      <span className={`font-medium ${ret >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {ret >= 0 ? "+" : ""}{ret.toFixed(2)}%
                      </span>
                    </div>
                  </>
                );
              })()
            )}
            {!trade.isOpen && trade.exitPx != null && trade.entryPx > 0 && (
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
            <div className="bg-[#0b0e11]/80/60 rounded-lg px-3 py-2">
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

function LiveDuration({ since }: { since: number }) {
  const [, tick] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    ref.current = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(ref.current);
  }, []);
  const elapsed = Date.now() - since;
  const s = Math.floor(elapsed / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return <>{d}d {h}h {m}m {sec}s</>;
  if (h > 0) return <>{h}h {m}m {sec}s</>;
  if (m > 0) return <>{m}m {sec}s</>;
  return <>{sec}s</>;
}

function PositionRow({ ap, markets, fills, trades }: { ap: AssetPosition; markets: MarketInfo[]; fills: Fill[]; trades: RoundTripTrade[] }) {
  const pos = ap.position;
  const size = parseFloat(pos.szi);
  const pnl = parseFloat(pos.unrealizedPnl);
  const entry = parseFloat(pos.entryPx ?? "0");
  const bare = stripPrefix(pos.coin);
  const market = markets.find((m) => stripPrefix(m.name) === bare) ?? markets.find((m) => m.name === pos.coin);
  const markPx = market ? parseFloat(market.markPx) : 0;
  const roe = parseFloat(pos.returnOnEquity) * 100;
  const notional = Math.abs(size) * markPx;
  const displayCoin = market?.displayName ?? bare;
  const tradeCoin = (() => {
    const raw = market?.name ?? pos.coin;
    return raw.includes(":") ? raw.split(":")[1] : raw;
  })();
  const isLong = size > 0;

  const entryTime = useMemo(() => {
    // Use the open round-trip trade's openTime (properly accounts for
    // previous positions that were closed and re-opened).
    const openTrade = trades.find(
      (t) => t.isOpen && stripPrefix(t.coin) === bare
    );
    if (openTrade) return openTrade.openTime;

    // Fallback: earliest "Open" fill for this coin
    const openFills = fills
      .filter((f) => stripPrefix(f.coin) === bare && f.dir.toLowerCase().includes("open"))
      .sort((a, b) => a.time - b.time);
    return openFills.length > 0 ? openFills[0].time : null;
  }, [fills, bare, trades]);

  return (
    <Link href={`/trade/${tradeCoin}`} className="flex items-center gap-3 px-4 py-2.5 bg-[#141620] rounded-xl transition-colors">
      <CoinLogo symbol={bare} size={28} />

      {/* Direction badge */}
      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold ${isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
        {isLong ? "LONG" : "SHORT"}
      </span>

      {/* Coin + leverage */}
      <div className="shrink-0 min-w-[70px]">
        <span className="text-xs font-semibold text-white">{displayCoin}</span>
        <span className="text-[9px] text-[#848e9c] ml-1">{pos.leverage.value}x</span>
      </div>

      {/* Size @ Mark */}
      <span className="hidden sm:block text-[10px] text-[#848e9c] tabular-nums shrink-0">
        {Math.abs(size).toFixed(size < 1 ? 5 : 2)} @ ${markPx.toLocaleString()}
      </span>

      {/* Entry */}
      <span className="hidden md:block text-[10px] text-[#848e9c] tabular-nums shrink-0">
        Entry ${entry.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </span>

      {/* Notional */}
      <span className="hidden lg:block text-[10px] text-[#848e9c] tabular-nums shrink-0">
        {formatUsd(notional)}
      </span>

      {/* Margin */}
      <span className="hidden xl:block text-[10px] text-[#848e9c] tabular-nums shrink-0">
        Margin {formatUsd(parseFloat(pos.marginUsed))}
      </span>

      {/* Funding */}
      {market && (
        <span className={`hidden xl:block text-[10px] tabular-nums shrink-0 ${parseFloat(market.funding) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {(parseFloat(market.funding) * 100).toFixed(4)}%/h
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Duration timer */}
      {entryTime && (
        <span className="text-[10px] text-[#555a66] font-mono tabular-nums shrink-0">
          <LiveDuration since={entryTime} />
        </span>
      )}

      {/* PnL + ROE */}
      <div className="flex items-center gap-1.5 shrink-0">
        <PnlBadge value={pnl} />
        <span className={`text-[10px] font-medium ${roe >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          ({roe >= 0 ? "+" : ""}{roe.toFixed(1)}%)
        </span>
      </div>
    </Link>
  );
}

// ── Based-style Transaction History table ──────────────────

function TransactionTable({ fills }: { fills: Fill[] }) {
  const sorted = [...fills].sort((a, b) => b.time - a.time);
  return (
    <div className="bg-[#141620] rounded-xl overflow-hidden">
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
  polyTrades,
}: {
  dailyPnl: Map<string, { closed: number; fees: number; funding: number; poly: number }>;
  dailyFills: Map<string, Fill[]>;
  totalClosedPnl: number;
  totalFundingPnl: number;
  totalPnlAll: number;
  polyTrades: PolymarketTrade[];
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
  let monthPoly = 0;
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
      const dayNet = entry.closed - entry.fees + entry.funding + entry.poly;
      dayPnls.push(dayNet);
      monthTotalPnl += dayNet;
      monthClosedPnl += entry.closed;
      monthFunding += entry.funding;
      monthPoly += entry.poly;
      if (dayNet > 0) { profitDays++; profitAmt += dayNet; }
      else if (dayNet < 0) { lossDays++; lossAmt += dayNet; }
    } else {
      dayPnls.push(null);
    }
  }

  const maxAbsPnl = dayPnls.reduce<number>((mx, v) => Math.max(mx, Math.abs(v ?? 0)), 0);

  const totalBarWidth = Math.abs(profitAmt) + Math.abs(lossAmt);
  const profitPct = totalBarWidth > 0 ? (Math.abs(profitAmt) / totalBarWidth) * 100 : 50;

  const selectedFills = selectedDay ? (dailyFills.get(selectedDay) ?? []).sort((a, b) => b.time - a.time) : [];
  const selectedPnlEntry = selectedDay ? dailyPnl.get(selectedDay) : null;

  const selectedDayPolyTrades = useMemo(() => {
    if (!selectedDay) return [];
    const toLocalDate = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    return polyTrades
      .filter((pt) => pt.timestamp && toLocalDate(pt.timestamp * 1000) === selectedDay)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedDay, polyTrades]);

  return (
    <div className="space-y-3">
      {/* Header with month nav */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="text-[#848e9c] hover:text-white p-1">&lt;</button>
        <h3 className="text-base font-bold text-white">{monthStr}</h3>
        <button onClick={nextMonth} className="text-[#848e9c] hover:text-white p-1">&gt;</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Total PnL</p>
          <p className={`text-sm font-bold ${monthTotalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {monthTotalPnl >= 0 ? "+" : ""}{formatUsd(monthTotalPnl)}
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Closed PnL</p>
          <p className={`text-sm font-bold ${monthClosedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {monthClosedPnl >= 0 ? "+" : ""}{formatUsd(monthClosedPnl)}
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Profitable Days</p>
          <p className="text-sm font-bold text-white">{profitDays} / {profitDays + lossDays}</p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Funding</p>
          <p className={`text-sm font-bold ${monthFunding >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {monthFunding >= 0 ? "+" : ""}{formatUsd(monthFunding)}
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase">Polymarket</p>
          <p className={`text-sm font-bold ${monthPoly >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {monthPoly >= 0 ? "+" : ""}{formatUsd(monthPoly)}
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
      <div className="bg-[#141620] rounded-xl overflow-hidden">
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
            const intensity = hasData && maxAbsPnl > 0 ? Math.min(Math.abs(pnl!) / maxAbsPnl, 1) : 0;
            const bgOpacity = hasData ? 0.08 + intensity * 0.35 : 0;
            const bgColor = isProfit
              ? `rgba(16, 185, 129, ${bgOpacity})`
              : isLoss
              ? `rgba(239, 68, 68, ${bgOpacity})`
              : undefined;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : (hasData ? key : null))}
                style={isSelected ? undefined : bgColor ? { backgroundColor: bgColor } : undefined}
                className={`aspect-square border-r border-b border-[#2a2e3e]/20 p-1 relative transition-colors flex flex-col ${
                  isSelected
                    ? "ring-2 ring-brand ring-inset bg-brand/10"
                    : hasData ? "hover:brightness-125" : ""
                } ${hasData ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`text-[10px] leading-none font-medium ${isToday(day) ? "text-brand font-bold" : "text-[#848e9c]"}`}>
                  {day}
                </span>
                {hasData && (
                  <span className={`text-[10px] font-bold mt-auto self-center ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                    {pnl >= 0 ? "+" : ""}{formatUsd(pnl)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && selectedPnlEntry && (
        <div className="bg-[#141620] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e3e]">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-white">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              {(() => {
                const net = selectedPnlEntry.closed - selectedPnlEntry.fees + selectedPnlEntry.funding + selectedPnlEntry.poly;
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
            {selectedPnlEntry.poly !== 0 && (
              <div>
                <span className="text-[#848e9c]">Polymarket: </span>
                <span className={selectedPnlEntry.poly >= 0 ? "text-blue-400 font-medium" : "text-red-400 font-medium"}>
                  {selectedPnlEntry.poly >= 0 ? "+" : ""}{formatUsd(selectedPnlEntry.poly)}
                </span>
              </div>
            )}
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
          ) : selectedDayPolyTrades.length === 0 ? (
            <div className="px-4 py-4 text-center text-[10px] text-[#848e9c]">No fills for this day (funding only)</div>
          ) : null}

          {/* Polymarket trades for selected day */}
          {selectedDayPolyTrades.length > 0 && (
            <>
              <div className="px-4 py-2 border-t border-[#2a2e3e]/50">
                <p className="text-[10px] text-blue-400 font-medium">Polymarket Trades ({selectedDayPolyTrades.length})</p>
              </div>
              <div className="divide-y divide-[#2a2e3e]/30 max-h-[200px] overflow-y-auto">
                {selectedDayPolyTrades.map((pt, i) => {
                  const isBuy = pt.side === "BUY";
                  const total = pt.size * pt.price;
                  return (
                    <Link
                      key={`${pt.transactionHash}-${i}`}
                      href={`/predict/${pt.eventSlug}`}
                      className="flex items-center justify-between px-4 py-2 text-[10px] hover:bg-[#1a1d2e]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {pt.side}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">POLY</span>
                        <span className="text-white font-medium truncate max-w-[180px]">{pt.title}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${pt.outcome === "Yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                          {pt.outcome}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white">{pt.size.toFixed(2)} @ {(pt.price * 100).toFixed(1)}¢</span>
                        <span className="text-[#848e9c]">{formatUsd(total)}</span>
                        <span className="text-[#848e9c]">
                          {new Date(pt.timestamp * 1000).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Coin Performance ─────────────────────────────────────

interface CoinStats {
  coin: string;
  grossPnl: number;
  fees: number;
  funding: number;
  netPnl: number;
  fills: number;
  trades: number;
  wins: number;
  losses: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  totalVolume: number;
}

function CoinPerformance({
  fills,
  trades,
  funding,
  polyPositions,
  polyTrades,
}: {
  fills: Fill[];
  trades: RoundTripTrade[];
  funding: FundingPayment[];
  polyPositions: PolymarketPosition[];
  polyTrades: PolymarketTrade[];
}) {
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"netPnl" | "fills" | "trades" | "winRate" | "volume">("netPnl");
  const [sortAsc, setSortAsc] = useState(false);

  const coinStats = useMemo(() => {
    const map = new Map<string, CoinStats>();

    const getOrCreate = (coin: string): CoinStats => {
      const bare = stripPrefix(coin);
      if (!map.has(bare)) {
        map.set(bare, {
          coin: bare, grossPnl: 0, fees: 0, funding: 0, netPnl: 0,
          fills: 0, trades: 0, wins: 0, losses: 0,
          bestTrade: -Infinity, worstTrade: Infinity,
          avgWin: 0, avgLoss: 0, totalVolume: 0,
        });
      }
      return map.get(bare)!;
    };

    for (const f of fills) {
      const s = getOrCreate(f.coin);
      s.grossPnl += parseFloat(f.closedPnl);
      s.fees += parseFloat(f.fee);
      s.fills++;
      s.totalVolume += parseFloat(f.px) * parseFloat(f.sz);
    }

    for (const fp of funding) {
      const s = getOrCreate(fp.delta.coin);
      s.funding += parseFloat(fp.delta.usdc);
    }

    for (const t of trades) {
      if (t.isOpen) continue;
      const bare = stripPrefix(t.coin);
      const s = getOrCreate(t.coin);
      s.trades++;
      if (t.netPnl > 0) s.wins++;
      else if (t.netPnl < 0) s.losses++;
      if (t.netPnl > s.bestTrade) s.bestTrade = t.netPnl;
      if (t.netPnl < s.worstTrade) s.worstTrade = t.netPnl;
    }

    for (const s of map.values()) {
      s.netPnl = s.grossPnl - s.fees + s.funding;
      s.avgWin = s.wins > 0 ? map.get(s.coin)!.grossPnl / s.wins : 0;
      if (s.bestTrade === -Infinity) s.bestTrade = 0;
      if (s.worstTrade === Infinity) s.worstTrade = 0;

      const coinTrades = trades.filter((t) => !t.isOpen && stripPrefix(t.coin) === s.coin);
      const winTrades = coinTrades.filter((t) => t.netPnl > 0);
      const lossTrades = coinTrades.filter((t) => t.netPnl < 0);
      s.avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.netPnl, 0) / winTrades.length : 0;
      s.avgLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + t.netPnl, 0) / lossTrades.length : 0;
    }

    return Array.from(map.values());
  }, [fills, trades, funding]);

  const sorted = useMemo(() => {
    const arr = [...coinStats];
    arr.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case "netPnl": va = a.netPnl; vb = b.netPnl; break;
        case "fills": va = a.fills; vb = b.fills; break;
        case "trades": va = a.trades; vb = b.trades; break;
        case "winRate":
          va = a.trades > 0 ? a.wins / a.trades : -1;
          vb = b.trades > 0 ? b.wins / b.trades : -1;
          break;
        case "volume": va = a.totalVolume; vb = b.totalVolume; break;
        default: va = a.netPnl; vb = b.netPnl;
      }
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [coinStats, sortKey, sortAsc]);

  const polyPnl = useMemo(() => polyPositions.reduce((s, p) => s + p.cashPnl, 0), [polyPositions]);
  const polyVolume = useMemo(() => polyTrades.reduce((s, t) => s + t.size * t.price, 0), [polyTrades]);

  const totalNet = coinStats.reduce((s, c) => s + c.netPnl, 0);
  const totalGross = coinStats.reduce((s, c) => s + c.grossPnl, 0);
  const totalFees = coinStats.reduce((s, c) => s + c.fees, 0);
  const totalFunding = coinStats.reduce((s, c) => s + c.funding, 0);
  const totalTrades = coinStats.reduce((s, c) => s + c.trades, 0);
  const totalWins = coinStats.reduce((s, c) => s + c.wins, 0);
  const overallWinRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(0) : "–";
  const bestCoin = coinStats.length > 0 ? [...coinStats].sort((a, b) => b.netPnl - a.netPnl)[0] : null;
  const worstCoin = coinStats.length > 0 ? [...coinStats].sort((a, b) => a.netPnl - b.netPnl)[0] : null;

  const coinTrades = useMemo(() => {
    if (!expandedCoin) return [];
    return trades
      .filter((t) => stripPrefix(t.coin) === expandedCoin)
      .sort((a, b) => (b.closeTime ?? b.openTime) - (a.closeTime ?? a.openTime));
  }, [expandedCoin, trades]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (fills.length === 0) {
    return (
      <div className="text-center py-16 bg-[#141620] rounded-xl">
        <BarChart3 className="h-8 w-8 text-[#848e9c] mx-auto mb-3" />
        <p className="text-sm text-[#848e9c]">No trading data yet</p>
        <Link href="/trade/BTC" className="inline-block mt-3 text-xs text-brand hover:underline">Start trading &rarr;</Link>
      </div>
    );
  }

  const maxAbsNet = Math.max(...coinStats.map((c) => Math.abs(c.netPnl)), Math.abs(polyPnl), 1);

  return (
    <div className="space-y-4">
      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Net P&L</p>
          <p className={`text-lg font-bold ${(totalNet + polyPnl) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {(totalNet + polyPnl) >= 0 ? "+" : ""}{formatUsd(totalNet + polyPnl)}
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Win Rate</p>
          <p className="text-lg font-bold text-white">
            {overallWinRate}%
            <span className="text-[10px] text-[#848e9c] font-normal ml-1">({totalWins}/{totalTrades})</span>
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Polymarket P&L</p>
          <p className={`text-lg font-bold ${polyPnl >= 0 ? "text-blue-400" : "text-red-400"}`}>
            {polyPnl >= 0 ? "+" : ""}{formatUsd(polyPnl)}
          </p>
          <p className="text-[10px] text-[#848e9c] mt-0.5">{polyPositions.length} position{polyPositions.length !== 1 ? "s" : ""} · {polyTrades.length} trades</p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5 flex items-center gap-1">
            <Trophy className="h-2.5 w-2.5" /> Best
          </p>
          {bestCoin && (
            <p className="text-lg font-bold text-emerald-400">
              {bestCoin.coin} <span className="text-xs font-medium">+{formatUsd(bestCoin.netPnl)}</span>
            </p>
          )}
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5 flex items-center gap-1">
            <Flame className="h-2.5 w-2.5" /> Worst
          </p>
          {worstCoin && (
            <p className="text-lg font-bold text-red-400">
              {worstCoin.coin} <span className="text-xs font-medium">{formatUsd(worstCoin.netPnl)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Breakdown: fees + funding */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Gross P&L</p>
          <p className={`text-sm font-bold ${totalGross >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalGross >= 0 ? "+" : ""}{formatUsd(totalGross)}
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Total Fees</p>
          <p className="text-sm font-bold text-amber-400">-{formatUsd(totalFees)}</p>
        </div>
        <div className="bg-[#141620] rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-[#848e9c] uppercase tracking-wide mb-0.5">Funding</p>
          <p className={`text-sm font-bold ${totalFunding >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalFunding >= 0 ? "+" : ""}{formatUsd(totalFunding)}
          </p>
        </div>
      </div>

      {/* P&L bar chart */}
      <div className="bg-[#141620] rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-3">P&L by Asset</p>
        <div className="space-y-2">
          {[...coinStats].sort((a, b) => b.netPnl - a.netPnl).map((c) => {
            const pct = (Math.abs(c.netPnl) / maxAbsNet) * 100;
            const isPositive = c.netPnl >= 0;
            return (
              <button
                key={c.coin}
                onClick={() => setExpandedCoin(expandedCoin === c.coin ? null : c.coin)}
                className="w-full group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-white w-20 text-left shrink-0">{c.coin}</span>
                  <div className="flex-1 h-6 bg-[#0b0e11] rounded-md overflow-hidden relative">
                    <div
                      className={`h-full rounded-md transition-all ${isPositive ? "bg-emerald-500/30" : "bg-red-500/30"}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                    <span className={`absolute inset-0 flex items-center px-2 text-[10px] font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {c.netPnl >= 0 ? "+" : ""}{formatUsd(c.netPnl)}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#848e9c] w-16 text-right shrink-0">{c.trades} trades</span>
                  <ChevronDown className={`h-3 w-3 text-[#848e9c] transition-transform ${expandedCoin === c.coin ? "rotate-180" : ""}`} />
                </div>
              </button>
            );
          })}
          {polyPositions.length > 0 && (
            <div className="w-full">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-blue-400 w-20 text-left shrink-0">Polymarket</span>
                <div className="flex-1 h-6 bg-[#0b0e11] rounded-md overflow-hidden relative">
                  <div
                    className={`h-full rounded-md transition-all ${polyPnl >= 0 ? "bg-blue-500/30" : "bg-red-500/30"}`}
                    style={{ width: `${Math.max((Math.abs(polyPnl) / maxAbsNet) * 100, 2)}%` }}
                  />
                  <span className={`absolute inset-0 flex items-center px-2 text-[10px] font-bold ${polyPnl >= 0 ? "text-blue-400" : "text-red-400"}`}>
                    {polyPnl >= 0 ? "+" : ""}{formatUsd(polyPnl)}
                  </span>
                </div>
                <span className="text-[10px] text-[#848e9c] w-16 text-right shrink-0">{polyTrades.length} trades</span>
                <div className="h-3 w-3" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sortable table */}
      <div className="bg-[#141620] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2e3e]">
          <p className="text-xs font-semibold text-white">Coin Breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[#2a2e3e]/50 text-[#848e9c] uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Coin</th>
                <SortHeader label="Net P&L" sortKey="netPnl" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Trades" sortKey="trades" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Win Rate" sortKey="winRate" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Fills" sortKey="fills" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Volume" sortKey="volume" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                <th className="text-right px-4 py-2.5 font-medium">Best</th>
                <th className="text-right px-4 py-2.5 font-medium">Worst</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const wr = c.trades > 0 ? ((c.wins / c.trades) * 100).toFixed(0) : "–";
                const isExpanded = expandedCoin === c.coin;
                return (
                  <tr
                    key={c.coin}
                    onClick={() => setExpandedCoin(isExpanded ? null : c.coin)}
                    className={`border-b border-[#2a2e3e]/20 cursor-pointer transition-colors ${isExpanded ? "bg-brand/5" : "hover:bg-[#1a1d2e]/50"}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/trade/${c.coin}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-white hover:text-brand transition-colors"
                        >
                          {c.coin}
                        </Link>
                        {isExpanded && <ChevronUp className="h-3 w-3 text-brand" />}
                      </div>
                    </td>
                    <td className={`text-right px-4 py-2.5 font-bold ${c.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {c.netPnl >= 0 ? "+" : ""}{formatUsd(c.netPnl)}
                    </td>
                    <td className="text-right px-4 py-2.5 text-white">{c.trades}</td>
                    <td className="text-right px-4 py-2.5">
                      <span className={`${c.trades > 0 && c.wins / c.trades >= 0.5 ? "text-emerald-400" : c.trades > 0 ? "text-red-400" : "text-[#848e9c]"}`}>
                        {wr}%
                      </span>
                      <span className="text-[#848e9c] ml-1">({c.wins}/{c.trades})</span>
                    </td>
                    <td className="text-right px-4 py-2.5 text-[#848e9c]">{c.fills}</td>
                    <td className="text-right px-4 py-2.5 text-[#848e9c]">{formatUsd(c.totalVolume)}</td>
                    <td className={`text-right px-4 py-2.5 ${c.bestTrade >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {c.bestTrade !== 0 ? `${c.bestTrade >= 0 ? "+" : ""}${formatUsd(c.bestTrade)}` : "–"}
                    </td>
                    <td className={`text-right px-4 py-2.5 ${c.worstTrade >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {c.worstTrade !== 0 ? `${c.worstTrade >= 0 ? "+" : ""}${formatUsd(c.worstTrade)}` : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded coin detail */}
      {expandedCoin && (
        <CoinTradeDetail
          coin={expandedCoin}
          stats={coinStats.find((c) => c.coin === expandedCoin)!}
          trades={coinTrades}
          onClose={() => setExpandedCoin(null)}
        />
      )}

      {/* Polymarket Positions Performance */}
      {polyPositions.length > 0 && (
        <div className="bg-[#141620] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e3e]">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-400" />
              <p className="text-xs font-semibold text-white">Polymarket Positions</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold ${polyPnl >= 0 ? "text-blue-400" : "text-red-400"}`}>
                {polyPnl >= 0 ? "+" : ""}{formatUsd(polyPnl)}
              </span>
              <span className="text-[10px] text-[#848e9c]">Vol: {formatUsd(polyVolume)}</span>
            </div>
          </div>
          <div className="divide-y divide-[#2a2e3e]/30 max-h-[400px] overflow-y-auto">
            {polyPositions.map((p) => {
              const isWin = p.cashPnl >= 0;
              return (
                <Link
                  key={p.asset}
                  href={`/predict/${p.eventSlug}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1d2e]/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {p.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.icon} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Target className="h-3 w-3 text-blue-400" />
                      </div>
                    )}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${p.outcome === "Yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {p.outcome.toUpperCase()}
                    </span>
                    <span className="text-xs text-white font-medium truncate max-w-[250px]">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#848e9c]">{p.size.toFixed(2)} @ {(p.avgPrice * 100).toFixed(1)}¢</span>
                    <span className="text-xs font-bold text-white">{formatUsd(p.currentValue)}</span>
                    <span className={`text-xs font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                      {isWin ? "+" : ""}{formatUsd(p.cashPnl)}
                      {p.percentPnl !== 0 && (
                        <span className="text-[10px] font-normal ml-0.5">({isWin ? "+" : ""}{p.percentPnl.toFixed(1)}%)</span>
                      )}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  asc,
  onSort,
}: {
  label: string;
  sortKey: "netPnl" | "fills" | "trades" | "winRate" | "volume";
  currentKey: string;
  asc: boolean;
  onSort: (k: "netPnl" | "fills" | "trades" | "winRate" | "volume") => void;
}) {
  const active = currentKey === key;
  return (
    <th
      className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => onSort(key)}
    >
      {label}
      {active && (
        <span className="ml-0.5 text-brand">{asc ? "↑" : "↓"}</span>
      )}
    </th>
  );
}

function CoinTradeDetail({
  coin,
  stats,
  trades,
  onClose,
}: {
  coin: string;
  stats: CoinStats;
  trades: RoundTripTrade[];
  onClose: () => void;
}) {
  const wr = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(0) : "–";
  const profitFactor = Math.abs(stats.avgLoss) > 0 ? Math.abs(stats.avgWin / stats.avgLoss) : stats.avgWin > 0 ? Infinity : 0;

  return (
    <div className="bg-[#141620] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e3e]">
        <div className="flex items-center gap-3">
          <Link href={`/trade/${coin}`} className="text-sm font-bold text-white hover:text-brand transition-colors">
            {coin}
          </Link>
          <span className={`text-sm font-bold ${stats.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {stats.netPnl >= 0 ? "+" : ""}{formatUsd(stats.netPnl)}
          </span>
        </div>
        <button onClick={onClose} className="text-[#848e9c] hover:text-white text-xs px-2 py-1 rounded hover:bg-[#2a2e3e] transition-colors">
          Close
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#2a2e3e]/30">
        {[
          { label: "Gross P&L", value: formatUsd(stats.grossPnl), color: stats.grossPnl >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Fees", value: `-${formatUsd(stats.fees)}`, color: "text-amber-400" },
          { label: "Funding", value: formatUsd(stats.funding), color: stats.funding >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Win Rate", value: `${wr}%`, color: "text-white" },
          { label: "Avg Win", value: stats.avgWin > 0 ? `+${formatUsd(stats.avgWin)}` : "–", color: "text-emerald-400" },
          { label: "Avg Loss", value: stats.avgLoss < 0 ? formatUsd(stats.avgLoss) : "–", color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[#141620] px-3 py-2.5">
            <p className="text-[9px] text-[#848e9c] uppercase">{s.label}</p>
            <p className={`text-xs font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Trades list */}
      <div className="px-4 py-3 border-t border-[#2a2e3e]">
        <p className="text-[10px] text-[#848e9c] font-medium mb-2">{trades.length} round-trip trade{trades.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="divide-y divide-[#2a2e3e]/30 max-h-[400px] overflow-y-auto">
        {trades.map((t, i) => {
          const duration = t.closeTime ? t.closeTime - t.openTime : Date.now() - t.openTime;
          const isWin = t.netPnl > 0;
          const fmtTime = (ts: number) =>
            new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          return (
            <div key={`${t.coin}-${t.openTime}-${i}`} className="px-4 py-2.5 hover:bg-[#1a1d2e]/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${t.direction === "Long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {t.direction.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-[#848e9c]">
                    {fmtTime(t.openTime)} → {t.closeTime ? fmtTime(t.closeTime) : "now"}
                  </span>
                  {t.isOpen && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">OPEN</span>}
                </div>
                <span className={`text-xs font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                  {t.netPnl >= 0 ? "+" : ""}{formatUsd(t.netPnl)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] text-[#848e9c]">
                <span>Size: <span className="text-white">{t.maxSize.toFixed(t.maxSize < 1 ? 5 : 2)}</span></span>
                <span>Entry: <span className="text-white">${t.entryPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></span>
                {t.exitPx != null && <span>Exit: <span className="text-white">${t.exitPx.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></span>}
                <span>Duration: <span className="text-white">{formatDuration(duration)}</span></span>
                <span>Fees: <span className="text-amber-400">-{formatUsd(t.totalFees)}</span></span>
                <span>{t.fills.length} fill{t.fills.length > 1 ? "s" : ""}</span>
              </div>
            </div>
          );
        })}
        {trades.length === 0 && (
          <div className="px-4 py-6 text-center text-[10px] text-[#848e9c]">No completed round-trip trades for {coin}</div>
        )}
      </div>
    </div>
  );
}

// ── Polymarket Trade Table ──────────────────────────────────

function PolyTradeTable({ trades, positions }: { trades: PolymarketTrade[]; positions: PolymarketPosition[] }) {
  const sorted = [...trades].sort((a, b) => b.timestamp - a.timestamp);

  // Build current price map for active positions (used to value open shares)
  const curPriceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of positions) {
      if (p.curPrice > 0) m.set(p.asset, p.curPrice);
    }
    return m;
  }, [positions]);

  // Compute per-trade P&L using running cost basis (FIFO-style).
  // Process trades chronologically per asset, track avg cost, realize on sells.
  // Remaining open shares valued at curPrice from positions.
  const tradePnlMap = useMemo(() => {
    const chronological = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const assetState = new Map<string, { shares: number; costBasis: number }>();
    const pnlMap = new Map<string, number>(); // key = `${txHash}-${index in sorted}`

    for (const t of chronological) {
      const state = assetState.get(t.asset) ?? { shares: 0, costBasis: 0 };
      const key = t.transactionHash;

      if (t.side === "BUY") {
        state.costBasis = ((state.costBasis * state.shares) + (t.price * t.size)) / (state.shares + t.size);
        state.shares += t.size;
        pnlMap.set(key, 0); // BUY: no realized PnL yet (unrealized computed later)
      } else {
        const realized = (t.price - state.costBasis) * t.size;
        pnlMap.set(key, realized);
        state.shares = Math.max(state.shares - t.size, 0);
      }
      assetState.set(t.asset, state);
    }

    // Unrealized PnL for remaining open shares (FIFO allocation)
    const assetRemaining = new Map<string, number>();
    for (const [asset, state] of assetState) {
      if (state.shares >= 0.01) assetRemaining.set(asset, state.shares);
    }
    for (let i = chronological.length - 1; i >= 0; i--) {
      const t = chronological[i];
      if (t.side !== "BUY") continue;
      const remaining = assetRemaining.get(t.asset) ?? 0;
      if (remaining < 0.01) continue;
      const curPrice = curPriceMap.get(t.asset);
      if (curPrice === undefined) continue;
      const allocated = Math.min(t.size, remaining);
      pnlMap.set(t.transactionHash, (curPrice - t.price) * allocated);
      assetRemaining.set(t.asset, remaining - allocated);
    }

    return pnlMap;
  }, [trades, curPriceMap]);

  const totalPnl = useMemo(() => {
    let sum = 0;
    for (const v of tradePnlMap.values()) sum += v;
    return sum;
  }, [tradePnlMap]);

  return (
    <div className="bg-[#141620] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e3e]">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-white">Polymarket Trades</p>
          <span className={`text-xs font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}{formatUsd(totalPnl)}
          </span>
        </div>
        <p className="text-[10px] text-[#848e9c]">Total: {trades.length}</p>
      </div>
      <div className="grid grid-cols-8 px-4 py-2 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e3e]/50 font-medium">
        <span>Date</span>
        <span className="col-span-2">Market</span>
        <span>Side</span>
        <span className="text-right">Price</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Total</span>
        <span className="text-right">P&L</span>
      </div>
      {sorted.map((t, i) => {
        const total = t.size * t.price;
        const isBuy = t.side === "BUY";
        const pnl = tradePnlMap.get(t.transactionHash) ?? null;
        const showPnl = pnl !== null && pnl !== 0;
        return (
          <Link
            key={`${t.transactionHash}-${i}`}
            href={`/predict/${t.eventSlug}`}
            className="grid grid-cols-8 items-center px-4 py-2.5 text-xs border-b border-[#2a2e3e]/20 hover:bg-[#1a1d2e]/50 transition-colors"
          >
            <span className="text-[#848e9c]">
              {new Date(t.timestamp * 1000).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="col-span-2 text-white font-medium truncate pr-2">
              <span className={`text-[9px] px-1 py-0.5 rounded font-bold mr-1 ${t.outcome === "Yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {t.outcome}
              </span>
              {t.title}
            </span>
            <span className={`font-medium ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
              {t.side}
            </span>
            <span className="text-right text-white">{(t.price * 100).toFixed(1)}¢</span>
            <span className="text-right text-white">{t.size.toFixed(2)}</span>
            <span className="text-right text-white">{formatUsd(total)}</span>
            <span className={`text-right font-medium ${!showPnl ? "text-[#555a66]" : pnl! >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {!showPnl ? "–" : `${pnl! >= 0 ? "+" : ""}${formatUsd(pnl!)}`}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Polymarket Position Row ─────────────────────────────────

function PolyPositionRow({ position: p }: { position: PolymarketPosition }) {
  const isProfit = p.cashPnl >= 0;
  const endDate = p.endDate ? new Date(p.endDate) : null;
  const ended = endDate ? endDate.getTime() < Date.now() : false;

  return (
    <Link
      href={`/predict/${p.eventSlug}`}
      className="flex items-center gap-3 bg-[#141620] rounded-xl px-4 py-3.5 hover:bg-[#1a1d2e] transition-colors"
    >
      {p.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.icon} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <Target className="h-4 w-4 text-blue-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">{p.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
            p.outcome === "Yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          }`}>
            {p.outcome.toUpperCase()}
          </span>
          <span className="text-[10px] text-[#848e9c]">
            {p.size.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares @ {(p.avgPrice * 100).toFixed(1)}¢
          </span>
          {p.curPrice > 0 && (
            <span className="text-[10px] text-[#848e9c]">
              → now {(p.curPrice * 100).toFixed(1)}¢
            </span>
          )}
          {endDate && (
            <span className={`text-[10px] ${ended ? "text-amber-400" : "text-[#555a66]"}`}>
              {ended ? "Ended" : `Ends ${endDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`}
            </span>
          )}
          {p.redeemable && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">REDEEM</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-white tabular-nums">{formatUsd(p.currentValue)}</p>
        <p className={`text-[11px] tabular-nums ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
          {isProfit ? "+" : ""}{formatUsd(p.cashPnl)}
          {p.percentPnl !== 0 && (
            <span className="ml-0.5">({isProfit ? "+" : ""}{p.percentPnl.toFixed(1)}%)</span>
          )}
        </p>
      </div>
    </Link>
  );
}
