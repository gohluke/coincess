import type { PositionInfo, MarketSnapshot, MarketBrief } from "../types";
import type { TechnicalSnapshot } from "../market-analysis";

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

function formatTechnical(t: TechnicalSnapshot): string {
  return [
    `${t.coin}: $${t.markPx > 100 ? t.markPx.toFixed(2) : t.markPx.toFixed(4)}`,
    `  Returns: 1h=${formatReturn(t.return1h)} 4h=${formatReturn(t.return4h)} 24h=${formatReturn(t.return24h)}`,
    `  RSI(14)=${t.rsi14.toFixed(1)} | EMA9/21=${t.emaTrend} | MACD=${t.macdCross !== "none" ? t.macdCross + " CROSS" : t.macdHistogram > 0 ? "bullish" : "bearish"}`,
    `  BB: price ${t.bbPosition.replace("_", " ")} (${t.bbLower.toFixed(4)}-${t.bbUpper.toFixed(4)})`,
    `  ATR(14)=${t.atr14Pct > 0 ? (t.atr14Pct * 100).toFixed(2) : "N/A"}% | Vol change: ${formatReturn(t.volumeChange)}`,
    `  4h Trend: ${t.htfTrend} | Funding: ${(t.funding * 100).toFixed(4)}% | Vol24h: $${(t.volume24h / 1e6).toFixed(1)}M | OI: $${(t.openInterest / 1e6).toFixed(1)}M`,
  ].join("\n");
}

