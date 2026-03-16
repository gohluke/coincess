export type StrategyType = "funding_rate" | "momentum" | "grid" | "mean_reversion" | "market_maker" | "ai_agent" | "spike_reversion" | "rebate_farmer";
export type StrategyStatus = "active" | "paused" | "stopped" | "error";
export type EngineStatus = "running" | "stopped" | "paused" | "error";
export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "closed" | "cancelled";

export interface StrategyConfig {
  maxPositionPct: number;
  maxLeverage: number;
  coins?: string[];
  [key: string]: unknown;
}

export interface QuantStrategy {
  id: string;
  type: StrategyType;
  status: StrategyStatus;
  config: StrategyConfig;
  wallet_address: string;
  error_message: string | null;
  total_trades: number;
  total_pnl: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuantTrade {
  id: string;
  strategy_id: string | null;
  strategy_type: string;
  coin: string;
  side: TradeSide;
  size: number;
  entry_px: number;
  exit_px: number | null;
  pnl: number | null;
  fees: number;
  status: TradeStatus;
  oid: number | null;
  meta: Record<string, unknown>;
  opened_at: string;
  closed_at: string | null;
}

export interface QuantState {
  id: number;
  engine_status: EngineStatus;
  daily_pnl: number;
  daily_pnl_reset_at: string;
  total_pnl: number;
  peak_equity: number;
  max_drawdown: number;
  current_exposure: number;
  last_tick_at: string | null;
  error_message: string | null;
  updated_at: string;
}

export interface OrderRequest {
  coin: string;
  isBuy: boolean;
  size: string;
  price: string;
  reduceOnly?: boolean;
  tif?: "Ioc" | "Gtc" | "Alo";
  assetIndex: number;
}

export interface OrderResult {
  success: boolean;
  error?: string;
  oid?: number;
  avgPx?: string;
}

export interface TickContext {
  accountValue: number;
  positions: PositionInfo[];
  timestamp: number;
}

export interface PositionInfo {
  coin: string;
  szi: number;
  entryPx: number;
  unrealizedPnl: number;
  marginUsed: number;
  leverage: number;
  assetIndex: number;
}

export interface StrategySignal {
  coin: string;
  side: TradeSide;
  size: number;
  price: number;
  assetIndex: number;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface AiAgentConfig {
  allowedMarkets: ("perps" | "spot" | "stocks" | "commodities")[];
  capitalAllocationPct: number;
  maxTradesPerHour: number;
  confidenceThreshold: number;
  maxPositions: number;
  defaultLeverage: number;
  stopLossPct: number;
  takeProfitPct: number;
  analystModel: string;
  traderModel: string;
}

export const AI_AGENT_DEFAULTS: AiAgentConfig = {
  allowedMarkets: ["perps", "spot", "stocks", "commodities"],
  capitalAllocationPct: 0.30,
  maxTradesPerHour: 6,
  confidenceThreshold: 0.75,
  maxPositions: 4,
  defaultLeverage: 3,
  stopLossPct: 0.04,
  takeProfitPct: 0.08,
  analystModel: "gemini-2.5-flash",
  traderModel: "gemini-2.5-flash",
};

export interface SpikeReversionConfig {
  lookbackMs: number;
  spikeThresholdPct: number;
  takeProfitRatio: number;
  stopLossRatio: number;
  maxPositions: number;
  cooldownMs: number;
  minVolumeUsd: number;
  capitalAllocationPct: number;
}

export const SPIKE_REVERSION_DEFAULTS: SpikeReversionConfig = {
  lookbackMs: 60_000,
  spikeThresholdPct: 0.02,
  takeProfitRatio: 0.5,
  stopLossRatio: 0.67,
  maxPositions: 3,
  cooldownMs: 300_000,
  minVolumeUsd: 1_000_000,
  capitalAllocationPct: 0.10,
};

export interface RebateFarmerConfig {
  coins: string[];
  spreadBps: number;          // offset from mid price in basis points (e.g. 2 = 0.02%)
  orderSizeUsd: number;       // notional per order
  maxExposureUsd: number;     // max net position in USD
  maxInventoryCoins: number;  // max absolute coin qty before unwinding
  cancelThresholdBps: number; // cancel resting order if price moves this many bps
  cycleSleepMs: number;       // milliseconds between quoting cycles
  maxDailyLossUsd: number;    // kill switch
  unwindAggressiveness: number; // 0-1, how aggressively to unwind inventory
}

export const REBATE_FARMER_DEFAULTS: RebateFarmerConfig = {
  coins: ["BTC", "ETH"],
  spreadBps: 1.5,
  orderSizeUsd: 100,
  maxExposureUsd: 300,
  maxInventoryCoins: 0.01,
  cancelThresholdBps: 3,
  cycleSleepMs: 500,
  maxDailyLossUsd: 20,
  unwindAggressiveness: 0.8,
};

export interface MarketBrief {
  regime: "trending" | "ranging" | "volatile" | "quiet";
  topOpportunities: Array<{
    coin: string;
    market: "perp" | "spot" | "stock" | "commodity";
    direction: "long" | "short" | "neutral";
    strength: number;
    reasons: string[];
    keyLevels: { support: number; resistance: number };
  }>;
  warnings: string[];
}

export interface TradeDecision {
  actions: Array<{
    action: "open" | "close" | "adjust" | "hold";
    coin: string;
    side: "long" | "short";
    sizeUsd: number;
    confidence: number;
    stopLoss: number;
    takeProfit?: number;
    reasoning: string;
  }>;
  portfolioReasoning: string;
}

export interface MarketSnapshot {
  coin: string;
  assetIndex: number;
  markPx: number;
  funding: number;
  openInterest: number;
  volume24h: number;
  dex: "perp" | "spot";
  /** For candle API: @N pair name for HIP-3 spot, same as coin for perps */
  candleCoin?: string;
  szDecimals?: number;
}
