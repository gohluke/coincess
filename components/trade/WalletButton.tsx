"use client";

import { useEffect } from "react";
import { Wallet, LogOut } from "lucide-react";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { connectWallet, getConnectedAddress, shortenAddress, onAccountsChanged } from "@/lib/hyperliquid/wallet";

export function WalletButton() {
  const { address, setAddress } = useTradingStore();

  useEffect(() => {
    getConnectedAddress().then((addr) => {
      if (addr) setAddress(addr);
    });
    return onAccountsChanged((accounts) => setAddress(accounts[0] ?? null));
  }, [setAddress]);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) setAddress(addr);
  };

  const handleDisconnect = () => {
    setAddress(null);
  };

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
      onClick={handleConnect}
      className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#7C3AED]/90 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
    >
      <Wallet className="h-4 w-4" />
      Connect Wallet
    </button>
  );
}
