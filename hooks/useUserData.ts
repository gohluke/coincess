"use client";

import { useEffect } from "react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { useUserDataStore } from "@/lib/hyperliquid/user-data-store";

/**
 * Subscribes to real-time Hyperliquid user data via WebSocket.
 * Manages lifecycle: connects when address is available, disconnects on unmount.
 * Returns fills, clearinghouse, openOrders, etc. from the centralized store.
 */
export function useUserData() {
  const { address } = useEffectiveAddress();
  const store = useUserDataStore();

  useEffect(() => {
    if (address) {
      store.connect(address);
    } else {
      store.disconnect();
    }
    return () => {
      store.disconnect();
    };
    // Only reconnect when address changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return {
    address: store.address,
    fills: store.fills,
    clearinghouse: store.clearinghouse,
    spotClearinghouse: store.spotClearinghouse,
    openOrders: store.openOrders,
    fundings: store.fundings,
    abstractionMode: store.abstractionMode,
    connectionState: store.connectionState,
    wsReady: store.wsReady,
    refreshUserState: store.refreshUserState,
  };
}
