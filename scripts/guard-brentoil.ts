import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { privateKeyToAccount } from "viem/accounts";
import { ExchangeClient, HttpTransport, MAINNET_API_URL } from "@nktkas/hyperliquid";

const ACCOUNT = process.env.HL_ACCOUNT_ADDRESS! as `0x${string}`;
const API_KEY = process.env.HL_API_PRIVATE_KEY! as `0x${string}`;

const wallet = privateKeyToAccount(API_KEY);
const transport = new HttpTransport();
const exchange = new ExchangeClient({ wallet, transport });

const HL_API = MAINNET_API_URL + "/info";

// ── Risk parameters (5x long — let it breathe) ──
const TAKE_PROFIT_PNL = 15.0;
const STOP_LOSS_PNL = -12.0;
const LIQ_BUFFER_PCT = 3.0;
const CHECK_INTERVAL_S = 120;

async function getXyzState() {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: ACCOUNT, dex: "xyz" }),
  });
  return res.json();
}

async function getXyzMarkets() {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
  });
  return res.json();
}

function priceToWire(px: number): string {
  const s = px.toPrecision(5);
  return parseFloat(s).toString();
}

async function closePosition(szi: number, markPx: number, assetIndex: number) {
  const absSize = Math.abs(szi);
  const isBuy = szi < 0;
  const slippage = isBuy ? 1.03 : 0.97;
  const limitPx = markPx * slippage;
  const globalIndex = 110000 + assetIndex;

  return exchange.order({
    orders: [{
      a: globalIndex,
      b: isBuy,
      p: priceToWire(limitPx),
      s: absSize.toFixed(2),
      r: true,
      t: { limit: { tif: "Ioc" } },
    }],
    grouping: "na",
  });
}

function ts() {
  return new Date().toLocaleTimeString("en-SG", { hour12: false });
}

async function guard() {
  let peakPnl = -Infinity;
  let checkCount = 0;

  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║   BRENTOIL LONG 5x — AUTO GUARD ACTIVE   ║`);
  console.log(`  ╠══════════════════════════════════════════╣`);
  console.log(`  ║  Take Profit:  >= +$${TAKE_PROFIT_PNL.toFixed(2)}                 ║`);
  console.log(`  ║  Stop Loss:    <= $${STOP_LOSS_PNL.toFixed(2)}                 ║`);
  console.log(`  ║  Liq Buffer:   ${LIQ_BUFFER_PCT}% from liquidation      ║`);
  console.log(`  ║  Check every:  ${CHECK_INTERVAL_S}s                        ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);

  while (true) {
    try {
      checkCount++;
      const [acct, marketsData] = await Promise.all([getXyzState(), getXyzMarkets()]);

      const pos = acct.assetPositions?.find((ap: any) => {
        const c = (ap.position?.coin || "").toUpperCase();
        return (c === "BRENTOIL" || c === "XYZ:BRENTOIL") && parseFloat(ap.position.szi) !== 0;
      });

      if (!pos) {
        console.log(`  [${ts()}] #${checkCount} — No BRENTOIL position found. Guard exiting.`);
        break;
      }

      const p = pos.position;
      const szi = parseFloat(p.szi);
      const entry = parseFloat(p.entryPx);
      const pnl = parseFloat(p.unrealizedPnl);
      const roe = parseFloat(p.returnOnEquity) * 100;
      const liqPx = parseFloat(p.liquidationPx);
      const funding = parseFloat(p.cumFunding?.sinceOpen || "0");

      const meta = marketsData[0]?.universe || [];
      const ctxs = marketsData[1] || [];
      let markPx = entry;
      let assetIndex = -1;
      for (let i = 0; i < meta.length; i++) {
        const n = (meta[i].name || "").toUpperCase();
        if (n === "BRENTOIL" || n === "XYZ:BRENTOIL") {
          markPx = parseFloat(ctxs[i]?.markPx || entry.toString());
          assetIndex = i;
          break;
        }
      }

      if (pnl > peakPnl) peakPnl = pnl;
      const distToLiq = ((liqPx - markPx) / markPx) * 100;

      const dir = szi < 0 ? "SHORT" : "LONG";
      const fundStr = funding >= 0 ? `paid $${funding.toFixed(3)}` : `earned $${Math.abs(funding).toFixed(3)}`;

      console.log(
        `  [${ts()}] #${checkCount}  ${dir} ${Math.abs(szi)} @ $${markPx.toFixed(2)}  ` +
        `PnL: $${pnl >= 0 ? "+" : ""}${pnl.toFixed(3)} (${roe >= 0 ? "+" : ""}${roe.toFixed(1)}% ROE)  ` +
        `Funding: ${fundStr}  ` +
        `Liq: $${liqPx.toFixed(2)} (${distToLiq.toFixed(1)}% away)`
      );

      let action: string | null = null;

      if (pnl >= TAKE_PROFIT_PNL) {
        action = `TAKE PROFIT — PnL $${pnl.toFixed(2)} >= $${TAKE_PROFIT_PNL}`;
      } else if (pnl <= STOP_LOSS_PNL) {
        action = `STOP LOSS — PnL $${pnl.toFixed(2)} <= $${STOP_LOSS_PNL}`;
      } else if (Math.abs(distToLiq) <= LIQ_BUFFER_PCT) {
        action = `LIQUIDATION GUARD — price ${distToLiq.toFixed(2)}% from liq ($${liqPx.toFixed(2)})`;
      }

      if (!action && peakPnl >= 10.0 && pnl < peakPnl * 0.4) {
        action = `TRAILING STOP — PnL dropped from peak $${peakPnl.toFixed(2)} to $${pnl.toFixed(2)}`;
      }

      if (action) {
        console.log(`\n  >>> ${action}`);
        console.log(`  >>> Closing position...\n`);

        const result = await closePosition(szi, markPx, assetIndex);
        const s = (result as any).response?.data?.statuses?.[0];
        if (s?.filled) {
          console.log(`  >>> CLOSED at $${s.filled.avgPx}`);
          console.log(`  >>> Final PnL: $${pnl >= 0 ? "+" : ""}${pnl.toFixed(3)}`);
          console.log(`  >>> Funding: ${fundStr}`);
        } else if (s?.error) {
          console.log(`  >>> Close failed: ${s.error} — retrying next cycle`);
          await new Promise(r => setTimeout(r, CHECK_INTERVAL_S * 1000));
          continue;
        } else {
          console.log(`  >>> Result: ${JSON.stringify(s)}`);
        }
        break;
      }
    } catch (err) {
      console.error(`  [${ts()}] Error: ${(err as Error).message}`);
    }

    await new Promise(r => setTimeout(r, CHECK_INTERVAL_S * 1000));
  }

  console.log(`\n  Guard stopped.\n`);
}

guard();
