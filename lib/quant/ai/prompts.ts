import type { PositionInfo, MarketSnapshot, MarketBrief } from "../types";

export function buildAnalystPrompt(
  markets: MarketSnapshot[],
  positions: PositionInfo[],
  accountValue: number,
): string {
  const perps = markets.filter((m) => m.dex === "perp" && !m.coin.startsWith("xyz:"));
  const stocks = markets.filter((m) => m.dex === "spot");
  const commodities = markets.filter((m) => m.coin.startsWith("xyz:"));

  const top30byVol = [...perps]
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 30);
  const highFunding = perps
    .filter((m) => Math.abs(m.funding) > 0.0001)
    .sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding))
    .slice(0, 10);

  return `You are a quantitative market analyst for a crypto/stocks/commodities trading system on Hyperliquid.

Your job: scan all available markets and identify the TOP 5-10 trading opportunities right now. You do NOT place trades — you only analyze.

## Current Account
- Account value: $${accountValue.toFixed(2)}
- Open positions: ${positions.length === 0 ? "None" : positions.map((p) => `${p.coin} ${p.szi > 0 ? "LONG" : "SHORT"} ${Math.abs(p.szi).toFixed(4)} @ $${p.entryPx.toFixed(2)} (uPnL: $${p.unrealizedPnl.toFixed(2)})`).join(", ")}

## Market Data (${new Date().toISOString()})

### Top 30 Perpetuals by Volume
${top30byVol.map((m) => `${m.coin}: $${m.markPx.toFixed(m.markPx > 100 ? 2 : 4)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M | funding: ${(m.funding * 100).toFixed(4)}% | OI: $${(m.openInterest / 1e6).toFixed(1)}M`).join("\n")}

### Extreme Funding Rates
${highFunding.map((m) => `${m.coin}: ${(m.funding * 100).toFixed(4)}% (${m.funding > 0 ? "longs pay shorts" : "shorts pay longs"})`).join("\n") || "No extreme funding rates"}

### HIP-3 Stocks (${stocks.length} available)
${stocks.map((m) => `${m.coin}: $${m.markPx.toFixed(2)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M`).join("\n") || "None loaded"}

### Commodities
${commodities.map((m) => `${m.coin.replace("xyz:", "")}: $${m.markPx.toFixed(2)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M | funding: ${(m.funding * 100).toFixed(4)}%`).join("\n") || "None loaded"}

## Instructions
Respond with a JSON object matching this exact schema (no markdown, no explanation outside JSON):
{
  "regime": "trending" | "ranging" | "volatile" | "quiet",
  "topOpportunities": [
    {
      "coin": string,
      "market": "perp" | "spot" | "stock" | "commodity",
      "direction": "long" | "short" | "neutral",
      "strength": number (0-100),
      "reasons": string[],
      "keyLevels": { "support": number, "resistance": number }
    }
  ],
  "warnings": string[]
}

Rules:
- Only include opportunities with strength >= 40
- Max 10 opportunities, ranked by strength descending
- For funding plays: extreme positive funding → short opportunity, extreme negative → long
- For stocks: consider after-hours moves, sector momentum
- For commodities: consider macro trends, supply/demand
- Be concise in reasons (max 10 words each)
- Key levels should be realistic support/resistance based on recent price action`;
}

export function buildTraderPrompt(
  brief: MarketBrief,
  positions: PositionInfo[],
  accountValue: number,
  capitalBudget: number,
  maxPositions: number,
  defaultLeverage: number,
  stopLossPct: number,
): string {
  const positionsText = positions.length === 0
    ? "No open positions"
    : positions.map((p) => {
        const side = p.szi > 0 ? "LONG" : "SHORT";
        const notional = Math.abs(p.szi * p.entryPx);
        return `${p.coin} ${side} | size: ${Math.abs(p.szi).toFixed(4)} | entry: $${p.entryPx.toFixed(2)} | uPnL: $${p.unrealizedPnl.toFixed(2)} | notional: $${notional.toFixed(2)} | leverage: ${p.leverage}x`;
      }).join("\n");

  return `You are an autonomous AI trader making real trades on Hyperliquid. Every action you output WILL be executed with real money.

## Account State
- Total account value: $${accountValue.toFixed(2)}
- Capital budget for AI: $${capitalBudget.toFixed(2)} (${((capitalBudget / accountValue) * 100).toFixed(0)}% of account)
- Remaining budget: $${(capitalBudget - positions.reduce((s, p) => s + Math.abs(p.szi * p.entryPx), 0)).toFixed(2)}
- Max simultaneous positions: ${maxPositions}
- Current positions: ${positions.length}/${maxPositions}
- Default leverage: ${defaultLeverage}x (perps only)
- Mandatory stop loss: ${(stopLossPct * 100).toFixed(1)}%

## Open Positions
${positionsText}

## Market Analysis (from analyst)
Regime: ${brief.regime}
${brief.warnings.length > 0 ? `Warnings: ${brief.warnings.join("; ")}` : ""}

### Opportunities
${brief.topOpportunities.map((o, i) => `${i + 1}. ${o.coin} (${o.market}) — ${o.direction} — strength ${o.strength}/100
   Reasons: ${o.reasons.join(", ")}
   Support: $${o.keyLevels.support} | Resistance: $${o.keyLevels.resistance}`).join("\n\n")}

## Instructions
Decide what to do. You MUST evaluate every open position AND consider new opportunities.

Respond with JSON matching this exact schema:
{
  "actions": [
    {
      "action": "open" | "close" | "adjust" | "hold",
      "coin": string,
      "side": "long" | "short",
      "sizeUsd": number,
      "confidence": number (0.0-1.0),
      "stopLoss": number (price),
      "takeProfit": number (price),
      "reasoning": string (REQUIRED: 1-2 sentences explaining WHY)
    }
  ],
  "portfolioReasoning": string (1-3 sentences explaining overall strategy)
}

CRITICAL RULES:
1. **Reasoning is MANDATORY** for every action — explain WHY you are opening, closing, holding, or adjusting. Never leave reasoning empty.
2. **Evaluate every open position** — for each open position, include either a "hold" (with reason to keep it), "close" (with reason to exit), or "adjust" action. Do NOT ignore open positions.
3. **Close with conviction** — if a position has moved against you beyond the stop level, or the thesis has changed, close it immediately with clear reasoning.
4. **Take profits** — if a position has hit the take-profit target or shows signs of reversal, close it. Explain the exit reasoning.
5. ONLY trade coins from the opportunities list
6. sizeUsd must not exceed remaining budget
7. For "close" actions: set sizeUsd to 0, stopLoss to 0, takeProfit to 0
8. For "hold" actions: set sizeUsd to 0, stopLoss to 0, takeProfit to 0
9. Stop loss is MANDATORY for open/adjust: use the ${(stopLossPct * 100).toFixed(1)}% default unless you have a strong technical reason for a different level
10. Confidence must reflect genuine probability of profit
11. Do NOT open a position just because an opportunity exists — only trade high-conviction setups
12. If no good new trades exist, return only hold/close actions for existing positions
13. Consider portfolio correlation: avoid overexposure to a single sector
14. Be decisive but conservative with sizing`;
}
