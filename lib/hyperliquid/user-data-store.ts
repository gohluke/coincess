import { create } from "zustand";
import type {
  Fill,
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FundingPayment,
} from "./types";
import type { WsUserFills, WsOrder, WsUserFundings, WsSpotState } from "./websocket";
import { getWs } from "./websocket";
import {
  fetchCombinedClearinghouseState,
  fetchSpotClearinghouseState,
  fetchOpenOrders,
  fetchUserFills,
  fetchUserAbstraction,
} from "./api";

type ConnectionState = "disconnected" | "connecting" | "connected";

interface UserDataState {
  address: string | null;
  fills: Fill[];
  clearinghouse: ClearinghouseState | null;
  spotClearinghouse: SpotClearinghouseState | null;
  openOrders: OpenOrder[];
  fundings: FundingPayment[];
  abstractionMode: string | null;
  connectionState: ConnectionState;
  wsReady: boolean;

  connect: (address: string) => void;
  disconnect: () => void;
  refreshUserState: () => Promise<void>;
}

let cleanups: (() => void)[] = [];
let restFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let positionPollTimer: ReturnType<typeof setInterval> | null = null;

function dedupFills(fills: Fill[]): Fill[] {
  const seen = new Set<number>();
  const result: Fill[] = [];
  for (const f of fills) {
    if (!seen.has(f.tid)) {
      seen.add(f.tid);
      result.push(f);
    }
  }
  return result;
}

