"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTradingStore, subscribeToMarket } from "@/lib/hyperliquid/store";
import { MarketSelector } from "@/components/trade/MarketSelector";
import { OrderBook } from "@/components/trade/OrderBook";
import { OrderForm } from "@/components/trade/OrderForm";
import { PositionsTable } from "@/components/trade/PositionsTable";
import { RecentTrades } from "@/components/trade/RecentTrades";
import { useWallet } from "@/hooks/useWallet";
import { useSettingsStore } from "@/lib/settings/store";
import { getConnectedAddress, onAccountsChanged } from "@/lib/hyperliquid/wallet";

const TradingChart = dynamic(
  () => import("@/components/trade/TradingChart").then((m) => m.TradingChart),
  { ssr: false },
);

type MobileTab = "chart" | "book" | "order" | "positions";

export default function TradePage() {
  const loadMarkets = useTradingStore((s) => s.loadMarkets);
  const selectedMarket = useTradingStore((s) => s.selectedMarket);
  const address = useTradingStore((s) => s.address);
  const setAddress = useTradingStore((s) => s.setAddress);
  const loadUserState = useTradingStore((s) => s.loadUserState);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");

  const { address: walletAddr, source } = useWallet();
  const activeLinkedAddr = useSettingsStore((s) => s.getActiveAddress)();

  useEffect(() => {
    const effective = activeLinkedAddr ?? walletAddr;
    if (effective && effective !== address) setAddress(effective);
  }, [walletAddr, activeLinkedAddr, address, setAddress]);

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
    loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    const unsub = subscribeToMarket(selectedMarket);
    return unsub;
  }, [selectedMarket]);

  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => loadUserState(), 10000);
    return () => clearInterval(interval);
  }, [address, loadUserState]);

  return (
    <div className="h-screen flex flex-col bg-[#0b0e11] text-white overflow-hidden">
      {/* Market selector bar */}
      <div className="flex items-center h-10 px-4 border-b border-[#2a2e39] shrink-0">
        <MarketSelector />
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex border-b border-[#2a2e39] bg-[#0b0e11]">
        {(["chart", "book", "order", "positions"] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              mobileTab === tab ? "text-brand border-b-2 border-brand" : "text-[#848e9c]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Desktop layout */}
      <div className="flex-1 min-h-0 hidden md:flex flex-col">
        {/* Top row: chart + orderbook + order form */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 border-r border-[#2a2e39]">
            <TradingChart />
          </div>
          <div className="w-[240px] shrink-0 flex flex-col border-r border-[#2a2e39]">
            <div className="flex-1 min-h-0">
              <OrderBook />
            </div>
            <div className="h-[250px] shrink-0 border-t border-[#2a2e39]">
              <RecentTrades />
            </div>
          </div>
          <div className="w-[280px] shrink-0 overflow-y-auto">
            <OrderForm />
          </div>
        </div>
        {/* Bottom row: full-width positions table */}
        <div className="h-[200px] shrink-0 border-t border-[#2a2e39]">
          <PositionsTable />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex-1 min-h-0 md:hidden">
        {mobileTab === "chart" && (
          <div className="h-full">
            <TradingChart />
          </div>
        )}
        {mobileTab === "book" && (
          <div className="h-full overflow-y-auto">
            <OrderBook />
            <div className="border-t border-[#2a2e39]">
              <RecentTrades />
            </div>
          </div>
        )}
        {mobileTab === "order" && (
          <div className="h-full overflow-y-auto">
            <OrderForm />
          </div>
        )}
        {mobileTab === "positions" && (
          <div className="h-full overflow-y-auto">
            <PositionsTable />
          </div>
        )}
      </div>
    </div>
  );
}
