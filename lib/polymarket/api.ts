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
  try {
    if (market.outcome_prices) {
      const prices = JSON.parse(market.outcome_prices);
      return { yes: parseFloat(prices[0]) || 0, no: parseFloat(prices[1]) || 0 };
    }
  } catch {
    // fallback
  }
  const yesToken = market.tokens?.find((t) => t.outcome === "Yes");
  const noToken = market.tokens?.find((t) => t.outcome === "No");
  return { yes: yesToken?.price ?? 0.5, no: noToken?.price ?? 0.5 };
}

import type { PolymarketMarket } from "./types";
