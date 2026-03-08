"use client";

import { useState, useEffect } from "react";
import { LogIn, LogOut, Wallet, ChevronDown } from "lucide-react";
import { connectWallet, getConnectedAddress, shortenAddress } from "@/lib/hyperliquid/wallet";

let usePrivy: (() => { ready: boolean; authenticated: boolean; user: { wallet?: { address: string } } | null; login: () => void; logout: () => void }) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const privy = require("@privy-io/react-auth");
  if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    usePrivy = privy.usePrivy;
  }
} catch {
  // Privy not available
}

export function ConnectButton({ onAddressChange }: { onAddressChange?: (address: string | null) => void }) {
  const [address, setAddress] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Try Privy first, fall back to MetaMask
  const privyAvailable = !!usePrivy && !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  useEffect(() => {
    getConnectedAddress().then((addr) => {
      if (addr) {
        setAddress(addr);
        onAddressChange?.(addr);
      }
    });
  }, [onAddressChange]);

  const handleConnect = async () => {
    if (privyAvailable && usePrivy) {
      // Privy handles its own modal
      return;
    }
    const addr = await connectWallet();
    if (addr) {
      setAddress(addr);
      onAddressChange?.(addr);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    setShowMenu(false);
    onAddressChange?.(null);
  };

  if (!address) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold transition-colors shadow-lg shadow-[#7C3AED]/20"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Connect</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141620] border border-[#2a2e3e] text-white text-xs font-medium hover:border-[#3a3e4e] transition-colors"
      >
        <Wallet className="h-3.5 w-3.5 text-[#7C3AED]" />
        <span className="font-mono">{shortenAddress(address)}</span>
        <ChevronDown className="h-3 w-3 text-[#848e9c]" />
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#141620] border border-[#2a2e3e] rounded-xl shadow-xl p-1 min-w-[160px]">
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
