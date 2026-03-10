"use client";

import { useEffect, useMemo } from "react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { getWs } from "@/lib/hyperliquid/websocket";
import { Skeleton } from "@/components/ui/Skeleton";

const VISIBLE_LEVELS = 14;

function formatPrice(px: string): string {
  const n = parseFloat(px);
  if (n >= 1000) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(5);
}

function formatSize(sz: string): string {
  const n = parseFloat(sz);
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

export function OrderBook() {
  const orderbook = useTradingStore((s) => s.orderbook);
  const selectedMarket = useTradingStore((s) => s.selectedMarket);
  const setOrderbook = useTradingStore((s) => s.setOrderbook);
  const setOrderPrice = useTradingStore((s) => s.setOrderPrice);

  useEffect(() => {
    const ws = getWs();
    const unsub = ws.subscribeL2Book(selectedMarket, (book) => {
      setOrderbook(book);
    });
    return unsub;
  }, [selectedMarket, setOrderbook]);

  const { bids, asks, spread, spreadPct, maxTotal } = useMemo(() => {
    if (!orderbook?.levels) {
      return { bids: [], asks: [], spread: "0", spreadPct: "0", maxTotal: 0 };
    }

    const [rawBids, rawAsks] = orderbook.levels;

    let bidTotal = 0;
    const bids = (rawBids || []).slice(0, VISIBLE_LEVELS).map((l) => {
      bidTotal += parseFloat(l.sz);
      return { price: l.px, size: l.sz, total: bidTotal };
    });

    let askTotal = 0;
    const asks = (rawAsks || [])
      .slice(0, VISIBLE_LEVELS)
      .map((l) => {
        askTotal += parseFloat(l.sz);
        return { price: l.px, size: l.sz, total: askTotal };
      })
      .reverse();

    const bestBid = rawBids?.[0] ? parseFloat(rawBids[0].px) : 0;
    const bestAsk = rawAsks?.[0] ? parseFloat(rawAsks[0].px) : 0;
    const sp = bestAsk - bestBid;
    const mid = (bestAsk + bestBid) / 2;

    return {
      bids,
      asks,
      spread: sp.toFixed(2),
      spreadPct: mid > 0 ? ((sp / mid) * 100).toFixed(3) : "0",
      maxTotal: Math.max(bidTotal, askTotal),
    };
  }, [orderbook]);

  const handleClick = (price: string) => setOrderPrice(price);

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-2 border-b border-[#2a2e39]">
        <span className="text-[#848e9c] font-medium">Order Book</span>
      </div>

      <div className="grid grid-cols-3 px-3 py-1.5 text-[#848e9c] text-[10px] uppercase tracking-wider border-b border-[#2a2e39]">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {asks.length === 0 && bids.length === 0 ? (
          <div className="flex-1 flex flex-col gap-[2px] px-3 py-1">
            {Array.from({ length: VISIBLE_LEVELS }).map((_, i) => (
              <div key={`ask-sk-${i}`} className="grid grid-cols-3 gap-2 py-[3px]">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
            <div className="py-1.5 border-y border-[#2a2e39] my-0.5">
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
            {Array.from({ length: VISIBLE_LEVELS }).map((_, i) => (
              <div key={`bid-sk-${i}`} className="grid grid-cols-3 gap-2 py-[3px]">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : (
        <>
        {/* Asks (sells) - reversed so lowest ask is at bottom */}
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          {asks.map((level, i) => (
            <button
              key={`ask-${i}`}
              onClick={() => handleClick(level.price)}
              className="grid grid-cols-3 px-3 py-[3px] hover:bg-[#1a1d26] relative cursor-pointer text-left"
            >
              <div
                className="absolute inset-0 bg-[#f6465d]/10"
                style={{ width: `${maxTotal > 0 ? (level.total / maxTotal) * 100 : 0}%`, right: 0, left: "auto" }}
              />
              <span className="text-[#f6465d] relative z-10">{formatPrice(level.price)}</span>
              <span className="text-right text-[#eaecef] relative z-10">{formatSize(level.size)}</span>
              <span className="text-right text-[#848e9c] relative z-10">{formatSize(level.total.toString())}</span>
            </button>
          ))}
        </div>

        {/* Spread */}
        <div className="px-3 py-1.5 border-y border-[#2a2e39] text-[#848e9c] flex items-center justify-between">
          <span className="text-[#eaecef] font-medium">
            {orderbook?.levels?.[0]?.[0]
              ? formatPrice(
                  (
                    (parseFloat(orderbook.levels[0][0].px) +
                      parseFloat(orderbook.levels[1]?.[0]?.px ?? orderbook.levels[0][0].px)) /
                    2
                  ).toString(),
                )
              : "—"}
          </span>
          <span className="text-[10px]">
            Spread: {spread} ({spreadPct}%)
          </span>
        </div>

        {/* Bids (buys) */}
        <div className="flex-1 overflow-hidden">
          {bids.map((level, i) => (
            <button
              key={`bid-${i}`}
              onClick={() => handleClick(level.price)}
              className="grid grid-cols-3 px-3 py-[3px] hover:bg-[#1a1d26] relative cursor-pointer text-left w-full"
            >
              <div
                className="absolute inset-0 bg-[#0ecb81]/10"
                style={{ width: `${maxTotal > 0 ? (level.total / maxTotal) * 100 : 0}%`, right: 0, left: "auto" }}
              />
              <span className="text-[#0ecb81] relative z-10">{formatPrice(level.price)}</span>
              <span className="text-right text-[#eaecef] relative z-10">{formatSize(level.size)}</span>
              <span className="text-right text-[#848e9c] relative z-10">{formatSize(level.total.toString())}</span>
            </button>
          ))}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
