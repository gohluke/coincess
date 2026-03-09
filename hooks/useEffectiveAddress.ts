"use client";

import { useWallet } from "@/hooks/useWallet";
import { useSettingsStore } from "@/lib/settings/store";

/**
 * Returns the effective trading address.
 * Priority: active linked wallet > Privy/MetaMask connected wallet.
 */
export function useEffectiveAddress() {
  const { address: walletAddr, loading, connect } = useWallet();
  const getActiveAddress = useSettingsStore((s) => s.getActiveAddress);
  const activeWallet = useSettingsStore((s) =>
    s.linkedWallets.find((w) => w.id === s.activeWalletId),
  );

  const linkedAddr = getActiveAddress();
  const address = linkedAddr || walletAddr;

  return {
    address,
    label: activeWallet?.label ?? null,
    isLinked: !!linkedAddr,
    loading,
    connect,
  };
}