export function buildAnalystPrompt(
  markets: MarketSnapshot[],
  positions: PositionInfo[],
  accountValue: number,
  technicals?: TechnicalSnapshot[],
  recentTrades?: RecentTradeResult[],
): string {
  const perps = markets.filter((m) => m.dex === "perp" && !m.coin.startsWith("xyz:"));
  const stocks = markets.filter((m) => m.dex === "spot");
  const commodities = markets.filter((m) => m.coin.startsWith("xyz:"));

  const highFunding = perps
    .filter((m) => Math.abs(m.funding) > 0.0001)
    .sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding))
    .slice(0, 10);

  // Use technical snapshots if available, otherwise fall back to basic data
  const techSection = technicals && technicals.length > 0
    ? `### Technical Analysis (${technicals.length} coins with full indicators)\n${technicals.map(formatTechnical).join("\n\n")}`
    : `### Top Perpetuals by Volume\n${[...perps].sort((a, b) => b.volume24h - a.volume24h).slice(0, 30).map((m) => `${m.coin}: $${m.markPx.toFixed(m.markPx > 100 ? 2 : 4)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M | funding: ${(m.funding * 100).toFixed(4)}%`).join("\n")}`;

  const tradeHistorySection = recentTrades && recentTrades.length > 0
    ? `\n## Your Recent Trade History (learn from these)\n${recentTrades.map((t) => `${t.coin} ${t.side.toUpperCase()}: entry=$${t.entryPx.toFixed(4)} exit=$${t.exitPx.toFixed(4)} PnL=${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(4)} | ${t.reason} | ${t.closedAt}`).join("\n")}\n\nWin rate: ${recentTrades.length > 0 ? ((recentTrades.filter((t) => t.pnl > 0).length / recentTrades.length) * 100).toFixed(0) : "N/A"}% (${recentTrades.filter((t) => t.pnl > 0).length}W/${recentTrades.filter((t) => t.pnl <= 0).length}L)\nTotal PnL: ${recentTrades.reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : ""}$${recentTrades.reduce((s, t) => s + t.pnl, 0).toFixed(4)}\n\nReflect on what went right and wrong. Avoid repeating losing patterns.`
    : "";

  return `You are an elite quantitative market analyst. You have REAL technical indicator data — use it to make data-driven decisions, not guesses.

## Current Account
- Account value: $${accountValue.toFixed(2)}
- Open positions: ${positions.length === 0 ? "None" : positions.map((p) => `${p.coin} ${p.szi > 0 ? "LONG" : "SHORT"} ${Math.abs(p.szi).toFixed(4)} @ $${p.entryPx.toFixed(2)} (uPnL: $${p.unrealizedPnl.toFixed(2)})`).join(", ")}
${tradeHistorySection}

## Market Data (${new Date().toISOString()})

${techSection}

### Extreme Funding Rates
${highFunding.map((m) => `${m.coin}: ${(m.funding * 100).toFixed(4)}% (${m.funding > 0 ? "longs pay shorts" : "shorts pay longs"})`).join("\n") || "No extreme funding rates"}

### HIP-3 Stocks (${stocks.length} available)
${stocks.map((m) => `${m.coin}: $${m.markPx.toFixed(2)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M`).join("\n") || "None loaded"}

### Commodities
${commodities.map((m) => `${m.coin.replace("xyz:", "")}: $${m.markPx.toFixed(2)} | vol24h: $${(m.volume24h / 1e6).toFixed(1)}M | funding: ${(m.funding * 100).toFixed(4)}%`).join("\n") || "None loaded"}

## Decision Framework (USE THIS)
1. **Trend alignment**: Only go long if 4h trend is UP + EMA trend is bullish. Only short if 4h trend is DOWN + EMA bearish.
2. **RSI extremes**: RSI < 30 = oversold (potential long). RSI > 70 = overbought (potential short). RSI 40-60 = no strong signal.
3. **MACD crossovers**: Bullish cross = buy signal. Bearish cross = sell signal. Histogram direction matters.
4. **Bollinger Band position**: Price below lower band = potential reversal long. Above upper band = potential reversal short. 
5. **Volume confirmation**: High volume confirms moves. Low volume = fake out risk.
6. **Funding arbitrage**: Extreme positive funding (>0.01%/hr) + other bearish signals = strong short. Vice versa.
7. **Multi-timeframe confluence**: Only trade when 5m + 4h agree on direction.

## Instructions
Respond with JSON:
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
- Only include opportunities with MULTI-TIMEFRAME CONFLUENCE and strength >= 60
- Max 5 opportunities, ranked by strength descending (quality over quantity)
- Each reason MUST reference a specific indicator value (e.g., "RSI=28 oversold bounce", not "looks good")
- Key levels = Bollinger Band boundaries or EMA values as support/resistance
- If no strong setups exist, return EMPTY topOpportunities — do NOT force trades`;
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

  return `You are an autonomous AI trader executing REAL trades on Hyperliquid. Every action = real money.

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

## Market Analysis (from analyst)
Regime: ${brief.regime}
${brief.warnings.length > 0 ? `Warnings: ${brief.warnings.join("; ")}` : ""}

### Opportunities (pre-screened with technical indicators)
${brief.topOpportunities.map((o, i) => `${i + 1}. ${o.coin} (${o.market}) — ${o.direction} — strength ${o.strength}/100
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
      "reasoning": string (REQUIRED: 1-2 sentences explaining WHY with indicator values)
    }
  ],
  "portfolioReasoning": string
}

CRITICAL RULES:
1. **Reasoning with DATA** — cite specific indicator values. "RSI=72 overbought + bearish MACD cross" not "price looks high"
2. **Evaluate every open position** — hold, close, or adjust each one
3. **Close losers fast** — if thesis is broken or past SL level, close immediately
4. **Take profits** — hit TP or showing reversal signals? Close it
5. **Quality over quantity** — 1 high-conviction trade beats 5 mediocre ones
6. ONLY trade coins from the opportunities list
7. sizeUsd must not exceed remaining budget
8. For "close"/"hold" actions: sizeUsd=0, stopLoss=0, takeProfit=0
9. Stop loss MANDATORY for open: use support level from analyst or ${(stopLossPct * 100).toFixed(1)}% default
10. Take profit: use resistance level from analyst
11. Confidence = genuine probability estimate (0.5 = coin flip, don't trade below 0.7)
12. If no high-conviction setups exist, ONLY hold/close — do NOT force new trades
13. Minimum confidence 0.7 to open a new trade
14. Consider portfolio correlation: don't be all-in on one sector`;
}
