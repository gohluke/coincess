import type {
  AllMids,
  Candle,
  CandleInterval,
  ClearinghouseState,
  L2Book,
  MetaAndAssetCtxs,
  OpenOrder,
  Fill,
  FundingPayment,
  MarketInfo,
  SpotClearinghouseState,
} from "./types";

const API_URL = "https://api.hyperliquid.xyz";

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchMetaAndAssetCtxs(dex?: string): Promise<MetaAndAssetCtxs> {
  const body: Record<string, unknown> = { type: "metaAndAssetCtxs" };
  if (dex) body.dex = dex;
  const [meta, assetCtxs] = await post<[MetaAndAssetCtxs["meta"], MetaAndAssetCtxs["assetCtxs"]]>(
    "/info",
    body,
  );
  return { meta, assetCtxs };
}

export async function fetchAllMids(): Promise<AllMids> {
  return post<AllMids>("/info", { type: "allMids" });
}

export async function fetchL2Book(coin: string, nSigFigs?: number): Promise<L2Book> {
  const body: Record<string, unknown> = { type: "l2Book", coin };
  if (nSigFigs) body.nSigFigs = nSigFigs;
  return post<L2Book>("/info", body);
}

export async function fetchCandles(
  coin: string,
  interval: CandleInterval,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  return post<Candle[]>("/info", {
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime },
  });
}

export async function fetchClearinghouseState(user: string, dex?: string): Promise<ClearinghouseState> {
  const body: Record<string, unknown> = { type: "clearinghouseState", user };
  if (dex) body.dex = dex;
  return post<ClearinghouseState>("/info", body);
}

export async function fetchSpotClearinghouseState(user: string): Promise<SpotClearinghouseState> {
  return post<SpotClearinghouseState>("/info", { type: "spotClearinghouseState", user });
}

export async function fetchCombinedClearinghouseState(user: string): Promise<ClearinghouseState> {
  const [main, xyz] = await Promise.all([
    fetchClearinghouseState(user).catch(() => null),
    fetchClearinghouseState(user, "xyz").catch(() => null),
  ]);

  if (!main && !xyz) {
    return {
      marginSummary: { accountValue: "0", totalMarginUsed: "0", totalNtlPos: "0", totalRawUsd: "0" },
      crossMarginSummary: { accountValue: "0", totalMarginUsed: "0", totalNtlPos: "0", totalRawUsd: "0" },
      crossMaintenanceMarginUsed: "0",
      withdrawable: "0",
      assetPositions: [],
      time: Date.now(),
    };
  }

  if (!main) return xyz!;
  if (!xyz) return main;

  const mainVal = parseFloat(main.marginSummary.accountValue || "0");
  const mainMargin = parseFloat(main.marginSummary.totalMarginUsed || "0");
  const xyzMargin = parseFloat(xyz.marginSummary.totalMarginUsed || "0");

  // In unified mode both dexes share the same USDC collateral.
  // main.accountValue = shared_USDC + main_unrealizedPnl, so it already
  // contains the full backing. We only add xyz positions' unrealized PnL
  // to avoid double-counting the USDC base.
  const xyzUPnl = xyz.assetPositions.reduce(
    (sum, ap) => sum + parseFloat(ap.position.unrealizedPnl || "0"), 0,
  );

  return {
    marginSummary: {
      accountValue: (mainVal + xyzUPnl).toString(),
      totalMarginUsed: (mainMargin + xyzMargin).toString(),
      totalNtlPos: main.marginSummary.totalNtlPos,
      totalRawUsd: main.marginSummary.totalRawUsd,
    },
    crossMarginSummary: main.crossMarginSummary,
    crossMaintenanceMarginUsed: main.crossMaintenanceMarginUsed,
    withdrawable: main.withdrawable,
    assetPositions: [...main.assetPositions, ...xyz.assetPositions],
    time: main.time,
  };
}

