/**
 * Content generators for @coincess X/Twitter account.
 *
 * Content categories:
 * 1. Market movers — top gainers/losers from Hyperliquid
 * 2. Strategy performance — how the bot fleet is doing
 * 3. Platform stats — Coincess volume, traders, etc.
 * 4. Educational threads — trading concepts, strategy explainers
 * 5. Alpha/signal — funding rates, liquidation levels, whale activity
 * 6. Engagement — polls, questions, hot takes
 */

const HL_API = "https://api.hyperliquid.xyz/info";

async function hlPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// 1. Market Movers
// ---------------------------------------------------------------------------

interface AssetCtx {
  dayNtlVlm: string;
  funding: string;
  markPx: string;
  prevDayPx: string;
}

export async function generateMarketMovers(): Promise<string> {
  const [meta] = await hlPost<[{ universe: { name: string }[] }, AssetCtx[]]>({
    type: "metaAndAssetCtxs",
  });

  const assets = meta.universe.map((u, i) => ({
    name: u.name,
    price: parseFloat((meta as unknown as { universe: { name: string }[] }).universe[i] ? "0" : "0"),
  }));

  // Re-fetch properly
  const data = await hlPost<[{ universe: { name: string }[] }, AssetCtx[]]>({
    type: "metaAndAssetCtxs",
  });

  const coins = data[0].universe.map((u, i) => {
    const ctx = data[1][i];
    const mark = parseFloat(ctx.markPx);
    const prev = parseFloat(ctx.prevDayPx);
    const change = prev > 0 ? ((mark - prev) / prev) * 100 : 0;
    const volume = parseFloat(ctx.dayNtlVlm);
    return { name: u.name, mark, change, volume, funding: parseFloat(ctx.funding) };
  });

  const sorted = [...coins].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const gainers = sorted.filter((c) => c.change > 0).slice(0, 3);
  const losers = sorted.filter((c) => c.change < 0).slice(0, 3);

  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  const fmtPrice = (n: number) =>
    n >= 1000 ? `$${n.toLocaleString("en", { maximumFractionDigits: 0 })}` :
    n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;

  const lines = [
    `Hyperliquid Market Movers\n`,
    ...gainers.map((c) => `${fmtPct(c.change)} $${c.name} ${fmtPrice(c.mark)}`),
    ``,
    ...losers.map((c) => `${fmtPct(c.change)} $${c.name} ${fmtPrice(c.mark)}`),
    `\ncoincess.com`,
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 2. Funding Rate Alpha
// ---------------------------------------------------------------------------

export async function generateFundingRateAlpha(): Promise<string> {
  const data = await hlPost<[{ universe: { name: string }[] }, AssetCtx[]]>({
    type: "metaAndAssetCtxs",
  });

  const coins = data[0].universe.map((u, i) => ({
    name: u.name,
    funding: parseFloat(data[1][i].funding),
    annualized: parseFloat(data[1][i].funding) * 24 * 365 * 100,
    volume: parseFloat(data[1][i].dayNtlVlm),
  }));

  const extreme = coins
    .filter((c) => c.volume > 1_000_000 && Math.abs(c.annualized) > 20)
    .sort((a, b) => Math.abs(b.annualized) - Math.abs(a.annualized))
    .slice(0, 5);

  if (extreme.length === 0) {
    return `Funding rates are calm across Hyperliquid today.\n\nNo extreme rates above 20% APR.\n\ncoincess.com`;
  }

  const lines = [
    `Funding Rate Alpha\n`,
    ...extreme.map((c) => {
      const dir = c.funding > 0 ? "longs pay" : "shorts pay";
      return `$${c.name}: ${c.annualized > 0 ? "+" : ""}${c.annualized.toFixed(0)}% APR (${dir})`;
    }),
    `\nCoincess auto-farms these rates.`,
    `coincess.com`,
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 3. Volume / Platform Stats
// ---------------------------------------------------------------------------

export async function generateVolumeUpdate(): Promise<string> {
  const data = await hlPost<[{ universe: { name: string }[] }, AssetCtx[]]>({
    type: "metaAndAssetCtxs",
  });

  let totalVol = 0;
  const topByVol = data[0].universe.map((u, i) => {
    const vol = parseFloat(data[1][i].dayNtlVlm);
    totalVol += vol;
    return { name: u.name, vol };
  }).sort((a, b) => b.vol - a.vol).slice(0, 5);

  const fmtVol = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    return `$${(n / 1e3).toFixed(0)}K`;
  };

  const lines = [
    `Hyperliquid 24h Volume: ${fmtVol(totalVol)}\n`,
    `Most traded:`,
    ...topByVol.map((c, i) => `${i + 1}. $${c.name} — ${fmtVol(c.vol)}`),
    `\nTrade these on Coincess with automated strategies.`,
    `\ncoincess.com`,
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 4. Educational Threads
// ---------------------------------------------------------------------------

const THREADS: string[][] = [
  [
    `How to farm funding rates on Hyperliquid (automated)\n\nA thread:`,
    `1/ Funding rates are paid hourly on Hyperliquid. When a rate is positive, longs pay shorts. When negative, shorts pay longs.\n\nThis creates a risk-free yield opportunity.`,
    `2/ The strategy: find coins with extreme funding rates, open the opposite position.\n\nIf funding is +0.1%/hr, go SHORT. You collect that rate every hour while hedging the price exposure.`,
    `3/ The trick: do this across 20+ markets simultaneously.\n\nDiversification smooths out any single position going against you. Aim for 1-3% daily.`,
    `4/ Risk: the price can move against your position faster than funding pays you.\n\nMitigation: strict position limits (max 5% per coin), daily loss limit (-5% kills all), focus on liquid pairs only.`,
    `5/ Coincess automates this entire strategy. Our funding rate harvester scans all 279 markets, finds the best rates, and executes automatically.\n\nNo manual monitoring needed.\n\ncoincess.com`,
  ],
  [
    `5 position management techniques every perp trader needs\n\nA thread:`,
    `1/ Limit Close\n\nDon't market close. Set a limit order at your target price. You pay maker fees (0.01%) instead of taker (0.035%).\n\nSaves $3.50 per $10K notional.`,
    `2/ Trailing Stop\n\nLock in profits as price moves in your favor. Set it at 0.5-1% from the peak.\n\nCaptures the trend without giving back gains.`,
    `3/ Reverse Position\n\nBullish turned bearish? Don't close and re-enter. Reverse in one action.\n\nSaves one set of fees and captures the move immediately.`,
    `4/ Scaled TP/SL\n\nDon't exit all at once. Close 50% at 2R, 25% at 3R, trail the rest.\n\nMaximizes expected value across different market scenarios.`,
    `5/ Time-Based Exits\n\nIf your thesis hasn't played out within your expected timeframe, close.\n\nOpportunity cost is real. Dead money = missed trades.\n\nAll of these are built into Coincess.\n\ncoincess.com`,
  ],
  [
    `Grid trading explained: how to profit in sideways markets\n\nA thread:`,
    `1/ Most trading strategies need a trend. Grid trading doesn't.\n\nIt profits from volatility itself — the more the price bounces, the more you make.`,
    `2/ How it works:\n- Pick a price range (e.g., BTC $95K-$105K)\n- Place buy orders below current price\n- Place sell orders above current price\n- When price bounces, orders fill and profit accumulates`,
    `3/ The math: if BTC oscillates 1% between grid levels, each level earns 1%.\n\nWith 20 grid levels, you're capturing 20 small profits per full oscillation.\n\nCompounding effect is powerful in ranging markets.`,
    `4/ Risks:\n- Breakout beyond your range = unrealized loss\n- Trending market = grid gets one-sided\n\nMitigation: use wider ranges, smaller position sizes, stop-loss on the grid itself.`,
    `5/ Coincess runs automated grid bots on Hyperliquid.\n\nSet your range, number of levels, and size — it handles the rest 24/7.\n\nPerfect for BTC and ETH during consolidation phases.\n\ncoincess.com`,
  ],
  [
    `Why 90% of traders lose money (and how to be in the 10%)\n\nA thread:`,
    `1/ Overleveraging\n\nNew traders use 20-50x leverage. One 2% move wipes them out.\n\nFix: start at 3-5x max. Your account survives long enough to learn.`,
    `2/ No edge, just gambling\n\nOpening positions based on "vibes" or Twitter hype isn't trading.\n\nFix: define your strategy BEFORE entering. What's the setup? What's the exit?`,
    `3/ Revenge trading\n\nLost money? Immediately open a bigger position to "make it back."\n\nFix: daily loss limit. If you're down 3%, stop trading for the day. No exceptions.`,
    `4/ Ignoring fees & funding\n\nThat "profitable" trade might be break-even after fees.\n\nOn Hyperliquid: 0.035% taker fee + hourly funding = significant drag on scalps.\n\nUse our leverage calculator to see true break-even: coincess.com/crypto-leverage-calculator`,
    `5/ Not tracking performance\n\nYou can't improve what you don't measure.\n\nFix: keep a trade journal. Review weekly. Coincess has a built-in journal + AI coach that analyzes your patterns.\n\ncoincess.com`,
  ],
];

export function getEducationalThread(): string[] {
  const idx = Math.floor(Math.random() * THREADS.length);
  return THREADS[idx];
}

// ---------------------------------------------------------------------------
// 5. Quick Takes / Engagement Posts
// ---------------------------------------------------------------------------

const ENGAGEMENT_POSTS = [
  `What's your go-to leverage on perps?\n\n1x-3x = Safe\n5x-10x = Moderate\n20x+ = Degen\n\nDrop your style below.`,
  `Unpopular opinion: most traders don't need more charts and indicators.\n\nThey need a journal, a daily loss limit, and the discipline to follow both.`,
  `Funding rates are the most underrated alpha in crypto.\n\nYou can literally get paid to hold a position.\n\ncoincess.com automates this.`,
  `The best trade is the one you don't take.\n\nOvertrading is the #1 account killer.`,
  `BTC consolidating. ETH consolidating.\n\nYou know what loves consolidation? Grid bots.\n\ncoincess.com`,
  `Copy trading is great for learning, terrible for risk management.\n\nAlways understand WHY someone took a position before you follow it.`,
  `Your trading journal is more valuable than any paid signal group.\n\nPatterns in YOUR behavior > patterns in the chart.`,
  `Name a coin you're bullish on for the next 30 days.\n\nI'll check back on this.`,
  `Stop looking at PnL every 5 minutes.\n\nSet your TP/SL and walk away. The market doesn't care that you're watching.`,
  `Automated trading > emotional trading.\n\nBots don't revenge trade. Bots don't FOMO. Bots don't hesitate.\n\ncoincess.com`,
  `What's your worst trading habit?\n\nMine was moving my stop loss further away when it was about to hit.`,
  `Hyperliquid has 279 perpetual markets including stocks, commodities, and forex.\n\nAll tradable from one interface. All on-chain.\n\ncoincess.com`,
];

export function getEngagementPost(): string {
  return ENGAGEMENT_POSTS[Math.floor(Math.random() * ENGAGEMENT_POSTS.length)];
}

// ---------------------------------------------------------------------------
// 6. Price Alert Posts
// ---------------------------------------------------------------------------

export async function generatePriceAlert(coin: string, threshold: number, direction: "above" | "below"): Promise<string | null> {
  const data = await hlPost<[{ universe: { name: string }[] }, AssetCtx[]]>({
    type: "metaAndAssetCtxs",
  });

  const idx = data[0].universe.findIndex((u) => u.name === coin);
  if (idx === -1) return null;

  const price = parseFloat(data[1][idx].markPx);
  const triggered = direction === "above" ? price > threshold : price < threshold;
  if (!triggered) return null;

  const fmtPrice = price >= 1000
    ? `$${price.toLocaleString("en", { maximumFractionDigits: 0 })}`
    : `$${price.toFixed(2)}`;

  return `$${coin} just broke ${direction} $${threshold.toLocaleString()}!\n\nCurrently trading at ${fmtPrice} on Hyperliquid.\n\ncoincess.com/trade/${coin}`;
}

// ---------------------------------------------------------------------------
// Content Scheduler — picks the right content for the time of day
// ---------------------------------------------------------------------------

export type ContentType = "market_movers" | "funding_alpha" | "volume" | "thread" | "engagement";

const SCHEDULE: Array<{ hour: number; type: ContentType }> = [
  { hour: 7, type: "market_movers" },    // Morning market overview
  { hour: 9, type: "engagement" },         // Morning engagement
  { hour: 11, type: "funding_alpha" },     // Mid-morning alpha
  { hour: 13, type: "engagement" },        // Lunch engagement
  { hour: 15, type: "volume" },            // Afternoon volume update
  { hour: 17, type: "thread" },            // Evening educational thread
  { hour: 19, type: "engagement" },        // Evening engagement
  { hour: 21, type: "market_movers" },     // Night market recap
];

export function getScheduledContentType(hourUTC: number): ContentType | null {
  const slot = SCHEDULE.find((s) => s.hour === hourUTC);
  return slot?.type ?? null;
}

export async function generateContent(type: ContentType): Promise<string | string[]> {
  switch (type) {
    case "market_movers":
      return generateMarketMovers();
    case "funding_alpha":
      return generateFundingRateAlpha();
    case "volume":
      return generateVolumeUpdate();
    case "thread":
      return getEducationalThread();
    case "engagement":
      return getEngagementPost();
  }
}
