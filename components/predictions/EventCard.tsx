"use client";

import Link from "next/link";
import type { PolymarketEvent } from "@/lib/polymarket/types";
import { formatVolume, getOutcomePrice, getEventEndDate, formatTimeRemaining } from "@/lib/polymarket/api";

function PriceBar({ yes }: { yes: number }) {
  const pct = Math.round(yes * 100);
  return (
    <div className="relative h-8 rounded-lg overflow-hidden bg-red-500/20">
      <div
        className="absolute inset-y-0 left-0 bg-emerald-500/30 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-between px-3">
        <span className="text-xs font-bold text-emerald-400">
          Yes {pct}¢
        </span>
        <span className="text-xs font-bold text-red-400">
          No {100 - pct}¢
        </span>
      </div>
    </div>
  );
}

export function EventCard({ event }: { event: PolymarketEvent }) {
  const mainMarket = event.markets?.[0];
  const prices = mainMarket ? getOutcomePrice(mainMarket) : { yes: 0.5, no: 0.5 };
  const isMultiMarket = event.markets && event.markets.length > 1;
  const endDate = getEventEndDate(event);
  const timeLeft = formatTimeRemaining(endDate);
  const isClosed = event.closed;
  const isEnded = timeLeft === "Ended";
  const isUrgent = endDate && !isClosed && !isEnded && endDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <Link
      href={`/predictions/${event.slug || event.id}`}
      className={`group block bg-[#141620] border rounded-xl p-4 transition-all duration-200 ${
        isClosed || isEnded
          ? "border-[#2a2e3e]/50 opacity-70 hover:opacity-90"
          : "border-[#2a2e3e] hover:border-[#7C3AED]/50 hover:bg-[#1a1d2e]"
      }`}
    >
      <div className="flex gap-3 mb-3">
        {event.image && (
          <div className="relative shrink-0">
            <img
              src={event.image}
              alt=""
              className={`w-12 h-12 rounded-lg object-cover ${isClosed || isEnded ? "grayscale" : ""}`}
            />
            {(isClosed || isEnded) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                <span className="text-[8px] font-bold text-white uppercase">Closed</span>
              </div>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 group-hover:text-[#7C3AED] transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 overflow-hidden">
            <span className="text-[10px] text-[#848e9c] shrink-0">
              Vol {formatVolume(event.volume_num ?? event.volume)}
            </span>
            {event.volume24hr > 0 && (
              <span className="text-[10px] text-emerald-400 shrink-0">
                24h {formatVolume(event.volume24hr)}
              </span>
            )}
            {timeLeft && (
              <span className={`text-[10px] font-medium shrink-0 ${
                isClosed || isEnded
                  ? "text-[#848e9c]"
                  : isUrgent
                    ? "text-amber-400"
                    : "text-[#848e9c]"
              }`}>
                {isClosed ? "Resolved" : isUrgent ? `⏱ ${timeLeft}` : timeLeft}
              </span>
            )}
            {event.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#7C3AED]/10 text-[#7C3AED] uppercase tracking-wide shrink-0"
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {isMultiMarket ? (
        <div className="space-y-1.5">
          {event.markets.slice(0, 4).map((m) => {
            const p = getOutcomePrice(m);
            const pct = Math.round(p.yes * 100);
            return (
              <div
                key={m.id}
                className="flex items-center justify-between bg-[#0b0e17] rounded-lg px-3 py-1.5"
              >
                <span className="text-xs text-[#c8ccd8] truncate mr-2 flex-1">
                  {m.question.length > 50
                    ? m.question.slice(0, 50) + "…"
                    : m.question}
                </span>
                <span className="text-xs font-bold text-emerald-400 shrink-0">
                  {pct}¢
                </span>
              </div>
            );
          })}
          {event.markets.length > 4 && (
            <p className="text-[10px] text-[#848e9c] text-center pt-1">
              +{event.markets.length - 4} more outcomes
            </p>
          )}
        </div>
      ) : (
        <PriceBar yes={prices.yes} />
      )}
    </Link>
  );
}