export async function fetchOpenOrders(user: string): Promise<OpenOrder[]> {
  const [main, xyz] = await Promise.all([
    post<OpenOrder[]>("/info", { type: "frontendOpenOrders", user }).catch(() => []),
    post<OpenOrder[]>("/info", { type: "frontendOpenOrders", user, dex: "xyz" }).catch(() => []),
  ]);
  return [...main, ...xyz];
}

export async function fetchUserFills(user: string): Promise<Fill[]> {
  const [main, xyz] = await Promise.all([
    post<Fill[]>("/info", { type: "userFills", user }).catch(() => []),
    post<Fill[]>("/info", { type: "userFills", user, dex: "xyz" }).catch(() => []),
  ]);
  const seen = new Set<number>();
  const deduped: Fill[] = [];
  for (const f of [...main, ...xyz]) {
    if (!seen.has(f.tid)) {
      seen.add(f.tid);
      deduped.push(f);
    }
  }
  return deduped;
}

export interface LedgerUpdate {
  time: number;
  delta: {
    type: string;
    usdc?: string;
    amount?: string;
    fee?: string;
    [key: string]: unknown;
  };
}

export async function fetchUserLedger(user: string): Promise<LedgerUpdate[]> {
  return post<LedgerUpdate[]>("/info", { type: "userNonFundingLedgerUpdates", user });
}

export async function fetchUserFunding(user: string, startTime = 0, endTime = 9999999999999): Promise<FundingPayment[]> {
  const [main, xyz] = await Promise.all([
    post<FundingPayment[]>("/info", { type: "userFunding", user, startTime, endTime }).catch(() => []),
    post<FundingPayment[]>("/info", { type: "userFunding", user, startTime, endTime, dex: "xyz" }).catch(() => []),
  ]);
  return [...main, ...xyz];
}

export async function fetchUserAbstraction(user: string): Promise<string | null> {
  try {
    const data = await post<{ abstraction?: string }>("/info", { type: "userAbstraction", user });
    return data?.abstraction ?? null;
  } catch {
    return null;
  }
}

export async function fetchReferralState(user: string): Promise<{ builderFeeApprovals?: Record<string, string> }> {
  try {
    return await post<{ builderFeeApprovals?: Record<string, string> }>("/info", { type: "referral", user });
  } catch {
    return {};
  }
}

function stripDexPrefix(name: string): string {
  const parts = name.split(":");
  return parts.length > 1 ? parts[1] : name;
}

const HIP3_DISPLAY_NAMES: Record<string, string> = {
  "CL": "Crude Oil WTI",
  "BRENTOIL": "Brent Oil",
  "GOLD": "Gold",
  "SILVER": "Silver",
  "COPPER": "Copper",
  "NATGAS": "Natural Gas",
  "URANIUM": "Uranium",
  "ALUMINIUM": "Aluminium",
  "PLATINUM": "Platinum",
  "PALLADIUM": "Palladium",
  "JPY": "USD/JPY",
  "EUR": "EUR/USD",
  "DXY": "US Dollar Index",
  "JP225": "Nikkei 225",
  "KR200": "KOSPI 200",
  "USAR": "US Aerospace ETF",
  "URNM": "Uranium Miners ETF",
  "EWY": "South Korea ETF",
  "EWJ": "Japan ETF",
  "SKHX": "SK Hynix",
  "SMSN": "Samsung",
  "CRWV": "CoreWeave",
  "CRCL": "Circle",
  "SNDK": "Sandisk/WD",
};

// Builder-deployed perp dexes use offset asset indices (Python SDK convention).
// Main dex: offset 0. Builder dexes: 110000 + (perpDexIndex - 1) * 10000.
// perpDexs response: [null, {name:"xyz",...}, {name:"flx",...}, ...]
// "xyz" is at index 1 → offset = 110000
const PERP_DEX_OFFSETS: Record<string, number> = {};
let perpDexOffsetsLoaded = false;

