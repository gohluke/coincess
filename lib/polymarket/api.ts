import type { PolymarketEvent, PolymarketTag, PolymarketBook } from "./types";

const CLOB_API = "https://clob.polymarket.com";

function proxyUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`/api/polymarket${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function gammaGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await fetch(proxyUrl(path, params));
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function clobGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${CLOB_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CLOB API error: ${res.status}`);
  return res.json();
}

export async function fetchTrendingEvents(
  limit = 20,
  offset = 0,
): Promise<PolymarketEvent[]> {
  return gammaGet<PolymarketEvent[]>("/events", {
    active: "true",
    closed: "false",
    order: "volume24hr",
    ascending: "false",
    limit: String(limit),
    offset: String(offset),
  });
}

export async function fetchEventsByTag(
  tagSlug: string,
  limit = 20,
  offset = 0,
): Promise<PolymarketEvent[]> {
  return gammaGet<PolymarketEvent[]>("/events", {
    active: "true",
    closed: "false",
    tag_slug: tagSlug,
    order: "volume24hr",
    ascending: "false",
    limit: String(limit),
    offset: String(offset),
  });
}

export async function fetchNewEvents(limit = 20): Promise<PolymarketEvent[]> {
  return gammaGet<PolymarketEvent[]>("/events", {
    active: "true",
    closed: "false",
    order: "startDate",
    ascending: "false",
    limit: String(limit),
  });
}

export async function fetchEndingSoonEvents(
  limit = 20,
  offset = 0,
): Promise<PolymarketEvent[]> {
  return gammaGet<PolymarketEvent[]>("/events", {
    active: "true",
    closed: "false",
    order: "endDate",
    ascending: "true",
    limit: String(limit),
    offset: String(offset),
    end_date_min: new Date().toISOString(),
  });
}

export async function fetchEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  const events = await gammaGet<PolymarketEvent[]>("/events", {
    slug,
    limit: "1",
  });
  return events[0] ?? null;
}

export async function fetchEventById(id: string): Promise<PolymarketEvent | null> {
  try {
    return await gammaGet<PolymarketEvent>(`/events/${id}`);
  } catch {
    return null;
  }
}

export async function fetchTags(): Promise<PolymarketTag[]> {
  return gammaGet<PolymarketTag[]>("/tags");
}

export async function searchEvents(query: string): Promise<PolymarketEvent[]> {
  const url = new URL("/api/polymarket/search", window.location.origin);
  url.searchParams.set("q", query);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return res.json();
}

export async function fetchOrderBook(tokenId: string): Promise<PolymarketBook> {
  return clobGet<PolymarketBook>("/book", { token_id: tokenId });
}

export async function fetchPrice(
  tokenId: string,
  side: "BUY" | "SELL" = "BUY",
): Promise<number> {
  const data = await clobGet<{ price: string }>("/price", {
    token_id: tokenId,
    side,
  });
  return parseFloat(data.price);
}

export function formatVolume(vol: number | string | undefined | null): string {
  const n = typeof vol === "string" ? parseFloat(vol) : (vol ?? 0);
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatLiquidity(liq: number | string | undefined | null): string {
  return formatVolume(liq);
}

export function getOutcomePrice(market: PolymarketMarket): { yes: number; no: number } {
  // API returns outcomePrices (camelCase) as string[] e.g. ["0.65","0.35"]
  const raw = market.outcomePrices ?? market.outcome_prices;
  if (raw) {
    try {
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(arr) && arr.length >= 2) {
        return { yes: parseFloat(arr[0]) || 0, no: parseFloat(arr[1]) || 0 };
      }
    } catch {
      // fallback below
    }
  }
  if (market.lastTradePrice != null) {
    const p = Number(market.lastTradePrice);
    if (p > 0 && p < 1) return { yes: p, no: 1 - p };
  }
  const yesToken = market.tokens?.find((t) => t.outcome === "Yes");
  const noToken = market.tokens?.find((t) => t.outcome === "No");
  return { yes: yesToken?.price ?? 0.5, no: noToken?.price ?? 0.5 };
}

import type { PolymarketMarket } from "./types";

export function getEventEndDate(event: PolymarketEvent): Date | null {
  const raw = event.endDate || event.end_date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTimeRemaining(endDate: Date | null): string | null {
  if (!endDate) return null;
  const now = Date.now();
  const diff = endDate.getTime() - now;
  if (diff <= 0) return "Ended";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d left`;
  const months = Math.floor(days / 30);
  return `${months}mo left`;
}

// ── Polymarket Data API (user positions & trades) ──────────

import type { PolymarketPosition, PolymarketTrade } from "./types";

export async function fetchPolymarketPositions(
  address: string,
): Promise<{ positions: PolymarketPosition[]; proxyWallet: string | null }> {
  const url = new URL("/api/polymarket/positions", window.location.origin);
  url.searchParams.set("address", address);
  url.searchParams.set("sizeThreshold", "0");
  url.searchParams.set("limit", "100");
  const res = await fetch(url.toString());
  if (!res.ok) return { positions: [], proxyWallet: null };
  return res.json();
}

export async function fetchPolymarketTrades(
  address: string,
  limit = 100,
): Promise<{ trades: PolymarketTrade[]; proxyWallet: string | null }> {
  const url = new URL("/api/polymarket/user-trades", window.location.origin);
  url.searchParams.set("address", address);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) return { trades: [], proxyWallet: null };
  return res.json();
}
