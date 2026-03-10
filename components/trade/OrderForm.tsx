"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { signAndPlaceOrder, getMarketOrderPrice, signAndEnableDexAbstraction } from "@/lib/hyperliquid/signing";
import { useWallet } from "@/hooks/useWallet";
import { FundingBanner } from "@/components/FundingBanner";
import { Skeleton } from "@/components/ui/Skeleton";

const LEVERAGE_PRESETS = [1, 2, 5, 10, 20, 50];
const SIZE_PRESETS = [25, 50, 75, 100];

export function OrderForm() {
  const {
    orderSide, orderType, orderPrice, orderSize, orderLeverage,
    setOrderSide, setOrderType, setOrderPrice, setOrderSize, setOrderLeverage,
    selectedMarket, address, setAddress, clearinghouse, spotClearinghouse, orderbook, markets, loadUserState,
    abstractionMode,
  } = useTradingStore();

  const { connect: walletConnect } = useWallet();

  const [showTpsl, setShowTpsl] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const market = markets.find((m) => m.name === selectedMarket);
  const displayName = market?.displayName || selectedMarket;
  const midPrice = orderbook?.levels
    ? (
        (parseFloat(orderbook.levels[0]?.[0]?.px ?? "0") +
          parseFloat(orderbook.levels[1]?.[0]?.px ?? "0")) /
        2
      ).toString()
    : market?.markPx ?? "0";

  const spotUsdcBalance = useMemo(() => {
    if (!spotClearinghouse?.balances) return 0;
    return spotClearinghouse.balances.reduce((sum, b) => {
      if (b.coin === "USDC" || b.coin === "USDT0" || b.coin === "USDE") {
        return sum + parseFloat(b.total);
      }
      return sum;
    }, 0);
  }, [spotClearinghouse]);

  const perpsWithdrawable = clearinghouse ? parseFloat(clearinghouse.withdrawable) : 0;
  const totalMarginUsed = clearinghouse ? parseFloat(clearinghouse.marginSummary.totalMarginUsed) : 0;
  const perpsAccountValue = clearinghouse ? parseFloat(clearinghouse.marginSummary.accountValue) : 0;

  // With unified account, balance lives in spot clearinghouse; subtract margin already allocated to perps
  const availableBalance = spotUsdcBalance > 0
    ? spotUsdcBalance - totalMarginUsed
    : perpsWithdrawable;
  const accountValue = spotUsdcBalance > 0
    ? spotUsdcBalance + (perpsAccountValue - totalMarginUsed)
    : perpsAccountValue;
  const hasFunds = accountValue > 0;

  const notional = useMemo(() => {
    const price = orderType === "market" ? parseFloat(midPrice) : parseFloat(orderPrice || "0");
    const size = parseFloat(orderSize || "0");
    return price * size;
  }, [orderType, midPrice, orderPrice, orderSize]);

  const margin = orderLeverage > 0 ? notional / orderLeverage : 0;

  const estLiqPrice = useMemo(() => {
    if (!notional || !orderLeverage) return null;
    const price = orderType === "market" ? parseFloat(midPrice) : parseFloat(orderPrice || midPrice);
    if (price <= 0) return null;
    const maintenanceMarginRate = 0.005;
    if (orderSide === "buy") {
      return price * (1 - (1 / orderLeverage) + maintenanceMarginRate);
    }
    return price * (1 + (1 / orderLeverage) - maintenanceMarginRate);
  }, [orderType, midPrice, orderPrice, orderLeverage, notional, orderSide]);

  const handleSizePreset = (pct: number) => {
    if (!availableBalance || !midPrice) return;
    const price = orderType === "market" ? parseFloat(midPrice) : parseFloat(orderPrice || midPrice);
    if (price <= 0) return;
    const maxNotional = availableBalance * orderLeverage * (pct / 100);
    const size = maxNotional / price;
    const decimals = market?.szDecimals ?? 4;
    setOrderSize(size.toFixed(decimals));
  };

  const handleSubmit = async () => {
    if (!address || submitting) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const price = orderType === "market"
        ? getMarketOrderPrice(orderSide === "buy", parseFloat(midPrice))
        : orderPrice;

      const result = await signAndPlaceOrder({
        coin: selectedMarket,
        isBuy: orderSide === "buy",
        price,
        size: orderSize,
        orderType,
        markets,
      });

      if (result.success) {
        setFeedback({ type: "success", msg: `Order placed (ID: ${result.oid})` });
        setOrderSize("");

        if (tpPrice) {
          await signAndPlaceOrder({
            coin: selectedMarket,
            isBuy: orderSide !== "buy", // opposite side for TP
            price: tpPrice,
            size: orderSize,
            orderType: "limit",
            reduceOnly: true,
            tpsl: { triggerPx: tpPrice, type: "tp" },
            markets,
          });
        }
        if (slPrice) {
          await signAndPlaceOrder({
            coin: selectedMarket,
            isBuy: orderSide !== "buy",
            price: slPrice,
            size: orderSize,
            orderType: "limit",
            reduceOnly: true,
            tpsl: { triggerPx: slPrice, type: "sl" },
            markets,
          });
        }

        loadUserState();
      } else {
        setFeedback({ type: "error", msg: result.error || "Order failed" });
      }
    } catch (err) {
      setFeedback({ type: "error", msg: (err as Error).message });
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#2a2e39]">
        <span className="text-[#848e9c] text-xs font-medium">Place Order</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Buy / Sell toggle */}
        <div className="grid grid-cols-2 gap-1 bg-[#1a1d26] rounded-lg p-0.5">
          <button
            onClick={() => setOrderSide("buy")}
            className={`py-2 text-sm font-semibold rounded-md transition-colors ${
              orderSide === "buy" ? "bg-[#0ecb81] text-white" : "text-[#848e9c] hover:text-white"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setOrderSide("sell")}
            className={`py-2 text-sm font-semibold rounded-md transition-colors ${
              orderSide === "sell" ? "bg-[#f6465d] text-white" : "text-[#848e9c] hover:text-white"
            }`}
          >
            Short
          </button>
        </div>

        {/* Order type */}
        <div className="flex gap-3 text-xs">
          {(["limit", "market"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`pb-1 border-b-2 transition-colors capitalize ${
                orderType === type
                  ? "border-brand text-white"
                  : "border-transparent text-[#848e9c] hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Price input (limit only) */}
        {orderType === "limit" && (
          <div>
            <label className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1 block">Price (USD)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={orderPrice}
                onChange={(e) => setOrderPrice(e.target.value)}
                placeholder={parseFloat(midPrice).toFixed(2)}
                className="w-full bg-[#1a1d26] border border-[#2a2e39] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a4e59] focus:outline-none focus:border-brand transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#848e9c]">USD</span>
            </div>
          </div>
        )}

        {/* Size input */}
        <div>
          <label className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1 block">
            Size ({displayName})
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={orderSize}
              onChange={(e) => setOrderSize(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#1a1d26] border border-[#2a2e39] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a4e59] focus:outline-none focus:border-brand transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#848e9c]">{displayName}</span>
          </div>
          {address && (
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {SIZE_PRESETS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleSizePreset(pct)}
                  className="py-1 text-[10px] text-[#848e9c] bg-[#1a1d26] rounded hover:bg-[#2a2e39] hover:text-white transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Leverage */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-[#848e9c] uppercase tracking-wider">Leverage</label>
            <span className="text-xs text-white font-medium">{orderLeverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={market?.maxLeverage ?? 50}
            value={orderLeverage}
            onChange={(e) => setOrderLeverage(parseInt(e.target.value))}
            className="w-full accent-brand h-1"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {LEVERAGE_PRESETS.filter((l) => l <= (market?.maxLeverage ?? 50)).map((l) => (
              <button
                key={l}
                onClick={() => setOrderLeverage(l)}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${
                  orderLeverage === l
                    ? "bg-brand text-white"
                    : "bg-[#1a1d26] text-[#848e9c] hover:bg-[#2a2e39] hover:text-white"
                }`}
              >
                {l}x
              </button>
            ))}
          </div>
        </div>

        {/* TP/SL */}
        <button
          onClick={() => setShowTpsl(!showTpsl)}
          className="flex items-center gap-1 text-[11px] text-[#848e9c] hover:text-white transition-colors"
        >
          {showTpsl ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Take Profit / Stop Loss
        </button>
        {showTpsl && (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-[#0ecb81] uppercase tracking-wider mb-1 block">Take Profit</label>
              <input
                type="text"
                inputMode="decimal"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="TP price"
                className="w-full bg-[#1a1d26] border border-[#0ecb81]/30 rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a4e59] focus:outline-none focus:border-[#0ecb81] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#f6465d] uppercase tracking-wider mb-1 block">Stop Loss</label>
              <input
                type="text"
                inputMode="decimal"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="SL price"
                className="w-full bg-[#1a1d26] border border-[#f6465d]/30 rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a4e59] focus:outline-none focus:border-[#f6465d] transition-colors"
              />
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="space-y-1.5 text-xs border-t border-[#2a2e39] pt-2">
          <div className="flex justify-between">
            <span className="text-[#848e9c]">Notional</span>
            <span className="text-white">${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#848e9c]">Margin Required</span>
            <span className="text-white">${margin.toFixed(2)}</span>
          </div>
          {estLiqPrice && estLiqPrice > 0 && (
            <div className="flex justify-between">
              <span className="text-[#848e9c]">Est. Liq. Price</span>
              <span className="text-[#f0b90b]">${estLiqPrice.toFixed(2)}</span>
            </div>
          )}
          {address && (
            <div className="flex justify-between">
              <span className="text-[#848e9c]">Available</span>
              {clearinghouse ? (
                <span className={availableBalance <= 0 ? "text-[#f0b90b]" : "text-white"}>
                  ${availableBalance.toFixed(2)}
                  {availableBalance <= 0 && !hasFunds && " ⚠"}
                </span>
              ) : (
                <Skeleton className="h-3.5 w-16" />
              )}
            </div>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
            feedback.type === "success" ? "bg-[#0ecb81]/10 text-[#0ecb81]" : "bg-[#f6465d]/10 text-[#f6465d]"
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* Funding prompt when connected but no balance at all */}
        {address && !hasFunds && (
          <FundingBanner address={address} balance={availableBalance} compact />
        )}

        {/* Submit button */}
        {address ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !orderSize || parseFloat(orderSize) <= 0}
            className={`w-full py-3 rounded-lg font-semibold text-sm text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              orderSide === "buy"
                ? "bg-[#0ecb81] hover:bg-[#0ecb81]/90"
                : "bg-[#f6465d] hover:bg-[#f6465d]/90"
            }`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {orderSide === "buy" ? "Long" : "Short"} {displayName}
          </button>
        ) : (
          <button
            onClick={() => walletConnect()}
            className="w-full py-3 rounded-lg font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            Sign In to Trade
          </button>
        )}

        {/* HIP-3 / XYZ unified account activation */}
        {address && market?.dex && abstractionMode !== "unifiedAccount" && abstractionMode !== "portfolioMargin" && (
          <div className="space-y-2">
            <button
              onClick={async () => {
                setFeedback(null);
                try {
                  const result = await signAndEnableDexAbstraction();
                  if (result.success) {
                    setFeedback({ type: "success", msg: "Unified account enabled! You can now trade stocks & commodities." });
                    loadUserState();
                  } else {
                    setFeedback({ type: "error", msg: result.error || "Failed to enable unified account" });
                  }
                } catch (err) {
                  setFeedback({ type: "error", msg: (err as Error).message });
                }
              }}
              className="w-full py-2.5 rounded-lg text-xs font-medium bg-[#f0b90b]/10 text-[#f0b90b] hover:bg-[#f0b90b]/20 transition-colors border border-[#f0b90b]/20"
            >
              Enable Unified Account to trade {displayName}
            </button>
            <p className="text-[10px] text-[#848e9c] text-center leading-tight">
              Unified Account lets you trade stocks, commodities &amp; forex using your main USDC balance.
              {!hasFunds && " You also need to deposit USDC to Hyperliquid first."}
            </p>
          </div>
        )}

        <p className="text-[10px] text-[#848e9c] text-center">
          Trades are executed on Hyperliquid DEX
        </p>
      </div>
    </div>
  );
}
