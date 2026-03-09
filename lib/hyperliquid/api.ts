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
  const xyzVal = parseFloat(xyz.marginSummary.accountValue || "0");
  const mainMargin = parseFloat(main.marginSummary.totalMarginUsed || "0");
  const xyzMargin = parseFloat(xyz.marginSummary.totalMarginUsed || "0");
  const mainWithdrawable = parseFloat(main.withdrawable || "0");
  const xyzWithdrawable = parseFloat(xyz.withdrawable || "0");

  return {
    marginSummary: {
      accountValue: (mainVal + xyzVal).toString(),
      totalMarginUsed: (mainMargin + xyzMargin).toString(),
      totalNtlPos: main.marginSummary.totalNtlPos,
      totalRawUsd: main.marginSummary.totalRawUsd,
    },
    crossMarginSummary: main.crossMarginSummary,
    crossMaintenanceMarginUsed: main.crossMaintenanceMarginUsed,
    withdrawable: (mainWithdrawable + xyzWithdrawable).toString(),
    assetPositions: [...main.assetPositions, ...xyz.assetPositions],
    time: main.time,
  };
}

export async function fetchOpenOrders(user: string): Promise<OpenOrder[]> {
  return post<OpenOrder[]>("/info", { type: "frontendOpenOrders", user });
}

export async function fetchUserFills(user: string): Promise<Fill[]> {
  return post<Fill[]>("/info", { type: "userFills", user });
}

export async function fetchUserFunding(user: string, startTime = 0, endTime = 9999999999999): Promise<FundingPayment[]> {
  return post<FundingPayment[]>("/info", { type: "userFunding", user, startTime, endTime });
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

export async function fetchAllMarkets(): Promise<MarketInfo[]> {
  await loadPerpDexOffsets();

  const [mainData, xyzData] = await Promise.all([
    fetchMetaAndAssetCtxs(),
    fetchMetaAndAssetCtxs("xyz"),
  ]);

  const mainMarkets = buildMarketList(mainData, "");
  const xyzMarkets = buildMarketList(xyzData, "xyz");

  return [...mainMarkets, ...xyzMarkets];
}
