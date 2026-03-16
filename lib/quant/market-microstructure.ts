/**
 * Market Microstructure Module
 *
 * Tracks order book imbalance, funding rate deltas, and OI changes
 * over time. These are leading indicators that professional quant
 * desks use but most retail traders ignore.
 *
 * 1. Order Book Imbalance — bid/ask size ratio from L2 data
 * 2. Funding Rate Delta — change in funding rate over past N ticks
 * 3. OI Delta — change in open interest (new money entering/leaving)
 * 4. Crowded Trade Detection — high funding + rising OI = danger
 */

const HL_API = "https://api.hyperliquid.xyz";

export interface OrderBookImbalance {
  coin: string;
  bidSize: number;   // total bid volume in top N levels
  askSize: number;   // total ask volume in top N levels
  imbalance: number; // (bid - ask) / (bid + ask), range [-1, 1]
  signal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  spreadBps: number; // bid-ask spread in basis points
}

export interface FundingOiSnapshot {
  coin: string;
  funding: number;
  openInterest: number;
  timestamp: number;
}

export interface MarketMicrostructure {
  coin: string;
  // Order book
  bookImbalance: number;       // [-1, 1]
  bookSignal: string;          // "strong_buy" to "strong_sell"
  spreadBps: number;

  // Funding rate delta
  fundingNow: number;
  fundingDelta1h: number;      // change in funding over ~1h
  fundingTrend: "rising" | "falling" | "stable";

  // OI delta
  oiNow: number;
  oiDelta1h: number;           // % change in OI over ~1h
  oiTrend: "rising" | "falling" | "stable";

  // Composite signals
  crowdedLong: boolean;        // high positive funding + rising OI = danger for longs
  crowdedShort: boolean;       // high negative funding + rising OI = danger for shorts
  smartMoneySignal: "accumulation" | "distribution" | "neutral";
}

// In-memory funding/OI history (ring buffer per coin)
const fundingOiHistory: Map<string, FundingOiSnapshot[]> = new Map();
const HISTORY_MAX_SAMPLES = 120; // ~1h at 30s ticks
const HISTORY_LOOKBACK_MS = 60 * 60 * 1000; // 1 hour

/**
 * Record current funding and OI snapshot for delta tracking.
 * Called every engine tick.
 */
export function recordFundingOi(
  coin: string,
  funding: number,
  openInterest: number,
): void {
  let history = fundingOiHistory.get(coin);
  if (!history) {
    history = [];
    fundingOiHistory.set(coin, history);
  }
  history.push({ coin, funding, openInterest, timestamp: Date.now() });
  if (history.length > HISTORY_MAX_SAMPLES) {
    history.splice(0, history.length - HISTORY_MAX_SAMPLES);
  }
}

/**
 * Get funding rate delta and OI delta over the past ~1h.
 */
function getFundingOiDelta(coin: string): {
  fundingDelta: number;
  fundingTrend: "rising" | "falling" | "stable";
  oiDelta: number;
  oiTrend: "rising" | "falling" | "stable";
} {
  const history = fundingOiHistory.get(coin);
  if (!history || history.length < 5) {
    return { fundingDelta: 0, fundingTrend: "stable", oiDelta: 0, oiTrend: "stable" };
  }

  const now = Date.now();
  const cutoff = now - HISTORY_LOOKBACK_MS;
  const oldSample = history.find((s) => s.timestamp >= cutoff) ?? history[0];
  const newSample = history[history.length - 1];

  const fundingDelta = newSample.funding - oldSample.funding;
  const fundingTrend: "rising" | "falling" | "stable" =
    fundingDelta > 0.00005 ? "rising" : fundingDelta < -0.00005 ? "falling" : "stable";

  const oiDelta = oldSample.openInterest > 0
    ? (newSample.openInterest - oldSample.openInterest) / oldSample.openInterest
    : 0;
  const oiTrend: "rising" | "falling" | "stable" =
    oiDelta > 0.01 ? "rising" : oiDelta < -0.01 ? "falling" : "stable";

  return { fundingDelta, fundingTrend, oiDelta, oiTrend };
}

/**
 * Fetch L2 order book for a coin and compute imbalance.
 * Uses top 5 levels on each side.
 */
