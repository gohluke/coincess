"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUpDown, Search, ChevronDown, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { signAndPlaceOrder, getMarketOrderPrice, signAndApproveAgent, signAndApproveBuilderFee, getStoredAgent } from "@/lib/hyperliquid/signing";
import { spotDisplayName } from "@/lib/hyperliquid/api";
import { useWallet } from "@/hooks/useWallet";
import { useSettingsStore } from "@/lib/settings/store";
import { getConnectedAddress, onAccountsChanged } from "@/lib/hyperliquid/wallet";
import { CoinLogo } from "@/components/CoinLogo";
import { BRAND_CONFIG } from "@/lib/brand";
import type { MarketInfo } from "@/lib/hyperliquid/types";

// Well-known tokens shown first in the picker (order = display priority)
const CURATED_POPULAR_CRYPTO = ["BTC", "ETH", "SOL", "HYPE", "PURR", "LINK"];
const CURATED_POPULAR_STOCKS = ["Tesla", "NVIDIA", "Apple", "Amazon", "Microsoft", "Meta Platforms"];
// Priority ordering for sort — lower number appears first
const PRIORITY_CRYPTO: Record<string, number> = {
  BTC: 0, ETH: 1, SOL: 2, HYPE: 3, PURR: 4, LINK: 5,
};
const PRIORITY_STOCKS: Record<string, number> = {
  Tesla: 0, NVIDIA: 1, Apple: 2, Amazon: 3, Microsoft: 4, "Meta Platforms": 5,
  "S&P 500 ETF": 6, "Nasdaq 100 ETF": 7, Robinhood: 8, MicroStrategy: 9,
};
const MAX_PRIORITY = 999;
const STABLECOINS = new Set(["USDC", "USDT0", "USDE", "USDH"]);

/* ─── helpers ──────────────────────────────────────────────── */

function fmtPrice(px: number): string {
  if (px >= 1000) return px.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (px >= 1) return px.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (px >= 0.01) return px.toFixed(4);
  return px.toPrecision(3);
}

function fmtChange(pct: number): string {
  const s = Math.abs(pct).toFixed(2);
  return pct >= 0 ? `+${s}%` : `-${s}%`;
}

/* ─── CoinPickerDropdown ───────────────────────────────────── */

type Mode = "buy" | "sell" | "convert";
type PickerTarget = "main" | "convertFrom" | "convertTo";
type PickerCategory = "crypto" | "stocks";
type PickerItem = { displayName: string; ticker: string; price: number; change24h: number | null; volume: number; name: string; dex: string };

