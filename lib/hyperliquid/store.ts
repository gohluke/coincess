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
  getSpotPairName,
} from "./api";
import { getWs } from "./websocket";
import { useUserDataStore } from "./user-data-store";

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
  refreshMarkets: () => Promise<void>;
  updateMids: (mids: Record<string, string>) => void;
  updateAssetCtx: (coin: string, ctx: Record<string, string>) => void;
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
      const bookCoin = getSpotPairName(selected) ?? selected;
      const book = await fetchL2Book(bookCoin);
      set({ orderbook: book });
    } catch (err) {
      console.error("Failed to load markets:", err);
      set({ marketsLoading: false });
    }
  },

  refreshMarkets: async () => {
    try {
      const fresh = await fetchAllMarkets();
      set({ markets: fresh });
    } catch (err) {
      console.error("Failed to refresh markets:", err);
    }
  },

  updateMids: (mids) => {
    set((s) => {
      let changed = false;
      const updated = s.markets.map((m) => {
        // For spot markets, allMids keys are the pair name (e.g. "PURR/USDC" or "@1")
        const key = getSpotPairName(m.name) ?? m.name;
        const mid = mids[key];
        if (!mid || mid === m.markPx) return m;
        changed = true;
        return { ...m, markPx: mid, midPx: mid };
      });
      return changed ? { markets: updated } : {};
    });
  },

  updateAssetCtx: (coin, ctx) => {
    set((s) => {
      let idx = s.markets.findIndex((m) => m.name === coin);
      // Fall back to matching by spot pair name for spot markets
      if (idx === -1) idx = s.markets.findIndex((m) => getSpotPairName(m.name) === coin);
      if (idx === -1) return {};
      const m = s.markets[idx];
      const updated = { ...m };
      if (ctx.funding !== undefined) updated.funding = ctx.funding;
      if (ctx.openInterest !== undefined) updated.openInterest = ctx.openInterest;
      if (ctx.oraclePx !== undefined) updated.oraclePx = ctx.oraclePx;
      if (ctx.markPx !== undefined) updated.markPx = ctx.markPx;
      if (ctx.midPx !== undefined) updated.midPx = ctx.midPx;
      if (ctx.prevDayPx !== undefined) updated.prevDayPx = ctx.prevDayPx;
      if (ctx.dayNtlVlm !== undefined) updated.dayNtlVlm = ctx.dayNtlVlm;
      if (ctx.premium !== undefined) updated.premium = ctx.premium;
      const markets = [...s.markets];
      markets[idx] = updated;
      return { markets };
    });
  },

  selectMarket: (coin) => {
    set({ selectedMarket: coin, orderbook: null, recentTrades: [] });
    const bookCoin = getSpotPairName(coin) ?? coin;
    fetchL2Book(bookCoin).then((book) => set({ orderbook: book })).catch(console.error);
  },

  setInterval: (interval) => set({ selectedInterval: interval }),

  setAddress: (addr) => {
    set({ address: addr });
    if (addr) {
      // Trigger REST refresh; WS streaming via user-data-store handles ongoing updates
      get().loadUserState();
    } else {
      set({ clearinghouse: null, spotClearinghouse: null, openOrders: [] });
    }
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
      // Also push to user data store so both stay in sync after manual refresh
      const uds = useUserDataStore.getState();
      if (uds.address === addr) {
        useUserDataStore.setState({ clearinghouse: ch, spotClearinghouse: spotCh, openOrders: orders, abstractionMode: abstraction });
      }
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
let metaRefreshTimer: ReturnType<typeof setInterval> | null = null;

export function subscribeToMarket(coin: string) {
  wsCleanups.forEach((fn) => fn());
  wsCleanups = [];
  if (metaRefreshTimer) {
    clearInterval(metaRefreshTimer);
    metaRefreshTimer = null;
  }

  const ws = getWs();
  const store = useTradingStore.getState();

  // Spot markets need the pair name (e.g. "@1") for WS subscriptions
  const wsCoin = getSpotPairName(coin) ?? coin;

  wsCleanups.push(
    ws.subscribeL2Book(wsCoin, (book) => {
      store.setOrderbook(book);
    }),
  );

  wsCleanups.push(
    ws.subscribeTrades(wsCoin, (trades) => {
      store.addTrades(trades);
    }),
  );

  wsCleanups.push(
    ws.subscribeAllMids((mids) => {
      store.updateMids(mids);
    }),
  );

  wsCleanups.push(
    ws.subscribeActiveAssetCtx(wsCoin, (data) => {
      store.updateAssetCtx(data.coin, data.ctx);
    }),
  );

  // Refresh full market list periodically for non-active markets
  metaRefreshTimer = setInterval(() => {
    store.refreshMarkets();
  }, 30_000);

  return () => {
    wsCleanups.forEach((fn) => fn());
    wsCleanups = [];
    if (metaRefreshTimer) {
      clearInterval(metaRefreshTimer);
      metaRefreshTimer = null;
    }
  };
}
