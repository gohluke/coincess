"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUpDown, Search, ChevronDown, Loader2, Check, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { signAndPlaceOrder, getMarketOrderPrice, signAndApproveAgent, signAndApproveBuilderFee, getStoredAgent } from "@/lib/hyperliquid/signing";
import { useWallet } from "@/hooks/useWallet";
import { useSettingsStore } from "@/lib/settings/store";
import { getConnectedAddress, onAccountsChanged } from "@/lib/hyperliquid/wallet";
import { getLogoForTicker, type LogoResult } from "@/lib/coinLogos";
import { BRAND_CONFIG } from "@/lib/brand";

const POPULAR_COINS = ["HYPE", "PURR", "BTC", "ETH", "SOL"];

const FALLBACK_COLORS = [
  "#f6465d", "#0ecb81", "#f0b90b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

function CoinLogo({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const logo: LogoResult = useMemo(() => getLogoForTicker(symbol), [symbol]);

  if (logo.type === "emoji") {
    return (
      <div
        className="rounded-full flex items-center justify-center bg-[#1e2130] shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {logo.emoji}
      </div>
    );
  }

  if (logo.type === "url" && !failed) {
    return (
      <img
        src={logo.src}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full shrink-0 object-cover bg-[#1e2130]"
        onError={() => setFailed(true)}
      />
    );
  }

  const ci = symbol.charCodeAt(0) % FALLBACK_COLORS.length;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: FALLBACK_COLORS[ci], fontSize: size * 0.36 }}
    >
      {symbol.charAt(0)}
    </div>
  );
}

type Mode = "buy" | "sell" | "convert";
type PickerTarget = "main" | "convertFrom" | "convertTo";

