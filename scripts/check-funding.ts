import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { MAINNET_API_URL } from "@nktkas/hyperliquid";

const HL_API = MAINNET_API_URL + "/info";

async function main() {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
  });
  const data = await res.json();
  const meta = data[0]?.universe || [];
  const ctxs = data[1] || [];

  for (let i = 0; i < meta.length; i++) {
    if (meta[i].name.toUpperCase() === "BRENTOIL") {
      const ctx = ctxs[i];
      const markPx = parseFloat(ctx.markPx);
      const oraclePx = parseFloat(ctx.oraclePx);
      const funding = parseFloat(ctx.funding);
      const openInterest = parseFloat(ctx.openInterest);
      const volume = parseFloat(ctx.dayNtlVlm || "0");
      const premium = parseFloat(ctx.premium || "0");
      const hourlyRate = funding;
      const annualRate = hourlyRate * 24 * 365 * 100;

      console.log("\n  === BRENTOIL Funding Analysis ===\n");
      console.log(`  Mark Price:     $${markPx.toFixed(2)}`);
      console.log(`  Oracle Price:   $${oraclePx.toFixed(2)}`);
      console.log(`  Premium:        ${(premium * 100).toFixed(4)}%`);
      console.log(`  Hourly Funding: ${(hourlyRate * 100).toFixed(4)}%`);
      console.log(`  Daily Funding:  ${(hourlyRate * 24 * 100).toFixed(4)}%`);
      console.log(`  Annual Rate:    ${annualRate.toFixed(1)}%`);
      console.log(`  Open Interest:  ${openInterest.toFixed(2)} contracts`);
      console.log(`  24h Volume:     $${volume.toLocaleString()}`);
      console.log();

      if (hourlyRate > 0) {
        console.log(`  >>> LONGS PAY ${(hourlyRate * 100).toFixed(4)}%/hr to shorts`);
        const dailyCostPer100 = hourlyRate * 24 * 100;
        console.log(`  >>> Cost to hold $100 long: ~$${dailyCostPer100.toFixed(2)}/day`);
      } else {
        console.log(`  >>> SHORTS PAY ${(Math.abs(hourlyRate) * 100).toFixed(4)}%/hr to longs`);
        console.log(`  >>> You'd EARN funding by going long!`);
      }
      break;
    }
  }

  const ACCOUNT = process.env.HL_ACCOUNT_ADDRESS!;
  const mainRes = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: ACCOUNT }),
  });
  const mainAcct = await mainRes.json();
  const mainVal = parseFloat(mainAcct.marginSummary?.accountValue || "0");
  const mainAvail = parseFloat(mainAcct.withdrawable || "0");

  const xyzRes = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: ACCOUNT, dex: "xyz" }),
  });
  const xyzAcct = await xyzRes.json();
  const xyzVal = parseFloat(xyzAcct.marginSummary?.accountValue || "0");

  console.log(`  === Account Balances ===`);
  console.log(`  Main Perps: $${mainVal.toFixed(2)} (available: $${mainAvail.toFixed(2)})`);
  console.log(`  HIP-3 (xyz): $${xyzVal.toFixed(2)}`);
  console.log(`  Total: $${(mainVal + xyzVal).toFixed(2)}`);
  console.log();
}
main();
