"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Share2, Download, Copy, Check } from "lucide-react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { signAndPlaceOrder, getMarketOrderPrice, signAndCancelOrder } from "@/lib/hyperliquid/signing";
import { Bot } from "lucide-react";

type Tab = "positions" | "orders" | "fills";

interface QuantTradeInfo {
  coin: string;
  side: string;
  strategy_type: string;
  meta: { reason?: string } | null;
}

export function PositionsTable() {
  const { clearinghouse, openOrders, address, markets, loadUserState } = useTradingStore();
  const [tab, setTab] = useState<Tab>("positions");
  const [closingCoin, setClosingCoin] = useState<string | null>(null);
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);
  const [sharePosition, setSharePosition] = useState<ShareablePosition | null>(null);
  const [quantTrades, setQuantTrades] = useState<QuantTradeInfo[]>([]);

  useEffect(() => {
    fetch("/api/quant/trades?status=open&limit=50")
      .then((r) => r.ok ? r.json() : { trades: [] })
      .then((d) => setQuantTrades(d.trades ?? []))
      .catch(() => {});
  }, []);

  const getQuantInfo = (coin: string) => quantTrades.find((t) => t.coin === coin);

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

  const openShareModal = useCallback((pos: { coin: string; szi: string; entryPx?: string | null; leverage: { value: number }; unrealizedPnl: string; returnOnEquity: string }) => {
    const size = parseFloat(pos.szi);
    const isLong = size > 0;
    const market = markets.find((m) => m.name === pos.coin);
    const markPx = market ? parseFloat(market.markPx).toFixed(2) : "0";
    setSharePosition({
      coin: pos.coin,
      side: isLong ? "LONG" : "SHORT",
      leverage: `${pos.leverage.value}x`,
      roe: parseFloat(pos.returnOnEquity) * 100,
      pnl: parseFloat(pos.unrealizedPnl),
      entryPx: pos.entryPx ? parseFloat(pos.entryPx).toFixed(2) : "0",
      markPx,
    });
  }, [markets]);

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
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[#2a2e39] shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          {([
            ["positions", `Positions (${positions.length})`],
            ["orders", `Orders (${openOrders.length})`],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-1 border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? "text-white border-[#7C3AED]" : "text-[#848e9c] border-transparent hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Account summary — visible on all screen sizes */}
        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px]">
          <div>
            <span className="text-[#848e9c]">Eq: </span>
            <span className="text-white font-medium">${accountValue.toFixed(2)}</span>
          </div>
          <div className="hidden xs:block">
            <span className="text-[#848e9c]">Mgn: </span>
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

      {/* Positions tab */}
      {tab === "positions" && (
        positions.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-[#4a4e59]">
            No open positions
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[#848e9c] uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">Market</th>
                    <th className="text-right px-3 py-2 font-medium">Size</th>
                    <th className="text-right px-3 py-2 font-medium">Entry</th>
                    <th className="text-right px-3 py-2 font-medium">Mark</th>
                    <th className="text-right px-3 py-2 font-medium">Liq.</th>
                    <th className="text-right px-3 py-2 font-medium">Margin</th>
                    <th className="text-right px-3 py-2 font-medium">Fund/8h</th>
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
                    const market = markets.find((m) => m.name === pos.coin);
                    const fundingRate = market ? parseFloat(market.funding) : 0;
                    const fundingPct = (fundingRate * 100).toFixed(4);
                    const quantInfo = getQuantInfo(pos.coin);

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
                            {quantInfo && (
                              <span className="text-[9px] px-1 py-0.5 rounded font-medium bg-[#7C3AED]/15 text-[#7C3AED] flex items-center gap-0.5" title={quantInfo.meta?.reason || quantInfo.strategy_type}>
                                <Bot className="h-2.5 w-2.5" /> AUTO
                              </span>
                            )}
                          </div>
                          {quantInfo?.meta?.reason && (
                            <div className="text-[9px] text-[#848e9c] mt-0.5 truncate max-w-[200px]">{quantInfo.meta.reason}</div>
                          )}
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
                        <td className={`text-right px-3 py-2 ${fundingRate >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                          {fundingRate >= 0 ? "+" : ""}{fundingPct}%
                        </td>
                        <td className={`text-right px-3 py-2 font-medium ${pnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </td>
                        <td className={`text-right px-3 py-2 font-medium ${roe >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                          {roe >= 0 ? "+" : ""}{roe.toFixed(2)}%
                        </td>
                        <td className="text-right px-4 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleClosePosition(pos.coin, pos.szi)}
                              disabled={closingCoin === pos.coin}
                              className="px-2 py-1 bg-[#f6465d]/10 text-[#f6465d] rounded hover:bg-[#f6465d]/20 transition-colors disabled:opacity-50 text-[10px] font-medium"
                            >
                              {closingCoin === pos.coin ? <Loader2 className="h-3 w-3 animate-spin" /> : "Close"}
                            </button>
                            <button
                              onClick={() => openShareModal(pos)}
                              className="px-2 py-1 bg-[#7C3AED]/15 text-[#7C3AED] rounded hover:bg-[#7C3AED]/25 transition-colors text-[10px] font-medium flex items-center gap-1"
                            >
                              <Share2 className="h-3 w-3" /> Share
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden flex-1 overflow-y-auto divide-y divide-[#2a2e39]">
              {positions.map((p) => {
                const pos = p.position;
                const size = parseFloat(pos.szi);
                const isLong = size > 0;
                const pnl = parseFloat(pos.unrealizedPnl);
                const roe = parseFloat(pos.returnOnEquity) * 100;
                const mkt = markets.find((m) => m.name === pos.coin);
                const markPx = mkt
                  ? parseFloat(mkt.markPx).toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : "—";
                const mFundRate = mkt ? parseFloat(mkt.funding) : 0;
                const mFundPct = (mFundRate * 100).toFixed(4);
                const mQuantInfo = getQuantInfo(pos.coin);

                return (
                  <div key={pos.coin} className="px-3 py-3 active:bg-[#1a1d26]">
                    {/* Row 1: coin + badge | PnL + ROE */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold text-sm">{pos.coin}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          isLong ? "bg-[#0ecb81]/15 text-[#0ecb81]" : "bg-[#f6465d]/15 text-[#f6465d]"
                        }`}>
                          {isLong ? "LONG" : "SHORT"} {pos.leverage.value}x
                        </span>
                        {mQuantInfo && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-[#7C3AED]/15 text-[#7C3AED] flex items-center gap-0.5">
                            <Bot className="h-2.5 w-2.5" /> AUTO
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${pnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </span>
                        <span className={`ml-1.5 text-[10px] font-medium ${roe >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                          ({roe >= 0 ? "+" : ""}{roe.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    {mQuantInfo?.meta?.reason && (
                      <div className="text-[9px] text-[#848e9c] mb-1.5 truncate">{mQuantInfo.meta.reason}</div>
                    )}

                    {/* Row 2: detail grid */}
                    <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 text-[10px] mb-2.5">
                      <div>
                        <div className="text-[#848e9c]">Size</div>
                        <div className={isLong ? "text-[#0ecb81]" : "text-[#f6465d]"}>{Math.abs(size).toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-[#848e9c]">Entry</div>
                        <div className="text-[#eaecef]">{pos.entryPx ? parseFloat(pos.entryPx).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</div>
                      </div>
                      <div>
                        <div className="text-[#848e9c]">Mark</div>
                        <div className="text-[#eaecef]">{markPx}</div>
                      </div>
                      <div>
                        <div className="text-[#848e9c]">Fund/8h</div>
                        <div className={mFundRate >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>{mFundRate >= 0 ? "+" : ""}{mFundPct}%</div>
                      </div>
                    </div>

                    {/* Row 3: actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleClosePosition(pos.coin, pos.szi)}
                        disabled={closingCoin === pos.coin}
                        className="flex-1 py-1.5 bg-[#f6465d]/10 text-[#f6465d] rounded-lg hover:bg-[#f6465d]/20 transition-colors disabled:opacity-50 text-[11px] font-semibold"
                      >
                        {closingCoin === pos.coin ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Close Position"}
                      </button>
                      <button
                        onClick={() => openShareModal(pos)}
                        className="px-3 py-1.5 bg-[#7C3AED]/10 text-[#7C3AED] rounded-lg hover:bg-[#7C3AED]/20 transition-colors"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {/* Orders tab */}
      {tab === "orders" && (
        openOrders.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-[#4a4e59]">
            No open orders
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto flex-1">
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

            {/* Mobile card layout for orders */}
            <div className="md:hidden flex-1 overflow-y-auto divide-y divide-[#2a2e39]">
              {openOrders.map((o) => {
                const isBuy = o.side === "B";
                return (
                  <div key={o.oid} className="px-3 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm">{o.coin}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          isBuy ? "bg-[#0ecb81]/15 text-[#0ecb81]" : "bg-[#f6465d]/15 text-[#f6465d]"
                        }`}>
                          {isBuy ? "BUY" : "SELL"}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2a2e3e] text-[#848e9c]">{o.orderType}</span>
                      </div>
                      <button
                        onClick={() => handleCancelOrder(o.coin, o.oid)}
                        disabled={cancellingOid === o.oid}
                        className="p-1.5 text-[#f6465d] hover:bg-[#f6465d]/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {cancellingOid === o.oid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <div className="text-[#848e9c]">Price</div>
                        <div className="text-[#eaecef]">${parseFloat(o.limitPx).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-[#848e9c]">Size</div>
                        <div className="text-[#eaecef]">{o.origSz}</div>
                      </div>
                      <div>
                        <div className="text-[#848e9c]">Filled</div>
                        <div className="text-[#848e9c]">{(parseFloat(o.origSz) - parseFloat(o.sz)).toFixed(4)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {sharePosition && createPortal(
        <SharePnlModal position={sharePosition} onClose={() => setSharePosition(null)} />,
        document.body
      )}
    </div>
  );
}

/* ---------- Share PNL Modal ---------- */

interface ShareablePosition {
  coin: string; side: string; leverage: string; roe: number; entryPx: string; markPx: string; pnl: number;
}

function SharePnlModal({ position, onClose }: { position: ShareablePosition; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "1:1">("16:9");
  const [showPnlAmount, setShowPnlAmount] = useState(true);
  const [copied, setCopied] = useState(false);
  const isProfit = position.roe >= 0;

  const W = aspectRatio === "16:9" ? 800 : 600;
  const H = aspectRatio === "16:9" ? 450 : 600;

  const drawCard = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.scale(2, 2);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0f1118");
    grad.addColorStop(1, "#1a1028");
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, W, H, 16);
    ctx.fill();

    ctx.strokeStyle = "#2a2e3e";
    ctx.lineWidth = 1;
    ctx.roundRect(0, 0, W, H, 16);
    ctx.stroke();

    drawStars(ctx, W, H);
    drawRocket(ctx, W, H, isProfit);

    ctx.fillStyle = "#7C3AED";
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("coincess", 32, 44);

    const badgeY = aspectRatio === "16:9" ? 80 : 90;
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = isProfit ? "#0ecb81" : "#f6465d";
    ctx.fillText(position.leverage, 32, badgeY);
    const levW = ctx.measureText(position.leverage).width;

    ctx.fillStyle = isProfit ? "#0ecb81" : "#f6465d";
    ctx.fillText(position.side, 32 + levW + 12, badgeY);
    const sideW = ctx.measureText(position.side).width;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
    ctx.fillText(position.coin.replace("-USD", ""), 32 + levW + 12 + sideW + 12, badgeY);

    const roeY = aspectRatio === "16:9" ? 150 : 170;
    ctx.fillStyle = isProfit ? "#0ecb81" : "#f6465d";
    ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
    const roeText = `${position.roe >= 0 ? "+" : ""}${position.roe.toFixed(2)}%`;
    ctx.fillText(roeText, 32, roeY);

    if (showPnlAmount) {
      ctx.fillStyle = "#848e9c";
      ctx.font = "16px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `PnL: ${position.pnl >= 0 ? "+" : ""}$${position.pnl.toFixed(2)}`,
        32,
        roeY + 30,
      );
    }

    const detailY = aspectRatio === "16:9" ? H - 60 : H - 80;
    ctx.fillStyle = "#848e9c";
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.fillText("Entry Price", 32, detailY);
    ctx.fillText("Current Price", 180, detailY);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.fillText(position.entryPx, 32, detailY + 24);
    ctx.fillText(position.markPx, 180, detailY + 24);

    ctx.fillStyle = "#4a4e59";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText("coincess.com", W - 110, H - 20);
  }, [W, H, position, isProfit, showPnlAmount, aspectRatio]);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCard(canvas);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coincess-${position.coin}-${position.side}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCard(canvas);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      handleDownload();
    }
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCard(canvas);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    const file = new File([blob], `coincess-${position.coin}.png`, { type: "image/png" });
    if (navigator.share) {
      try {
        await navigator.share({ files: [file], title: `${position.coin} ${position.side} ${position.roe >= 0 ? "+" : ""}${position.roe.toFixed(2)}%` });
        return;
      } catch { /* fallback */ }
    }
    handleDownload();
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[#1a1d2e] border-t sm:border border-[#2a2e3e] sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto pb-safe">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-[#2a2e3e] bg-[#1a1d2e]">
            <h2 className="text-white font-semibold text-base">Share PNL</h2>
            <button onClick={onClose} className="text-[#848e9c] hover:text-white p-1.5 rounded-lg hover:bg-[#2a2e3e] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-4 space-y-4">
            {/* Aspect ratio toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#2a2e3e]">
              {(["16:9", "1:1"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`flex-1 py-2.5 sm:py-2 text-xs font-medium transition-colors ${
                    aspectRatio === r ? "bg-[#7C3AED] text-white" : "text-[#848e9c] hover:text-white"
                  }`}
                >
                  {r === "16:9" ? "Rectangle (16:9)" : "Square (1:1)"}
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="relative bg-[#0b0e11] rounded-xl overflow-hidden">
              <ShareCardPreview
                position={position}
                aspectRatio={aspectRatio}
                showPnlAmount={showPnlAmount}
              />
            </div>

            {/* Action buttons — responsive grid on mobile */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3">
              <button onClick={handleDownload} className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 bg-[#2a2e3e] text-white rounded-xl hover:bg-[#3a3e4e] active:bg-[#3a3e4e] transition-colors text-xs sm:text-sm font-medium">
                <Download className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Download</span><span className="sm:hidden">Save</span>
              </button>
              <button onClick={handleCopy} className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 bg-[#2a2e3e] text-white rounded-xl hover:bg-[#3a3e4e] active:bg-[#3a3e4e] transition-colors text-xs sm:text-sm font-medium">
                {copied ? <Check className="h-4 w-4 shrink-0 text-[#0ecb81]" /> : <Copy className="h-4 w-4 shrink-0" />}
                {copied ? "Done" : "Copy"}
              </button>
              <button onClick={handleShare} className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 bg-[#7C3AED] text-white rounded-xl hover:bg-[#6D28D9] active:bg-[#6D28D9] transition-colors text-xs sm:text-sm font-bold">
                <Share2 className="h-4 w-4 shrink-0" /> Share
              </button>
            </div>

            {/* Options */}
            <label className="flex items-center gap-2 text-sm text-[#848e9c] cursor-pointer py-1">
              <input
                type="checkbox"
                checked={showPnlAmount}
                onChange={(e) => setShowPnlAmount(e.target.checked)}
                className="w-4 h-4 rounded border-[#2a2e3e] bg-[#0b0e11] text-[#7C3AED] focus:ring-[#7C3AED]"
              />
              Include P&L amount
            </label>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}

/* ---------- Preview Component (CSS/HTML for instant rendering) ---------- */

function ShareCardPreview({ position, aspectRatio, showPnlAmount }: {
  position: ShareablePosition; aspectRatio: "16:9" | "1:1"; showPnlAmount: boolean;
}) {
  const isProfit = position.roe >= 0;
  const pctAspect = aspectRatio === "16:9" ? "56.25%" : "100%";

  const stars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      w: 1 + Math.random() * 2,
      left: Math.random() * 100,
      top: Math.random() * 100,
      key: i,
    })),
    [],
  );

  return (
    <div className="relative w-full" style={{ paddingBottom: pctAspect }}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f1118] to-[#1a1028] rounded-xl overflow-hidden p-4 sm:p-6 flex flex-col">
        {/* Stars */}
        <div className="absolute inset-0 pointer-events-none">
          {stars.map((s) => (
            <div
              key={s.key}
              className="absolute rounded-full bg-white/20"
              style={{ width: `${s.w}px`, height: `${s.w}px`, left: `${s.left}%`, top: `${s.top}%` }}
            />
          ))}
        </div>

        {/* Rocket illustration */}
        <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
          <svg className="w-[80px] sm:w-[140px] h-auto" viewBox="0 0 140 200" fill="none">
            <ellipse cx="70" cy="180" rx="40" ry="12" fill={isProfit ? "#0ecb81" : "#f6465d"} opacity="0.3" />
            <path d="M70 20 L90 80 L85 140 L70 150 L55 140 L50 80 Z" fill="#e8e8e8" stroke="#ccc" strokeWidth="1" />
            <circle cx="70" cy="80" r="12" fill="#1a1028" stroke="#7C3AED" strokeWidth="2" />
            <path d="M50 80 L35 130 L55 120 Z" fill="#7C3AED" opacity="0.7" />
            <path d="M90 80 L105 130 L85 120 Z" fill="#7C3AED" opacity="0.7" />
            <path d="M60 150 L55 190 L70 165 L85 190 L80 150 Z" fill={isProfit ? "#0ecb81" : "#f6465d"} opacity="0.8" />
          </svg>
        </div>

        {/* Logo */}
        <div className="text-[#7C3AED] font-bold text-lg sm:text-xl mb-auto relative z-10">coincess</div>

        {/* Position info */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <span className={`text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded ${isProfit ? "bg-[#0ecb81]/20 text-[#0ecb81]" : "bg-[#f6465d]/20 text-[#f6465d]"}`}>
              {position.leverage}
            </span>
            <span className={`text-[10px] sm:text-xs font-bold ${isProfit ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              {position.side}
            </span>
            <span className="text-white font-bold text-xs sm:text-sm">{position.coin.replace("-USD", "")}</span>
          </div>

          <div className={`text-3xl sm:text-5xl font-bold ${isProfit ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
            {position.roe >= 0 ? "+" : ""}{position.roe.toFixed(2)}%
          </div>

          {showPnlAmount && (
            <div className="text-[#848e9c] text-xs sm:text-sm mt-1">
              PnL: {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
            </div>
          )}
        </div>

        {/* Entry / Current */}
        <div className="relative z-10 flex gap-8 sm:gap-16 mt-auto">
          <div>
            <div className="text-[#848e9c] text-[10px] sm:text-xs mb-0.5 sm:mb-1">Entry Price</div>
            <div className="text-white font-bold text-sm sm:text-lg">{position.entryPx}</div>
          </div>
          <div>
            <div className="text-[#848e9c] text-[10px] sm:text-xs mb-0.5 sm:mb-1">Current Price</div>
            <div className="text-white font-bold text-sm sm:text-lg">{position.markPx}</div>
          </div>
        </div>

        {/* Watermark */}
        <div className="absolute bottom-2 sm:bottom-3 right-3 sm:right-4 text-[#4a4e59] text-[9px] sm:text-[10px]">coincess.com</div>
      </div>
    </div>
  );
}

/* ---------- Canvas drawing helpers ---------- */

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  for (let i = 0; i < 40; i++) {
    const r = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRocket(ctx: CanvasRenderingContext2D, w: number, h: number, isProfit: boolean) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  const cx = w - 100;
  const cy = h / 2;
  ctx.translate(cx, cy);

  ctx.fillStyle = "#e8e8e8";
  ctx.beginPath();
  ctx.moveTo(0, -70);
  ctx.bezierCurveTo(15, -50, 20, 0, 20, 60);
  ctx.lineTo(-20, 60);
  ctx.bezierCurveTo(-20, 0, -15, -50, 0, -70);
  ctx.fill();

  ctx.fillStyle = "#7C3AED";
  ctx.beginPath();
  ctx.arc(0, -5, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7C3AED";
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(-20, 20);
  ctx.lineTo(-35, 55);
  ctx.lineTo(-15, 45);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, 20);
  ctx.lineTo(35, 55);
  ctx.lineTo(15, 45);
  ctx.fill();

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = isProfit ? "#0ecb81" : "#f6465d";
  ctx.beginPath();
  ctx.moveTo(-10, 60);
  ctx.lineTo(-15, 100);
  ctx.lineTo(0, 80);
  ctx.lineTo(15, 100);
  ctx.lineTo(10, 60);
  ctx.fill();

  ctx.restore();
}
