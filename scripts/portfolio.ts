/**
 * Automated portfolio manager for Hyperliquid.
 *
 * Strategy: Delta-neutral funding-rate farming
 * - Go LONG on coins with deeply negative funding (shorts pay us)
 * - Hedge with BTC/ETH SHORT to stay market-neutral
 * - Collect funding every hour, rebalance when rates shift
 *
 * Commands:
 *   npx tsx scripts/portfolio.ts monitor          # one-shot status + PnL + funding
 *   npx tsx scripts/portfolio.ts guard             # continuous risk guard (stop-loss/TP)
 *   npx tsx scripts/portfolio.ts scan              # find best funding-rate opportunities
 *   npx tsx scripts/portfolio.ts rebalance         # rotate into better funding rates
 *   npx tsx scripts/portfolio.ts close-all          # emergency: flatten everything
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

const ACCOUNT = process.env.HL_ACCOUNT_ADDRESS! as `0x${string}`;
const API_KEY = process.env.HL_API_PRIVATE_KEY! as `0x${string}`;

const wallet = privateKeyToAccount(API_KEY);
const transport = new HttpTransport();
const exchange = new ExchangeClient({ wallet, transport });
const info = new InfoClient({ transport });

const HL_API = MAINNET_API_URL + "/info";

// ═══════════════════════════════════════════════════════════
// Risk parameters — tune these for your risk appetite
// ═══════════════════════════════════════════════════════════
const STOP_LOSS_PCT = -15;      // close position if ROE drops below this %
const TAKE_PROFIT_PCT = 30;     // close position if ROE exceeds this %
const MAX_DRAWDOWN_PCT = -25;   // close ALL if total account drops this % from peak
const GUARD_INTERVAL_S = 60;    // how often the guard loop checks (seconds)
const MIN_FUNDING_APR = -30;    // minimum annualised funding to keep a farm position (%)
const MIN_FARM_VOLUME = 500_000; // minimum 24h volume for new farm entries

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function priceToWire(price: number): string {
  const rounded = parseFloat(price.toPrecision(5));
  if (rounded === Math.round(rounded)) return rounded.toFixed(1);
  return rounded.toString();
}

function fmt(n: number, d = 2): string { return n.toFixed(d); }
function fmtUsd(n: number): string { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function pct(n: number): string { return (n >= 0 ? "+" : "") + n.toFixed(2) + "%"; }
function pad(s: string, w: number): string { return s.padEnd(w); }

interface Position {
  coin: string;
  szi: number;
  entryPx: number;
  markPx: number;
  unrealizedPnl: number;
  returnOnEquity: number;
  leverage: number;
  liquidationPx: number | null;
  marginUsed: number;
  notional: number;
}

async function getPositions(): Promise<Position[]> {
  const acct = await info.clearinghouseState({ user: ACCOUNT });
  return acct.assetPositions
    .filter((ap: any) => parseFloat(ap.position.szi) !== 0)
    .map((ap: any) => {
      const p = ap.position;
      const szi = parseFloat(p.szi);
      const entryPx = parseFloat(p.entryPx);
      const markPx = parseFloat(p.positionValue) / Math.abs(szi) || entryPx;
      return {
        coin: p.coin,
        szi,
        entryPx,
        markPx,
        unrealizedPnl: parseFloat(p.unrealizedPnl),
        returnOnEquity: parseFloat(p.returnOnEquity) * 100,
        leverage: parseFloat(p.leverage.value),
        liquidationPx: p.liquidationPx ? parseFloat(p.liquidationPx) : null,
        marginUsed: parseFloat(p.marginUsed),
        notional: Math.abs(szi) * entryPx,
      };
    });
}

async function getAccountValue(): Promise<{ accountValue: number; available: number; totalMargin: number }> {
  const acct = await info.clearinghouseState({ user: ACCOUNT });
  return {
    accountValue: parseFloat(acct.marginSummary.accountValue),
    available: parseFloat(acct.withdrawable),
    totalMargin: parseFloat(acct.marginSummary.totalMarginUsed),
  };
}

async function getFundingRates(): Promise<Map<string, { rate: number; apr: number; vol: number }>> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });
  const [meta, ctxs] = (await res.json()) as [{ universe: any[] }, any[]];
  const map = new Map<string, { rate: number; apr: number; vol: number }>();

  for (let i = 0; i < meta.universe.length; i++) {
    const name = meta.universe[i].name;
    const fundRate = parseFloat(ctxs[i].funding || "0");
    const vol = parseFloat(ctxs[i].dayNtlVlm || "0");
    map.set(name, {
      rate: fundRate * 100,           // hourly %
      apr: fundRate * 24 * 365 * 100, // annualised %
      vol,
    });
  }
  return map;
}

async function closePosition(coin: string, szi: number): Promise<boolean> {
  const [meta, ctxs] = await info.metaAndAssetCtxs();
  const idx = meta.universe.findIndex((m: any) => m.name === coin);
  if (idx < 0) return false;

  const markPx = parseFloat(ctxs[idx].markPx);
  const closeSide = szi > 0 ? false : true;
  const slippage = closeSide ? 1.02 : 0.98;
  const limitPx = markPx * slippage;
  const szDec = meta.universe[idx].szDecimals;

  try {
    const result = await exchange.order({
      orders: [{
        a: idx,
        b: closeSide,
        p: priceToWire(limitPx),
        s: Math.abs(szi).toFixed(szDec),
        r: true,
        t: { limit: { tif: "Ioc" } },
      }],
      grouping: "na",
    });
    const status = result.response.data.statuses[0];
    return typeof status === "object" && status !== null && "filled" in status;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// MONITOR — one-shot portfolio dashboard
// ═══════════════════════════════════════════════════════════

async function cmdMonitor() {
  const [positions, acctInfo, fundingMap] = await Promise.all([
    getPositions(),
    getAccountValue(),
    getFundingRates(),
  ]);

  const now = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
  console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║  COINCESS PORTFOLIO MONITOR — ${now}  ║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝\n`);

  console.log(`  Account Value: ${fmtUsd(acctInfo.accountValue)}  |  Margin: ${fmtUsd(acctInfo.totalMargin)}  |  Available: ${fmtUsd(acctInfo.available)}\n`);

  let totalPnl = 0;
  let totalLong = 0;
  let totalShort = 0;
  let dailyFunding = 0;

  console.log(`  ${pad("COIN", 10)} ${pad("SIDE", 6)} ${pad("SIZE", 10)} ${pad("ENTRY", 12)} ${pad("PnL", 16)} ${pad("ROE", 10)} ${pad("FUND/hr", 10)} ${pad("FUND APR", 12)}`);
  console.log(`  ${"─".repeat(90)}`);

  for (const p of positions) {
    const side = p.szi > 0 ? "LONG" : "SHORT";
    const funding = fundingMap.get(p.coin);
    const fundHr = funding ? funding.rate : 0;
    const fundApr = funding ? funding.apr : 0;

    // Funding P&L direction: longs pay positive funding, shorts receive it
    const fundDir = p.szi > 0 ? -fundHr : fundHr;
    const dailyFundUsd = (fundDir / 100) * p.notional * 24;
    dailyFunding += dailyFundUsd;

    totalPnl += p.unrealizedPnl;
    if (p.szi > 0) totalLong += p.notional;
    else totalShort += p.notional;

    const pnlStr = `${fmtUsd(p.unrealizedPnl)} (${pct(p.returnOnEquity)})`;
    const fundStr = p.szi > 0
      ? (fundHr <= 0 ? `✓ ${pct(fundHr)}` : `✗ ${pct(fundHr)}`)
      : (fundHr >= 0 ? `✓ ${pct(fundHr)}` : `✗ ${pct(fundHr)}`);

    console.log(`  ${pad(p.coin, 10)} ${pad(side, 6)} ${pad(Math.abs(p.szi).toString(), 10)} ${pad(fmtUsd(p.entryPx), 12)} ${pad(pnlStr, 16)} ${pad(pct(p.returnOnEquity), 10)} ${pad(fundStr, 10)} ${pad(pct(fundApr) + "/yr", 12)}`);
  }

  console.log(`  ${"─".repeat(90)}`);
  console.log(`\n  Net PnL:       ${fmtUsd(totalPnl)} ${totalPnl >= 0 ? "✓" : "✗"}`);
  console.log(`  Long exposure:  ${fmtUsd(totalLong)}`);
  console.log(`  Short exposure: ${fmtUsd(totalShort)}`);
  console.log(`  Delta:          ${fmtUsd(totalLong - totalShort)} (${totalLong - totalShort > 0 ? "net long" : "net short"})`);
  console.log(`\n  Daily funding income: ~${fmtUsd(dailyFunding)}`);
  console.log(`  Annual funding income: ~${fmtUsd(dailyFunding * 365)}`);
  console.log(`  Funding yield on capital: ~${pct((dailyFunding * 365 / acctInfo.accountValue) * 100)}/yr\n`);
}

// ═══════════════════════════════════════════════════════════
// GUARD — continuous risk management loop
// ═══════════════════════════════════════════════════════════

async function cmdGuard() {
  let peakValue = 0;
  let cycle = 0;

  console.log(`\n  🛡  RISK GUARD ACTIVE`);
  console.log(`  Stop-loss: ${STOP_LOSS_PCT}% per position  |  Take-profit: ${TAKE_PROFIT_PCT}%  |  Max drawdown: ${MAX_DRAWDOWN_PCT}%`);
  console.log(`  Checking every ${GUARD_INTERVAL_S}s — press Ctrl+C to stop\n`);

  const run = async () => {
    cycle++;
    try {
      const [positions, acctInfo] = await Promise.all([
        getPositions(),
        getAccountValue(),
      ]);

      if (acctInfo.accountValue > peakValue) peakValue = acctInfo.accountValue;
      const drawdown = peakValue > 0 ? ((acctInfo.accountValue - peakValue) / peakValue) * 100 : 0;

      const ts = new Date().toLocaleTimeString();
      process.stdout.write(`  [${ts}] #${cycle}  Value: ${fmtUsd(acctInfo.accountValue)}  Peak: ${fmtUsd(peakValue)}  DD: ${pct(drawdown)}  `);

      // Max drawdown check
      if (drawdown < MAX_DRAWDOWN_PCT) {
        console.log(`\n  ⚠  MAX DRAWDOWN HIT (${pct(drawdown)}) — CLOSING ALL POSITIONS`);
        for (const p of positions) {
          const ok = await closePosition(p.coin, p.szi);
          console.log(`    ${p.coin}: ${ok ? "closed" : "FAILED"}`);
        }
        process.exit(0);
      }

      // Per-position stop-loss / take-profit
      let actions: string[] = [];
      for (const p of positions) {
        if (p.returnOnEquity <= STOP_LOSS_PCT) {
          console.log(`\n  ⚠  STOP-LOSS: ${p.coin} at ${pct(p.returnOnEquity)} ROE`);
          const ok = await closePosition(p.coin, p.szi);
          actions.push(`${p.coin} SL ${ok ? "✓" : "✗"}`);
        } else if (p.returnOnEquity >= TAKE_PROFIT_PCT) {
          console.log(`\n  ✓  TAKE-PROFIT: ${p.coin} at ${pct(p.returnOnEquity)} ROE`);
          const ok = await closePosition(p.coin, p.szi);
          actions.push(`${p.coin} TP ${ok ? "✓" : "✗"}`);
        }
      }

      if (actions.length > 0) {
        console.log(`  Actions: ${actions.join(", ")}`);
      } else {
        console.log("OK");
      }
    } catch (err) {
      console.log(`  ERROR: ${(err as Error).message}`);
    }
  };

  await run();
  setInterval(run, GUARD_INTERVAL_S * 1000);
}

// ═══════════════════════════════════════════════════════════
// SCAN — find best funding rate farm opportunities
// ═══════════════════════════════════════════════════════════

async function cmdScan() {
  const fundingMap = await getFundingRates();

  console.log(`\n  ═══ FUNDING RATE OPPORTUNITIES ═══\n`);
  console.log(`  ${pad("COIN", 10)} ${pad("FUND/hr", 10)} ${pad("APR", 14)} ${pad("24h Volume", 16)} ${pad("STRATEGY", 10)}`);
  console.log(`  ${"─".repeat(65)}`);

  const entries = Array.from(fundingMap.entries())
    .filter(([, v]) => Math.abs(v.apr) > 25 && v.vol > MIN_FARM_VOLUME)
    .sort((a, b) => a[1].apr - b[1].apr);

  for (const [coin, data] of entries) {
    const strategy = data.apr < 0 ? "→ LONG" : "→ SHORT";
    const volStr = fmtUsd(data.vol);
    console.log(`  ${pad(coin, 10)} ${pad(pct(data.rate), 10)} ${pad(pct(data.apr) + "/yr", 14)} ${pad(volStr, 16)} ${strategy}`);
  }

  console.log(`\n  Coins with APR < ${MIN_FUNDING_APR}% are ideal long farm targets.`);
  console.log(`  Pair with BTC/ETH shorts for delta neutrality.\n`);
}

// ═══════════════════════════════════════════════════════════
// REBALANCE — rotate out of stale farms, into better ones
// ═══════════════════════════════════════════════════════════

async function cmdRebalance() {
  const [positions, fundingMap] = await Promise.all([
    getPositions(),
    getFundingRates(),
  ]);

  console.log(`\n  ═══ REBALANCE CHECK ═══\n`);

  const farmPositions = positions.filter(p => p.szi > 0 && p.coin !== "BTC" && p.coin !== "ETH");
  const hedgePositions = positions.filter(p => p.szi < 0);

  let totalLong = 0;
  let totalShort = 0;

  for (const p of positions) {
    if (p.szi > 0) totalLong += p.notional;
    else totalShort += p.notional;
  }

  console.log(`  Delta balance: Long ${fmtUsd(totalLong)} vs Short ${fmtUsd(totalShort)} = ${fmtUsd(totalLong - totalShort)} net\n`);

  // Check if any farm positions have unfavourable funding now
  console.log(`  Farm positions:`);
  for (const p of farmPositions) {
    const funding = fundingMap.get(p.coin);
    const apr = funding ? funding.apr : 0;
    const status = apr < MIN_FUNDING_APR ? "✓ KEEP" : (apr < 0 ? "⚠ WEAK" : "✗ ROTATE");
    console.log(`    ${pad(p.coin, 8)} APR: ${pad(pct(apr) + "/yr", 14)} ${status}  (PnL: ${fmtUsd(p.unrealizedPnl)})`);
  }

  // Find better alternatives
  const currentCoins = new Set(positions.map(p => p.coin));
  const alternatives = Array.from(fundingMap.entries())
    .filter(([coin, v]) => !currentCoins.has(coin) && v.apr < MIN_FUNDING_APR && v.vol > MIN_FARM_VOLUME)
    .sort((a, b) => a[1].apr - b[1].apr)
    .slice(0, 5);

  if (alternatives.length > 0) {
    console.log(`\n  Better alternatives:`);
    for (const [coin, data] of alternatives) {
      console.log(`    ${pad(coin, 8)} APR: ${pad(pct(data.apr) + "/yr", 14)} Vol: ${fmtUsd(data.vol)}`);
    }
  }

  // Check hedge adequacy
  console.log(`\n  Hedge positions:`);
  for (const p of hedgePositions) {
    const funding = fundingMap.get(p.coin);
    const apr = funding ? funding.apr : 0;
    const fundDir = apr >= 0 ? "✓ earning" : "⚠ paying";
    console.log(`    ${pad(p.coin, 8)} APR: ${pad(pct(apr) + "/yr", 14)} ${fundDir}  (PnL: ${fmtUsd(p.unrealizedPnl)})`);
  }

  const delta = Math.abs(totalLong - totalShort);
  const deltaRatio = delta / Math.max(totalLong, totalShort) * 100;
  console.log(`\n  Delta imbalance: ${pct(deltaRatio)} ${deltaRatio < 15 ? "✓ OK" : "⚠ REBALANCE NEEDED"}\n`);
}

// ═══════════════════════════════════════════════════════════
// CLOSE-ALL — emergency flatten
// ═══════════════════════════════════════════════════════════

async function cmdCloseAll() {
  const positions = await getPositions();
  if (positions.length === 0) {
    console.log("\n  No positions to close.\n");
    return;
  }

  console.log(`\n  ⚠  CLOSING ALL ${positions.length} POSITIONS\n`);
  for (const p of positions) {
    process.stdout.write(`  ${p.coin} (${p.szi > 0 ? "LONG" : "SHORT"} ${Math.abs(p.szi)})... `);
    const ok = await closePosition(p.coin, p.szi);
    console.log(ok ? "closed ✓" : "FAILED ✗");
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════

const [, , cmd] = process.argv;

switch (cmd) {
  case "monitor": cmdMonitor(); break;
  case "guard": cmdGuard(); break;
  case "scan": cmdScan(); break;
  case "rebalance": cmdRebalance(); break;
  case "close-all": cmdCloseAll(); break;
  default:
    console.log(`
  Coincess Portfolio Manager

  Commands:
    monitor      Dashboard — positions, PnL, funding income
    guard        Continuous risk guard (stop-loss / take-profit / max-drawdown)
    scan         Find best funding-rate farming opportunities
    rebalance    Check if current farms need rotation
    close-all    Emergency: close all positions

  Usage:
    npx tsx scripts/portfolio.ts monitor
    npx tsx scripts/portfolio.ts guard
    npx tsx scripts/portfolio.ts scan
    `);
}
