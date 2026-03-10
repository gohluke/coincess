import { create } from "zustand";
import type {
  MarketInfo,
  L2Book,
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  CandleInterval,
  WsTrade,
} from "./types";
import {
  fetchAllMarkets,
  fetchL2Book,
  fetchCombinedClearinghouseState,
  fetchSpotClearinghouseState,
  fetchOpenOrders,
  fetchUserAbstraction,
} from "./api";
import { getWs } from "./websocket";

interface TradingState {
  // Markets
  markets: MarketInfo[];
  selectedMarket: string;
  selectedInterval: CandleInterval;
  marketsLoading: boolean;

  // Orderbook
  orderbook: L2Book | null;

  // Recent trades
  recentTrades: WsTrade[];

  // User state
  address: string | null;
  clearinghouse: ClearinghouseState | null;
  spotClearinghouse: SpotClearinghouseState | null;
  openOrders: OpenOrder[];
  abstractionMode: string | null;

  // Order form
  orderSide: "buy" | "sell";
  orderType: "market" | "limit";
  orderPrice: string;
  orderSize: string;
  orderLeverage: number;

  // Actions
  loadMarkets: () => Promise<void>;
  selectMarket: (coin: string) => void;
  setInterval: (interval: CandleInterval) => void;
  setAddress: (addr: string | null) => void;
  loadUserState: () => Promise<void>;
  setOrderSide: (side: "buy" | "sell") => void;
  setOrderType: (type: "market" | "limit") => void;
  setOrderPrice: (price: string) => void;
  setOrderSize: (size: string) => void;
  setOrderLeverage: (leverage: number) => void;
  setOrderbook: (book: L2Book) => void;
  addTrades: (trades: WsTrade[]) => void;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  markets: [],
  selectedMarket: "BTC",
  selectedInterval: "15m",
  marketsLoading: false,

  orderbook: null,
  recentTrades: [],

  address: null,
  clearinghouse: null,
  spotClearinghouse: null,
  openOrders: [],
  abstractionMode: null,

  orderSide: "buy",
  orderType: "limit",
  orderPrice: "",
  orderSize: "",
  orderLeverage: 10,

  loadMarkets: async () => {
    set({ marketsLoading: true });
    try {
      const markets = await fetchAllMarkets();
      set({ markets, marketsLoading: false });

      const selected = get().selectedMarket;
      const book = await fetchL2Book(selected);
      set({ orderbook: book });
    } catch (err) {
      console.error("Failed to load markets:", err);
      set({ marketsLoading: false });
    }
  },

  selectMarket: (coin) => {
    set({ selectedMarket: coin, orderbook: null, recentTrades: [] });
    fetchL2Book(coin).then((book) => set({ orderbook: book })).catch(console.error);
  },

  setInterval: (interval) => set({ selectedInterval: interval }),

  setAddress: (addr) => {
    set({ address: addr });
    if (addr) get().loadUserState();
    else set({ clearinghouse: null, spotClearinghouse: null, openOrders: [] });
  },

  loadUserState: async () => {
    const addr = get().address;
    if (!addr) return;
    try {
      const [ch, spotCh, orders, abstraction] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchSpotClearinghouseState(addr).catch(() => null),
        fetchOpenOrders(addr),
        fetchUserAbstraction(addr),
      ]);
      set({ clearinghouse: ch, spotClearinghouse: spotCh, openOrders: orders, abstractionMode: abstraction });
    } catch (err) {
      console.error("Failed to load user state:", err);
    }
  },

  setOrderSide: (side) => set({ orderSide: side }),
  setOrderType: (type) => set({ orderType: type }),
  setOrderPrice: (price) => set({ orderPrice: price }),
  setOrderSize: (size) => set({ orderSize: size }),
  setOrderLeverage: (leverage) => set({ orderLeverage: leverage }),
  setOrderbook: (book) => set({ orderbook: book }),
  addTrades: (trades) =>
    set((s) => ({ recentTrades: [...trades, ...s.recentTrades].slice(0, 100) })),
}));

let wsCleanups: (() => void)[] = [];

export function subscribeToMarket(coin: string) {
  wsCleanups.forEach((fn) => fn());
  wsCleanups = [];

  const ws = getWs();
  const store = useTradingStore.getState();

  wsCleanups.push(
    ws.subscribeL2Book(coin, (book) => {
      store.setOrderbook(book);
    }),
  );

  wsCleanups.push(
    ws.subscribeTrades(coin, (trades) => {
      store.addTrades(trades);
    }),
  );

  return () => {
    wsCleanups.forEach((fn) => fn());
    wsCleanups = [];
  };
}
