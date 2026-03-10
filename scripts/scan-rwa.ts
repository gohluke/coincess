#!/usr/bin/env npx tsx
/**
 * Scan all HIP-3 spot markets on Hyperliquid and identify RWA (stocks, commodities, indices)
 */

async function main() {
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
    {
      tokens: Array<{ index: number; name: string; szDecimals: number }>;
      universe: Array<{ name: string; tokens: number[]; index: number }>;
    },
    Array<{ dayNtlVlm: string; markPx: string; prevDayPx: string }>,
  ];
  const allMids = (await allMidsRes.json()) as Record<string, string>;

  const idxToName: Record<number, string> = {};
  const idxToDecimals: Record<number, number> = {};
  for (const t of spotMeta.tokens) {
    idxToName[t.index] = t.name;
    idxToDecimals[t.index] = t.szDecimals;
  }

  // Known RWA tickers to search for
  const STOCKS = new Set([
    "TSLA", "NVDA", "GOOGL", "AAPL", "HOOD", "MSTR", "AMZN",
    "META", "MSFT", "ORCL", "AVGO", "MU", "NFLX", "INTC",
    "AMD", "COIN", "PLTR", "SNOW", "BABA", "CRM", "UBER",
  ]);
  const INDICES = new Set(["SPY", "QQQ", "IWM", "DIA"]);
  const COMMODITIES = new Set(["GLD", "SLV", "USO", "GDX", "XAU", "XAG", "BRENT", "WTI", "OIL"]);
  const SPECIAL = new Set(["SPACEX", "OPENAI"]);

  console.log("=== ALL HIP-3 SPOT PAIRS ===\n");
  console.log("Token".padEnd(10), "Pair".padEnd(8), "Price".padStart(14), "24h Vol".padStart(14), "Type".padEnd(12));
  console.log("-".repeat(70));

  const results: Array<{
    name: string;
    pair: string;
    price: number;
    volume: number;
    type: string;
    spotIndex: number;
  }> = [];

  for (let i = 0; i < spotMeta.universe.length; i++) {
    const pair = spotMeta.universe[i];
    if (!pair.tokens?.length) continue;
    const name = idxToName[pair.tokens[0]];
    if (!name) continue;

    const midPrice = parseFloat(allMids[pair.name] ?? "0");
    const ctx = spotCtxs[i];
    const volume = parseFloat(ctx?.dayNtlVlm ?? "0");

    let type = "crypto";
    if (STOCKS.has(name)) type = "STOCK";
    else if (INDICES.has(name)) type = "INDEX";
    else if (COMMODITIES.has(name)) type = "COMMODITY";
    else if (SPECIAL.has(name)) type = "PRIVATE";
    else if (name === "XAUT0" || name.includes("XAU")) type = "GOLD";
    else if (name === "THBILL") type = "TBILL";

    if (type !== "crypto" || midPrice > 10) {
      results.push({ name, pair: pair.name, price: midPrice, volume, type, spotIndex: i });
    }
  }

  results.sort((a, b) => b.volume - a.volume);

  const rwaResults = results.filter((r) => r.type !== "crypto");
  const cryptoResults = results.filter((r) => r.type === "crypto");

  console.log("\n--- RWA / TRADITIONAL ASSETS ---");
  for (const r of rwaResults) {
    console.log(
      r.name.padEnd(10),
      r.pair.padEnd(8),
      `$${r.price.toFixed(2)}`.padStart(14),
      `$${r.volume.toFixed(0)}`.padStart(14),
      r.type.padEnd(12),
      `assetIdx: ${10000 + r.spotIndex}`,
    );
  }

  console.log(`\n--- HIGH-VALUE CRYPTO SPOTS (price > $10) ---`);
  for (const r of cryptoResults.slice(0, 15)) {
    console.log(
      r.name.padEnd(10),
      r.pair.padEnd(8),
      `$${r.price.toFixed(2)}`.padStart(14),
      `$${r.volume.toFixed(0)}`.padStart(14),
    );
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total spot pairs: ${spotMeta.universe.length}`);
  console.log(`RWA assets found: ${rwaResults.length}`);
  console.log(`  Stocks:      ${rwaResults.filter((r) => r.type === "STOCK").map((r) => r.name).join(", ")}`);
  console.log(`  Indices:     ${rwaResults.filter((r) => r.type === "INDEX").map((r) => r.name).join(", ")}`);
  console.log(`  Commodities: ${rwaResults.filter((r) => r.type === "COMMODITY" || r.type === "GOLD").map((r) => r.name).join(", ")}`);
  console.log(`  Private:     ${rwaResults.filter((r) => r.type === "PRIVATE").map((r) => r.name).join(", ")}`);
  console.log(`  Other:       ${rwaResults.filter((r) => r.type === "TBILL").map((r) => r.name).join(", ")}`);
}

main().catch(console.error);
