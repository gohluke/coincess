export type StrategyType = "funding_rate" | "momentum" | "grid" | "mean_reversion" | "market_maker" | "ai_agent";
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
  maxTradesPerHour: 10,
  confidenceThreshold: 0.70,
  maxPositions: 5,
  defaultLeverage: 3,
  stopLossPct: 0.05,
  takeProfitPct: 0.10,
  analystModel: "gemini-2.0-flash",
  traderModel: "gpt-4o",
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
