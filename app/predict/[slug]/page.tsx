"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  BarChart3,
  Droplets,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
} from "lucide-react";
import type { PolymarketEvent, PolymarketMarket, PolymarketPosition } from "@/lib/polymarket/types";
import {
  fetchEventBySlug,
  fetchEventById,
  formatVolume,
  getOutcomePrice,
  getEventEndDate,
  formatTimeRemaining,
  fetchPolymarketPositions,
} from "@/lib/polymarket/api";
import { useWallet } from "@/hooks/useWallet";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";

function LiveCountdown({ endDate }: { endDate: Date }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, endDate.getTime() - Date.now());
  if (diff <= 0) return <span className="text-red-400 font-semibold">Ended</span>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  parts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
  return <span className="font-mono tabular-nums">{parts.join(" ")}</span>;
}

function formatUsd(val: number): string {
  if (!Number.isFinite(val)) return "$0.00";
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export default function EventDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [event, setEvent] = useState<PolymarketEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const { address, connect } = useWallet();
  const { address: effectiveAddress } = useEffectiveAddress();
  const [positions, setPositions] = useState<PolymarketPosition[]>([]);

  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"chance" | "volume">("chance");
  const [sortAsc, setSortAsc] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      let ev = await fetchEventBySlug(slug);
      if (!ev) ev = await fetchEventById(slug);
      setEvent(ev);
      if (ev?.markets?.length) setSelectedMarket(ev.markets[0]);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!effectiveAddress || !event) return;
    fetchPolymarketPositions(effectiveAddress).then((data) => {
      const eventPositions = data.positions.filter(
        (p) => p.eventSlug === event.slug || p.eventId === event.id,
      );
      setPositions(eventPositions);
    }).catch(() => {});
  }, [effectiveAddress, event]);

  const sortedMarkets = useMemo(() => {
    if (!event?.markets) return [];
    let filtered = event.markets;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => m.question.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === "chance") {
        const pa = getOutcomePrice(a).yes;
        const pb = getOutcomePrice(b).yes;
        return sortAsc ? pa - pb : pb - pa;
      }
      const va = a.volume_num ?? (parseFloat(String(a.volume)) || 0);
      const vb = b.volume_num ?? (parseFloat(String(b.volume)) || 0);
      return sortAsc ? va - vb : vb - va;
    });
  }, [event, searchQuery, sortBy, sortAsc]);

  const selectedPrices = selectedMarket ? getOutcomePrice(selectedMarket) : { yes: 0.5, no: 0.5 };
  const activePrice = selectedSide === "yes" ? selectedPrices.yes : selectedPrices.no;
  const shares = amount && activePrice > 0 ? parseFloat(amount) / activePrice : 0;
  const toWin = shares > 0 ? shares - parseFloat(amount || "0") : 0;

  const positionMap = useMemo(() => {
    const map = new Map<string, PolymarketPosition>();
    for (const p of positions) {
      if (p.currentValue > 0.01 || p.size > 0) {
        map.set(p.conditionId, p);
      }
    }
    return map;
  }, [positions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center text-white">
        <p className="text-sm text-[#848e9c] mb-4">Event not found</p>
        <Link href="/predict" className="text-sm text-brand hover:underline">
          &larr; Back to predictions
        </Link>
      </div>
    );
  }

  const endDate = getEventEndDate(event);
  const isClosed = event.closed;
  const isEnded = endDate ? endDate.getTime() < Date.now() : false;
  const isUrgent = endDate && !isClosed && !isEnded && endDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#848e9c] mb-5">
          <Link href="/predict" className="hover:text-white transition-colors">Prediction Markets</Link>
          <span>&rsaquo;</span>
          <span className="text-white truncate max-w-[300px]">{event.title}</span>
        </div>

        {/* Closed banner */}
        {(isClosed || isEnded) && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-[#1a1d2e] border border-[#2a2e3e] flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#848e9c]/20 text-[#848e9c] text-xs font-semibold uppercase">
              <Clock className="h-3 w-3" />
              {isClosed ? "Resolved" : "Ended"}
            </span>
            {endDate && (
              <span className="text-xs text-[#848e9c]">
                on {endDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── Left Column: Content ─── */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Event Header */}
            <div className="flex gap-4">
              {event.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.image}
                  alt=""
                  className={`w-16 h-16 rounded-xl object-cover shrink-0 ${isClosed || isEnded ? "grayscale" : ""}`}
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold leading-tight mb-2">{event.title}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-[#848e9c]">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {formatVolume(event.volume_num ?? event.volume ?? 0)} volume
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#848e9c]">
                    <Droplets className="h-3.5 w-3.5" />
                    {formatVolume(event.liquidity ?? 0)} liquidity
                  </span>
                  {endDate && !isClosed && !isEnded && (
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${isUrgent ? "text-amber-400" : "text-[#848e9c]"}`}>
                      <Clock className="h-3.5 w-3.5" />
                      <LiveCountdown endDate={endDate} />
                    </span>
                  )}
                  {event.tags?.map((tag) => (
                    <span key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                      {tag.label}
                    </span>
                  ))}
                  <a
                    href={`https://polymarket.com/event/${event.slug || event.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#848e9c] hover:text-white transition-colors ml-auto"
                  >
                    View on Polymarket <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Description (collapsible) */}
            {event.description && (
              <div className="bg-[#141620] rounded-xl px-5 py-4">
                <p className={`text-sm text-[#848e9c] leading-relaxed ${showFullDesc ? "" : "line-clamp-3"}`}>
                  {event.description}
                </p>
                {event.description.length > 200 && (
                  <button
                    onClick={() => setShowFullDesc(!showFullDesc)}
                    className="flex items-center gap-1 text-xs text-brand hover:text-brand-hover mt-2 transition-colors"
                  >
                    {showFullDesc ? "Show less" : "Read more"}
                    {showFullDesc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>
            )}

            {/* Outcome Table Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">Outcome</span>
                {event.markets && event.markets.length > 5 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#555a66]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search markets..."
                      className="pl-7 pr-3 py-1.5 bg-[#141620] rounded-lg text-xs text-white placeholder-[#555a66] focus:outline-none w-48"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (sortBy === "chance") setSortAsc(!sortAsc); else { setSortBy("chance"); setSortAsc(false); } }}
                  className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${sortBy === "chance" ? "text-brand" : "text-[#848e9c] hover:text-white"}`}
                >
                  % Chance
                  {sortBy === "chance" && <ArrowUpDown className="h-2.5 w-2.5" />}
                </button>
              </div>
            </div>

            {/* Outcome Rows */}
            <div className="space-y-1.5">
              {sortedMarkets.map((m) => {
                const prices = getOutcomePrice(m);
                const yesPct = Math.round(prices.yes * 100);
                const noPct = Math.round(prices.no * 100);
                const vol = m.volume_num ?? (parseFloat(String(m.volume)) || 0);
                const isSelected = selectedMarket?.id === m.id;
                const pos = positionMap.get(m.condition_id);

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMarket(m)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#1a1d2e] ring-1 ring-brand/30"
                        : "bg-[#141620] hover:bg-[#1a1d2e]"
                    }`}
                  >
                    {/* Outcome name + position badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{m.question}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#555a66]">{formatVolume(vol)} Vol</span>
                        {pos && pos.size > 0 && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            pos.outcome === "Yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {pos.outcome} · {pos.size.toLocaleString(undefined, { maximumFractionDigits: 1 })} · {(pos.avgPrice * 100).toFixed(1)}¢
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chance % */}
                    <div className="shrink-0 text-right w-16">
                      <span className="text-lg font-bold text-white">{yesPct}%</span>
                    </div>

                    {/* Buy buttons */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedMarket(m); setSelectedSide("yes"); }}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          isSelected && selectedSide === "yes"
                            ? "bg-emerald-500 text-white"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        Buy Yes {yesPct}¢
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedMarket(m); setSelectedSide("no"); }}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          isSelected && selectedSide === "no"
                            ? "bg-red-500 text-white"
                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        }`}
                      >
                        Buy No {noPct}¢
                      </button>
                    </div>
                  </div>
                );
              })}
              {sortedMarkets.length === 0 && (
                <p className="text-sm text-[#848e9c] text-center py-8">No markets found</p>
              )}
            </div>
          </div>

          {/* ─── Right Column: Bet Slip (sticky) ─── */}
          <div className="lg:w-[340px] shrink-0">
            <div className="sticky top-6 space-y-4">
              {/* Bet Slip */}
              <div className="bg-[#141620] rounded-xl overflow-hidden">
                {/* Market header */}
                {selectedMarket && (
                  <div className="px-5 pt-4 pb-3 border-b border-[#2a2e3e]">
                    <div className="flex items-center gap-2.5">
                      {event.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={event.icon || event.image} alt="" className="h-7 w-7 rounded-lg object-cover" />
                      )}
                      <span className="text-sm font-semibold text-white truncate">{selectedMarket.question}</span>
                    </div>
                  </div>
                )}

                {selectedMarket ? (
                  <div className="px-5 py-4 space-y-4">
                    {/* Buy / Sell toggle */}
                    <div className="flex gap-1 bg-[#0b0e11] rounded-lg p-0.5">
                      <button className="flex-1 py-2 rounded-md text-xs font-semibold bg-brand text-white">Buy</button>
                      <button className="flex-1 py-2 rounded-md text-xs font-semibold text-[#848e9c] hover:text-white transition-colors">Sell</button>
                      <div className="flex items-center gap-1 px-2">
                        <button
                          onClick={() => setOrderType("market")}
                          className={`text-[10px] font-medium px-2 py-1 rounded ${orderType === "market" ? "text-white bg-[#2a2e3e]" : "text-[#848e9c]"}`}
                        >
                          Market
                        </button>
                        <button
                          onClick={() => setOrderType("limit")}
                          className={`text-[10px] font-medium px-2 py-1 rounded ${orderType === "limit" ? "text-white bg-[#2a2e3e]" : "text-[#848e9c]"}`}
                        >
                          Limit
                        </button>
                      </div>
                    </div>

                    {/* Yes / No selector */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedSide("yes")}
                        className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                          selectedSide === "yes"
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-[#2a2e3e] hover:border-[#3a3e4e]"
                        }`}
                      >
                        <span className="text-sm font-bold text-white">Yes</span>
                        <span className={`text-sm font-bold ${selectedSide === "yes" ? "text-emerald-400" : "text-[#848e9c]"}`}>
                          {Math.round(selectedPrices.yes * 100)}¢
                        </span>
                      </button>
                      <button
                        onClick={() => setSelectedSide("no")}
                        className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                          selectedSide === "no"
                            ? "border-red-500 bg-red-500/10"
                            : "border-[#2a2e3e] hover:border-[#3a3e4e]"
                        }`}
                      >
                        <span className="text-sm font-bold text-white">No</span>
                        <span className={`text-sm font-bold ${selectedSide === "no" ? "text-red-400" : "text-[#848e9c]"}`}>
                          {Math.round(selectedPrices.no * 100)}¢
                        </span>
                      </button>
                    </div>

                    {/* Shares display */}
                    <div className="flex items-center justify-between text-xs text-[#848e9c]">
                      <span>0.00 Shares</span>
                      <span className={selectedSide === "yes" ? "text-emerald-400" : "text-red-400"}>
                        {shares > 0 ? shares.toFixed(2) : "0.00"} Shares
                      </span>
                    </div>

                    {/* Amount input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-white">Amount</span>
                        <span className="text-[10px] text-[#848e9c]">Balance $0.01</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#848e9c]">$</span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 bg-[#0b0e11] rounded-xl text-sm text-white text-right placeholder-[#4a4e5c] focus:outline-none focus:ring-1 focus:ring-brand/30"
                        />
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {[2, 20, 100].map((v) => (
                          <button
                            key={v}
                            onClick={() => setAmount(String(v))}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-[#848e9c] bg-[#0b0e11] hover:bg-[#1a1d2e] hover:text-white transition-colors"
                          >
                            +${v}
                          </button>
                        ))}
                        <button
                          onClick={() => setAmount("0")}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-[#848e9c] bg-[#0b0e11] hover:bg-[#1a1d2e] hover:text-white transition-colors"
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    {/* To Win / Avg Price */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#848e9c]">To win</span>
                        <span className={`font-semibold ${toWin > 0 ? "text-emerald-400" : "text-white"}`}>
                          {toWin > 0 ? formatUsd(toWin) : "$\u2014"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#848e9c]">Avg. Price</span>
                        <span className="text-white">
                          {activePrice > 0 ? `${(activePrice * 100).toFixed(1)}¢` : "\u2014"}
                        </span>
                      </div>
                    </div>

                    {/* Place Order Button */}
                    {address ? (
                      <button
                        className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                          selectedSide === "yes"
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                            : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                        } ${!amount || parseFloat(amount) <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={!amount || parseFloat(amount) <= 0}
                        onClick={() => {
                          alert(`Trade preview: Buy ${selectedSide?.toUpperCase()} for $${amount}\nShares: ${shares.toFixed(2)}\nTo win: ${formatUsd(toWin)}\n\nPolymarket CLOB trading coming soon.`);
                        }}
                      >
                        Buy {selectedSide === "yes" ? "Yes" : "No"} &mdash; ${amount || "0"}
                      </button>
                    ) : (
                      <button
                        onClick={connect}
                        className="w-full py-3.5 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand-hover transition-colors"
                      >
                        Connect Wallet
                      </button>
                    )}

                    <p className="text-[9px] text-[#555a66] text-center">
                      Trades execute on Polygon via Polymarket CLOB
                    </p>
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-[#848e9c]">Select an outcome to trade</p>
                  </div>
                )}
              </div>

              {/* Your Positions */}
              {positions.length > 0 && (
                <div className="bg-[#141620] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2e3e]">
                    <span className="text-sm font-semibold text-white">Your Positions ({positions.filter(p => p.size > 0).length})</span>
                  </div>
                  <div className="divide-y divide-[#2a2e3e]/50">
                    {positions.filter(p => p.size > 0).map((p) => {
                      const isProfit = p.cashPnl >= 0;
                      return (
                        <div key={p.asset} className="px-5 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-white truncate max-w-[180px]">{p.title}</span>
                            <span className={`text-xs font-bold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                              {formatUsd(p.currentValue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                p.outcome === "Yes" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                              }`}>
                                {p.outcome}
                              </span>
                              <span className="text-[10px] text-[#848e9c]">
                                {p.size.toLocaleString(undefined, { maximumFractionDigits: 1 })} @ {(p.avgPrice * 100).toFixed(1)}¢
                              </span>
                            </div>
                            <span className={`text-[10px] font-medium ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                              {isProfit ? "+" : ""}{formatUsd(p.cashPnl)} ({p.percentPnl.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