async function loadPerpDexOffsets(): Promise<void> {
  if (perpDexOffsetsLoaded) return;
  try {
    const dexs = await post<(null | { name: string })[]>("/info", { type: "perpDexs" });
    for (let i = 1; i < dexs.length; i++) {
      const d = dexs[i];
      if (d?.name) {
        PERP_DEX_OFFSETS[d.name] = 110000 + (i - 1) * 10000;
      }
    }
    perpDexOffsetsLoaded = true;
  } catch (err) {
    console.error("Failed to load perp dex offsets:", err);
  }
}

export function buildMarketList(data: MetaAndAssetCtxs, dex: string = ""): MarketInfo[] {
  const offset = dex ? (PERP_DEX_OFFSETS[dex] ?? 0) : 0;

  return data.meta.universe.map((asset, i) => {
    const ctx = data.assetCtxs[i];
    const coin = asset.name;
    const short = stripDexPrefix(coin);
    const display = HIP3_DISPLAY_NAMES[short] || short;

    return {
      name: coin,
      displayName: display,
      assetIndex: i + offset,
      szDecimals: asset.szDecimals,
      maxLeverage: asset.maxLeverage,
      markPx: ctx?.markPx ?? "0",
      midPx: ctx?.midPx ?? null,
      oraclePx: ctx?.oraclePx ?? "0",
      funding: ctx?.funding ?? "0",
      openInterest: ctx?.openInterest ?? "0",
      prevDayPx: ctx?.prevDayPx ?? "0",
      dayNtlVlm: ctx?.dayNtlVlm ?? "0",
      premium: ctx?.premium ?? "0",
      dex,
    };
  });
}

export interface LeaderboardEntry {
  ethAddress: string;
  accountValue: string;
  displayName: string | null;
  windowPerformances: [string, { pnl: string; roi: string; vlm: string }][];
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch("https://stats-data.hyperliquid.xyz/Mainnet/leaderboard");
  if (!res.ok) throw new Error(`Leaderboard fetch error: ${res.status}`);
  const data = (await res.json()) as { leaderboardRows: LeaderboardEntry[] };
  return data.leaderboardRows;
}

const HIP3_STOCK_NAMES = new Set([
  "TSLA", "NVDA", "GOOGL", "AAPL", "HOOD", "MSTR", "SPY", "AMZN",
  "META", "QQQ", "MSFT", "ORCL", "AVGO", "GLD", "MU", "SLV",
  "SPACEX", "OPENAI", "INTC", "NFLX",
]);

const HIP3_STOCK_DISPLAY: Record<string, string> = {
  TSLA: "Tesla", NVDA: "NVIDIA", GOOGL: "Alphabet", AAPL: "Apple",
  HOOD: "Robinhood", MSTR: "MicroStrategy", SPY: "S&P 500 ETF",
  AMZN: "Amazon", META: "Meta Platforms", QQQ: "Nasdaq 100 ETF",
  MSFT: "Microsoft", ORCL: "Oracle", AVGO: "Broadcom", GLD: "Gold ETF",
  MU: "Micron", SLV: "Silver ETF", SPACEX: "SpaceX", OPENAI: "OpenAI",
  INTC: "Intel", NFLX: "Netflix",
};

interface SpotMetaResponse {
  tokens: Array<{ index: number; name: string; szDecimals: number }>;
  universe: Array<{ name: string; index: number; tokens: number[] }>;
}
type SpotCtxsResponse = Array<{ markPx?: string; dayNtlVlm?: string; prevDayPx?: string }>;

let cachedSpotMeta: [SpotMetaResponse, SpotCtxsResponse] | null = null;

async function loadSpotMeta(): Promise<[SpotMetaResponse, SpotCtxsResponse]> {
  if (cachedSpotMeta) return cachedSpotMeta;
  cachedSpotMeta = await post<[SpotMetaResponse, SpotCtxsResponse]>("/info", { type: "spotMetaAndAssetCtxs" });
  return cachedSpotMeta;
}

// Spot pair name (e.g. "PURR/USDC", "@1") → coin identifier used by WS/API
const spotPairNameMap = new Map<string, string>();

export function getSpotPairName(marketName: string): string | undefined {
  return spotPairNameMap.get(marketName);
}

