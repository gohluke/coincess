import type { PositionInfo, MarketSnapshot, MarketBrief } from "../types";
import type { TechnicalSnapshot } from "../market-analysis";
import type { MarketMicrostructure } from "../market-microstructure";
import { getCurrentSession } from "../market-microstructure";

export interface RecentTradeResult {
  coin: string;
  side: "long" | "short";
  entryPx: number;
  exitPx: number;
  pnl: number;
  reason: string;
  closedAt: string;
}

function formatReturn(r: number): string {
  return `${r >= 0 ? "+" : ""}${(r * 100).toFixed(2)}%`;
}

function formatTechnical(t: TechnicalSnapshot, micro?: MarketMicrostructure): string {
  const lines = [
    `${t.coin}: $${t.markPx > 100 ? t.markPx.toFixed(2) : t.markPx.toFixed(4)}`,
    `  Returns: 1h=${formatReturn(t.return1h)} 4h=${formatReturn(t.return4h)} 24h=${formatReturn(t.return24h)}`,
    `  RSI(14)=${t.rsi14.toFixed(1)} | EMA9/21=${t.emaTrend} | MACD=${t.macdCross !== "none" ? t.macdCross + " CROSS" : t.macdHistogram > 0 ? "bullish" : "bearish"}`,
    `  BB: price ${t.bbPosition.replace("_", " ")} (${t.bbLower.toFixed(4)}-${t.bbUpper.toFixed(4)})`,
    `  ATR(14)=${t.atr14Pct > 0 ? (t.atr14Pct * 100).toFixed(2) : "N/A"}% | Vol change: ${formatReturn(t.volumeChange)}`,
    `  4h Trend: ${t.htfTrend} | Funding: ${(t.funding * 100).toFixed(4)}% | Vol24h: $${(t.volume24h / 1e6).toFixed(1)}M | OI: $${(t.openInterest / 1e6).toFixed(1)}M`,
  ];

  if (micro) {
    lines.push(
      `  ORDER BOOK: imbalance=${(micro.bookImbalance * 100).toFixed(0)}% (${micro.bookSignal}) | spread=${micro.spreadBps.toFixed(1)}bps`,
      `  FLOW: funding ${micro.fundingTrend} (Δ${(micro.fundingDelta1h * 100).toFixed(4)}%) | OI ${micro.oiTrend} (Δ${(micro.oiDelta1h * 100).toFixed(1)}%) | ${micro.smartMoneySignal}` +
        (micro.crowdedLong ? " ⚠ CROWDED LONG" : "") +
        (micro.crowdedShort ? " ⚠ CROWDED SHORT" : ""),
    );
  }

  return lines.join("\n");
}

