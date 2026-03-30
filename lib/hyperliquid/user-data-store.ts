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

    // Disconnect previous if any
    if (cleanups.length > 0) {
      cleanups.forEach((fn) => fn());
      cleanups = [];
    }
    if (restFallbackTimer) {
      clearTimeout(restFallbackTimer);
      restFallbackTimer = null;
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
    let receivedClearinghouse = false;
    let receivedFills = false;

    // Track connection state
    const connUnsub = ws.onConnectionStateChange((state) => {
      set({ connectionState: state });
    });
    cleanups.push(connUnsub);
    set({ connectionState: ws.connectionState });

    // userFills: snapshot replaces, incremental appends
    const fillsUnsub = ws.subscribeUserFills(address, (data: WsUserFills) => {
      receivedFills = true;
      if (data.isSnapshot) {
        set({ fills: data.fills });
      } else {
        set((s) => {
          const seen = new Set(s.fills.map((f) => f.tid));
          const newFills = data.fills.filter((f) => !seen.has(f.tid));
          if (newFills.length === 0) return s;
          return { fills: [...newFills, ...s.fills] };
        });
      }
    });
    cleanups.push(fillsUnsub);

    // clearinghouseState: main dex
    const chMainUnsub = ws.subscribeClearinghouseState(address, (state) => {
      receivedClearinghouse = true;
      set((s) => {
        const xyzCh = s.clearinghouse?.assetPositions.filter(
          (ap) => ap.position.coin.includes(":")
        ) ?? [];

        if (xyzCh.length === 0) {
          set({ wsReady: true });
          return { clearinghouse: state };
        }

        // Merge with xyz positions
        const mainVal = parseFloat(state.marginSummary.accountValue || "0");
        const mainMargin = parseFloat(state.marginSummary.totalMarginUsed || "0");
        const xyzMargin = xyzCh.reduce(
          (sum, ap) => sum + parseFloat(ap.position.marginUsed || "0"), 0
        );
        const xyzUPnl = xyzCh.reduce(
          (sum, ap) => sum + parseFloat(ap.position.unrealizedPnl || "0"), 0
        );

        return {
          wsReady: true,
          clearinghouse: {
            ...state,
            marginSummary: {
              accountValue: (mainVal + xyzUPnl).toString(),
              totalMarginUsed: (mainMargin + xyzMargin).toString(),
              totalNtlPos: state.marginSummary.totalNtlPos,
              totalRawUsd: state.marginSummary.totalRawUsd,
            },
            assetPositions: [...state.assetPositions, ...xyzCh],
          },
        };
      });
    });
    cleanups.push(chMainUnsub);

    // clearinghouseState: xyz dex (HIP-3)
    const chXyzUnsub = ws.subscribeClearinghouseState(address, (xyzState) => {
      set((s) => {
        const mainCh = s.clearinghouse;
        if (!mainCh) {
          return {
            clearinghouse: xyzState,
            wsReady: true,
          };
        }

        // Remove old xyz positions, add new ones
        const mainOnly = mainCh.assetPositions.filter(
          (ap) => !ap.position.coin.includes(":")
        );

        const mainVal = parseFloat(mainCh.marginSummary.accountValue || "0");
        const mainMarginUsed = mainOnly.reduce(
          (sum, ap) => sum + parseFloat(ap.position.marginUsed || "0"), 0
        );
        const xyzMargin = parseFloat(xyzState.marginSummary.totalMarginUsed || "0");
        const xyzUPnl = xyzState.assetPositions.reduce(
          (sum, ap) => sum + parseFloat(ap.position.unrealizedPnl || "0"), 0
        );

        // Recompute with updated xyz
        const prevXyzUPnl = mainCh.assetPositions
          .filter((ap) => ap.position.coin.includes(":"))
          .reduce((sum, ap) => sum + parseFloat(ap.position.unrealizedPnl || "0"), 0);
        const adjustedVal = mainVal - prevXyzUPnl + xyzUPnl;

        return {
          wsReady: true,
          clearinghouse: {
            ...mainCh,
            marginSummary: {
              accountValue: adjustedVal.toString(),
              totalMarginUsed: (mainMarginUsed + xyzMargin).toString(),
              totalNtlPos: mainCh.marginSummary.totalNtlPos,
              totalRawUsd: mainCh.marginSummary.totalRawUsd,
            },
            assetPositions: [...mainOnly, ...xyzState.assetPositions],
          },
        };
      });
    }, "xyz");
    cleanups.push(chXyzUnsub);

    // orderUpdates: reconcile open orders on status change
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
            // filled, canceled, etc. -- remove from open orders
            if (idx >= 0) updated.splice(idx, 1);
          }
        }
        return { openOrders: updated };
      });
    });
    cleanups.push(orderUnsub);

    // userFundings
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

    // spotState
    const spotUnsub = ws.subscribeSpotState(address, (data: WsSpotState) => {
      set({ spotClearinghouse: data.spotState });
    });
    cleanups.push(spotUnsub);

    // Fetch abstraction mode (no WS subscription available)
    fetchUserAbstraction(address).then((mode) => set({ abstractionMode: mode })).catch(() => {});

    // REST fallback: if WS hasn't delivered core data within 5s, bootstrap via REST
    restFallbackTimer = setTimeout(async () => {
      const s = get();
      if (s.address !== address) return;

      const tasks: Promise<void>[] = [];

      if (!receivedClearinghouse) {
        tasks.push(
          fetchCombinedClearinghouseState(address)
            .then((ch) => { if (get().address === address) set({ clearinghouse: ch, wsReady: true }); })
            .catch(() => {}),
        );
        tasks.push(
          fetchSpotClearinghouseState(address)
            .then((sp) => { if (get().address === address) set({ spotClearinghouse: sp }); })
            .catch(() => {}),
        );
        tasks.push(
          fetchOpenOrders(address)
            .then((orders) => { if (get().address === address) set({ openOrders: orders }); })
            .catch(() => {}),
        );
      }

      if (!receivedFills) {
        tasks.push(
          fetchUserFills(address)
            .then((fills) => { if (get().address === address) set({ fills }); })
            .catch(() => {}),
        );
      }

      await Promise.allSettled(tasks);
    }, 5000);
  },

  disconnect: () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    if (restFallbackTimer) {
      clearTimeout(restFallbackTimer);
      restFallbackTimer = null;
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
      const [ch, spotCh, orders, abstraction] = await Promise.all([
        fetchCombinedClearinghouseState(addr),
        fetchSpotClearinghouseState(addr).catch(() => null),
        fetchOpenOrders(addr),
        fetchUserAbstraction(addr),
      ]);
      if (get().address === addr) {
        set({ clearinghouse: ch, spotClearinghouse: spotCh, openOrders: orders, abstractionMode: abstraction });
      }
    } catch (err) {
      console.error("Failed to refresh user state:", err);
    }
  },
}));
