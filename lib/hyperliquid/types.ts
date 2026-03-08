export interface AssetInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

export interface AssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string | null;
  impactPxs: [string, string] | null;
}

export interface Meta {
  universe: AssetInfo[];
}

export interface MetaAndAssetCtxs {
  meta: Meta;
  assetCtxs: AssetCtx[];
}

export type AllMids = Record<string, string>;

export interface L2Level {
  px: string;
  sz: string;
  n: number;
}

export interface L2Book {
  coin: string;
  time: number;
  levels: [L2Level[], L2Level[]]; // [bids, asks]
}

export interface Candle {
  T: number; // close time
  c: string; // close
  h: string; // high
  i: string; // interval
  l: string; // low
  n: number; // num trades
  o: string; // open
  s: string; // symbol
  t: number; // open time
  v: string; // volume
}

export interface Position {
  coin: string;
  entryPx: string | null;
  leverage: { type: string; value: number; rawUsd?: string };
  liquidationPx: string | null;
  marginUsed: string;
  maxLeverage: number;
  positionValue: string;
  returnOnEquity: string;
  szi: string; // signed size (negative = short)
  unrealizedPnl: string;
  cumFunding: { allTime: string; sinceOpen: string; sinceChange: string };
}

export interface AssetPosition {
  type: string;
  position: Position;
}

export interface MarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface ClearinghouseState {
  marginSummary: MarginSummary;
  crossMarginSummary: MarginSummary;
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: AssetPosition[];
  time: number;
}

export interface OpenOrder {
  coin: string;
  isPositionTpsl: boolean;
  isTrigger: boolean;
  limitPx: string;
  oid: number;
  orderType: string;
  origSz: string;
  reduceOnly: boolean;
  side: "A" | "B"; // A = sell/ask, B = buy/bid
  sz: string;
  timestamp: number;
  triggerCondition: string;
  triggerPx: string;
}

export interface Fill {
  closedPnl: string;
  coin: string;
  crossed: boolean;
  dir: string;
  hash: string;
  oid: number;
  px: string;
  side: "A" | "B";
  startPosition: string;
  sz: string;
  time: number;
  fee: string;
  feeToken: string;
  tid: number;
}

export interface WsTrade {
  coin: string;
  side: "A" | "B";
  px: string;
  sz: string;
  hash: string;
  time: number;
  tid: number;
}

export interface MarketInfo {
  name: string;
  displayName: string;
  assetIndex: number;
  szDecimals: number;
  maxLeverage: number;
  markPx: string;
  midPx: string | null;
  oraclePx: string;
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  dex: string; // "" for main perps, "xyz" for HIP-3
}

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type TimeInForce = "Gtc" | "Ioc" | "Alo";
export type CandleInterval =
  | "1m" | "3m" | "5m" | "15m" | "30m"
  | "1h" | "2h" | "4h" | "8h" | "12h"
  | "1d" | "3d" | "1w" | "1M";
