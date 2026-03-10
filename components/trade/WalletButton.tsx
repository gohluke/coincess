"use client";

import { useEffect, useState, useRef } from "react";
import { Wallet, LogOut, ChevronDown, Radio, Settings } from "lucide-react";
import Link from "next/link";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { getConnectedAddress, shortenAddress, onAccountsChanged } from "@/lib/hyperliquid/wallet";
import { useWallet } from "@/hooks/useWallet";
import { useSettingsStore } from "@/lib/settings/store";

export function WalletButton() {
  const { address: storeAddr, setAddress } = useTradingStore();
  const { address: walletAddr, connect, source } = useWallet();

  const linkedWallets = useSettingsStore((s) => s.linkedWallets);
  const activeWalletId = useSettingsStore((s) => s.activeWalletId);
  const setActiveWallet = useSettingsStore((s) => s.setActiveWallet);
  const getActiveAddress = useSettingsStore((s) => s.getActiveAddress);

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeLinkedAddr = getActiveAddress();

  useEffect(() => {
    if (activeLinkedAddr) {
      if (activeLinkedAddr !== storeAddr) setAddress(activeLinkedAddr);
    } else if (walletAddr && walletAddr !== storeAddr) {
      setAddress(walletAddr);
    }
  }, [walletAddr, storeAddr, setAddress, activeLinkedAddr]);

  useEffect(() => {
    if (source === "privy") return;
    getConnectedAddress().then((addr) => {
      if (addr && !walletAddr && !activeLinkedAddr) setAddress(addr);
    });
    return onAccountsChanged((accounts) => {
      if (!activeLinkedAddr) setAddress(accounts[0] ?? null);
    });
  }, [setAddress, walletAddr, source, activeLinkedAddr]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDisconnect = () => {
    setAddress(null);
  };

  const handleSelectLinked = (walletId: string, addr: string) => {
    setActiveWallet(walletId);
    setAddress(addr);
    setShowDropdown(false);
  };

  const address = storeAddr || walletAddr || activeLinkedAddr;
  const hasLinkedWallets = linkedWallets.length > 0;
  const activeWallet = linkedWallets.find((w) => w.id === activeWalletId);
  const displayLabel = activeWallet?.label ?? (address ? shortenAddress(address) : null);
  const isLinkedOnly = !walletAddr && !!activeLinkedAddr;

  if (address) {
    return (
      <div className="flex items-center gap-2 relative" ref={dropdownRef}>
        <button
          onClick={() => hasLinkedWallets ? setShowDropdown(!showDropdown) : undefined}
          className="flex items-center gap-2 bg-[#1a1d26] border border-[#2a2e39] rounded-full px-3 py-1.5 hover:border-[#3a3e49] transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${isLinkedOnly ? "bg-[#f0b90b]" : "bg-[#0ecb81]"}`} />
          <span className="text-sm text-white font-medium max-w-[120px] truncate">
            {displayLabel}
          </span>
          {hasLinkedWallets && <ChevronDown className="h-3 w-3 text-[#848e9c]" />}
        </button>

        {!hasLinkedWallets && (
          <button
            onClick={handleDisconnect}
            className="p-1.5 text-[#848e9c] hover:text-white hover:bg-[#1a1d26] rounded-lg transition-colors"
            title="Disconnect"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}

        {showDropdown && hasLinkedWallets && (
          <div className="absolute top-full right-0 mt-1 w-64 bg-[#141620] border border-[#2a2e39] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-[#2a2e39]">
              <span className="text-[10px] text-[#848e9c] uppercase tracking-wider font-bold">
                Switch Wallet
              </span>
            </div>

            {walletAddr && (
              <button
                onClick={() => {
                  setActiveWallet(null);
                  setAddress(walletAddr);
                  setShowDropdown(false);
                }}
                className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-[#1a1d26] transition-colors text-left ${
                  !activeWalletId ? "bg-brand/5" : ""
                }`}
              >
                <Wallet className="h-3.5 w-3.5 text-[#848e9c] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">Connected Wallet</div>
                  <div className="text-[10px] text-[#5a6270] font-mono">{shortenAddress(walletAddr)}</div>
                </div>
                {!activeWalletId && <Radio className="h-3 w-3 text-brand shrink-0" />}
              </button>
            )}

            {linkedWallets.map((w) => (
              <button
                key={w.id}
                onClick={() => handleSelectLinked(w.id, w.address)}
                className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-[#1a1d26] transition-colors text-left ${
                  w.id === activeWalletId ? "bg-brand/5" : ""
                }`}
              >
                <Wallet className="h-3.5 w-3.5 text-[#848e9c] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{w.label}</div>
                  <div className="text-[10px] text-[#5a6270] font-mono">{shortenAddress(w.address)}</div>
                </div>
                {w.id === activeWalletId && <Radio className="h-3 w-3 text-brand shrink-0" />}
              </button>
            ))}

            <Link
              href="/settings"
              onClick={() => setShowDropdown(false)}
              className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-[#1a1d26] transition-colors border-t border-[#2a2e39] text-left"
            >
              <Settings className="h-3.5 w-3.5 text-[#848e9c]" />
              <span className="text-xs text-[#848e9c]">Manage Wallets</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
    >
      <Wallet className="h-4 w-4" />
      Connect
    </button>
  );
}
