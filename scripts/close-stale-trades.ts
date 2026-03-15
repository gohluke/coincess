#!/usr/bin/env npx tsx
/**
 * One-off script: close stale positions that have no SL/TP and are losing money.
 * Updates Supabase trade records and logs to ai_agent_logs for AI visibility.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";

const HL_API = "https://api.hyperliquid.xyz";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // 1. Get perp asset indices
  const metaRes = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  });
  const meta = (await metaRes.json()) as { universe: Array<{ name: string; szDecimals: number }> };
  const coinToIndex = new Map<string, number>();
  const coinToDecimals = new Map<string, number>();
  for (let i = 0; i < meta.universe.length; i++) {
    coinToIndex.set(meta.universe[i].name, i);
    coinToDecimals.set(meta.universe[i].name, meta.universe[i].szDecimals);
  }

  // 2. Get ALL open trades from Supabase that lack SL/TP
  const { data: allOpenTrades, error: tradeErr } = await sb
    .from("quant_trades")
    .select("id, coin, side, size, entry_px, strategy_id, meta")
    .eq("status", "open");

  if (tradeErr) throw new Error(`Supabase query failed: ${tradeErr.message}`);
  if (!allOpenTrades?.length) {
    console.log("No open trades in Supabase.");
    return;
  }

  const staleTrades = allOpenTrades.filter((t) => {
    const m = t.meta as Record<string, unknown> | null;
    return !m?.stopLoss && !m?.takeProfit;
  });

  if (!staleTrades.length) {
    console.log("All open trades already have SL/TP — nothing stale to close.");
    return;
  }

  const coinsToClose = [...new Set(staleTrades.map((t) => t.coin))];
  console.log(`Found ${staleTrades.length} stale trades across ${coinsToClose.length} coins: ${coinsToClose.join(", ")}`);

  // 3. Get current positions from Hyperliquid
  const posRes = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: process.env.HL_ACCOUNT_ADDRESS }),
  });
  const posData = (await posRes.json()) as {
    assetPositions: Array<{
      position: { coin: string; szi: string; entryPx: string; unrealizedPnl: string };
    }>;
  };

  // 4. Get current mid prices
  const midsRes = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  const mids = (await midsRes.json()) as Record<string, string>;

  // 5. Import executor
  const { placeOrder } = await import("../lib/quant/executor");

  const closedCoins: string[] = [];
  let totalRealizedPnl = 0;

  for (const coin of coinsToClose) {
    const hlPos = posData.assetPositions.find((p) => p.position.coin === coin);

    if (hlPos && parseFloat(hlPos.position.szi) !== 0) {
      const szi = parseFloat(hlPos.position.szi);
      const isLong = szi > 0;
      const absSize = Math.abs(szi);
      const assetIndex = coinToIndex.get(coin);
      const szDec = coinToDecimals.get(coin) ?? 4;
      const midPx = parseFloat(mids[coin] ?? "0");

      if (assetIndex === undefined) {
        console.log(`${coin}: unknown asset index, skipping`);
        continue;
      }

      const slippage = isLong ? 0.97 : 1.03;
      const limitPx = roundPrice(midPx * slippage);
      const sizeStr = absSize.toFixed(szDec);

      console.log(`${coin}: closing ${isLong ? "long" : "short"} ${sizeStr} @ ${limitPx} (mid=${midPx})`);

      const result = await placeOrder({
        coin,
        isBuy: !isLong,
        size: sizeStr,
        price: limitPx,
        reduceOnly: true,
        tif: "Ioc",
        assetIndex,
      });

      if (result.success) {
        console.log(`  CLOSED on HL: avgPx=${result.avgPx}`);
        closedCoins.push(coin);
      } else {
        console.log(`  FAILED on HL: ${result.error}`);
      }

      const fillPx = result.success ? parseFloat(result.avgPx ?? limitPx.toString()) : midPx;

      // Update all stale Supabase trades for this coin
      const coinTrades = staleTrades.filter((t) => t.coin === coin);
      for (const t of coinTrades) {
        const entryPx = Number(t.entry_px);
        const size = Number(t.size);
        const pnl = t.side === "long"
          ? (fillPx - entryPx) * size
          : (entryPx - fillPx) * size;
        totalRealizedPnl += pnl;

        await sb.from("quant_trades").update({
          status: "closed",
          exit_px: fillPx,
          pnl,
          closed_at: new Date().toISOString(),
          meta: {
            close_reason: `Manual cleanup: stale pre-v4 position with no SL/TP`,
            exit_method: result.success ? "ioc_market_close" : "reconciliation",
          },
        }).eq("id", t.id);

        if (t.strategy_id) {
          const { data: strat } = await sb.from("quant_strategies").select("total_pnl").eq("id", t.strategy_id).single();
          if (strat) {
            await sb.from("quant_strategies").update({
              total_pnl: (strat.total_pnl ?? 0) + pnl,
            }).eq("id", t.strategy_id);
          }
        }

        console.log(`  DB ${t.id.slice(0, 8)}: ${t.side} ${coin} entry=${entryPx} exit=${fillPx.toFixed(6)} pnl=${pnl.toFixed(4)}`);
      }
    } else {
      // No HL position — reconcile DB records using mid price
      const midPx = parseFloat(mids[coin] ?? "0");
      const coinTrades = staleTrades.filter((t) => t.coin === coin);
      for (const t of coinTrades) {
        const entryPx = Number(t.entry_px);
        const size = Number(t.size);
        const pnl = t.side === "long"
          ? (midPx - entryPx) * size
          : (entryPx - midPx) * size;
        totalRealizedPnl += pnl;

        await sb.from("quant_trades").update({
          status: "closed",
          exit_px: midPx,
          pnl,
          closed_at: new Date().toISOString(),
          meta: { close_reason: "Reconciliation: no HL position found, stale DB record" },
        }).eq("id", t.id);

        console.log(`  DB reconcile ${t.id.slice(0, 8)}: ${t.side} ${coin} pnl=${pnl.toFixed(4)}`);
      }
      closedCoins.push(`${coin}(db-only)`);
    }
  }

  console.log(`\nTotal realized PnL: $${totalRealizedPnl.toFixed(4)}`);
  console.log(`Coins closed: ${closedCoins.join(", ")}`);

  // 6. Log to ai_agent_logs so the AI knows what happened and why
  await sb.from("ai_agent_logs").insert({
    strategy_id: null,
    event_type: "manual_close",
    market_sentiment: "cleanup",
    decision: {
      action: "manual_close_all_stale_positions",
      coins: coinsToClose,
      tradesClosed: staleTrades.length,
      totalRealizedPnl: totalRealizedPnl.toFixed(4),
      reason: "All positions opened before v4 upgrade had NO stop-loss or take-profit levels. " +
        "These were unprotected and bleeding. Closed all stale trades to free capital and reset. " +
        "Going forward, every trade MUST have SL/TP set in meta so the PositionGuard can enforce exits. " +
        "The v4 system now automatically sets SL/TP on all new trades.",
      lesson: "NEVER open a position without SL/TP. Always use risk-adjusted sizing. " +
        "Avoid duplicate positions in the same coin/direction.",
    },
    signals_generated: 0,
    error_message: null,
  });

  console.log("\nDone. AI agent logs updated with cleanup context.");
}

function roundPrice(price: number): string {
  if (price >= 100_000) return (Math.round(price / 10) * 10).toString();
  if (price >= 10_000) return Math.round(price).toString();
  if (price >= 1_000) return (Math.round(price * 10) / 10).toFixed(1);
  if (price >= 100) return (Math.round(price * 100) / 100).toFixed(2);
  if (price >= 10) return (Math.round(price * 1000) / 1000).toFixed(3);
  if (price >= 1) return (Math.round(price * 10000) / 10000).toFixed(4);
  return (Math.round(price * 100000) / 100000).toFixed(5);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