export const useUserDataStore = create<UserDataState>((set, get) => ({
  address: null,
  fills: [],
  clearinghouse: null,
  spotClearinghouse: null,
  openOrders: [],
  fundings: [],
  abstractionMode: null,
  connectionState: "disconnected",
  wsReady: false,

  connect: (address: string) => {
    const current = get().address;
    if (current === address && cleanups.length > 0) return;

    if (cleanups.length > 0) {
      cleanups.forEach((fn) => fn());
      cleanups = [];
    }
    if (restFallbackTimer) {
      clearTimeout(restFallbackTimer);
      restFallbackTimer = null;
    }
    if (positionPollTimer) {
      clearInterval(positionPollTimer);
      positionPollTimer = null;
    }

    set({
      address,
      fills: [],
      clearinghouse: null,
      spotClearinghouse: null,
      openOrders: [],
      fundings: [],
      abstractionMode: null,
      wsReady: false,
    });

    const ws = getWs();
    let receivedFills = false;

    const connUnsub = ws.onConnectionStateChange((state) => {
      set({ connectionState: state });
    });
    cleanups.push(connUnsub);
    set({ connectionState: ws.connectionState });

    // WS: userFills (snapshot replaces, incremental appends with dedup)
    const fillsUnsub = ws.subscribeUserFills(address, (data: WsUserFills) => {
      receivedFills = true;
      if (data.isSnapshot) {
        set({ fills: dedupFills(data.fills) });
      } else {
        set((s) => {
          const merged = [...data.fills, ...s.fills];
          const deduped = dedupFills(merged);
          if (deduped.length === s.fills.length) return s;
          return { fills: deduped };
        });
      }
    });
    cleanups.push(fillsUnsub);

    // WS: orderUpdates (instant order status changes)
    const orderUnsub = ws.subscribeOrderUpdates(address, (orders: WsOrder[]) => {
      set((s) => {
        const updated = [...s.openOrders];
        for (const wo of orders) {
          const idx = updated.findIndex((o) => o.oid === wo.order.oid);
          if (wo.status === "open" || wo.status === "triggered") {
            const order: OpenOrder = {
              coin: wo.order.coin,
              isPositionTpsl: false,
              isTrigger: false,
              limitPx: wo.order.limitPx,
              oid: wo.order.oid,
              orderType: "Limit",
              origSz: wo.order.origSz,
              reduceOnly: false,
              side: wo.order.side as "A" | "B",
              sz: wo.order.sz,
              timestamp: wo.order.timestamp,
              triggerCondition: "",
              triggerPx: "0",
            };
            if (idx >= 0) updated[idx] = order;
            else updated.push(order);
          } else {
            if (idx >= 0) updated.splice(idx, 1);
          }
        }
        return { openOrders: updated };
      });
    });
    cleanups.push(orderUnsub);

    // WS: userFundings
    const fundUnsub = ws.subscribeUserFundings(address, (data: WsUserFundings) => {
      if (data.isSnapshot) {
        const payments: FundingPayment[] = data.fundings.map((f) => ({
          time: f.time,
          delta: {
            type: "funding" as const,
            coin: f.coin,
            usdc: f.usdc,
            szi: f.szi,
            fundingRate: f.fundingRate,
          },
        }));
        set({ fundings: payments });
      } else {
        set((s) => {
          const newPayments: FundingPayment[] = data.fundings.map((f) => ({
            time: f.time,
            delta: {
              type: "funding" as const,
              coin: f.coin,
              usdc: f.usdc,
              szi: f.szi,
              fundingRate: f.fundingRate,
            },
          }));
          return { fundings: [...newPayments, ...s.fundings] };
        });
      }
    });
    cleanups.push(fundUnsub);

    // WS: spotState
    const spotUnsub = ws.subscribeSpotState(address, (data: WsSpotState) => {
      set({ spotClearinghouse: data.spotState });
    });
    cleanups.push(spotUnsub);

    // Fetch abstraction mode (no WS equivalent)
    fetchUserAbstraction(address).then((mode) => set({ abstractionMode: mode })).catch(() => {});

    // Positions/orders via REST polling (clearinghouseState WS has channel
    // collision issues with multi-dex -- REST already handles main+xyz merging)
    const loadPositions = async () => {
      const addr = get().address;
      if (addr !== address) return;
      try {
        const [ch, spotCh, orders] = await Promise.all([
          fetchCombinedClearinghouseState(address),
          fetchSpotClearinghouseState(address).catch(() => null),
          fetchOpenOrders(address),
        ]);
        if (get().address === address) {
          set({ clearinghouse: ch, spotClearinghouse: spotCh, openOrders: orders, wsReady: true });
        }
      } catch { /* silent */ }
    };

    loadPositions();
    positionPollTimer = setInterval(loadPositions, 10_000);

    // REST fallback for fills if WS hasn't delivered within 5s
    restFallbackTimer = setTimeout(async () => {
      if (get().address !== address) return;
      if (!receivedFills) {
        try {
          const fills = await fetchUserFills(address);
          if (get().address === address) set({ fills: dedupFills(fills) });
        } catch { /* silent */ }
      }
    }, 5000);
  },

  disconnect: () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    if (restFallbackTimer) {
      clearTimeout(restFallbackTimer);
      restFallbackTimer = null;
    }
    if (positionPollTimer) {
      clearInterval(positionPollTimer);
      positionPollTimer = null;
    }
    set({
      address: null,
      fills: [],
      clearinghouse: null,
      spotClearinghouse: null,
      openOrders: [],
      fundings: [],
      abstractionMode: null,
      connectionState: "disconnected",
      wsReady: false,
    });
  },

  refreshUserState: async () => {
    const addr = get().address;
    if (!addr) return;
    try {
      const [ch, spotCh, orders, fills, abstraction] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchSpotClearinghouseState(addr).catch(() => null),
        fetchOpenOrders(addr),
        fetchUserFills(addr),
        fetchUserAbstraction(addr),
      ]);
      if (get().address === addr) {
        set({
          clearinghouse: ch,
          spotClearinghouse: spotCh,
          openOrders: orders,
          fills: dedupFills(fills),
          abstractionMode: abstraction,
        });
      }
    } catch (err) {
      console.error("Failed to refresh user state:", err);
    }
  },
}));
