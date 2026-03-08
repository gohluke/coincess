"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { signAndPlaceOrder, getMarketOrderPrice, signAndCancelOrder } from "@/lib/hyperliquid/signing";

type Tab = "positions" | "orders" | "fills";

export function PositionsTable() {
  const { clearinghouse, openOrders, address, markets, loadUserState } = useTradingStore();
  const [tab, setTab] = useState<Tab>("positions");
  const [closingCoin, setClosingCoin] = useState<string | null>(null);
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);

  const positions = clearinghouse?.assetPositions?.filter(
    (p) => parseFloat(p.position.szi) !== 0,
  ) ?? [];

  const handleClosePosition = async (coin: string, szi: string) => {
    setClosingCoin(coin);
    try {
      const size = Math.abs(parseFloat(szi));
      const isLong = parseFloat(szi) > 0;
      const market = markets.find((m) => m.name === coin);
      const markPx = parseFloat(market?.markPx ?? "0");
      const price = getMarketOrderPrice(!isLong, markPx);

      await signAndPlaceOrder({
        coin,
        isBuy: !isLong,
        price,
        size: size.toString(),
        orderType: "market",
        reduceOnly: true,
        markets,
      });
      loadUserState();
    } catch (err) {
      console.error("Close position failed:", err);
    } finally {
      setClosingCoin(null);
    }
  };

  const handleCancelOrder = async (coin: string, oid: number) => {
    setCancellingOid(oid);
    try {
      const market = markets.find((m) => m.name === coin);
      if (market) {
        await signAndCancelOrder(market.assetIndex, oid);
        loadUserState();
      }
    } catch (err) {
      console.error("Cancel order failed:", err);
    } finally {
      setCancellingOid(null);
    }
  };

  if (!address) {
    return (
      <div className="flex items-center justify-center h-full text-[#848e9c] text-sm">
        Connect wallet to view positions
      </div>
    );
  }

  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + parseFloat(p.position.unrealizedPnl), 0);
  const totalMarginUsed = clearinghouse ? parseFloat(clearinghouse.marginSummary.totalMarginUsed) : 0;
  const accountValue = clearinghouse ? parseFloat(clearinghouse.marginSummary.accountValue) : 0;

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Tab bar + account summary */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2e39]">
        <div className="flex items-center gap-4">
          {([
            ["positions", `Positions (${positions.length})`],
            ["orders", `Orders (${openOrders.length})`],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-1 border-b-2 transition-colors ${
                tab === t ? "text-white border-[#7C3AED]" : "text-[#848e9c] border-transparent hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Account summary inline */}
        <div className="hidden sm:flex items-center gap-4 text-[11px]">
          <div>
            <span className="text-[#848e9c]">Equity: </span>
            <span className="text-white font-medium">${accountValue.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[#848e9c]">Margin: </span>
            <span className="text-white">${totalMarginUsed.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[#848e9c]">uPnL: </span>
            <span className={totalUnrealizedPnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
              {totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {tab === "positions" && (
        positions.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-[#4a4e59]">
            No open positions
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-[#848e9c] uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Market</th>
                  <th className="text-right px-3 py-2 font-medium">Size</th>
                  <th className="text-right px-3 py-2 font-medium">Entry</th>
                  <th className="text-right px-3 py-2 font-medium">Mark</th>
                  <th className="text-right px-3 py-2 font-medium">Liq.</th>
                  <th className="text-right px-3 py-2 font-medium">Margin</th>
                  <th className="text-right px-3 py-2 font-medium">PnL</th>
                  <th className="text-right px-3 py-2 font-medium">ROE</th>
                  <th className="text-right px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const pos = p.position;
                  const size = parseFloat(pos.szi);
                  const isLong = size > 0;
                  const pnl = parseFloat(pos.unrealizedPnl);
                  const roe = parseFloat(pos.returnOnEquity) * 100;

                  return (
                    <tr key={pos.coin} className="hover:bg-[#1a1d26] border-b border-[#1a1d26]">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium">{pos.coin}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                            isLong ? "bg-[#0ecb81]/10 text-[#0ecb81]" : "bg-[#f6465d]/10 text-[#f6465d]"
                          }`}>
                            {isLong ? "L" : "S"} {pos.leverage.value}x
                          </span>
                        </div>
                      </td>
                      <td className={`text-right px-3 py-2 ${isLong ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                        {Math.abs(size).toFixed(4)}
                      </td>
                      <td className="text-right px-3 py-2 text-[#eaecef]">
                        {pos.entryPx ? parseFloat(pos.entryPx).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="text-right px-3 py-2 text-[#eaecef]">
                        {parseFloat(pos.positionValue) > 0
                          ? (parseFloat(pos.positionValue) / Math.abs(size)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                          : "—"}
                      </td>
                      <td className="text-right px-3 py-2 text-[#f0b90b]">
                        {pos.liquidationPx ? parseFloat(pos.liquidationPx).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="text-right px-3 py-2 text-[#eaecef]">${parseFloat(pos.marginUsed).toFixed(2)}</td>
                      <td className={`text-right px-3 py-2 font-medium ${pnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </td>
                      <td className={`text-right px-3 py-2 font-medium ${roe >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                        {roe >= 0 ? "+" : ""}{roe.toFixed(2)}%
                      </td>
                      <td className="text-right px-4 py-2">
                        <button
                          onClick={() => handleClosePosition(pos.coin, pos.szi)}
                          disabled={closingCoin === pos.coin}
                          className="px-2 py-1 bg-[#f6465d]/10 text-[#f6465d] rounded hover:bg-[#f6465d]/20 transition-colors disabled:opacity-50 text-[10px] font-medium"
                        >
                          {closingCoin === pos.coin ? <Loader2 className="h-3 w-3 animate-spin" /> : "Close"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "orders" && (
        openOrders.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-[#4a4e59]">
            No open orders
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-[#848e9c] uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Market</th>
                  <th className="text-right px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Side</th>
                  <th className="text-right px-3 py-2 font-medium">Price</th>
                  <th className="text-right px-3 py-2 font-medium">Size</th>
                  <th className="text-right px-3 py-2 font-medium">Filled</th>
                  <th className="text-right px-4 py-2 font-medium">Cancel</th>
                </tr>
              </thead>
              <tbody>
                {openOrders.map((o) => {
                  const isBuy = o.side === "B";
                  return (
                    <tr key={o.oid} className="hover:bg-[#1a1d26] border-b border-[#1a1d26]">
                      <td className="px-4 py-2 text-white font-medium">{o.coin}</td>
                      <td className="text-right px-3 py-2 text-[#eaecef]">{o.orderType}</td>
                      <td className={`text-right px-3 py-2 font-medium ${isBuy ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                        {isBuy ? "Buy" : "Sell"}
                      </td>
                      <td className="text-right px-3 py-2 text-[#eaecef]">
                        ${parseFloat(o.limitPx).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right px-3 py-2 text-[#eaecef]">{o.origSz}</td>
                      <td className="text-right px-3 py-2 text-[#848e9c]">
                        {(parseFloat(o.origSz) - parseFloat(o.sz)).toFixed(4)}
                      </td>
                      <td className="text-right px-4 py-2">
                        <button
                          onClick={() => handleCancelOrder(o.coin, o.oid)}
                          disabled={cancellingOid === o.oid}
                          className="p-1 text-[#f6465d] hover:bg-[#f6465d]/10 rounded transition-colors disabled:opacity-50"
                        >
                          {cancellingOid === o.oid ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
