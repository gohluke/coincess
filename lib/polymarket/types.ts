export interface PolymarketToken {
  token_id: string;
  outcome: string; // "Yes" or "No"
  price: number;
  winner: boolean;
}

export interface PolymarketMarket {
  id: string;
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time: string | null;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  accepting_order_timestamp: string | null;
  minimum_order_size: number;
  minimum_tick_size: number;
  tokens: PolymarketToken[];
  image: string;
  icon: string;
  volume: string;
  volume_num: number;
  liquidity: string;
  liquidity_num: number;
  best_bid: number;
  best_ask: number;
  last_trade_price: number;
  outcome_prices: string;
  outcomePrices: string[] | string;
  outcomes: string[];
  lastTradePrice: number;
  spread: number;
}

export interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: number;
  volume: number;
  volume_num: number;
  volume24hr: number;
  markets: PolymarketMarket[];
  tags: PolymarketTag[];
  comment_count: number;
}

export interface PolymarketTag {
  id: string;
  label: string;
  slug: string;
  image?: string;
}

export interface BookLevel {
  price: string;
  size: string;
}

export interface PolymarketBook {
  market: string;
  asset_id: string;
  bids: BookLevel[];
  asks: BookLevel[];
  hash: string;
  timestamp: string;
}

export type EventCategory =
  | "All"
  | "New"
  | "Politics"
  | "Sports"
  | "Crypto"
  | "Pop Culture"
  | "Business"
  | "Science"
  | "Technology";
