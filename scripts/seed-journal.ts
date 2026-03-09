import "dotenv/config";

const API_BASE = process.env.SEED_API_BASE || "http://localhost:3000";
const WALLET = (process.env.HL_ACCOUNT_ADDRESS || "0x635b3b453de75e873a02b4898f615c5e8909070a").toLowerCase();

const BRENTOIL_ENTRY = {
  wallet_address: WALLET,
  title: "BRENTOIL Blowup Analysis — Lessons from losing it all",
  content: `## What Happened

Took a series of aggressive BRENTOIL trades without proper risk management. Started with a short, then panic-flipped to long, then back to short, then long again — each time the market moved against me. Lost the entire account over ~6 trades.

## The Trades (Chronological)

1. **Short @ ~$73.3** — market dropped, but I didn't take profit. Got stopped out when it reversed.
2. **Long @ ~$72.8** — revenge trade right after the loss. Market kept dropping. Closed for a loss.
3. **Short @ ~$72.5** — flipped again trying to "catch" the direction. Small loss.
4. **Long @ ~$72.1** — again flipped, trying to "buy the dip." Wrong again.
5. **Short @ ~$72.0** — another flip. At this point was trading on pure tilt.
6. **Long @ ~$71.8** — final trade, total capitulation.

## Root Cause Analysis

### 1. No Stop Losses
Every single trade was held hoping it would come back. Never set a hard stop. This turned small losses into account-ending losses.

### 2. Revenge Trading
After the first loss, immediately jumped back in trying to "make it back." Classic tilt behavior. Should have walked away after the first or second loss.

### 3. Fighting the Trend
Price was clearly in a downtrend (lower highs, lower lows), but kept going long "because it's cheap now." That's not a strategy, that's denial.

### 4. Panic Flipping
Constantly switching direction instead of waiting for a clear setup. Each flip realized the loss from the previous position AND entered a new high-risk position.

### 5. Concentration Risk
100% of exposure in a single illiquid asset (BRENTOIL). No diversification. One bad run wipes everything.

## 5 Rules to Not Blow Up Again

### Rule 1: Always Use Stop Losses
Risk max 2-3% of account per trade. Set a hard stop at entry. If the market moves 2% against you, exit automatically. No "I'll just hold a bit longer."

### Rule 2: Fixed Position Sizing
Never risk more than 5% of account on a single trade. If account is $100, max position risk is $5. This means sizing position + leverage so that the stop-loss distance equals your max risk.

### Rule 3: No Revenge Trading
After 2 consecutive losses on the same asset, take a MINIMUM 4-hour break. After 3 losses total in a day, stop for the day. The market will be there tomorrow.

### Rule 4: Trade With the Trend
If price is making lower highs and lower lows → SHORT or STAY OUT.
If price is making higher highs and higher lows → LONG or STAY OUT.
Never counter-trend trade with leverage. Period.

### Rule 5: Daily Loss Limit
If down 10% of account in a day, STOP TRADING. No exceptions. Close all positions. Walk away. Come back tomorrow with a clear head.

## Key Takeaway

The $70 lost wasn't from "bad luck" — it was from violating every basic risk management principle. The market didn't cause this blowup. Emotional decision-making did. Following these 5 rules would have limited the damage to $2-3 max on the first trade.`,
  tags: ["brentoil", "no-stop-loss", "revenge-trading", "overleverage", "lesson", "loss", "rules"],
  pnl_amount: -70.53,
  coin: "BRENTOIL",
  mood: "learning" as const,
};

async function main() {
  console.log(`Seeding journal entry for wallet: ${WALLET}`);
  console.log(`API base: ${API_BASE}`);

  const res = await fetch(`${API_BASE}/api/journal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(BRENTOIL_ENTRY),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to seed (${res.status}):`, err);
    process.exit(1);
  }

  const data = await res.json();
  console.log("Seeded journal entry:", data.id);
  console.log("Title:", data.title);
}

main();
