export type StrategyType =
  | "dca"
  | "grid"
  | "trailing_stop"
  | "conditional"
  | "prediction_auto_bet"
  | "prediction_exit"
  | "copy_trade";

export type Platform = "hyperliquid" | "polymarket";
export type StrategyStatus = "active" | "paused" | "stopped" | "error";

export interface DCAConfig {
  coin: string;
  side: "buy" | "sell";
  amountUsd: number;
  intervalMs: number;
  totalOrders?: number;
  priceLimit?: number;
}

export interface GridConfig {
  coin: string;
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  orderSize: number;
  leverage: number;
}

export interface TrailingStopConfig {
  coin: string;
  side: "long" | "short";
  trailPercent: number;
  activationPrice?: number;
  size: number;
}

export interface ConditionalConfig {
  condition: {
    type: "price_above" | "price_below" | "pnl_above" | "pnl_below";
    value: number;
    coin: string;
  };
  action: {
    type: "place_order" | "close_position" | "alert";
    coin: string;
    side: "buy" | "sell";
    size: number;
    orderType: "market" | "limit";
    price?: number;
  };
  oneShot: boolean;
}

export interface PredictionBetConfig {
  eventId: string;
  eventTitle: string;
  marketId: string;
  marketQuestion: string;
  outcome: "Yes" | "No";
  triggerPrice: number;
  betSize: number;
  tokenId: string;
}

export interface PredictionExitConfig {
  eventId: string;
  eventTitle: string;
  marketId: string;
  tokenId: string;
  exitBeforeMs: number;
  endDate: string;
}

export interface CopyTradeConfig {
  targetAddress: string;
  targetLabel?: string;
  sizeMultiplier: number;
  maxPositionUsd: number;
  allowedCoins?: string[];
  excludedCoins?: string[];
}

export type StrategyConfig =
  | DCAConfig
  | GridConfig
  | TrailingStopConfig
  | ConditionalConfig
  | PredictionBetConfig
  | PredictionExitConfig
  | CopyTradeConfig;

export interface TradeLog {
  id: string;
  strategyId: string;
  timestamp: number;
  type: "order" | "cancel" | "alert" | "error" | "info";
  platform: Platform;
  details: string;
  orderId?: number;
  coin?: string;
  side?: "buy" | "sell";
  price?: number;
  size?: number;
  pnl?: number;
}

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  platform: Platform;
  status: StrategyStatus;
  config: StrategyConfig;
  createdAt: number;
  updatedAt: number;
  lastExecutedAt: number | null;
  nextExecuteAt: number | null;
  totalTrades: number;
  totalPnl: number;
  errorMessage?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  type: "price_cross" | "pnl_threshold" | "market_closing" | "whale_move";
  platform: Platform;
  enabled: boolean;
  condition: AlertCondition;
  notifyMethod: "browser" | "sound" | "both";
  oneShot: boolean;
  triggered: boolean;
  createdAt: number;
  lastTriggeredAt: number | null;
}

export type AlertCondition =
  | { type: "price_above"; coin: string; price: number }
  | { type: "price_below"; coin: string; price: number }
  | { type: "pnl_above"; coin: string; amount: number }
  | { type: "pnl_below"; coin: string; amount: number }
  | { type: "market_closing"; eventId: string; eventTitle: string; beforeMs: number }
  | { type: "whale_move"; coin: string; minSizeUsd: number };

export interface AlertHistory {
  id: string;
  alertId: string;
  timestamp: number;
  message: string;
  acknowledged: boolean;
}

export const INTERVAL_PRESETS: { label: string; ms: number }[] = [
  { label: "1 min", ms: 60_000 },
  { label: "5 min", ms: 300_000 },
  { label: "15 min", ms: 900_000 },
  { label: "1 hour", ms: 3_600_000 },
  { label: "4 hours", ms: 14_400_000 },
  { label: "12 hours", ms: 43_200_000 },
  { label: "1 day", ms: 86_400_000 },
];