async function fetchHip3SpotStocks(allMids: AllMids): Promise<MarketInfo[]> {
  try {
    const [spotMeta, spotCtxs] = await loadSpotMeta();

    const idxToName: Record<number, string> = {};
    const idxToDecimals: Record<number, number> = {};
    for (const t of spotMeta.tokens) {
      idxToName[t.index] = t.name;
      idxToDecimals[t.index] = t.szDecimals;
    }

    const markets: MarketInfo[] = [];
    for (let i = 0; i < spotMeta.universe.length; i++) {
      const pair = spotMeta.universe[i];
      if (!pair.tokens || pair.tokens.length < 2) continue;
      const baseName = idxToName[pair.tokens[0]];
      if (!baseName || !HIP3_STOCK_NAMES.has(baseName)) continue;

      const pairName = pair.name;
      const midPx = allMids[pairName] ?? "0";
      if (parseFloat(midPx) <= 0) continue;

      const ctx = spotCtxs[i];
      spotPairNameMap.set(baseName, pairName);
      markets.push({
        name: baseName,
        displayName: HIP3_STOCK_DISPLAY[baseName] ?? baseName,
        assetIndex: 10000 + pair.index,
        szDecimals: idxToDecimals[pair.tokens[0]] ?? 4,
        maxLeverage: 1,
        markPx: midPx,
        midPx,
        oraclePx: midPx,
        funding: "0",
        openInterest: "0",
        prevDayPx: ctx?.prevDayPx ?? midPx,
        dayNtlVlm: ctx?.dayNtlVlm ?? "0",
        premium: "0",
        dex: "hip3",
      });
    }
    return markets;
  } catch (err) {
    console.error("[api] HIP-3 spot stock fetch failed:", err);
    return [];
  }
}

// Hyperliquid uses wrapped token names internally; map to familiar symbols
const SPOT_DISPLAY_NAME: Record<string, string> = {
  UBTC: "BTC", UETH: "ETH", USOL: "SOL", USDH: "USDH",
  USDT0: "USDT", USDE: "USDE", LINK0: "LINK", XAUT0: "XAUT",
};

function spotDisplayName(raw: string): string {
  return SPOT_DISPLAY_NAME[raw] ?? raw;
}

async function fetchSpotMarkets(allMids: AllMids): Promise<MarketInfo[]> {
  try {
    const [spotMeta, spotCtxs] = await loadSpotMeta();

    const idxToName: Record<number, string> = {};
    const idxToDecimals: Record<number, number> = {};
    let usdcTokenIdx = -1;
    for (const t of spotMeta.tokens) {
      idxToName[t.index] = t.name;
      idxToDecimals[t.index] = t.szDecimals;
      if (t.name === "USDC") usdcTokenIdx = t.index;
    }

    const markets: MarketInfo[] = [];
    for (let i = 0; i < spotMeta.universe.length; i++) {
      const pair = spotMeta.universe[i];
      if (!pair.tokens || pair.tokens.length < 2) continue;
      const baseName = idxToName[pair.tokens[0]];
      if (!baseName) continue;
      if (HIP3_STOCK_NAMES.has(baseName)) continue;
      // Only include USDC-quoted pairs to avoid duplicates (USDT0, USDH, USDE)
      if (usdcTokenIdx >= 0 && pair.tokens[1] !== usdcTokenIdx) continue;

      const pairName = pair.name;
      const midPx = allMids[pairName] ?? "0";
      if (parseFloat(midPx) <= 0) continue;

      const ctx = spotCtxs[i];
      const spotMarketName = `spot:${baseName}`;
      spotPairNameMap.set(spotMarketName, pairName);
      markets.push({
        name: spotMarketName,
        displayName: spotDisplayName(baseName),
        assetIndex: 10000 + pair.index,
        szDecimals: idxToDecimals[pair.tokens[0]] ?? 4,
        maxLeverage: 1,
        markPx: midPx,
        midPx,
        oraclePx: midPx,
        funding: "0",
        openInterest: "0",
        prevDayPx: ctx?.prevDayPx ?? midPx,
        dayNtlVlm: ctx?.dayNtlVlm ?? "0",
        premium: "0",
        dex: "spot",
      });
    }
    return markets;
  } catch (err) {
    console.error("[api] Spot markets fetch failed:", err);
    return [];
  }
}

