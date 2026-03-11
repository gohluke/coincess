"use client";

import { useEffect } from "react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { getWs } from "@/lib/hyperliquid/websocket";

export function RecentTrades({ hideHeader }: { hideHeader?: boolean } = {}) {
  const { recentTrades, selectedMarket, addTrades } = useTradingStore();

  useEffect(() => {
    const ws = getWs();
    const unsub = ws.subscribeTrades(selectedMarket, (trades) => {
      addTrades(trades);
    });
    return unsub;
  }, [selectedMarket, addTrades]);

  return (
    <div className="flex flex-col h-full text-xs">
      {!hideHeader && (
        <div className="px-3 py-2 border-b border-[#2a2e39]">
          <span className="text-[#848e9c] font-medium">Recent Trades</span>
        </div>
      )}

      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-[#848e9c] uppercase tracking-wider border-b border-[#2a2e39]">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>

      <div className="flex-1 overflow-hidden">
        {recentTrades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#4a4e59]">
            Waiting for trades...
          </div>
        ) : (
          recentTrades.slice(0, 30).map((trade, i) => {
            const isBuy = trade.side === "B";
            const time = new Date(trade.time);
            const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;

            return (
              <div key={`${trade.tid}-${i}`} className="grid grid-cols-3 px-3 py-[3px]">
                <span className={isBuy ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                  {parseFloat(trade.px) >= 1
                    ? parseFloat(trade.px).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : parseFloat(trade.px).toPrecision(5)}
                </span>
                <span className="text-right text-[#eaecef]">
                  {parseFloat(trade.sz).toFixed(4)}
                </span>
                <span className="text-right text-[#848e9c]">{timeStr}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
