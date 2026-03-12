import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

const HL_API = "https://api.hyperliquid.xyz";

export async function POST() {
  try {
    const supabase = getServiceClient();
    const accountAddress = process.env.HL_ACCOUNT_ADDRESS;
    if (!accountAddress) {
      return NextResponse.json({ error: "HL_ACCOUNT_ADDRESS not set" }, { status: 500 });
    }

    const [posRes, midsRes, tradesRes] = await Promise.all([
      fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: accountAddress }),
      }),
      fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "allMids" }),
      }),
      supabase
        .from("quant_trades")
        .select("id, coin, side, size, entry_px, strategy_id, strategy_type")
        .eq("status", "open"),
    ]);

    const posData = (await posRes.json()) as {
      assetPositions: Array<{ position: { coin: string; szi: string } }>;
    };
    const allMids = (await midsRes.json()) as Record<string, string>;
    const openTrades = tradesRes.data ?? [];

    const hlCoins = new Set(
      posData.assetPositions
        .filter((p) => parseFloat(p.position.szi) !== 0)
        .map((p) => p.position.coin),
    );

    let closed = 0;
    const reconciled: Array<{ id: string; coin: string; pnl: number }> = [];

    for (const trade of openTrades) {
      if (hlCoins.has(trade.coin)) continue;

      const markPx = parseFloat(allMids[trade.coin] ?? "0");
      const entryPx = Number(trade.entry_px);
      const size = Number(trade.size);
      const pnl = trade.side === "long"
        ? (markPx - entryPx) * size
        : (entryPx - markPx) * size;

      await supabase.from("quant_trades").update({
        status: "closed",
        exit_px: markPx || null,
        pnl: markPx > 0 ? pnl : 0,
        closed_at: new Date().toISOString(),
        meta: { close_reason: "Manual sync: no matching HL position" },
      }).eq("id", trade.id);

      if (trade.strategy_id) {
        const { data: strat } = await supabase
          .from("quant_strategies")
          .select("total_pnl")
          .eq("id", trade.strategy_id)
          .single();
        if (strat) {
          await supabase.from("quant_strategies").update({
            total_pnl: (strat.total_pnl ?? 0) + (markPx > 0 ? pnl : 0),
          }).eq("id", trade.strategy_id);
        }
      }

      reconciled.push({ id: trade.id, coin: trade.coin, pnl: markPx > 0 ? pnl : 0 });
      closed++;
    }

    return NextResponse.json({
      synced: true,
      hlPositions: [...hlCoins],
      openTradesChecked: openTrades.length,
      staleTradesClosed: closed,
      reconciled,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