function CoinPickerDropdown({
  items,
  popularCoins,
  popularStocks,
  selectedCoin,
  pickerSearch,
  onSearchChange,
  onSelect,
}: {
  items: PickerItem[];
  popularCoins: string[];
  popularStocks: string[];
  selectedCoin: string;
  pickerSearch: string;
  onSearchChange: (v: string) => void;
  onSelect: (coin: string) => void;
}) {
  const [category, setCategory] = useState<PickerCategory>("crypto");

  const filtered = useMemo(() => {
    let list = items;
    if (!pickerSearch) {
      list = list.filter((m) => category === "stocks" ? m.dex === "hip3" : m.dex === "spot");
    } else {
      const q = pickerSearch.toUpperCase();
      list = list.filter((m) => m.displayName.toUpperCase().includes(q) || m.ticker.toUpperCase().includes(q));
    }
    return list;
  }, [items, pickerSearch, category]);

  const activePills = category === "stocks" ? popularStocks : popularCoins;

  return (
    <div className="bg-[#0b0e11] rounded-xl border border-[#2a2e39] overflow-hidden">
      {/* Category tabs */}
      <div className="flex gap-1 p-2 pb-0">
        {(["crypto", "stocks"] as PickerCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); onSearchChange(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
              category === cat ? "bg-[#1a1d26] text-white" : "text-[#4a4e59] hover:text-[#848e9c]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555]" />
          <input
            type="text"
            value={pickerSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={category === "stocks" ? "Search stocks..." : "Search tokens..."}
            autoFocus
            className="w-full bg-[#12141a] rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-[#4a4e59] focus:outline-none"
          />
        </div>
      </div>

      {!pickerSearch && activePills.length > 0 && (
        <div className="flex gap-1.5 px-2 pb-2 overflow-x-auto scrollbar-none">
          {activePills.map((coin) => (
            <button
              key={coin}
              onClick={() => onSelect(coin)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                selectedCoin === coin
                  ? "bg-brand/20 text-brand border border-brand/30"
                  : "bg-[#1a1d26] text-[#848e9c] hover:text-white border border-transparent"
              }`}
            >
              <CoinLogo symbol={coin} size={16} />
              {coin}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-56 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-[#4a4e59] text-sm">
            {pickerSearch ? "No results" : category === "stocks" ? "No stocks available" : "No tokens found"}
          </div>
        ) : (
          filtered.map((m) => {
            const chg = m.change24h;
            const isStock = m.dex === "hip3";
            return (
              <button
                key={m.name}
                onClick={() => onSelect(m.displayName)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#12141a] transition-colors ${
                  selectedCoin === m.displayName ? "bg-[#12141a]" : ""
                }`}
              >
                <CoinLogo symbol={isStock ? m.ticker : m.displayName} size={28} />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-sm font-medium truncate">{m.displayName}</span>
                    {isStock && <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold shrink-0">STOCK</span>}
                  </div>
                  <span className="text-[#4a4e59] text-xs">{isStock ? m.ticker : ""}{isStock ? " · " : ""}/USDC</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-white">${fmtPrice(m.price)}</div>
                  {chg !== null ? (
                    <div className={`text-[10px] ${chg >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                      {fmtChange(chg)}
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#4a4e59]">—</div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────── */

export default function BuyPage() {
  const router = useRouter();

  const { address: walletAddr, connect: walletConnect, source } = useWallet();
  const activeLinkedAddr = useSettingsStore((s) => s.getActiveAddress)();

  const {
    markets, loadMarkets, refreshMarkets,
    address, setAddress,
    spotClearinghouse,
    loadUserState,
  } = useTradingStore();

  const [mode, setMode] = useState<Mode>("buy");
  const [selectedCoin, setSelectedCoin] = useState("");
  const [convertFrom, setConvertFrom] = useState("");
  const [convertTo, setConvertTo] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [showPicker, setShowPicker] = useState<PickerTarget | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agentApproved, setAgentApproved] = useState(false);
  const [enablingTrading, setEnablingTrading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const defaultsSet = useRef(false);

  /* ── wallet sync ── */
  useEffect(() => {
    const effective = activeLinkedAddr ?? walletAddr;
    if (effective && effective !== address) setAddress(effective);
  }, [walletAddr, activeLinkedAddr, address, setAddress]);

  useEffect(() => {
    if (source === "privy") return;
    getConnectedAddress().then((addr) => {
      if (addr && !walletAddr && !activeLinkedAddr) setAddress(addr);
    });
    return onAccountsChanged((accounts) => {
      if (!activeLinkedAddr) setAddress(accounts[0] ?? null);
    });
  }, [setAddress, walletAddr, source, activeLinkedAddr]);

  /* ── load + refresh ── */
  useEffect(() => { loadMarkets(); }, [loadMarkets]);
  useEffect(() => {
    const id = setInterval(() => { refreshMarkets(); }, 8000);
    return () => clearInterval(id);
  }, [refreshMarkets]);

  // Load balances on connect + refresh every 15s
  useEffect(() => {
    if (!address) return;
    loadUserState();
    const id = setInterval(loadUserState, 15000);
    return () => clearInterval(id);
  }, [address, loadUserState]);

  useEffect(() => {
    if (address) setAgentApproved(!!getStoredAgent(address));
  }, [address]);

  /* ── derived market data ── */
  const spotMarkets = useMemo(
    () => markets.filter((m) => m.dex === "spot" || m.dex === "hip3"),
    [markets],
  );

  // Build a map of perp 24h changes keyed by display name (e.g. "BTC", "ETH")
  // Perps have reliable prevDayPx; many spot pairs have stale/inaccurate values
  const perpChangeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of markets) {
      if (m.dex !== "" && m.dex !== "xyz") continue; // perps only
      const px = parseFloat(m.markPx);
      const prev = parseFloat(m.prevDayPx);
      if (px > 0 && prev > 0) {
        map.set(m.name, ((px - prev) / prev) * 100);
      }
    }
    return map;
  }, [markets]);

  // Compute accurate 24h change: prefer perp data, fall back to own prevDayPx
  const get24hChange = useCallback((spot: MarketInfo): number | null => {
    const dn = spot.displayName;
    if (perpChangeMap.has(dn)) return perpChangeMap.get(dn)!;
    // HIP-3 tickers (e.g. "TSLA") may match a perp name directly
    const ticker = spot.name.replace("spot:", "");
    if (ticker !== dn && perpChangeMap.has(ticker)) return perpChangeMap.get(ticker)!;
    // Fall back to own prevDayPx — cap at ±15% for stocks, ±50% for crypto
    // to filter stale/initial-listing prevDayPx values
    const px = parseFloat(spot.markPx);
    const prev = parseFloat(spot.prevDayPx);
    if (px > 0 && prev > 0) {
      const chg = ((px - prev) / prev) * 100;
      const cap = spot.dex === "hip3" ? 15 : 50;
      if (Math.abs(chg) <= cap) return chg;
    }
    return null;
  }, [perpChangeMap]);

  // Pre-sorted list including both spot + hip3 items
  const sortedItems = useMemo(() => {
    return spotMarkets
      .map((m) => ({
        displayName: m.displayName,
        ticker: m.name.replace("spot:", ""),
        name: m.name,
        dex: m.dex,
        price: parseFloat(m.markPx),
        change24h: get24hChange(m),
        volume: parseFloat(m.dayNtlVlm),
      }))
      .sort((a, b) => {
        const prioMap = a.dex === "hip3" ? PRIORITY_STOCKS : PRIORITY_CRYPTO;
        const prioMapB = b.dex === "hip3" ? PRIORITY_STOCKS : PRIORITY_CRYPTO;
        const pa = prioMap[a.displayName] ?? MAX_PRIORITY;
        const pb = prioMapB[b.displayName] ?? MAX_PRIORITY;
        if (pa !== pb) return pa - pb;
        return b.volume - a.volume;
      });
  }, [spotMarkets, get24hChange]);

  const popularCoins = useMemo(() => {
    if (spotMarkets.length === 0) return CURATED_POPULAR_CRYPTO;
    const available = new Set(spotMarkets.filter((m) => m.dex === "spot").map((m) => m.displayName));
    return CURATED_POPULAR_CRYPTO.filter((c) => available.has(c));
  }, [spotMarkets]);

  const popularStocks = useMemo(() => {
    if (spotMarkets.length === 0) return CURATED_POPULAR_STOCKS;
    const available = new Set(spotMarkets.filter((m) => m.dex === "hip3").map((m) => m.displayName));
    return CURATED_POPULAR_STOCKS.filter((c) => available.has(c));
  }, [spotMarkets]);

  // Set defaults once markets load — BTC first (like Coinbase)
  useEffect(() => {
    if (defaultsSet.current || spotMarkets.length === 0) return;
    defaultsSet.current = true;
    const first = "BTC";
    const second = "ETH";
    const hasFirst = spotMarkets.some((m) => m.displayName === first);
    const hasSecond = spotMarkets.some((m) => m.displayName === second);
    const fallbackFirst = popularCoins[0] ?? spotMarkets[0]?.displayName ?? "";
    const fallbackSecond = popularCoins[1] ?? spotMarkets[1]?.displayName ?? fallbackFirst;
    if (!selectedCoin) setSelectedCoin(hasFirst ? first : fallbackFirst);
    if (!convertFrom) setConvertFrom(hasFirst ? first : fallbackFirst);
    if (!convertTo) setConvertTo(hasSecond ? second : fallbackSecond);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotMarkets.length, popularCoins, selectedCoin, convertFrom, convertTo]);

  /* ── state derived from selected coin ── */
  const market = spotMarkets.find((m) => m.displayName === selectedCoin);
  const price = market ? parseFloat(market.markPx) : 0;
  const change24h = market ? get24hChange(market) : null;
  const usdValue = parseFloat(usdAmount || "0");
  const tokenAmount = price > 0 ? usdValue / price : 0;

  const fromMarket = spotMarkets.find((m) => m.displayName === convertFrom);
  const toMarket = spotMarkets.find((m) => m.displayName === convertTo);
  const fromPrice = fromMarket ? parseFloat(fromMarket.markPx) : 0;
  const toPrice = toMarket ? parseFloat(toMarket.markPx) : 0;
  const convertTokenAmount = parseFloat(convertAmount || "0");
  const convertUsdValue = convertTokenAmount * fromPrice;
  const convertReceiveAmount = toPrice > 0 ? convertUsdValue / toPrice : 0;
  const conversionRate = fromPrice > 0 && toPrice > 0 ? fromPrice / toPrice : 0;

  const spotUsdcBalance = useMemo(() => {
    if (!spotClearinghouse?.balances) return 0;
    return spotClearinghouse.balances.reduce((sum, b) => {
      if (b.coin === "USDC" || b.coin === "USDT0" || b.coin === "USDE") return sum + parseFloat(b.total);
      return sum;
    }, 0);
  }, [spotClearinghouse]);

  const getTokenBalance = useCallback((displayName: string) => {
    if (!spotClearinghouse?.balances) return 0;
    const m = spotMarkets.find((s) => s.displayName === displayName);
    const internalName = m ? m.name.replace("spot:", "") : displayName;
    const bal = spotClearinghouse.balances.find((b) => b.coin === internalName);
    return bal ? parseFloat(bal.total) : 0;
  }, [spotClearinghouse, spotMarkets]);

  const tokenBalance = getTokenBalance(selectedCoin);
  const convertFromBalance = getTokenBalance(convertFrom);

  // Spot holdings: all non-zero, non-stablecoin balances with USD value, cost basis + P&L
  const holdings = useMemo(() => {
    if (!spotClearinghouse?.balances || spotMarkets.length === 0) return [];
    return spotClearinghouse.balances
      .filter((b) => {
        if (STABLECOINS.has(b.coin)) return false;
        return parseFloat(b.total) > 0;
      })
      .map((b) => {
        const dn = spotDisplayName(b.coin);
        const m = spotMarkets.find((s) => s.displayName === dn);
        const px = m ? parseFloat(m.markPx) : 0;
        const amount = parseFloat(b.total);
        const usd = amount * px;
        const costBasis = parseFloat(b.entryNtl ?? "0");
        const pnl = costBasis > 0 ? usd - costBasis : null;
        const pnlPct = costBasis > 0 ? ((usd - costBasis) / costBasis) * 100 : null;
        const chg = m ? get24hChange(m) : null;
        const dex = m?.dex ?? "spot";
        return { coin: b.coin, displayName: dn, ticker: b.coin, amount, px, usd, costBasis, pnl, pnlPct, change24h: chg, dex };
      })
      .sort((a, b) => b.usd - a.usd);
  }, [spotClearinghouse, spotMarkets, get24hChange]);

  const totalHoldingsUsd = useMemo(
    () => holdings.reduce((sum, h) => sum + h.usd, 0) + spotUsdcBalance,
    [holdings, spotUsdcBalance],
  );

  /* ── actions ── */
  const handlePreset = (pct: number) => {
    if (mode === "convert") {
      if (convertFromBalance <= 0) return;
      setConvertAmount((convertFromBalance * pct / 100).toFixed(6));
    } else {
      const maxUsd = mode === "buy" ? spotUsdcBalance : tokenBalance * price;
      if (maxUsd <= 0) return;
      setUsdAmount((maxUsd * pct / 100).toFixed(2));
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!address || submitting) return;
    setSubmitting(true);
    setOrderSuccess(false);

    try {
      if (mode === "convert") {
        if (!fromMarket || !toMarket || convertTokenAmount <= 0) { setSubmitting(false); return; }

        toast.loading(`Converting ${convertFrom} to ${convertTo}...`, { id: "simple-order" });

        const sellSize = convertTokenAmount.toFixed(fromMarket.szDecimals);
        const sellPrice = getMarketOrderPrice(false, fromPrice);
        const sellResult = await signAndPlaceOrder({
          coin: fromMarket.name, isBuy: false, price: sellPrice, size: sellSize,
          orderType: "market", markets, expectedAddress: address,
          builderFee: BRAND_CONFIG.builder.simpleFee,
        });
        if (!sellResult.success) {
          toast.error(`Failed to sell ${convertFrom}`, { id: "simple-order", description: sellResult.error });
          setSubmitting(false);
          return;
        }

        await new Promise((r) => setTimeout(r, 500));

        const buySize = convertReceiveAmount.toFixed(toMarket.szDecimals);
        const buyPrice = getMarketOrderPrice(true, toPrice);
        const buyResult = await signAndPlaceOrder({
          coin: toMarket.name, isBuy: true, price: buyPrice, size: buySize,
          orderType: "market", markets, expectedAddress: address,
          builderFee: BRAND_CONFIG.builder.simpleFee,
        });
        if (buyResult.success) {
          setOrderSuccess(true);
          toast.success(`Converted ${convertFrom} to ${convertTo}`, {
            id: "simple-order",
            description: `${convertTokenAmount.toLocaleString()} ${convertFrom} → ${convertReceiveAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${convertTo}`,
          });
          setConvertAmount("");
          loadUserState();
          setTimeout(() => setOrderSuccess(false), 3000);
        } else {
          toast.error(`Failed to buy ${convertTo}`, { id: "simple-order", description: buyResult.error });
        }
      } else {
        if (!market || usdValue <= 0) { setSubmitting(false); return; }

        const sideLabel = mode === "buy" ? "Buy" : "Sell";
        const sz = mode === "buy"
          ? tokenAmount.toFixed(market.szDecimals)
          : (usdValue / price).toFixed(market.szDecimals);

        toast.loading(`${sideLabel}ing ${selectedCoin}...`, { id: "simple-order" });
        const orderPrice = getMarketOrderPrice(mode === "buy", price);

        const result = await signAndPlaceOrder({
          coin: market.name, isBuy: mode === "buy", price: orderPrice, size: sz,
          orderType: "market", markets, expectedAddress: address,
          builderFee: BRAND_CONFIG.builder.simpleFee,
        });
        if (result.success) {
          setOrderSuccess(true);
          toast.success(`${sideLabel} ${selectedCoin} — Success`, {
            id: "simple-order",
            description: `${parseFloat(sz).toLocaleString()} ${selectedCoin} for ~$${usdValue.toFixed(2)}`,
          });
          setUsdAmount("");
          loadUserState();
          setTimeout(() => setOrderSuccess(false), 3000);
        } else {
          toast.error("Order Failed", { id: "simple-order", description: result.error });
        }
      }
    } catch (err) {
      toast.error("Order Failed", { id: "simple-order", description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }, [address, submitting, mode, market, fromMarket, toMarket, usdValue, convertTokenAmount, convertReceiveAmount, selectedCoin, convertFrom, convertTo, tokenAmount, price, fromPrice, toPrice, markets, loadUserState]);

  const handleEnableTrading = useCallback(async () => {
    if (!address || enablingTrading) return;
    setEnablingTrading(true);
    try {
      toast.loading("Enabling trading...", { id: "enable-trading" });
      const result = await signAndApproveAgent(address);
      if (result.success) {
        setAgentApproved(true);
        if (BRAND_CONFIG.builder.enabled) {
          await signAndApproveBuilderFee(BRAND_CONFIG.builder.address, BRAND_CONFIG.builder.maxFeeApproval, address);
        }
        toast.success("Trading Enabled", { id: "enable-trading" });
      } else {
        toast.error("Failed", { id: "enable-trading", description: result.error });
      }
    } catch (err) {
      toast.error("Failed", { id: "enable-trading", description: (err as Error).message });
    } finally {
      setEnablingTrading(false);
    }
  }, [address, enablingTrading]);

  const handlePickerSelect = (coin: string) => {
    if (showPicker === "main") setSelectedCoin(coin);
    else if (showPicker === "convertFrom") {
      setConvertFrom(coin);
      if (coin === convertTo) setConvertTo(convertFrom);
    } else if (showPicker === "convertTo") {
      setConvertTo(coin);
      if (coin === convertFrom) setConvertFrom(convertTo);
    }
    setShowPicker(null);
    setPickerSearch("");
  };

  const swapConvertPair = () => {
    const tmp = convertFrom;
    setConvertFrom(convertTo);
    setConvertTo(tmp);
    setConvertAmount("");
  };

  /* ── computed UI state ── */
  const loading = spotMarkets.length === 0;
  const headerText = mode === "convert" ? "Convert" : mode === "buy" ? "Buy" : "Sell";
  const activeCoin = mode === "convert" ? convertFrom : selectedCoin;
  const activeMarket = spotMarkets.find((m) => m.displayName === activeCoin);
  const activeInternalName = activeMarket ? activeMarket.name.replace("spot:", "") : activeCoin;
  const isActiveStock = activeMarket?.dex === "hip3";

  const canSubmit = mode === "convert"
    ? convertTokenAmount > 0 && !!fromMarket && !!toMarket
    : usdValue > 0 && !!market;

  const submitLabel = (() => {
    if (orderSuccess) return "Done!";
    if (submitting) return mode === "convert" ? "Converting..." : `${mode === "buy" ? "Buying" : "Selling"}...`;
    if (mode === "convert") return `Convert ${convertFrom} to ${convertTo}`;
    return `${mode === "buy" ? "Buy" : "Sell"} ${selectedCoin}`;
  })();

  const submitColor = orderSuccess
    ? "bg-[#0ecb81]"
    : mode === "sell"
    ? "bg-[#f6465d] hover:bg-[#f6465d]/90"
    : mode === "convert"
    ? "bg-brand hover:bg-brand/90"
    : "bg-[#0ecb81] hover:bg-[#0ecb81]/90";

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-md mx-auto px-4 pt-8 pb-24">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{headerText}</h1>
          <p className="text-sm text-[#848e9c]">Simple spot trading — crypto &amp; stocks on Hyperliquid</p>
        </div>

        <div className="bg-[#12141a] rounded-2xl overflow-hidden shadow-xl shadow-black/30">
          {/* Buy / Sell / Convert toggle */}
          <div className="grid grid-cols-3 p-1 m-3 bg-[#0b0e11] rounded-xl">
            {(["buy", "sell", "convert"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setOrderSuccess(false); }}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                  mode === m
                    ? m === "buy"
                      ? "bg-[#0ecb81] text-white shadow-lg shadow-[#0ecb81]/20"
                      : m === "sell"
                      ? "bg-[#f6465d] text-white shadow-lg shadow-[#f6465d]/20"
                      : "bg-brand text-white shadow-lg shadow-brand/20"
                    : "text-[#848e9c] hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <span className="text-xs text-[#848e9c]">Loading markets...</span>
            </div>
          )}

          {/* ── BUY / SELL UI ── */}
          {!loading && mode !== "convert" && (
            <>
              {/* Coin selector */}
              <div className="px-4 pb-3">
                <button
                  onClick={() => { setShowPicker(showPicker === "main" ? null : "main"); setPickerSearch(""); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#0b0e11] hover:bg-[#161820] transition-colors"
                >
                  <CoinLogo symbol={isActiveStock ? activeInternalName : selectedCoin} size={36} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-semibold">{selectedCoin}</span>
                      {isActiveStock && <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">STOCK</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#848e9c]">${fmtPrice(price)}</span>
                      {change24h !== null ? (
                        <span className={change24h >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                          {fmtChange(change24h)}
                        </span>
                      ) : (
                        <span className="text-[#4a4e59]">—</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-[#848e9c] transition-transform ${showPicker === "main" ? "rotate-180" : ""}`} />
                </button>
              </div>

              {showPicker === "main" && (
                <div className="px-4 pb-3">
                  <CoinPickerDropdown
                    items={sortedItems}
                    popularCoins={popularCoins}
                    popularStocks={popularStocks}
                    selectedCoin={selectedCoin}
                    pickerSearch={pickerSearch}
                    onSearchChange={setPickerSearch}
                    onSelect={handlePickerSelect}
                  />
                </div>
              )}

              {/* Amount input */}
              <div className="px-4 pb-3">
                <div className="bg-[#0b0e11] rounded-xl p-4">
                  <label className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-2 block">
                    {mode === "buy" ? "You pay" : "You sell"}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-[#4a4e59]">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={usdAmount}
                      onChange={(e) => setUsdAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                      className="flex-1 bg-transparent text-3xl font-bold text-white placeholder-[#4a4e59] focus:outline-none w-full"
                    />
                    <span className="text-sm text-[#848e9c] font-medium shrink-0">USD</span>
                  </div>
                  {address && (
                    <div className="flex gap-1.5 mt-3">
                      {[25, 50, 75, 100].map((pct) => (
                        <button key={pct} onClick={() => handlePreset(pct)} className="flex-1 py-1.5 text-[10px] font-medium text-[#848e9c] bg-[#1a1d26] rounded-lg hover:bg-[#2a2e39] hover:text-white transition-colors">
                          {pct}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center -my-1.5 relative z-10">
                <div className="w-8 h-8 rounded-full bg-[#1a1d26] border-4 border-[#12141a] flex items-center justify-center">
                  <ArrowDown className="h-4 w-4 text-[#848e9c]" />
                </div>
              </div>

              {/* You receive */}
              <div className="px-4 pt-1 pb-4">
                <div className="bg-[#0b0e11] rounded-xl p-4">
                  <label className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-2 block">You receive</label>
                  <div className="flex items-center gap-3">
                    {mode === "buy" ? (
                      <>
                        <CoinLogo symbol={selectedCoin} size={28} />
                        <span className="text-2xl font-bold text-white">
                          {tokenAmount > 0 ? tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0"}
                        </span>
                        <span className="text-sm text-[#848e9c] font-medium">{selectedCoin}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-[#4a4e59]">$</span>
                        <span className="text-2xl font-bold text-white">{usdValue > 0 ? usdValue.toFixed(2) : "0"}</span>
                        <span className="text-sm text-[#848e9c] font-medium">USDC</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Info */}
              {address && (
                <div className="px-4 pb-4 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#848e9c]">Available</span>
                    <span className="text-white">
                      {mode === "buy"
                        ? `$${spotUsdcBalance.toFixed(2)} USDC`
                        : `${tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedCoin}`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#848e9c]">Price</span>
                    <span className="text-white">1 {selectedCoin} = ${fmtPrice(price)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#848e9c]">Network</span>
                    <span className="text-white">Hyperliquid L1</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── CONVERT UI ── */}
          {!loading && mode === "convert" && (
            <>
              <div className="px-4 pb-2">
                <div className="bg-[#0b0e11] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] text-[#848e9c] uppercase tracking-wider">From</label>
                    {address && (
                      <span className="text-[10px] text-[#848e9c]">
                        Balance: {convertFromBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setShowPicker(showPicker === "convertFrom" ? null : "convertFrom"); setPickerSearch(""); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1d26] hover:bg-[#252830] transition-colors shrink-0"
                    >
                      <CoinLogo symbol={convertFrom} size={24} />
                      <span className="text-white font-semibold text-sm">{convertFrom}</span>
                      <ChevronDown className="h-4 w-4 text-[#848e9c]" />
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={convertAmount}
                      onChange={(e) => setConvertAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                      className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-[#4a4e59] focus:outline-none text-right w-full min-w-0"
                    />
                  </div>
                  {convertUsdValue > 0 && (
                    <div className="text-right text-[10px] text-[#848e9c] mt-1">≈ ${convertUsdValue.toFixed(2)}</div>
                  )}
                  {address && (
                    <div className="flex gap-1.5 mt-3">
                      {[25, 50, 75, 100].map((pct) => (
                        <button key={pct} onClick={() => handlePreset(pct)} className="flex-1 py-1.5 text-[10px] font-medium text-[#848e9c] bg-[#1a1d26] rounded-lg hover:bg-[#2a2e39] hover:text-white transition-colors">
                          {pct}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {showPicker === "convertFrom" && (
                <div className="px-4 pb-2">
                  <CoinPickerDropdown items={sortedItems} popularCoins={popularCoins} popularStocks={popularStocks} selectedCoin={convertFrom} pickerSearch={pickerSearch} onSearchChange={setPickerSearch} onSelect={handlePickerSelect} />
                </div>
              )}

              <div className="flex justify-center -my-1.5 relative z-10">
                <button onClick={swapConvertPair} className="w-8 h-8 rounded-full bg-[#1a1d26] border-4 border-[#12141a] flex items-center justify-center hover:bg-[#252830] transition-colors">
                  <ArrowUpDown className="h-4 w-4 text-[#848e9c]" />
                </button>
              </div>

              <div className="px-4 pt-2 pb-4">
                <div className="bg-[#0b0e11] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] text-[#848e9c] uppercase tracking-wider">To</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setShowPicker(showPicker === "convertTo" ? null : "convertTo"); setPickerSearch(""); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1d26] hover:bg-[#252830] transition-colors shrink-0"
                    >
                      <CoinLogo symbol={convertTo} size={24} />
                      <span className="text-white font-semibold text-sm">{convertTo}</span>
                      <ChevronDown className="h-4 w-4 text-[#848e9c]" />
                    </button>
                    <span className="flex-1 text-2xl font-bold text-white text-right">
                      {convertReceiveAmount > 0 ? convertReceiveAmount.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0"}
                    </span>
                  </div>
                  {convertReceiveAmount > 0 && (
                    <div className="text-right text-[10px] text-[#848e9c] mt-1">≈ ${convertUsdValue.toFixed(2)}</div>
                  )}
                </div>
              </div>

              {showPicker === "convertTo" && (
                <div className="px-4 pb-3">
                  <CoinPickerDropdown items={sortedItems} popularCoins={popularCoins} popularStocks={popularStocks} selectedCoin={convertTo} pickerSearch={pickerSearch} onSearchChange={setPickerSearch} onSelect={handlePickerSelect} />
                </div>
              )}

              {address && conversionRate > 0 && (
                <div className="px-4 pb-4 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#848e9c]">Rate</span>
                    <span className="text-white">
                      1 {convertFrom} = {conversionRate >= 1
                        ? conversionRate.toLocaleString(undefined, { maximumFractionDigits: 4 })
                        : conversionRate.toPrecision(4)
                      } {convertTo}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#848e9c]">Route</span>
                    <span className="text-white">{convertFrom} → USDC → {convertTo}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#848e9c]">Network</span>
                    <span className="text-white">Hyperliquid L1</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action button */}
          {!loading && <div className="p-4 pt-0">
            {!address ? (
              <button
                onClick={() => walletConnect()}
                className="w-full py-4 rounded-xl font-semibold text-base bg-brand text-white hover:bg-brand/90 transition-colors"
              >
                Connect Wallet
              </button>
            ) : !agentApproved ? (
              <button
                onClick={handleEnableTrading}
                disabled={enablingTrading}
                className="w-full py-4 rounded-xl font-semibold text-base bg-brand text-white hover:bg-brand/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {enablingTrading && <Loader2 className="h-4 w-4 animate-spin" />}
                Enable Trading
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className={`w-full py-4 rounded-xl font-semibold text-base text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40 ${submitColor}`}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : orderSuccess ? (
                  <Check className="h-5 w-5" />
                ) : null}
                {submitLabel}
              </button>
            )}

            <p className="text-[10px] text-[#4a4e59] text-center mt-3">
              {mode === "convert"
                ? "Two market orders via USDC on Hyperliquid DEX"
                : "Market order on Hyperliquid DEX · No leverage · Self-custody"
              }
            </p>
          </div>}
        </div>

        {/* ── Your Assets ── */}
        {address && (holdings.length > 0 || spotUsdcBalance > 0) && (
          <div className="mt-6">
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h2 className="text-sm font-semibold text-white">Your assets</h2>
              <span className="text-xs text-[#848e9c]">${totalHoldingsUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#12141a] rounded-2xl overflow-hidden divide-y divide-[#1e2130]">
              {/* USDC row */}
              {spotUsdcBalance > 0.01 && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <CoinLogo symbol="USDC" size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">USDC</div>
                    <div className="text-[11px] text-[#848e9c]">USD Coin</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">${spotUsdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className="text-[11px] text-[#848e9c]">{spotUsdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              )}

              {/* Token rows */}
              {holdings.map((h) => (
                <button
                  key={h.coin}
                  onClick={() => { setSelectedCoin(h.displayName); setMode("sell"); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#161820] transition-colors"
                >
                  <CoinLogo symbol={h.dex === "hip3" ? h.ticker : h.displayName} size={36} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white text-sm font-medium">{h.displayName}</span>
                      {h.dex === "hip3" && <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">STOCK</span>}
                    </div>
                    <div className="text-[11px] text-[#848e9c]">
                      {h.amount < 0.001
                        ? h.amount.toPrecision(3)
                        : h.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      {" "}{h.displayName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">
                      ${h.usd >= 0.01 ? h.usd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : h.usd.toPrecision(3)}
                    </div>
                    {h.pnl !== null ? (
                      <div className={`text-[11px] ${h.pnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                        {h.pnl >= 0 ? "+" : ""}{h.pnl >= 0.01 || h.pnl <= -0.01
                          ? `$${Math.abs(h.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                          : `$${Math.abs(h.pnl).toPrecision(2)}`
                        }
                        {h.pnlPct !== null && <span className="ml-0.5">({h.pnl >= 0 ? "+" : ""}{h.pnlPct.toFixed(2)}%)</span>}
                      </div>
                    ) : h.change24h !== null ? (
                      <div className={`text-[11px] ${h.change24h >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                        {fmtChange(h.change24h)}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#4a4e59]">—</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pro mode link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push(isActiveStock ? `/trade/${activeInternalName}` : `/trade/spot-${activeInternalName}`)}
            className="text-xs text-[#848e9c] hover:text-brand transition-colors"
          >
            Advanced trading →
          </button>
        </div>
      </div>
    </div>
  );
}
