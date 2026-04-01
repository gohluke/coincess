import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { fetchUserFills } from "@/lib/hyperliquid/api";

export const maxDuration = 60;

const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

async function resolveProxyWallet(address: string): Promise<string | null> {
  try {
    const res = await fetch(`${GAMMA_API}/public-profile?address=${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.proxyWallet ?? null;
  } catch {
    return null;
  }
}

interface SimplifiedFill {
  coin: string;
  side: string;
  size: string;
  price: string;
  pnl: string;
  fee: string;
  time: string;
}

interface LinkedTrade {
  platform: string;
  fills: SimplifiedFill[];
  summary: { totalPnl: number; tradeCount: number; coins: string[] };
}

export async function POST(req: NextRequest) {
  try {
    const { wallet_address, date } = await req.json();
    if (!wallet_address) {
      return NextResponse.json({ error: "wallet_address required" }, { status: 400 });
    }

    const targetDate = date ? new Date(date) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);
    const startMs = dayStart.getTime();
    const endMs = dayEnd.getTime();

    // Fetch Hyperliquid fills
    const allFills = await fetchUserFills(wallet_address).catch(() => []);
    const hlFills = allFills.filter((f) => f.time >= startMs && f.time <= endMs);

    const hlSimplified: SimplifiedFill[] = hlFills.map((f) => ({
      coin: f.coin,
      side: f.side === "B" ? "BUY" : "SELL",
      size: f.sz,
      price: f.px,
      pnl: f.closedPnl,
      fee: f.fee,
      time: new Date(f.time).toISOString(),
    }));

    // Fetch Polymarket trades
    let polyTrades: SimplifiedFill[] = [];
    const proxyWallet = await resolveProxyWallet(wallet_address);
    if (proxyWallet) {
      try {
        const url = new URL(`${DATA_API}/trades`);
        url.searchParams.set("user", proxyWallet);
        url.searchParams.set("limit", "200");
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const trades = (await res.json()) as Array<{
            side: string;
            size: string;
            price: string;
            timestamp: number;
            asset: string;
            outcome: string;
          }>;
          polyTrades = trades
            .filter((t) => {
              const ts = t.timestamp * 1000;
              return ts >= startMs && ts <= endMs;
            })
            .map((t) => ({
              coin: `${t.asset}/${t.outcome}`,
              side: t.side,
              size: t.size,
              price: t.price,
              pnl: "0",
              fee: "0",
              time: new Date(t.timestamp * 1000).toISOString(),
            }));
        }
      } catch {
        // Polymarket fetch is best-effort
      }
    }

    const linkedTrades: LinkedTrade[] = [];

    if (hlSimplified.length > 0) {
      const hlPnl = hlSimplified.reduce((s, f) => s + parseFloat(f.pnl || "0"), 0);
      const hlCoins = [...new Set(hlSimplified.map((f) => f.coin))];
      linkedTrades.push({
        platform: "hyperliquid",
        fills: hlSimplified,
        summary: { totalPnl: hlPnl, tradeCount: hlSimplified.length, coins: hlCoins },
      });
    }

    if (polyTrades.length > 0) {
      const polyCoins = [...new Set(polyTrades.map((f) => f.coin))];
      linkedTrades.push({
        platform: "polymarket",
        fills: polyTrades,
        summary: { totalPnl: 0, tradeCount: polyTrades.length, coins: polyCoins },
      });
    }

    if (linkedTrades.length === 0) {
      return NextResponse.json({
        draft: "",
        linked_trades: [],
        message: "No trades found for this date.",
      });
    }

    const dateStr = targetDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const tradeContext = linkedTrades
      .map((lt) => {
        const header = `## ${lt.platform.charAt(0).toUpperCase() + lt.platform.slice(1)} Trades`;
        const table = lt.fills
          .map(
            (f) =>
              `- ${f.time}: ${f.side} ${f.size} ${f.coin} @ $${f.price}` +
              (parseFloat(f.pnl) !== 0 ? ` (PnL: $${f.pnl})` : ""),
          )
          .join("\n");
        return `${header}\n${table}\nSummary: ${lt.summary.tradeCount} trades, Net PnL: $${lt.summary.totalPnl.toFixed(2)}, Coins: ${lt.summary.coins.join(", ")}`;
      })
      .join("\n\n");

    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      system: `You are a trading journal assistant for a crypto/derivatives trader. Write reflective, honest journal entries in first person. Include:
- A summary with net P&L at the top
- What happened chronologically
- What went right and what went wrong
- Emotional state and decision-making analysis
- Concrete lessons and action items
Use markdown formatting with headers, tables where appropriate, and bullet points. Be direct and analytical, not sugar-coated.`,
      prompt: `Write a trading journal entry for ${dateStr} based on these trades:\n\n${tradeContext}\n\nAnalyze the trading decisions, identify patterns, and extract lessons. If there were losses, be honest about what went wrong. If there were wins, analyze whether the process was sound or if it was luck.`,
    });

    return NextResponse.json({
      draft: text,
      linked_trades: linkedTrades,
      date: dateStr,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[journal/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
