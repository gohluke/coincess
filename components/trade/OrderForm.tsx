"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { signAndPlaceOrder, getMarketOrderPrice, signAndEnableDexAbstraction, signAndApproveAgent, signAndApproveBuilderFee, getSigningAddress, getStoredAgent, clearStoredAgent, STALE_AGENT_ERROR } from "@/lib/hyperliquid/signing";
import { useWallet } from "@/hooks/useWallet";
import { FundingBanner } from "@/components/FundingBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { BRAND_CONFIG } from "@/lib/brand";
import { toast } from "sonner";

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
  const searchParams = useSearchParams();
  const copyTradeApplied = useRef(false);

  const [showTpsl, setShowTpsl] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [signingAddr, setSigningAddr] = useState<string | null>(null);
  const [signingAddrLoaded, setSigningAddrLoaded] = useState(false);
  const [agentApproved, setAgentApproved] = useState(false);
  const [enablingTrading, setEnablingTrading] = useState(false);

  // Pre-fill from copy trade query params (?side=buy&size=1.5&price=64300)
  useEffect(() => {
    if (copyTradeApplied.current) return;
    const sideParam = searchParams.get("side");
    const sizeParam = searchParams.get("size");
    const priceParam = searchParams.get("price");
    if (!sideParam && !sizeParam && !priceParam) return;
    copyTradeApplied.current = true;

    if (sideParam === "buy" || sideParam === "sell") {
      setOrderSide(sideParam === "buy" ? "buy" : "sell");
    }
    if (sizeParam) setOrderSize(sizeParam);
    if (priceParam) {
      setOrderPrice(priceParam);
      setOrderType("limit");
    }
    toast.info("Trade copied! Review and submit when ready.");
  }, [searchParams, setOrderSide, setOrderSize, setOrderPrice, setOrderType]);

  useEffect(() => {
    if (address) {
      setSigningAddrLoaded(false);
      setAgentApproved(!!getStoredAgent(address));
      getSigningAddress().then((addr) => {
        setSigningAddr(addr);
        setSigningAddrLoaded(true);
      });
    } else {
      setSigningAddr(null);
      setSigningAddrLoaded(false);
      setAgentApproved(false);
    }
  }, [address]);

  const addressMismatch = signingAddrLoaded && address && signingAddr &&
    address.toLowerCase() !== signingAddr.toLowerCase();

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

      const sideLabel = orderSide === "buy" ? "Long" : "Short";
      const typeLabel = orderType === "market" ? "Market" : "Limit";
      toast.loading(`Submitting ${typeLabel} ${sideLabel} ${displayName}...`, { id: "order-submit" });

      const result = await signAndPlaceOrder({
        coin: selectedMarket,
        isBuy: orderSide === "buy",
        price,
        size: orderSize,
        orderType,
        markets,
        expectedAddress: address ?? undefined,
      });

      if (result.success) {
        toast.success(`${typeLabel} ${sideLabel} ${displayName} — Order Placed`, {
          id: "order-submit",
          description: `${orderSize} ${displayName} @ ${orderType === "market" ? "Market" : "$" + parseFloat(orderPrice || midPrice).toLocaleString()}`,
        });
        setFeedback(null);
        setOrderSize("");

        if (tpPrice) {
          await signAndPlaceOrder({
            coin: selectedMarket,
            isBuy: orderSide !== "buy",
            price: tpPrice,
            size: orderSize,
            orderType: "limit",
            reduceOnly: true,
            tpsl: { triggerPx: tpPrice, type: "tp" },
            markets,
            expectedAddress: address ?? undefined,
          });
          toast.success("Take Profit order placed", { description: `TP @ $${parseFloat(tpPrice).toLocaleString()}` });
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
            expectedAddress: address ?? undefined,
          });
          toast.success("Stop Loss order placed", { description: `SL @ $${parseFloat(slPrice).toLocaleString()}` });
        }

        loadUserState();
      } else {
        const raw = result.error || "Order failed";
        if (raw === STALE_AGENT_ERROR) {
          setAgentApproved(false);
          toast.error("Session Expired", { id: "order-submit", description: "Please enable trading again." });
        } else {
          toast.error("Order Failed", { id: "order-submit", description: raw });
        }
        setFeedback({ type: "error", msg: raw });
      }
    } catch (err) {
      const raw = (err as Error).message;
      if (raw === STALE_AGENT_ERROR) {
        setAgentApproved(false);
        toast.error("Session Expired", { id: "order-submit", description: "Please enable trading again." });
      } else {
        toast.error("Order Failed", { id: "order-submit", description: raw });
      }
      setFeedback({ type: "error", msg: raw });
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
        {/* Long / Short toggle */}
        <div className="grid grid-cols-2">
          <button
            onClick={() => setOrderSide("buy")}
            className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
              orderSide === "buy"
                ? "text-[#0ecb81] border-[#0ecb81]"
                : "text-[#848e9c] border-transparent hover:text-white"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setOrderSide("sell")}
            className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
              orderSide === "sell"
                ? "text-[#f6465d] border-[#f6465d]"
                : "text-[#848e9c] border-transparent hover:text-white"
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

        {/* Address mismatch warning */}
        {addressMismatch && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#f0b90b]/10 border border-[#f0b90b]/20">
            <AlertTriangle className="h-3.5 w-3.5 text-[#f0b90b] shrink-0 mt-0.5" />
            <div className="text-[10px] text-[#f0b90b] leading-tight">
              <p className="font-semibold mb-0.5">Wallet mismatch</p>
              <p>Viewing {address.slice(0, 6)}...{address.slice(-4)} but signing wallet is {signingAddr!.slice(0, 6)}...{signingAddr!.slice(-4)}. Switch wallet in Zerion or go to Settings to update.</p>
            </div>
          </div>
        )}

        {/* Submit / Enable Trading / Connect button */}
        {address && agentApproved ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !orderSize || parseFloat(orderSize) <= 0 || !!addressMismatch}
            className={`w-full py-3 rounded-full font-semibold text-sm text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              orderSide === "buy"
                ? "bg-[#0ecb81] hover:bg-[#0ecb81]/90"
                : "bg-[#f6465d] hover:bg-[#f6465d]/90"
            }`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {orderSide === "buy" ? "Long" : "Short"} {displayName}
          </button>
        ) : address ? (
          <div className="space-y-2">
            <button
              onClick={async () => {
                if (enablingTrading) return;
                setEnablingTrading(true);
                setFeedback(null);
                try {
                  toast.loading("Approving trading agent...", { id: "enable-trading" });
                  const result = await signAndApproveAgent(address ?? undefined);
                  if (result.success) {
                    setAgentApproved(true);

                    if (BRAND_CONFIG.builder.enabled) {
                      toast.loading("Approving builder fee...", { id: "enable-trading" });
                      const builderResult = await signAndApproveBuilderFee(
                        BRAND_CONFIG.builder.address,
                        "0.01%",
                        address ?? undefined,
                      );
                      if (!builderResult.success) {
                        console.warn("Builder fee approval failed (non-blocking):", builderResult.error);
                      }
                    }

                    toast.success("Trading Enabled", { id: "enable-trading", description: "You can now place orders without wallet popups." });
                    setFeedback(null);
                  } else {
                    const raw = result.error || "Failed to enable trading";
                    const msg = raw.includes("does not exist")
                      ? "No Hyperliquid account found. Deposit USDC to Hyperliquid first, then enable trading."
                      : raw;
                    toast.error("Enable Trading Failed", { id: "enable-trading", description: msg });
                    setFeedback({ type: "error", msg });
                  }
                } catch (err) {
                  const msg = (err as Error).message;
                  toast.error("Enable Trading Failed", { id: "enable-trading", description: msg });
                  setFeedback({ type: "error", msg });
                } finally {
                  setEnablingTrading(false);
                }
              }}
              disabled={enablingTrading}
              className="w-full py-3 rounded-full font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {enablingTrading && <Loader2 className="h-4 w-4 animate-spin" />}
              Enable Trading
            </button>
            <p className="text-[10px] text-[#848e9c] text-center leading-tight">
              Sign once to authorize Coincess to trade on your behalf. No further popups per order.
            </p>
          </div>
        ) : (
          <button
            onClick={() => walletConnect()}
            className="w-full py-3 rounded-full font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            Connect to Trade
          </button>
        )}

        {/* HIP-3 / XYZ unified account activation */}
        {address && market?.dex && abstractionMode !== "unifiedAccount" && abstractionMode !== "portfolioMargin" && (
          <div className="space-y-2">
            <button
              onClick={async () => {
                setFeedback(null);
                try {
                  toast.loading("Enabling unified account...", { id: "unified-account" });
                  const result = await signAndEnableDexAbstraction(address ?? undefined);
                  if (result.success) {
                    toast.success("Unified Account Enabled", { id: "unified-account", description: "You can now trade stocks & commodities." });
                    setFeedback(null);
                    loadUserState();
                  } else {
                    const msg = result.error || "Failed to enable unified account";
                    toast.error("Unified Account Failed", { id: "unified-account", description: msg });
                    setFeedback({ type: "error", msg });
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
