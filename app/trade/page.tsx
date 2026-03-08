"use client";

import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTradingStore, subscribeToMarket } from "@/lib/hyperliquid/store";
import { MarketSelector } from "@/components/trade/MarketSelector";
import { OrderBook } from "@/components/trade/OrderBook";
import { OrderForm } from "@/components/trade/OrderForm";
import { PositionsTable } from "@/components/trade/PositionsTable";
import { WalletButton } from "@/components/trade/WalletButton";
import { RecentTrades } from "@/components/trade/RecentTrades";

const TradingChart = dynamic(
  () => import("@/components/trade/TradingChart").then((m) => m.TradingChart),
  { ssr: false },
);

export default function TradePage() {
  const loadMarkets = useTradingStore((s) => s.loadMarkets);
  const selectedMarket = useTradingStore((s) => s.selectedMarket);
  const address = useTradingStore((s) => s.address);
  const loadUserState = useTradingStore((s) => s.loadUserState);

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
      {/* Top bar */}
      <header className="flex items-center justify-between h-12 px-4 border-b border-[#2a2e39] shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-[#848e9c] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <Logo />
          </Link>
          <div className="h-5 w-px bg-[#2a2e39]" />
          <MarketSelector />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/predictions"
            className="text-xs text-[#848e9c] hover:text-white transition-colors hidden sm:block"
          >
            Predictions →
          </Link>
          <a
            href="https://app.hyperliquid.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#848e9c] hover:text-white transition-colors hidden sm:block"
          >
            Powered by Hyperliquid
          </a>
          <WalletButton />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Chart + Positions */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-[#2a2e39]">
          <div className="flex-1 min-h-0 border-b border-[#2a2e39]">
            <TradingChart />
          </div>
          <div className="h-[200px] shrink-0">
            <PositionsTable />
          </div>
        </div>

        {/* Middle: Orderbook + Trades */}
        <div className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-[#2a2e39]">
          <div className="flex-1 min-h-0">
            <OrderBook />
          </div>
          <div className="h-[250px] shrink-0 border-t border-[#2a2e39]">
            <RecentTrades />
          </div>
        </div>

        {/* Right: Order Form */}
        <div className="hidden md:block w-[280px] shrink-0 overflow-y-auto">
          <OrderForm />
        </div>
      </div>
    </div>
  );
}
