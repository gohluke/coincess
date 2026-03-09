import { z } from "zod";
import type { Tool } from "ai";

const API_URL = "https://api.hyperliquid.xyz";

async function hlPost(body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function createTools(walletAddress: string | null, supabaseServiceKey: string | null): Record<string, Tool> {
  return {
    getPositions: {
      description: "Fetch the user's current open positions and account state from Hyperliquid.",
      inputSchema: z.object({
        address: z.string().optional().describe("Wallet address to check. Defaults to the connected user's address."),
      }),
      execute: async ({ address }: { address?: string }) => {
        const addr = address || walletAddress;
        if (!addr) return { error: "No wallet address available" };
        try {
          const [main, xyz, spot] = await Promise.all([
            hlPost({ type: "clearinghouseState", user: addr }).catch(() => null),
            hlPost({ type: "clearinghouseState", user: addr, dex: "xyz" }).catch(() => null),
            hlPost({ type: "spotClearinghouseState", user: addr }).catch(() => null),
          ]);

          const positions = [
            ...(main?.assetPositions ?? []),
            ...(xyz?.assetPositions ?? []),
          ].filter((ap: any) => Math.abs(parseFloat(ap.position.szi)) > 0);

          const accountValue = parseFloat(main?.marginSummary?.accountValue ?? "0") + parseFloat(xyz?.marginSummary?.accountValue ?? "0");
          const spotBalances = (spot?.balances ?? []).filter((b: any) => parseFloat(b.total) > 0);

          return {
            accountValue,
            withdrawable: parseFloat(main?.withdrawable ?? "0") + parseFloat(xyz?.withdrawable ?? "0"),
            totalMarginUsed: parseFloat(main?.marginSummary?.totalMarginUsed ?? "0") + parseFloat(xyz?.marginSummary?.totalMarginUsed ?? "0"),
            positionCount: positions.length,
            positions: positions.map((ap: any) => ({
              coin: ap.position.coin,
              size: ap.position.szi,
              entryPx: ap.position.entryPx,
              unrealizedPnl: ap.position.unrealizedPnl,
              leverage: ap.position.leverage,
              liquidationPx: ap.position.liquidationPx,
              marginUsed: ap.position.marginUsed,
              returnOnEquity: ap.position.returnOnEquity,
            })),
            spotBalances: spotBalances.map((b: any) => ({ coin: b.coin, total: b.total })),
          };
        } catch (err) {
          return { error: String(err) };
        }
      },
    },

    getRecentFills: {
      description: "Fetch the user's recent trade fills from Hyperliquid.",
      inputSchema: z.object({
        address: z.string().optional().describe("Wallet address. Defaults to connected user."),
        coin: z.string().optional().describe("Filter fills to a specific coin (e.g. BRENTOIL, BTC)"),
        limit: z.number().optional().describe("Max number of fills to return. Default 50."),
      }),
      execute: async ({ address, coin, limit }: { address?: string; coin?: string; limit?: number }) => {
        const addr = address || walletAddress;
        if (!addr) return { error: "No wallet address available" };
        try {
          const fills: any[] = await hlPost({ type: "userFills", user: addr });
          let filtered = fills;
          if (coin) {
            const target = coin.toUpperCase();
            filtered = fills.filter((f: any) => {
              const c = f.coin.includes(":") ? f.coin.split(":")[1] : f.coin;
              return c.toUpperCase() === target;
            });
          }
          const sorted = filtered.sort((a: any, b: any) => b.time - a.time).slice(0, limit ?? 50);
          const totalPnl = sorted.reduce((s: number, f: any) => s + parseFloat(f.closedPnl), 0);
          const totalFees = sorted.reduce((s: number, f: any) => s + parseFloat(f.fee), 0);

          return {
            fillCount: sorted.length,
            totalRealizedPnl: totalPnl.toFixed(2),
            totalFees: totalFees.toFixed(4),
            fills: sorted.map((f: any) => ({
              time: new Date(f.time).toISOString(),
              coin: f.coin,
              side: f.side === "B" ? "Buy" : "Sell",
              direction: f.dir,
              price: f.px,
              size: f.sz,
              closedPnl: f.closedPnl,
              fee: f.fee,
            })),
          };
        } catch (err) {
          return { error: String(err) };
        }
      },
    },

    getMarketData: {
      description: "Get current market data for a specific coin or all markets.",
      inputSchema: z.object({
        coin: z.string().optional().describe("Specific coin to look up (e.g. BTC, BRENTOIL). If omitted returns top markets by volume."),
      }),
      execute: async ({ coin }: { coin?: string }) => {
        try {
          const [mainData, xyzData]: [any, any] = await Promise.all([
            hlPost({ type: "metaAndAssetCtxs" }),
            hlPost({ type: "metaAndAssetCtxs", dex: "xyz" }).catch(() => null),
          ]);

          type MarketItem = { coin: string; markPx: string; funding: string; openInterest: string; dayVolume: string; prevDayPx: string; maxLeverage: number };
          const markets: MarketItem[] = [];

          const addMarkets = (data: any, prefix: string) => {
            const [meta, ctxs] = data;
            meta.universe.forEach((asset: any, i: number) => {
              const ctx = ctxs[i];
              if (!ctx?.markPx) return;
              markets.push({
                coin: prefix ? `${prefix}:${asset.name}` : asset.name,
                markPx: ctx.markPx,
                funding: ctx.funding ?? "0",
                openInterest: ctx.openInterest ?? "0",
                dayVolume: ctx.dayNtlVlm ?? "0",
                prevDayPx: ctx.prevDayPx ?? "0",
                maxLeverage: asset.maxLeverage,
              });
            });
          };

          addMarkets(mainData, "");
          if (xyzData) addMarkets(xyzData, "xyz");

          if (coin) {
            const target = coin.toUpperCase();
            const match = markets.find((m) => {
              const bare = m.coin.includes(":") ? m.coin.split(":")[1] : m.coin;
              return bare.toUpperCase() === target;
            });
            if (!match) return { error: `Market ${coin} not found` };
            const mark = parseFloat(match.markPx);
            const prev = parseFloat(match.prevDayPx);
            const change24h = prev > 0 ? ((mark - prev) / prev * 100) : 0;
            return {
              ...match,
              change24h: `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`,
              fundingRate: `${(parseFloat(match.funding) * 100).toFixed(4)}%/hr`,
            };
          }

          return {
            marketCount: markets.length,
            topByVolume: markets
              .sort((a, b) => parseFloat(b.dayVolume) - parseFloat(a.dayVolume))
              .slice(0, 15)
              .map((m) => ({ coin: m.coin, markPx: m.markPx, dayVolume: m.dayVolume, funding: m.funding })),
          };
        } catch (err) {
          return { error: String(err) };
        }
      },
    },

    readJournal: {
      description: "Read the user's trade journal entries.",
      inputSchema: z.object({
        searchQuery: z.string().optional().describe("Search term to filter entries by title or content"),
        limit: z.number().optional().describe("Max entries to return. Default 10."),
      }),
      execute: async ({ searchQuery, limit }: { searchQuery?: string; limit?: number }) => {
        if (!walletAddress || !supabaseServiceKey) {
          return { error: "Journal not available (no wallet or Supabase not configured)" };
        }
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const db = createClient(supabaseUrl, supabaseServiceKey);

          let query = db
            .from("journal_entries")
            .select("id, title, content, tags, pnl_amount, coin, mood, created_at")
            .eq("wallet_address", walletAddress.toLowerCase())
            .order("created_at", { ascending: false })
            .limit(limit ?? 10);

          if (searchQuery) {
            query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
          }

          const { data, error } = await query;
          if (error) return { error: error.message };
          return { entries: data, count: data?.length ?? 0 };
        } catch (err) {
          return { error: String(err) };
        }
      },
    },
  };
}