function CoinPickerDropdown({
  spotMarkets,
  selectedCoin,
  pickerSearch,
  onSearchChange,
  onSelect,
}: {
  spotMarkets: { name: string; displayName: string; markPx: string; prevDayPx: string }[];
  selectedCoin: string;
  pickerSearch: string;
  onSearchChange: (v: string) => void;
  onSelect: (coin: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!pickerSearch) return spotMarkets;
    const q = pickerSearch.toUpperCase();
    return spotMarkets.filter((m) => m.displayName.toUpperCase().includes(q));
  }, [spotMarkets, pickerSearch]);

  return (
    <div className="bg-[#0b0e11] rounded-xl border border-[#2a2e39] overflow-hidden">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#848e9c]" />
          <input
            type="text"
            value={pickerSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tokens..."
            autoFocus
            className="w-full bg-[#12141a] rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-[#4a4e59] focus:outline-none"
          />
        </div>
      </div>

      {!pickerSearch && (
        <div className="flex gap-1.5 px-2 pb-2 overflow-x-auto scrollbar-none">
          {POPULAR_COINS.map((coin) => (
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
          <div className="py-6 text-center text-[#4a4e59] text-sm">No spot tokens found</div>
        ) : (
          filtered.map((m) => {
            const base = m.displayName;
            const px = parseFloat(m.markPx);
            const prev = parseFloat(m.prevDayPx);
            const chg = prev > 0 ? ((px - prev) / prev) * 100 : 0;
            return (
              <button
                key={m.name}
                onClick={() => onSelect(base)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#12141a] transition-colors ${
                  selectedCoin === base ? "bg-[#12141a]" : ""
                }`}
              >
                <CoinLogo symbol={base} size={28} />
                <div className="flex-1 text-left">
                  <span className="text-white text-sm font-medium">{base}</span>
                  <span className="text-[#4a4e59] text-xs ml-1">/USDC</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white">
                    ${px >= 1 ? px.toLocaleString(undefined, { maximumFractionDigits: 2 }) : px.toPrecision(4)}
                  </div>
                  <div className={`text-[10px] ${chg >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                    {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                  </div>
                </div>
                {selectedCoin === base && <Check className="h-4 w-4 text-brand shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function BuyPage() {
  const router = useRouter();

  const { address: walletAddr, connect: walletConnect, source } = useWallet();
  const activeLinkedAddr = useSettingsStore((s) => s.getActiveAddress)();

  const {
    markets, loadMarkets,
    address, setAddress,
    spotClearinghouse,
    loadUserState,
  } = useTradingStore();

  const [mode, setMode] = useState<Mode>("buy");
  const [selectedCoin, setSelectedCoin] = useState("HYPE");
  const [convertFrom, setConvertFrom] = useState("HYPE");
  const [convertTo, setConvertTo] = useState("ETH");
  const [usdAmount, setUsdAmount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [showPicker, setShowPicker] = useState<PickerTarget | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agentApproved, setAgentApproved] = useState(false);
  const [enablingTrading, setEnablingTrading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

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

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  useEffect(() => {
    if (address) setAgentApproved(!!getStoredAgent(address));
  }, [address]);

  const spotMarkets = useMemo(
    () => markets.filter((m) => m.dex === "spot"),
    [markets],
  );

  // Buy/Sell state
  const market = spotMarkets.find((m) => m.name === `spot:${selectedCoin}`);
  const price = market ? parseFloat(market.markPx) : 0;
  const prevPrice = market ? parseFloat(market.prevDayPx) : 0;
  const change24h = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
  const usdValue = parseFloat(usdAmount || "0");
  const tokenAmount = price > 0 ? usdValue / price : 0;

  // Convert state
  const fromMarket = spotMarkets.find((m) => m.name === `spot:${convertFrom}`);
  const toMarket = spotMarkets.find((m) => m.name === `spot:${convertTo}`);
  const fromPrice = fromMarket ? parseFloat(fromMarket.markPx) : 0;
  const toPrice = toMarket ? parseFloat(toMarket.markPx) : 0;
  const convertTokenAmount = parseFloat(convertAmount || "0");
  const convertUsdValue = convertTokenAmount * fromPrice;
  const convertReceiveAmount = toPrice > 0 ? convertUsdValue / toPrice : 0;
  const conversionRate = fromPrice > 0 && toPrice > 0 ? fromPrice / toPrice : 0;

  const spotUsdcBalance = useMemo(() => {
    if (!spotClearinghouse?.balances) return 0;
    return spotClearinghouse.balances.reduce((sum, b) => {
      if (b.coin === "USDC" || b.coin === "USDT0" || b.coin === "USDE") {
        return sum + parseFloat(b.total);
      }
      return sum;
    }, 0);
  }, [spotClearinghouse]);

  const getTokenBalance = useCallback((coin: string) => {
    if (!spotClearinghouse?.balances) return 0;
    const bal = spotClearinghouse.balances.find((b) => b.coin === coin);
    return bal ? parseFloat(bal.total) : 0;
  }, [spotClearinghouse]);

  const tokenBalance = getTokenBalance(selectedCoin);
  const convertFromBalance = getTokenBalance(convertFrom);

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
        if (!fromMarket || !toMarket || convertTokenAmount <= 0) {
          setSubmitting(false);
          return;
        }

        toast.loading(`Converting ${convertFrom} to ${convertTo}...`, { id: "simple-order" });

        // Step 1: Sell fromToken → USDC
        const sellSize = convertTokenAmount.toFixed(fromMarket.szDecimals);
        const sellPrice = getMarketOrderPrice(false, fromPrice);
        const sellResult = await signAndPlaceOrder({
          coin: fromMarket.name,
          isBuy: false,
          price: sellPrice,
          size: sellSize,
          orderType: "market",
          markets,
          expectedAddress: address,
          builderFee: BRAND_CONFIG.builder.simpleFee,
        });

        if (!sellResult.success) {
          toast.error(`Failed to sell ${convertFrom}`, { id: "simple-order", description: sellResult.error });
          setSubmitting(false);
          return;
        }

        // Brief pause for settlement
        await new Promise((r) => setTimeout(r, 500));

        // Step 2: Buy toToken with USDC
        const buySize = convertReceiveAmount.toFixed(toMarket.szDecimals);
        const buyPrice = getMarketOrderPrice(true, toPrice);
        const buyResult = await signAndPlaceOrder({
          coin: toMarket.name,
          isBuy: true,
          price: buyPrice,
          size: buySize,
          orderType: "market",
          markets,
          expectedAddress: address,
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
        if (!market || usdValue <= 0) {
          setSubmitting(false);
          return;
        }

        const sideLabel = mode === "buy" ? "Buy" : "Sell";
        const sz = mode === "buy"
          ? tokenAmount.toFixed(market.szDecimals)
          : (usdValue / price).toFixed(market.szDecimals);

        toast.loading(`${sideLabel}ing ${selectedCoin}...`, { id: "simple-order" });

        const midPx = price;
        const orderPrice = getMarketOrderPrice(mode === "buy", midPx);

        const result = await signAndPlaceOrder({
          coin: market.name,
          isBuy: mode === "buy",
          price: orderPrice,
          size: sz,
          orderType: "market",
          markets,
          expectedAddress: address,
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

  const headerText = mode === "convert" ? "Convert" : mode === "buy" ? "Buy" : "Sell";
  const activeCoin = mode === "convert" ? convertFrom : selectedCoin;

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

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-md mx-auto px-4 pt-8 pb-24">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{headerText} Crypto</h1>
          <p className="text-sm text-[#848e9c]">Simple spot trading on Hyperliquid</p>
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

          {/* ── BUY / SELL UI ── */}
          {mode !== "convert" && (
            <>
              {/* Coin selector */}
              <div className="px-4 pb-3">
                <button
                  onClick={() => { setShowPicker(showPicker === "main" ? null : "main"); setPickerSearch(""); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#0b0e11] hover:bg-[#161820] transition-colors"
                >
                  <CoinLogo symbol={selectedCoin} size={36} />
                  <div className="flex-1 text-left">
                    <div className="text-white font-semibold">{selectedCoin}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#848e9c]">
                        ${price >= 1 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price.toPrecision(4)}
                      </span>
                      <span className={`flex items-center gap-0.5 ${change24h >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                        {change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-[#848e9c] transition-transform ${showPicker === "main" ? "rotate-180" : ""}`} />
                </button>
              </div>

              {showPicker === "main" && (
                <div className="px-4 pb-3">
                  <CoinPickerDropdown
                    spotMarkets={spotMarkets}
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
                    <span className="text-white">
                      1 {selectedCoin} = ${price >= 1 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price.toPrecision(4)}
                    </span>
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
          {mode === "convert" && (
            <>
              {/* From token */}
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
                    <div className="text-right text-[10px] text-[#848e9c] mt-1">
                      ≈ ${convertUsdValue.toFixed(2)}
                    </div>
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
                  <CoinPickerDropdown
                    spotMarkets={spotMarkets}
                    selectedCoin={convertFrom}
                    pickerSearch={pickerSearch}
                    onSearchChange={setPickerSearch}
                    onSelect={handlePickerSelect}
                  />
                </div>
              )}

              {/* Swap button */}
              <div className="flex justify-center -my-1.5 relative z-10">
                <button
                  onClick={swapConvertPair}
                  className="w-8 h-8 rounded-full bg-[#1a1d26] border-4 border-[#12141a] flex items-center justify-center hover:bg-[#252830] transition-colors"
                >
                  <ArrowUpDown className="h-4 w-4 text-[#848e9c]" />
                </button>
              </div>

              {/* To token */}
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
                      {convertReceiveAmount > 0
                        ? convertReceiveAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })
                        : "0"
                      }
                    </span>
                  </div>
                  {convertReceiveAmount > 0 && (
                    <div className="text-right text-[10px] text-[#848e9c] mt-1">
                      ≈ ${convertUsdValue.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {showPicker === "convertTo" && (
                <div className="px-4 pb-3">
                  <CoinPickerDropdown
                    spotMarkets={spotMarkets}
                    selectedCoin={convertTo}
                    pickerSearch={pickerSearch}
                    onSearchChange={setPickerSearch}
                    onSelect={handlePickerSelect}
                  />
                </div>
              )}

              {/* Convert info */}
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
          <div className="p-4 pt-0">
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
                : "Market order on Hyperliquid DEX \u00b7 No leverage \u00b7 Self-custody"
              }
            </p>
          </div>
        </div>

        {/* Pro mode link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push(`/trade/spot-${activeCoin}`)}
            className="text-xs text-[#848e9c] hover:text-brand transition-colors"
          >
            Advanced trading &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
