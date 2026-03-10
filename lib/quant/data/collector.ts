/**
 * Market Data Collector
 *
 * Continuously collects 5-minute candles from Hyperliquid and stores them
 * in Supabase. Supports both perps and HIP-3 spot markets.
 *
 * Two modes:
 * - backfill(coin, days): Fetch historical candles for a coin
 * - run(): Continuous collection loop (call alongside QuantEngine)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const HL_API = "https://api.hyperliquid.xyz";
const COLLECT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 500; // Max candles per API call
const MAX_BACKFILL_DAYS = 90;

interface RawCandle {
  T: number; c: string; h: string; i: string; l: string;
  n: number; o: string; s: string; t: number; v: string;
}

interface CandleRow {
  coin: string;
  interval: string;
  open_time: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  dex: string;
}

export class DataCollector {
  private supabase: SupabaseClient;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private coins: string[] = [];
  private hip3Coins: Map<string, string> = new Map(); // display name -> @N pair name

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials");
    this.supabase = createClient(url, key);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log("[collector] Starting data collection...");

    await this.discoverMarkets();
    await this.collect();

    this.timer = setInterval(() => {
      this.collect().catch((err) =>
        console.error("[collector] Collection error:", err),
      );
    }, COLLECT_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[collector] Stopped.");
  }

  /** Discover all available markets from Hyperliquid */
  private async discoverMarkets(): Promise<void> {
    const [metaRes, spotMetaRes] = await Promise.all([
      fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
      }),
      fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "spotMeta" }),
      }),
    ]);

    const meta = (await metaRes.json()) as { universe: Array<{ name: string }> };
    // Top 50 perps by convention (most liquid)
    const perpCoins = meta.universe.slice(0, 50).map((u) => u.name);

    const spotMeta = (await spotMetaRes.json()) as {
      tokens: Array<{ index: number; name: string }>;
      universe: Array<{ name: string; index: number; tokens: number[] }>;
    };

    const HIP3_NAMES = new Set([
      "TSLA", "NVDA", "GOOGL", "AAPL", "HOOD", "MSTR", "SPY", "AMZN",
      "META", "QQQ", "MSFT", "ORCL", "AVGO", "GLD", "MU", "SLV",
    ]);
    const idxToName: Record<number, string> = {};
    for (const t of spotMeta.tokens) idxToName[t.index] = t.name;
    for (const pair of spotMeta.universe) {
      if (!pair.tokens?.length) continue;
      const name = idxToName[pair.tokens[0]];
      if (name && HIP3_NAMES.has(name)) {
        this.hip3Coins.set(name, pair.name); // TSLA -> @264
      }
    }

    this.coins = [...perpCoins, ...Array.from(this.hip3Coins.keys())];
    console.log(
      `[collector] Tracking ${perpCoins.length} perps + ${this.hip3Coins.size} HIP-3 stocks = ${this.coins.length} total`,
    );
  }

  /** Collect latest candles for all tracked coins */
  private async collect(): Promise<void> {
    const now = Date.now();
    const startTime = now - COLLECT_INTERVAL_MS * 2; // overlap to avoid gaps
    let total = 0;

    // Process in batches of 10 concurrent fetches
    for (let i = 0; i < this.coins.length; i += 10) {
      const batch = this.coins.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map((coin) => this.fetchAndStore(coin, "5m", startTime, now)),
      );
      for (const r of results) {
        if (r.status === "fulfilled") total += r.value;
      }
    }

    if (total > 0) {
      console.log(`[collector] Stored ${total} new candles for ${this.coins.length} markets`);
    }
  }

  /** Fetch candles from HL and upsert into Supabase */
  private async fetchAndStore(
    coin: string,
    interval: string,
    startTime: number,
    endTime: number,
  ): Promise<number> {
    const candleCoin = this.hip3Coins.get(coin) ?? coin;
    const isSpot = this.hip3Coins.has(coin);

    const res = await fetch(`${HL_API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: { coin: candleCoin, interval, startTime, endTime },
      }),
    });
    const candles = (await res.json()) as RawCandle[];
    if (!candles?.length) return 0;

    const rows: CandleRow[] = candles.map((c) => ({
      coin,
      interval,
      open_time: c.t,
      o: parseFloat(c.o),
      h: parseFloat(c.h),
      l: parseFloat(c.l),
      c: parseFloat(c.c),
      v: parseFloat(c.v),
      n: c.n,
      dex: isSpot ? "spot" : "perp",
    }));

    const { error } = await this.supabase
      .from("market_candles")
      .upsert(rows, { onConflict: "coin,interval,open_time" });

    if (error) {
      console.error(`[collector] Upsert error for ${coin}:`, error.message);
      return 0;
    }

    // Update collection state
    const lastTime = Math.max(...candles.map((c) => c.t));
    await this.supabase
      .from("data_collection_state")
      .upsert({
        coin,
        interval,
        last_collected_at: lastTime,
        total_candles: rows.length,
      }, { onConflict: "coin,interval" });

    return rows.length;
  }

  /** Backfill historical candles for a specific coin */
  async backfill(coin: string, days = 30, interval = "5m"): Promise<number> {
    const safeDays = Math.min(days, MAX_BACKFILL_DAYS);
    const now = Date.now();
    const startTime = now - safeDays * 24 * 60 * 60 * 1000;
    const intervalMs = interval === "1m" ? 60_000
      : interval === "5m" ? 300_000
      : interval === "15m" ? 900_000
      : interval === "1h" ? 3_600_000
      : 300_000;

    console.log(`[collector] Backfilling ${coin} ${interval} for ${safeDays} days...`);

    let totalStored = 0;
    let cursor = startTime;

    while (cursor < now) {
      const chunkEnd = Math.min(cursor + intervalMs * BATCH_SIZE, now);
      const stored = await this.fetchAndStore(coin, interval, cursor, chunkEnd);
      totalStored += stored;
      cursor = chunkEnd;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`[collector] Backfilled ${totalStored} candles for ${coin}`);
    return totalStored;
  }

  /** Backfill all tracked coins */
  async backfillAll(days = 30, interval = "5m"): Promise<void> {
    if (!this.coins.length) await this.discoverMarkets();

    console.log(`[collector] Backfilling ${this.coins.length} coins for ${days} days...`);
    for (const coin of this.coins) {
      await this.backfill(coin, days, interval);
    }
    console.log("[collector] Backfill complete.");
  }

  /** Get stored candles from Supabase */
  async getCandles(
    coin: string,
    interval: string,
    startTime: number,
    endTime: number,
  ): Promise<CandleRow[]> {
    const { data, error } = await this.supabase
      .from("market_candles")
      .select("*")
      .eq("coin", coin)
      .eq("interval", interval)
      .gte("open_time", startTime)
      .lte("open_time", endTime)
      .order("open_time", { ascending: true });

    if (error) throw new Error(`Query error: ${error.message}`);
    return (data ?? []) as CandleRow[];
  }

  /** Get all available coins in the database */
  async getAvailableCoins(): Promise<string[]> {
    const { data } = await this.supabase
      .from("data_collection_state")
      .select("coin")
      .order("coin");
    return (data ?? []).map((r: { coin: string }) => r.coin);
  }
}