async function fetchOrderBookImbalance(coin: string): Promise<OrderBookImbalance | null> {
  try {
    const res = await fetch(`${HL_API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "l2Book",
        coin,
      }),
    });
    const data = (await res.json()) as {
      levels: [
        Array<{ px: string; sz: string; n: number }>, // bids
        Array<{ px: string; sz: string; n: number }>, // asks
      ];
    };

    if (!data.levels || data.levels.length < 2) return null;

    const [bids, asks] = data.levels;
    const topN = 5;

    let bidSize = 0;
    let askSize = 0;
    for (let i = 0; i < Math.min(topN, bids.length); i++) {
      bidSize += parseFloat(bids[i].sz);
    }
    for (let i = 0; i < Math.min(topN, asks.length); i++) {
      askSize += parseFloat(asks[i].sz);
    }

    const total = bidSize + askSize;
    const imbalance = total > 0 ? (bidSize - askSize) / total : 0;

    let signal: OrderBookImbalance["signal"] = "neutral";
    if (imbalance > 0.3) signal = "strong_buy";
    else if (imbalance > 0.1) signal = "buy";
    else if (imbalance < -0.3) signal = "strong_sell";
    else if (imbalance < -0.1) signal = "sell";

    // Spread in basis points
    const bestBid = bids.length > 0 ? parseFloat(bids[0].px) : 0;
    const bestAsk = asks.length > 0 ? parseFloat(asks[0].px) : 0;
    const mid = (bestBid + bestAsk) / 2;
    const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10_000 : 0;

    return { coin, bidSize, askSize, imbalance, signal, spreadBps };
  } catch {
    return null;
  }
}

/**
 * Build full microstructure snapshot for a set of coins.
 * Fetches L2 books in parallel (batched) and combines with funding/OI deltas.
 */
export async function buildMicrostructure(
  coins: Array<{ coin: string; funding: number; openInterest: number }>,
): Promise<MarketMicrostructure[]> {
  const results: MarketMicrostructure[] = [];

  // Fetch L2 books in parallel, batched
  const BATCH_SIZE = 5;
  for (let i = 0; i < coins.length; i += BATCH_SIZE) {
    const batch = coins.slice(i, i + BATCH_SIZE);
    const bookResults = await Promise.all(
      batch.map((c) => fetchOrderBookImbalance(c.coin)),
    );

    for (let j = 0; j < batch.length; j++) {
      const { coin, funding, openInterest } = batch[j];
      const book = bookResults[j];
      const delta = getFundingOiDelta(coin);

      const crowdedLong = funding > 0.0001 && delta.oiTrend === "rising";
      const crowdedShort = funding < -0.0001 && delta.oiTrend === "rising";

      // Smart money heuristic:
      // OI rising + price dropping = smart money accumulating shorts (distribution)
      // OI rising + price rising = smart money accumulating longs (accumulation)
      // OI falling = positions being closed (neutral)
      let smartMoneySignal: MarketMicrostructure["smartMoneySignal"] = "neutral";
      if (delta.oiTrend === "rising" && delta.fundingTrend === "rising") {
        smartMoneySignal = "accumulation"; // longs opening
      } else if (delta.oiTrend === "rising" && delta.fundingTrend === "falling") {
        smartMoneySignal = "distribution"; // shorts opening
      }

      results.push({
        coin,
        bookImbalance: book?.imbalance ?? 0,
        bookSignal: book?.signal ?? "neutral",
        spreadBps: book?.spreadBps ?? 0,
        fundingNow: funding,
        fundingDelta1h: delta.fundingDelta,
        fundingTrend: delta.fundingTrend,
        oiNow: openInterest,
        oiDelta1h: delta.oiDelta,
        oiTrend: delta.oiTrend,
        crowdedLong,
        crowdedShort,
        smartMoneySignal,
      });
    }
  }

  return results;
}

/**
 * Get the current trading session based on UTC time.
 */
export function getCurrentSession(): {
  session: "asian" | "european" | "us" | "overlap_eu_us" | "quiet";
  description: string;
  volatilityBias: "low" | "medium" | "high";
} {
  const hour = new Date().getUTCHours();

  if (hour >= 0 && hour < 7) {
    return { session: "asian", description: "Asian session (low volume, range-bound)", volatilityBias: "low" };
  }
  if (hour >= 7 && hour < 12) {
    return { session: "european", description: "European session (increasing volume)", volatilityBias: "medium" };
  }
  if (hour >= 12 && hour < 16) {
    return { session: "overlap_eu_us", description: "EU/US overlap (highest volume, most volatile)", volatilityBias: "high" };
  }
  if (hour >= 16 && hour < 21) {
    return { session: "us", description: "US session (high volume)", volatilityBias: "high" };
  }
  return { session: "quiet", description: "Post-US quiet period (low volume)", volatilityBias: "low" };
}
