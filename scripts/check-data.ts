#!/usr/bin/env npx tsx
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // Check what coins have candle data
  const { data: coins } = await sb
    .from("data_collection_state")
    .select("coin, total_candles")
    .order("coin");

  console.log(`\n=== CANDLE DATA (${coins?.length ?? 0} coins) ===`);
  const hip3 = ["TSLA", "NVDA", "GOOGL", "AAPL", "HOOD", "MSTR", "SPY", "AMZN",
    "META", "QQQ", "MSFT", "ORCL", "AVGO", "GLD", "MU", "SLV"];

  let totalCandles = 0;
  const rwaCoins: string[] = [];
  for (const r of coins ?? []) {
    const isRwa = hip3.includes(r.coin);
    if (isRwa) rwaCoins.push(r.coin);
    totalCandles += r.total_candles;
    console.log(
      `  ${r.coin.padEnd(10)} ${String(r.total_candles).padStart(6)} candles ${isRwa ? "  [RWA/HIP-3]" : ""}`,
    );
  }
  console.log(`\nTotal: ${totalCandles} candles across ${coins?.length} coins`);
  console.log(`RWA coins with data: ${rwaCoins.join(", ") || "none yet"}`);

  // Check backtest results
  const { data: backtests } = await sb
    .from("backtest_runs")
    .select("strategy_type, total_pnl, sharpe_ratio, win_rate, max_drawdown, total_trades, coins, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log(`\n=== BACKTEST RESULTS (${backtests?.length ?? 0}) ===`);
  for (const bt of backtests ?? []) {
    const coins = (bt.coins as string[]).join(",");
    console.log(
      `  ${bt.strategy_type.padEnd(16)} P&L: $${Number(bt.total_pnl).toFixed(2).padStart(8)} | ` +
      `Sharpe: ${Number(bt.sharpe_ratio ?? 0).toFixed(2).padStart(6)} | ` +
      `WR: ${((Number(bt.win_rate ?? 0)) * 100).toFixed(0).padStart(3)}% | ` +
      `DD: ${((Number(bt.max_drawdown ?? 0)) * 100).toFixed(1).padStart(5)}% | ` +
      `${bt.total_trades} trades | ${coins}`,
    );
  }

  // Probe Hyperliquid for all HIP-3 assets
  console.log("\n=== LIVE HIP-3 SPOT MARKETS ===");
  const [spotMetaRes, allMidsRes] = await Promise.all([
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotMetaAndAssetCtxs" }),
    }),
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    }),
  ]);
  const [spotMeta, spotCtxs] = (await spotMetaRes.json()) as [
    { tokens: Array<{ index: number; name: string }>; universe: Array<{ name: string; tokens: number[] }> },
    Array<{ dayNtlVlm: string; markPx: string }>,
  ];
  const allMids = (await allMidsRes.json()) as Record<string, string>;

  const idxToName: Record<number, string> = {};
  for (const t of spotMeta.tokens) idxToName[t.index] = t.name;

  // Known RWA/HIP-3 categories
  const RWA_KEYWORDS = new Set([
    "TSLA", "NVDA", "GOOGL", "AAPL", "HOOD", "MSTR", "SPY", "AMZN",
    "META", "QQQ", "MSFT", "ORCL", "AVGO", "MU", "NFLX", "INTC",
    "GLD", "SLV", "USO", "SPACEX", "OPENAI",
    "XAU", "XAG", "BRENT", "WTI",
  ]);

  const rwaPairs: Array<{ name: string; pair: string; price: string; volume: string }> = [];
  for (let i = 0; i < spotMeta.universe.length; i++) {
    const pair = spotMeta.universe[i];
    if (!pair.tokens?.length) continue;
    const name = idxToName[pair.tokens[0]];
    if (!name) continue;
    const isRwa = RWA_KEYWORDS.has(name) ||
      name.length <= 5 && !name.match(/^(PURR|HYPE|JEFF|GMEOW|CATBAL)/);
    const midPrice = allMids[pair.name] ?? "0";
    const ctx = spotCtxs[i];
    const volume = ctx?.dayNtlVlm ?? "0";

    if (isRwa || parseFloat(midPrice) > 1) {
      rwaPairs.push({
        name,
        pair: pair.name,
        price: midPrice,
        volume: parseFloat(volume).toFixed(0),
      });
    }
  }

  // Sort by volume descending
  rwaPairs.sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));

  for (const p of rwaPairs.slice(0, 40)) {
    const hasData = rwaCoins.includes(p.name);
    console.log(
      `  ${p.name.padEnd(10)} ${p.pair.padEnd(8)} $${parseFloat(p.price).toFixed(2).padStart(12)} ` +
      `vol: $${p.volume.padStart(10)} ${hasData ? "  [DATA]" : ""}`,
    );
  }
}

main().catch(console.error);
