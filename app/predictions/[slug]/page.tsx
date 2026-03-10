"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Clock, BarChart3, Droplets, Loader2, ExternalLink } from "lucide-react";
import type { PolymarketEvent } from "@/lib/polymarket/types";
import { fetchEventBySlug, fetchEventById, formatVolume, getEventEndDate, formatTimeRemaining } from "@/lib/polymarket/api";
import { MarketRow } from "@/components/predictions/MarketRow";

export default function EventDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [event, setEvent] = useState<PolymarketEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      let ev = await fetchEventBySlug(slug);
      if (!ev) ev = await fetchEventById(slug);
      setEvent(ev);
      setLoading(false);
    })();
  }, [slug]);

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
        <Link href="/predictions" className="text-sm text-brand hover:underline">
          ← Back to predictions
        </Link>
      </div>
    );
  }

  const endDate = getEventEndDate(event);
  const timeLeft = formatTimeRemaining(endDate);
  const isClosed = event.closed;
  const isEnded = timeLeft === "Ended";
  const isUrgent = endDate && !isClosed && !isEnded && endDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Closed/Resolved banner */}
        {(isClosed || isEnded) && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-[#1a1d2e] border border-[#2a2e3e] flex items-center gap-2">
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

        {/* Event header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          {event.image && (
            <img
              src={event.image}
              alt=""
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 ${isClosed || isEnded ? "grayscale" : ""}`}
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight mb-2">
              {event.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-[#848e9c]">
                <BarChart3 className="h-3 w-3" />
                {formatVolume(event.volume_num ?? event.volume ?? 0)} volume
              </span>
              <span className="flex items-center gap-1 text-xs text-[#848e9c]">
                <Droplets className="h-3 w-3" />
                {formatVolume(event.liquidity ?? 0)} liquidity
              </span>
              {endDate && !isClosed && !isEnded && (
                <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? "text-amber-400" : "text-[#848e9c]"}`}>
                  <Clock className="h-3 w-3" />
                  {isUrgent ? `⏱ ${timeLeft}` : `Ends ${endDate.toLocaleDateString()}`}
                  {timeLeft && !isUrgent && ` (${timeLeft})`}
                </span>
              )}
              {event.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
          <a
            href={`https://polymarket.com/event/${event.slug || event.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#848e9c] hover:text-white transition-colors shrink-0"
          >
            View on Polymarket
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-sm text-[#848e9c] leading-relaxed mb-8 max-w-3xl">
            {event.description}
          </p>
        )}

        {/* Markets */}
        <h2 className="text-lg font-semibold mb-4">
          Markets ({event.markets?.length ?? 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {event.markets?.map((m) => (
            <MarketRow key={m.id} market={m} />
          ))}
        </div>

        {(!event.markets || event.markets.length === 0) && (
          <p className="text-sm text-[#848e9c]">No markets available for this event.</p>
        )}
      </div>
    </div>
  );
}
