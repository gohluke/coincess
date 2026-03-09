/**
 * Raw HIP-3 (xyz) trading script for Hyperliquid.
 * Bypasses SDK validation to include `dex: "xyz"` in the order action.
 *
 * Usage:
 *   npx tsx scripts/trade-xyz.ts buy BRENTOIL 0.1
 *   npx tsx scripts/trade-xyz.ts sell GOLD 0.01
 *   npx tsx scripts/trade-xyz.ts close BRENTOIL
 *   npx tsx scripts/trade-xyz.ts markets [filter]
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { privateKeyToAccount } from "viem/accounts";
import { ExchangeClient, InfoClient, HttpTransport, MAINNET_API_URL } from "@nktkas/hyperliquid";

const ACCOUNT = process.env.HL_ACCOUNT_ADDRESS! as `0x${string}`;
const API_KEY = process.env.HL_API_PRIVATE_KEY! as `0x${string}`;

const wallet = privateKeyToAccount(API_KEY);
const transport = new HttpTransport();
const exchange = new ExchangeClient({ wallet, transport });
const info = new InfoClient({ transport });

const HL_API = MAINNET_API_URL + "/info";

interface XyzMarket {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  index: number;
  markPx: number;
}

async function fetchXyzMarkets(): Promise<XyzMarket[]> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
  });
  const [meta, ctxs] = (await res.json()) as [{ universe: any[] }, any[]];
  return meta.universe.map((m, i) => ({
    name: m.name.replace("xyz:", ""),
    szDecimals: m.szDecimals,
    maxLeverage: m.maxLeverage,
    index: i,
    markPx: parseFloat(ctxs[i].markPx),
  }));
}

function priceToWire(price: number, sigFigs = 5): string {
  const rounded = parseFloat(price.toPrecision(sigFigs));
  if (rounded === Math.round(rounded)) return rounded.toFixed(1);
  return rounded.toString();
}

async function placeXyzOrder(
  assetIndex: number,
  isBuy: boolean,
  size: string,
  limitPrice: string,
  reduceOnly: boolean,
  tif: "Ioc" | "Gtc" = "Ioc",
) {
  const nonce = Date.now();

  // HIP-3 assets use offset 110000 + local index (from perpDexs API)
  // xyz is the first builder-deployed dex, so offset = 110000
  const globalAssetIndex = 110000 + assetIndex;

  const result = await exchange.order({
    orders: [{
      a: globalAssetIndex,
      b: isBuy,
      p: limitPrice,
      s: size,
      r: reduceOnly,
      t: { limit: { tif } },
    }],
    grouping: "na",
  });
  return result;
}

// ─── Commands ───

async function cmdMarkets(filter?: string) {
  const markets = await fetchXyzMarkets();
  const filtered = filter
    ? markets.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()))
    : markets;

  console.log(`\n  ${"Market".padEnd(18)} ${"Price".padStart(12)} ${"Index".padStart(6)} ${"Max Lev".padStart(8)}`);
  console.log("  " + "-".repeat(48));
  for (const m of filtered) {
    console.log(`  ${m.name.padEnd(18)} ${"$" + m.markPx.toLocaleString(undefined, { maximumFractionDigits: 4 }).padStart(10)} ${String(m.index).padStart(6)} ${m.maxLeverage + "x"}`);
  }
  console.log(`\n  Total HIP-3 markets: ${markets.length}\n`);
}

async function cmdBuySell(side: "buy" | "sell", coinName: string, size: number) {
  const markets = await fetchXyzMarkets();
  const upper = coinName.toUpperCase();
  const market = markets.find(m => m.name.toUpperCase() === upper);

  if (!market) {
    console.error(`  Market "${coinName}" not found in HIP-3 universe.`);
    const similar = markets.filter(m => m.name.toUpperCase().includes(upper));
    if (similar.length > 0) {
      console.log(`  Did you mean: ${similar.map(m => m.name).join(", ")}?`);
    }
    process.exit(1);
  }

  const slippage = side === "buy" ? 1.02 : 0.98;
  const limitPx = market.markPx * slippage;
  const notional = market.markPx * size;
  const sizeStr = size.toFixed(market.szDecimals);
  const priceStr = priceToWire(limitPx);

  console.log(`\n  ${side.toUpperCase()} ${sizeStr} ${market.name} (HIP-3)`);
  console.log(`  Mark:     ~$${market.markPx.toLocaleString()}`);
  console.log(`  Limit:    ~$${priceStr} (2% slippage)`);
  console.log(`  Notional: ~$${notional.toFixed(2)}`);
  console.log(`  Asset:    ${market.index} (xyz universe)`);
  console.log(`  Type:     IOC (market)\n`);

  try {
    const result = await placeXyzOrder(
      market.index,
      side === "buy",
      sizeStr,
      priceStr,
      false,
    );

    if (result.status === "ok") {
      const statuses = result.response?.data?.statuses;
      if (statuses && statuses.length > 0) {
        const s = statuses[0] as Record<string, any>;
        if (s.filled) {
          console.log(`  Order filled! (ID: ${s.filled.oid})`);
          console.log(`  Fill price: $${s.filled.avgPx}`);
          console.log(`  Total cost: $${(parseFloat(s.filled.avgPx) * parseFloat(s.filled.totalSz)).toFixed(2)}\n`);
        } else if (s.resting) {
          console.log(`  Order resting (ID: ${s.resting.oid})\n`);
        } else if (s.error) {
          console.error(`  Order error: ${s.error}\n`);
        } else {
          console.log(`  Status: ${JSON.stringify(s)}\n`);
        }
      } else {
        console.log(`  Response: ${JSON.stringify(result)}\n`);
      }
    } else {
      console.error(`  API error: ${JSON.stringify(result)}\n`);
    }
  } catch (err) {
    console.error(`  Error: ${(err as Error).message}\n`);
  }
}

async function cmdLimit(side: "buy" | "sell", coinName: string, size: number, price: number) {
  const markets = await fetchXyzMarkets();
  const upper = coinName.toUpperCase();
  const market = markets.find(m => m.name.toUpperCase() === upper);

  if (!market) {
    console.error(`  Market "${coinName}" not found in HIP-3 universe.`);
    process.exit(1);
  }

  const notional = price * size;
  const sizeStr = size.toFixed(market.szDecimals);
  const priceStr = priceToWire(price);

  console.log(`\n  GTC LIMIT ${side.toUpperCase()} ${sizeStr} ${market.name} @ $${priceStr}`);
  console.log(`  Current:  ~$${market.markPx.toLocaleString()}`);
  console.log(`  Notional: ~$${notional.toFixed(2)} (at limit price)`);
  console.log(`  Type:     GTC (rests until filled or cancelled)\n`);

  try {
    const result = await placeXyzOrder(
      market.index,
      side === "buy",
      sizeStr,
      priceStr,
      false,
      "Gtc",
    );

    if (result.status === "ok") {
      const statuses = result.response?.data?.statuses;
      if (statuses && statuses.length > 0) {
        const s = statuses[0] as Record<string, any>;
        if (s.filled) {
          console.log(`  Filled immediately at $${s.filled.avgPx}!\n`);
        } else if (s.resting) {
          console.log(`  Order resting (ID: ${s.resting.oid})`);
          console.log(`  Waiting at $${priceStr} until filled or cancelled.\n`);
        } else if (s.error) {
          console.error(`  Error: ${s.error}\n`);
        } else {
          console.log(`  Status: ${JSON.stringify(s)}\n`);
        }
      }
    } else {
      console.error(`  API error: ${JSON.stringify(result)}\n`);
    }
  } catch (err) {
    console.error(`  Error: ${(err as Error).message}\n`);
  }
}

async function cmdClose(coinName: string) {
  const upper = coinName.toUpperCase();

  // Get user state from xyz dex
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: ACCOUNT, dex: "xyz" }),
  });
  const acct = await res.json();
  const pos = acct.assetPositions.find((ap: any) => {
    const coin = ap.position.coin.replace(/^xyz:/, "").toUpperCase();
    return coin === upper && parseFloat(ap.position.szi) !== 0;
  });

  if (!pos) {
    console.error(`  No open position for ${coinName}\n`);
    process.exit(1);
  }

  const markets = await fetchXyzMarkets();
  const market = markets.find(m => m.name.toUpperCase() === upper);
  if (!market) {
    console.error(`  Market "${coinName}" not found in HIP-3 universe.\n`);
    process.exit(1);
  }

  const szi = parseFloat(pos.position.szi);
  const absSize = Math.abs(szi);
  const closeSide = szi > 0 ? false : true; // buy to close short, sell to close long
  const slippage = closeSide ? 1.02 : 0.98;
  const limitPx = market.markPx * slippage;

  console.log(`\n  Closing ${szi > 0 ? "LONG" : "SHORT"} ${absSize} ${market.name}`);
  console.log(`  Entry: $${pos.position.entryPx}  |  PnL: $${pos.position.unrealizedPnl}\n`);

  try {
    const result = await placeXyzOrder(
      market.index,
      closeSide,
      absSize.toFixed(market.szDecimals),
      priceToWire(limitPx),
      true,
    );

    if (result.status === "ok") {
      const s = result.response?.data?.statuses?.[0] as Record<string, any> | undefined;
      if (s?.filled) {
        console.log(`  Position closed! Fill: $${s.filled.avgPx}\n`);
      } else if (s?.error) {
        console.error(`  Close failed: ${s.error}\n`);
      } else {
        console.log(`  Result: ${JSON.stringify(s)}\n`);
      }
    } else {
      console.error(`  API error: ${JSON.stringify(result)}\n`);
    }
  } catch (err) {
    console.error(`  Error: ${(err as Error).message}\n`);
  }
}

async function cmdStatus() {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: ACCOUNT, dex: "xyz" }),
  });
  const data = await res.json();
  const positions = data.assetPositions.filter((ap: any) => parseFloat(ap.position.szi) !== 0);
  const ms = data.marginSummary;

  console.log(`\n  === XYZ (HIP-3) Account ===`);
  console.log(`  Account Value: $${parseFloat(ms.accountValue).toFixed(2)}`);
  console.log(`  Margin Used:   $${parseFloat(ms.totalMarginUsed).toFixed(2)}`);

  if (positions.length > 0) {
    console.log(`\n  === Open HIP-3 Positions (${positions.length}) ===`);
    for (const ap of positions) {
      const p = ap.position;
      const sz = parseFloat(p.szi);
      const pnl = parseFloat(p.unrealizedPnl);
      const roe = parseFloat(p.returnOnEquity) * 100;
      const name = p.coin.replace("xyz:", "");
      const notional = Math.abs(sz) * parseFloat(p.entryPx);
      const liqPx = p.liquidationPx ? `$${p.liquidationPx}` : "n/a";
      console.log(`  ${name.padEnd(14)} ${sz > 0 ? "LONG" : "SHORT"} ${Math.abs(sz)} @ $${p.entryPx}`);
      console.log(`${"".padEnd(16)} PnL: $${pnl.toFixed(4)} (${roe >= 0 ? "+" : ""}${roe.toFixed(2)}%)  |  ${p.leverage.value}x  |  Liq: ${liqPx}`);
      console.log(`${"".padEnd(16)} Notional: $${notional.toFixed(2)}  |  Margin: $${parseFloat(p.marginUsed).toFixed(2)}`);
    }
  } else {
    console.log("\n  No HIP-3 positions");
  }
  console.log();
}

// ─── Main ───

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case "status":
    cmdStatus();
    break;
  case "markets":
    cmdMarkets(args[0]);
    break;
  case "buy":
    if (args.length < 2) { console.error("Usage: buy <COIN> <SIZE>"); process.exit(1); }
    cmdBuySell("buy", args[0], parseFloat(args[1]));
    break;
  case "sell":
    if (args.length < 2) { console.error("Usage: sell <COIN> <SIZE>"); process.exit(1); }
    cmdBuySell("sell", args[0], parseFloat(args[1]));
    break;
  case "limit":
    if (args.length < 4) { console.error("Usage: limit <buy|sell> <COIN> <SIZE> <PRICE>"); process.exit(1); }
    cmdLimit(args[0] as "buy" | "sell", args[1], parseFloat(args[2]), parseFloat(args[3]));
    break;
  case "close":
    if (!args[0]) { console.error("Usage: close <COIN>"); process.exit(1); }
    cmdClose(args[0]);
    break;
  default:
    console.log(`
  HIP-3 (XYZ) Trader — Stocks, Oil, Gold, Forex on Hyperliquid

  Commands:
    status                          Show HIP-3 positions
    markets [filter]                List all HIP-3 markets
    buy <COIN> <SIZE>               Market buy  (e.g., buy BRENTOIL 0.1)
    sell <COIN> <SIZE>              Market sell (e.g., sell GOLD 0.01)
    limit <buy|sell> <COIN> <SZ> <PX>  GTC limit order (rests until filled)
    close <COIN>                    Close position

  Examples:
    npx tsx scripts/trade-xyz.ts status
    npx tsx scripts/trade-xyz.ts buy BRENTOIL 0.1
    npx tsx scripts/trade-xyz.ts limit buy BRENTOIL 4.2 95
    npx tsx scripts/trade-xyz.ts close BRENTOIL
    `);
}