export interface CoincessTraderStats {
  address: string;
  displayName: string | null;
  volume24h: number;
  volume7d: number;
  volumeAll: number;
  coincessVolume: number;
  pnl24h: number;
  pnl7d: number;
  pnlAll: number;
  tradeCount: number;
  coincessTradeCount: number;
  accountValue: number;
  topCoin: string | null;
  firstTrade: number | null;
}

/**
 * @param trackedVolumes - optional map of address -> { coincessVolume, coincessTradeCount }
 * from the Supabase coincess_traders table. When provided, the leaderboard
 * shows Coincess-only volume instead of all-Hyperliquid volume.
 */
export async function fetchCoincessTraderStats(
  addresses: string[],
  leaderboard?: LeaderboardEntry[],
  trackedVolumes?: Map<string, { coincessVolume: number; coincessTradeCount: number }>,
): Promise<CoincessTraderStats[]> {
  if (addresses.length === 0) return [];

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const results = await Promise.allSettled(
    addresses.map(async (addr): Promise<CoincessTraderStats> => {
      const [fills, ch] = await Promise.all([
        fetchUserFills(addr).catch(() => [] as Fill[]),
        fetchCombinedClearinghouseState(addr).catch(() => null),
      ]);

      let vol24h = 0, vol7d = 0, volAll = 0;
      let pnl24h = 0, pnl7d = 0, pnlAll = 0;
      let firstTrade: number | null = null;
      const coinVolume: Record<string, number> = {};

      for (const f of fills) {
        const ntl = parseFloat(f.px) * parseFloat(f.sz);
        const pnl = parseFloat(f.closedPnl);
        const age = now - f.time;

        volAll += ntl;
        pnlAll += pnl;
        if (age <= DAY) { vol24h += ntl; pnl24h += pnl; }
        if (age <= 7 * DAY) { vol7d += ntl; pnl7d += pnl; }

        const coin = f.coin.includes(":") ? f.coin.split(":")[1] : f.coin;
        coinVolume[coin] = (coinVolume[coin] ?? 0) + ntl;

        if (!firstTrade || f.time < firstTrade) firstTrade = f.time;
      }

      const topCoin = Object.entries(coinVolume)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const lbEntry = leaderboard?.find(
        (e) => e.ethAddress.toLowerCase() === addr.toLowerCase(),
      );

      const av = ch ? parseFloat(ch.marginSummary.accountValue) : 0;

      const tracked = trackedVolumes?.get(addr.toLowerCase());

      return {
        address: addr,
        displayName: lbEntry?.displayName ?? null,
        volume24h: vol24h,
        volume7d: vol7d,
        volumeAll: volAll,
        coincessVolume: tracked?.coincessVolume ?? 0,
        pnl24h: pnl24h,
        pnl7d: pnl7d,
        pnlAll: pnlAll,
        tradeCount: fills.length,
        coincessTradeCount: tracked?.coincessTradeCount ?? 0,
        accountValue: av,
        topCoin,
        firstTrade,
      };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<CoincessTraderStats> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function fetchAllMarkets(): Promise<MarketInfo[]> {
  await loadPerpDexOffsets();
  cachedSpotMeta = null;

  const [mainData, xyzData, allMids] = await Promise.all([
    fetchMetaAndAssetCtxs(),
    fetchMetaAndAssetCtxs("xyz"),
    fetchAllMids(),
  ]);

  const mainMarkets = buildMarketList(mainData, "");
  const xyzMarkets = buildMarketList(xyzData, "xyz");
  const [hip3Markets, spotMarkets] = await Promise.all([
    fetchHip3SpotStocks(allMids),
    fetchSpotMarkets(allMids),
  ]);

  return [...mainMarkets, ...xyzMarkets, ...hip3Markets, ...spotMarkets];
}
