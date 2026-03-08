"use client";

import { useEffect } from "react";
import { Wallet, LogOut } from "lucide-react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { getConnectedAddress, shortenAddress, onAccountsChanged } from "@/lib/hyperliquid/wallet";
import { useWallet } from "@/hooks/useWallet";

export function WalletButton() {
  const { address: storeAddr, setAddress } = useTradingStore();
  const { address: walletAddr, connect, source } = useWallet();

  useEffect(() => {
    if (walletAddr && walletAddr !== storeAddr) {
      setAddress(walletAddr);
    }
  }, [walletAddr, storeAddr, setAddress]);

  useEffect(() => {
    if (source === "privy") return;
    getConnectedAddress().then((addr) => {
      if (addr && !walletAddr) setAddress(addr);
    });
    return onAccountsChanged((accounts) => setAddress(accounts[0] ?? null));
  }, [setAddress, walletAddr, source]);

  const handleDisconnect = () => {
    setAddress(null);
  };

  const address = storeAddr || walletAddr;

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-[#1a1d26] border border-[#2a2e39] rounded-lg px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-[#0ecb81]" />
          <span className="text-sm text-white font-medium">{shortenAddress(address)}</span>
        </div>
        <button
          onClick={handleDisconnect}
          className="p-1.5 text-[#848e9c] hover:text-white hover:bg-[#1a1d26] rounded-lg transition-colors"
          title="Disconnect"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#7C3AED]/90 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
    >
      <Wallet className="h-4 w-4" />
      Sign In
    </button>
  );
}
