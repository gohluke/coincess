"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePredictionsStore } from "@/lib/polymarket/store";
import { EventCard } from "./EventCard";
import { Loader2 } from "lucide-react";

export function EventGrid() {
  const events = usePredictionsStore((s) => s.events);
  const loading = usePredictionsStore((s) => s.loading);
  const hasMore = usePredictionsStore((s) => s.hasMore);
  const loadMore = usePredictionsStore((s) => s.loadMore);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !loading) {
        loadMore();
      }
    },
    [hasMore, loading, loadMore],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "200px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF455B]" />
      </div>
    );
  }

  if (!loading && events.length === 0) {
    return (
      <div className="text-center py-20 text-[#848e9c]">
        <p className="text-sm">No prediction markets found</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-4" />
      {loading && events.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#FF455B]" />
        </div>
      )}
    </>
  );
}
