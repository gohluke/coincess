import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const content = readFileSync("journal/2026-03-31.md", "utf-8");

  const tradeData = {
    polymarket: {
      net_pnl: -1010.73,
      total_spent: 1910.36,
      total_received: 899.63,
      trades: [
        { time: "2026-03-30T05:06:00Z", side: "BUY", shares: 552.16, price: 0.688, cost: 379.86, market: "CL $105", outcome: "No" },
        { time: "2026-03-30T13:59:00Z", side: "BUY", shares: 883.37, price: 0.679, cost: 600.0, market: "CL $105", outcome: "No" },
        { time: "2026-03-30T23:15:00Z", side: "SELL", shares: 1435.52, price: 0.325, cost: 466.76, market: "CL $105", outcome: "No" },
        { time: "2026-03-30T23:15:00Z", side: "BUY", shares: 2721.15, price: 0.172, cost: 466.76, market: "CL $110", outcome: "Yes" },
        { time: "2026-03-31T01:37:00Z", side: "BUY", shares: 1563.14, price: 0.297, cost: 463.74, market: "CL $105", outcome: "Yes" },
        { time: "2026-03-31T12:53:00Z", side: "SELL", shares: 2721.14, price: 0.023, cost: 61.45, market: "CL $110", outcome: "Yes" },
        { time: "2026-03-31T13:16:00Z", side: "SELL", shares: 1563.13, price: 0.238, cost: 371.43, market: "CL $105", outcome: "Yes" },
      ],
    },
    hyperliquid: {
      net_pnl: 45.4,
      closed_pnl: 46.25,
      fees: 0.85,
      fills: [
        { time: "2026-03-30T03:11:38Z", side: "BUY", size: 8.29, price: 100.67, coin: "BRENTOIL" },
        { time: "2026-03-30T03:20:47Z", side: "BUY", size: 11.45, price: 100.31, coin: "BRENTOIL" },
        { time: "2026-03-30T03:27:11Z", side: "SELL", size: 19.74, price: 100.51, coin: "BRENTOIL", closedPnl: 0.97 },
        { time: "2026-03-30T09:37:02Z", side: "BUY", size: 9.57, price: 101.19, coin: "BRENTOIL" },
        { time: "2026-03-30T10:09:22Z", side: "SELL", size: 9.57, price: 101.32, coin: "BRENTOIL", closedPnl: 1.24 },
        { time: "2026-03-30T11:02:38Z", side: "BUY", size: 22.05, price: 101.21, coin: "BRENTOIL" },
        { time: "2026-03-30T11:13:59Z", side: "BUY", size: 79.66, price: 100.9, coin: "BRENTOIL" },
        { time: "2026-03-30T13:16:02Z", side: "SELL", size: 92.56, price: 101.4, coin: "BRENTOIL", closedPnl: 40.08 },
        { time: "2026-03-30T13:16:02Z", side: "SELL", size: 9.15, price: 101.4, coin: "BRENTOIL", closedPnl: 3.96 },
      ],
    },
  };

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      wallet_address: "0x635b3b453de75e873a02b4898f615c5e8909070a",
      title: "How I Lost $1K Panicking on Polymarket Oil Bets",
      content,
      tags: ["polymarket", "brentoil", "loss", "lesson", "panic-sell", "oil"],
      trade_data: tradeData,
      pnl_amount: -965.33,
      coin: "BRENTOIL",
      mood: "tilted",
      created_at: "2026-03-31T21:30:00Z",
    })
    .select("id, title, created_at")
    .single();

  if (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
  console.log("Inserted:", JSON.stringify(data, null, 2));
}

main();
