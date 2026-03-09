/**
 * CLI trading script for Hyperliquid via API wallet (agent key).
 * Supports both standard perps and HIP-3 (xyz:) markets.
 *
 * Usage:
 *   npx tsx scripts/trade.ts buy ETH 0.01                # market buy 0.01 ETH (perps)
 *   npx tsx scripts/trade.ts sell BTC 0.001               # market sell 0.001 BTC
 *   npx tsx scripts/trade.ts buy BRENTOIL 0.1             # buy 0.1 Brent Oil (HIP-3)
 *   npx tsx scripts/trade.ts close ETH                    # close entire ETH position
 *   npx tsx scripts/trade.ts close BRENTOIL               # close HIP-3 position
 *   npx tsx scripts/trade.ts status                       # show account & positions
 *   npx tsx scripts/trade.ts markets [filter]             # list available markets
 *   npx tsx scripts/trade.ts xyz [filter]                 # list HIP-3 markets (stocks, oil, gold)
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { privateKeyToAccount } from "viem/accounts";
import {
  ExchangeClient,
  InfoClient,
  HttpTransport,
  MAINNET_API_URL,
} from "@nktkas/hyperliquid";

const ACCOUNT_ADDRESS = process.env.HL_ACCOUNT_ADDRESS! as `0x${string}`;
const API_PRIVATE_KEY = process.env.HL_API_PRIVATE_KEY! as `0x${string}`;

if (!ACCOUNT_ADDRESS || !API_PRIVATE_KEY) {
  console.error("Missing HL_ACCOUNT_ADDRESS or HL_API_PRIVATE_KEY in .env.local");
  process.exit(1);
}

const wallet = privateKeyToAccount(API_PRIVATE_KEY);
const transport = new HttpTransport();
const exchange = new ExchangeClient({ wallet, transport });
const info = new InfoClient({ transport });

const HL_API = MAINNET_API_URL + "/info";

// ─── Helpers ───

function priceToWire(price: number): string {
  const rounded = parseFloat(price.toPrecision(5));
  if (rounded === Math.round(rounded)) return rounded.toFixed(1);
  return rounded.toString();
}

interface MarketMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

interface ResolvedMarket {
  market: MarketMeta;
  markPx: number;
  assetIndex: number;
  isHip3: boolean;
}

const HIP3_NAMES = new Set([
  "TSLA", "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AMD", "INTC",
  "PLTR", "COIN", "HOOD", "ORCL", "MU", "MSTR", "NFLX", "COST", "LLY",
  "TSM", "RIVN", "BABA", "GME", "SOFTBANK", "HYUNDAI", "KIOXIA", "SMSN", "CRWV",
  "GOLD", "SILVER", "CL", "BRENTOIL", "COPPER", "NATGAS", "URANIUM",
  "ALUMINIUM", "PLATINUM", "PALLADIUM",
  "JPY", "EUR", "DXY",
  "JP225", "KR200", "XYZ100",
  "EWY", "EWJ", "URNM", "USAR",
  "SPY", "QQQ", "GLD", "AVGO",
]);

async function fetchXyzMeta(): Promise<[MarketMeta[], any[]]> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
  });
  const [meta, ctxs] = (await res.json()) as [{ universe: MarketMeta[] }, any[]];
  return [meta.universe, ctxs];
}

async function resolveMarket(coin: string): Promise<ResolvedMarket> {
  const upper = coin.toUpperCase();
  const stripped = upper.replace(/^XYZ:/, "");

  // Try standard perps first (unless it's a known HIP-3 name)
  if (!HIP3_NAMES.has(stripped)) {
    const [meta, ctxs] = await info.metaAndAssetCtxs();
    const idx = meta.universe.findIndex(
      (m: { name: string }) => m.name.toUpperCase() === upper
    );
    if (idx >= 0) {
      return {
        market: meta.universe[idx] as MarketMeta,
        markPx: parseFloat(ctxs[idx].markPx),
        assetIndex: idx,
        isHip3: false,
      };
    }
  }

  // Try HIP-3 (dex=xyz)
  const [xyzUniverse, xyzCtxs] = await fetchXyzMeta();
  const xyzIdx = xyzUniverse.findIndex((m) => {
    const raw = m.name.replace(/^xyz:/, "").toUpperCase();
    return raw === stripped;
  });
  if (xyzIdx >= 0) {
    return {
      market: xyzUniverse[xyzIdx],
      markPx: parseFloat(xyzCtxs[xyzIdx].markPx),
      assetIndex: 10000 + xyzIdx,
      isHip3: true,
    };
  }

  // Fallback: try perps if we skipped it
  if (HIP3_NAMES.has(stripped)) {
    const [meta, ctxs] = await info.metaAndAssetCtxs();
    const idx = meta.universe.findIndex(
      (m: { name: string }) => m.name.toUpperCase() === upper
    );
    if (idx >= 0) {
      return {
        market: meta.universe[idx] as MarketMeta,
        markPx: parseFloat(ctxs[idx].markPx),
        assetIndex: idx,
        isHip3: false,
      };
    }
  }

  console.error(`  Market "${coin}" not found in perps or HIP-3.`);
  process.exit(1);
}

// ─── Commands ───

async function cmdStatus() {
  console.log(`\n  Account: ${ACCOUNT_ADDRESS}`);
  console.log(`  Agent:   ${wallet.address}\n`);

  const [acct, spot] = await Promise.all([
    info.clearinghouseState({ user: ACCOUNT_ADDRESS }),
    info.spotClearinghouseState({ user: ACCOUNT_ADDRESS }),
  ]);
  const ms = acct.marginSummary;

  console.log("  === Perps Account ===");
  console.log(`  Account Value:  $${parseFloat(ms.accountValue).toFixed(2)}`);
  console.log(`  Margin Used:    $${parseFloat(ms.totalMarginUsed).toFixed(2)}`);
  console.log(`  Available:      $${parseFloat(acct.withdrawable).toFixed(2)}`);

  const usdcSpot = spot.balances.find((b: { coin: string }) => b.coin === "USDC");
  if (usdcSpot) {
    console.log(`\n  === Spot Balance ===`);
    console.log(`  USDC Total:     $${parseFloat(usdcSpot.total).toFixed(2)}`);
    console.log(`  USDC On Hold:   $${parseFloat(usdcSpot.hold).toFixed(2)}`);
    console.log(`  USDC Available: $${(parseFloat(usdcSpot.total) - parseFloat(usdcSpot.hold)).toFixed(2)}`);
  }

  const positions = acct.assetPositions.filter(
    (ap: { position: { szi: string } }) => parseFloat(ap.position.szi) !== 0
  );
  if (positions.length > 0) {
    console.log(`\n  === Open Positions (${positions.length}) ===`);
    for (const ap of positions) {
      const p = ap.position;
      const sz = parseFloat(p.szi);
      const pnl = parseFloat(p.unrealizedPnl);
      const roe = parseFloat(p.returnOnEquity) * 100;
      console.log(
        `  ${p.coin.padEnd(16)} ${sz > 0 ? "LONG" : "SHORT"} ${Math.abs(sz)} @ $${p.entryPx}  |  PnL: $${pnl.toFixed(2)} (${roe >= 0 ? "+" : ""}${roe.toFixed(1)}%)  |  ${p.leverage.value}x`
      );
    }
  } else {
    console.log("\n  No open positions");
  }
  console.log();
}

async function cmdMarkets(filter?: string) {
  const [meta, ctxs] = await info.metaAndAssetCtxs();
  const markets = meta.universe.map((m: { name: string }, i: number) => ({
    name: m.name,
    markPx: ctxs[i].markPx,
  }));

  const filtered = filter
    ? markets.filter((m: { name: string }) => m.name.toLowerCase().includes(filter.toLowerCase()))
    : markets.slice(0, 30);

  console.log(`\n  ${"Coin".padEnd(12)} ${"Price".padStart(14)}`);
  console.log("  " + "-".repeat(28));
  for (const m of filtered) {
    console.log(`  ${m.name.padEnd(12)} ${"$" + parseFloat(m.markPx).toLocaleString(undefined, { maximumFractionDigits: 6 })}`);
  }
  console.log(`\n  Total perps: ${markets.length}  (use "xyz" command for HIP-3 markets)\n`);
}

async function cmdXyz(filter?: string) {
  const [universe, ctxs] = await fetchXyzMeta();
  const markets = universe.map((m, i) => ({
    name: m.name,
    markPx: ctxs[i].markPx,
    maxLev: m.maxLeverage,
  }));

  const filtered = filter
    ? markets.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()))
    : markets;

  console.log(`\n  ${"Market".padEnd(20)} ${"Price".padStart(12)} ${"Max Lev".padStart(10)}`);
  console.log("  " + "-".repeat(44));
  for (const m of filtered) {
    const raw = m.name.replace("xyz:", "");
    console.log(`  ${raw.padEnd(20)} ${"$" + parseFloat(m.markPx).toLocaleString(undefined, { maximumFractionDigits: 4 })}  ${m.maxLev}x`);
  }
  console.log(`\n  Total HIP-3 markets: ${universe.length}\n`);
}

async function cmdBuySell(side: "buy" | "sell", coin: string, size: number) {
  const resolved = await resolveMarket(coin);
  const { market, markPx, assetIndex, isHip3 } = resolved;
  const slippage = side === "buy" ? 1.02 : 0.98;
  const limitPx = markPx * slippage;
  const notional = markPx * size;

  const displayName = market.name.replace("xyz:", "");

  console.log(`\n  ${side.toUpperCase()} ${size} ${displayName}${isHip3 ? " (HIP-3)" : ""}`);
  console.log(`  Mark:     ~$${markPx.toLocaleString()}`);
  console.log(`  Limit:    ~$${limitPx.toFixed(2)} (2% slippage)`);
  console.log(`  Notional: ~$${notional.toFixed(2)}`);
  console.log(`  Asset:    ${assetIndex}${isHip3 ? " (isolated only)" : ""}`);
  console.log(`  Type:     IOC (market)\n`);

  try {
    const result = await exchange.order({
      orders: [{
        a: assetIndex,
        b: side === "buy",
        p: priceToWire(limitPx),
        s: size.toFixed(market.szDecimals),
        r: false,
        t: { limit: { tif: "Ioc" } },
      }],
      grouping: "na",
    });

    const status = result.response.data.statuses[0] as Record<string, any>;
    if ("filled" in status) {
      console.log(`  Order filled! (ID: ${status.filled.oid})`);
      console.log(`  Fill price: $${status.filled.avgPx}`);
      console.log(`  Total cost: $${(parseFloat(status.filled.avgPx) * parseFloat(status.filled.totalSz)).toFixed(2)}\n`);
    } else if ("resting" in status) {
      console.log(`  Order resting (ID: ${status.resting.oid})\n`);
    } else if ("error" in status) {
      console.error(`  Order failed: ${status.error}\n`);
    } else {
      console.log(`  Result: ${JSON.stringify(status)}\n`);
    }
  } catch (err) {
    console.error(`  Error: ${(err as Error).message}\n`);
  }
}

async function cmdClose(coin: string) {
  const acct = await info.clearinghouseState({ user: ACCOUNT_ADDRESS });
  const upper = coin.toUpperCase().replace(/^XYZ:/, "");

  const pos = acct.assetPositions.find(
    (ap: { position: { coin: string; szi: string } }) => {
      const posCoin = ap.position.coin.replace(/^xyz:/, "").toUpperCase();
      return posCoin === upper && parseFloat(ap.position.szi) !== 0;
    }
  );

  if (!pos) {
    console.error(`  No open position for ${coin}\n`);
    process.exit(1);
  }

  const resolved = await resolveMarket(pos.position.coin);
  const { market, markPx, assetIndex } = resolved;

  const sz = parseFloat(pos.position.szi);
  const absSize = Math.abs(sz);
  const closeSide = sz > 0 ? false : true;
  const slippage = closeSide ? 1.02 : 0.98;
  const limitPx = markPx * slippage;

  const displayName = market.name.replace("xyz:", "");
  console.log(`\n  Closing ${sz > 0 ? "LONG" : "SHORT"} ${absSize} ${displayName}`);
  console.log(`  Entry: $${pos.position.entryPx}  |  PnL: $${pos.position.unrealizedPnl}\n`);

  try {
    const result = await exchange.order({
      orders: [{
        a: assetIndex,
        b: closeSide,
        p: priceToWire(limitPx),
        s: absSize.toFixed(market.szDecimals),
        r: true,
        t: { limit: { tif: "Ioc" } },
      }],
      grouping: "na",
    });

    const status = result.response.data.statuses[0] as Record<string, any>;
    if ("filled" in status) {
      console.log(`  Position closed! Fill: $${status.filled.avgPx}\n`);
    } else if ("error" in status) {
      console.error(`  Close failed: ${status.error}\n`);
    } else {
      console.log(`  Result: ${JSON.stringify(status)}\n`);
    }
  } catch (err) {
    console.error(`  Error: ${(err as Error).message}\n`);
  }
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
  case "xyz":
    cmdXyz(args[0]);
    break;
  case "buy":
    if (args.length < 2) { console.error("Usage: buy <COIN> <SIZE>"); process.exit(1); }
    cmdBuySell("buy", args[0], parseFloat(args[1]));
    break;
  case "sell":
    if (args.length < 2) { console.error("Usage: sell <COIN> <SIZE>"); process.exit(1); }
    cmdBuySell("sell", args[0], parseFloat(args[1]));
    break;
  case "close":
    if (!args[0]) { console.error("Usage: close <COIN>"); process.exit(1); }
    cmdClose(args[0]);
    break;
  default:
    console.log(`
  Coincess CLI Trader (Perps + HIP-3)

  Commands:
    status              Show account balance & positions
    markets [filter]    List perps markets
    xyz [filter]        List HIP-3 markets (stocks, oil, gold, forex)
    buy <COIN> <SIZE>   Market buy  (e.g., buy ETH 0.01  or  buy BRENTOIL 0.1)
    sell <COIN> <SIZE>  Market sell (e.g., sell BTC 0.001 or  sell GOLD 0.01)
    close <COIN>        Close entire position

  Examples:
    npx tsx scripts/trade.ts status
    npx tsx scripts/trade.ts xyz oil
    npx tsx scripts/trade.ts buy BRENTOIL 0.1
    npx tsx scripts/trade.ts close BRENTOIL
    `);
}