export function buildAnalystPrompt(
  markets: MarketSnapshot[],
  positions: PositionInfo[],
  accountValue: number,
  technicals?: TechnicalSnapshot[],
  recentTrades?: RecentTradeResult[],
  microstructure?: MarketMicrostructure[],
): string {
  const perps = markets.filter((m) => m.dex === "perp" && !m.coin.startsWith("xyz:"));
  const stocks = markets.filter((m) => m.dex === "spot");
  const commodities = markets.filter((m) => m.coin.startsWith("xyz:"));

  const highFunding = perps
    .filter((m) => Math.abs(m.funding) > 0.0001)
    .sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding))
    .slice(0, 10);

  // Build microstructure lookup
  const microMap = new Map<string, MarketMicrostructure>();
  for (const m of microstructure ?? []) microMap.set(m.coin, m);

  const techSection = technicals && technicals.length > 0
    ? `### Technical Analysis + Order Flow (${technicals.length} coins)\n${technicals.map((t) => formatTechnical(t, microMap.get(t.coin))).join("\n\n")}`
    : `### Top Perpetuals by Volume\n${[...perps].sort((a, b) => b.volume24h - a.volume24h).slice(0, 30).map((m) => `${m.coin}: $${m.markPx.toFixed(m.markPx > 100 ? 2 : 4)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M | funding: ${(m.funding * 100).toFixed(4)}%`).join("\n")}`;

  const tradeHistorySection = recentTrades && recentTrades.length > 0
    ? `\n## Your Recent Trade History (learn from these)\n${recentTrades.map((t) => `${t.coin} ${t.side.toUpperCase()}: entry=$${t.entryPx.toFixed(4)} exit=$${t.exitPx.toFixed(4)} PnL=${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(4)} | ${t.reason} | ${t.closedAt}`).join("\n")}\n\nWin rate: ${recentTrades.length > 0 ? ((recentTrades.filter((t) => t.pnl > 0).length / recentTrades.length) * 100).toFixed(0) : "N/A"}% (${recentTrades.filter((t) => t.pnl > 0).length}W/${recentTrades.filter((t) => t.pnl <= 0).length}L)\nTotal PnL: ${recentTrades.reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : ""}$${recentTrades.reduce((s, t) => s + t.pnl, 0).toFixed(4)}\n\nReflect on what went right and wrong. Avoid repeating losing patterns.`
    : "";

  // Session awareness
  const session = getCurrentSession();

  // Crowded trade warnings
  const crowdedWarnings: string[] = [];
  for (const m of microstructure ?? []) {
    if (m.crowdedLong) crowdedWarnings.push(`${m.coin}: CROWDED LONG (high funding + rising OI — liquidation cascade risk)`);
    if (m.crowdedShort) crowdedWarnings.push(`${m.coin}: CROWDED SHORT (negative funding + rising OI — short squeeze risk)`);
  }

  return `You are an elite quantitative market analyst with access to institutional-grade data: technical indicators, order book depth, funding flow, and OI dynamics.

## Trading Session
${session.description} | Volatility bias: ${session.volatilityBias}
${session.volatilityBias === "low" ? "LOW VOLUME SESSION — be cautious of false breakouts, prefer range-bound strategies" : ""}
${session.volatilityBias === "high" ? "HIGH VOLUME SESSION — breakouts are more reliable, trend-following preferred" : ""}

## Current Account
- Account value: $${accountValue.toFixed(2)}
- Open positions: ${positions.length === 0 ? "None" : positions.map((p) => `${p.coin} ${p.szi > 0 ? "LONG" : "SHORT"} ${Math.abs(p.szi).toFixed(4)} @ $${p.entryPx.toFixed(2)} (uPnL: $${p.unrealizedPnl.toFixed(2)})`).join(", ")}
${tradeHistorySection}

## Market Data (${new Date().toISOString()})

${techSection}

### Extreme Funding Rates
${highFunding.map((m) => `${m.coin}: ${(m.funding * 100).toFixed(4)}% (${m.funding > 0 ? "longs pay shorts" : "shorts pay longs"})`).join("\n") || "No extreme funding rates"}

${crowdedWarnings.length > 0 ? `### CROWDED TRADE ALERTS\n${crowdedWarnings.join("\n")}` : ""}

### HIP-3 Stocks (${stocks.length} available)
${stocks.map((m) => `${m.coin}: $${m.markPx.toFixed(2)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M`).join("\n") || "None loaded"}

### Commodities
${commodities.map((m) => `${m.coin.replace("xyz:", "")}: $${m.markPx.toFixed(2)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M | funding: ${(m.funding * 100).toFixed(4)}%`).join("\n") || "None loaded"}

## Scoring Rubric (weight each factor)
| Factor | Weight | Bullish Signal | Bearish Signal |
|--------|--------|---------------|----------------|
| 4h Trend | 25% | UP | DOWN |
| EMA9/21 | 15% | Bullish crossover | Bearish crossover |
| RSI(14) | 15% | <30 oversold | >70 overbought |
| MACD | 10% | Bullish cross | Bearish cross |
| Order Book | 15% | strong_buy/buy | strong_sell/sell |
| Funding Flow | 10% | Smart money accumulation | Smart money distribution |
| Volume | 10% | Above average + confirming | Below average = suspect |

TOTAL SCORE: Sum weighted signals. Only report opportunities scoring >= 60/100.

## Crowded Trade Rules (CRITICAL)
- If "CROWDED LONG" → the coin is vulnerable to a long liquidation cascade. Avoid longs, consider short.
- If "CROWDED SHORT" → the coin is vulnerable to a short squeeze. Avoid shorts, consider long.
- These override technical signals because liquidation cascades are the strongest force in crypto.

## Instructions
Respond with JSON:
{
  "regime": "trending" | "ranging" | "volatile" | "quiet",
  "topOpportunities": [
    {
      "coin": string,
      "market": "perp" | "spot" | "stock" | "commodity",
      "direction": "long" | "short" | "neutral",
      "strength": number (0-100, from scoring rubric),
      "reasons": string[],
      "keyLevels": { "support": number, "resistance": number }
    }
  ],
  "warnings": string[]
}

Rules:
- Score MUST come from the rubric above, not vibes
- Only include opportunities scoring >= 60
- Max 5 opportunities, ranked by score
- Each reason MUST cite a specific data point (e.g., "Book imbalance +35% buy pressure", "RSI=28 oversold")
- Include crowded trade warnings in warnings array
- If no setups score >= 60, return EMPTY topOpportunities — capital preservation is a valid strategy`;
}

export function buildTraderPrompt(
  brief: MarketBrief,
  positions: PositionInfo[],
  accountValue: number,
  capitalBudget: number,
  maxPositions: number,
  defaultLeverage: number,
  stopLossPct: number,
  recentTrades?: RecentTradeResult[],
): string {
  const positionsText = positions.length === 0
    ? "No open positions"
    : positions.map((p) => {
        const side = p.szi > 0 ? "LONG" : "SHORT";
        const notional = Math.abs(p.szi * p.entryPx);
        return `${p.coin} ${side} | size: ${Math.abs(p.szi).toFixed(4)} | entry: $${p.entryPx.toFixed(2)} | uPnL: $${p.unrealizedPnl.toFixed(2)} | notional: $${notional.toFixed(2)} | leverage: ${p.leverage}x`;
      }).join("\n");

  const tradeHistorySection = recentTrades && recentTrades.length > 0
    ? `\n## Your Recent Trade Performance\nWin rate: ${((recentTrades.filter((t) => t.pnl > 0).length / recentTrades.length) * 100).toFixed(0)}% | Total PnL: $${recentTrades.reduce((s, t) => s + t.pnl, 0).toFixed(4)}\n${recentTrades.slice(0, 5).map((t) => `${t.pnl >= 0 ? "WIN" : "LOSS"} ${t.coin} ${t.side}: $${t.pnl.toFixed(4)} — ${t.reason}`).join("\n")}\n\nDo NOT repeat losing patterns. If you've been wrong on a coin/direction, skip it or reverse.`
    : "";

  const session = getCurrentSession();

  return `You are an autonomous AI trader executing REAL trades on Hyperliquid. Every action = real money.

## Session: ${session.description} (volatility: ${session.volatilityBias})

## Account State
- Total account value: $${accountValue.toFixed(2)}
- Capital budget for AI: $${capitalBudget.toFixed(2)} (${((capitalBudget / accountValue) * 100).toFixed(0)}% of account)
- Remaining budget: $${(capitalBudget - positions.reduce((s, p) => s + Math.abs(p.szi * p.entryPx), 0)).toFixed(2)}
- Max simultaneous positions: ${maxPositions}
- Current positions: ${positions.length}/${maxPositions}
- Default leverage: ${defaultLeverage}x (perps only)
- Mandatory stop loss: ${(stopLossPct * 100).toFixed(1)}%
${tradeHistorySection}

## Open Positions
${positionsText}

## Market Analysis (from analyst with order book + flow data)
Regime: ${brief.regime}
${brief.warnings.length > 0 ? `Warnings: ${brief.warnings.join("; ")}` : ""}

### Opportunities (scored with weighted rubric)
${brief.topOpportunities.map((o, i) => `${i + 1}. ${o.coin} (${o.market}) — ${o.direction} — score ${o.strength}/100
   Reasons: ${o.reasons.join(", ")}
   Support: $${o.keyLevels.support} | Resistance: $${o.keyLevels.resistance}`).join("\n\n")}

## Instructions
Respond with JSON:
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
      "reasoning": string (REQUIRED: cite indicator values + order flow data)
    }
  ],
  "portfolioReasoning": string
}

RULES:
1. **Data-backed reasoning** — cite RSI, MACD, book imbalance, funding flow. No vibes.
2. **Evaluate every open position** — hold/close/adjust each one
3. **Cut losers immediately** — broken thesis = close. No averaging down.
4. **Take profits at resistance** — use analyst's key levels
5. **1 great trade > 5 mediocre ones** — minimum confidence 0.75 to open
6. ONLY trade coins from the opportunities list
7. sizeUsd must not exceed remaining budget
8. For "close"/"hold" actions: sizeUsd=0, stopLoss=0, takeProfit=0
9. Stop loss MANDATORY: use support level or ${(stopLossPct * 100).toFixed(1)}% default
10. Take profit: use resistance level
11. If session is LOW VOLATILITY: prefer tighter targets and smaller sizes
12. If any warnings mention "CROWDED" — respect the liquidation risk
13. If no setups pass the bar, return ONLY hold/close actions`;
}
