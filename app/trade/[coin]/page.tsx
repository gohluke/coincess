"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { fetchUserFills } from "@/lib/hyperliquid/api";
import type { Fill } from "@/lib/hyperliquid/types";

const TradingChart = dynamic(
  () => import("@/components/trade/TradingChart").then((m) => m.TradingChart),
  { ssr: false },
);

type MobileTab = "chart" | "book" | "order" | "positions";
type BookTab = "book" | "trades";

function findMarketByCoin(markets: { name: string; displayName: string; dex?: string }[], coinParam: string) {
  // URL format: "spot-PURR" → spot market, "BTC" → perp market
  const isSpotUrl = coinParam.startsWith("SPOT-");
  const baseCoin = isSpotUrl ? coinParam.slice(5) : coinParam;

  if (isSpotUrl) {
    return markets.find((m) => {
      if (m.dex !== "spot") return false;
      const spotBase = m.name.replace("spot:", "").toUpperCase();
      return spotBase === baseCoin;
    });
  }

  return markets.find((m) => {
    if (m.dex === "spot") return false;
    const upper = m.name.toUpperCase();
    if (upper === coinParam) return true;
    if (m.displayName.toUpperCase() === coinParam) return true;
    const stripped = upper.includes(":") ? upper.split(":")[1] : upper;
    return stripped === coinParam;
  });
}

export default function TradePageDynamic() {
  const params = useParams<{ coin: string }>();
  const router = useRouter();
  const coinParam = params.coin?.toUpperCase() ?? "BTC";

  const loadMarkets = useTradingStore((s) => s.loadMarkets);
  const selectedMarket = useTradingStore((s) => s.selectedMarket);
  const selectMarket = useTradingStore((s) => s.selectMarket);
  const address = useTradingStore((s) => s.address);
  const setAddress = useTradingStore((s) => s.setAddress);
  const loadUserState = useTradingStore((s) => s.loadUserState);
  const markets = useTradingStore((s) => s.markets);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [bookTab, setBookTab] = useState<BookTab>("book");
  const marketsReady = markets.length > 0;
  const initialSynced = useRef(false);

  const [userFills, setUserFills] = useState<Fill[]>([]);

  const { address: walletAddr, source } = useWallet();
  const activeLinkedAddr = useSettingsStore((s) => s.getActiveAddress)();

  // Sync wallet address to store
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

  // Load markets
  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  // Initial sync: resolve URL coin param to a market name once markets load
  useEffect(() => {
    if (initialSynced.current || !marketsReady) return;
    initialSynced.current = true;
    const match = findMarketByCoin(markets, coinParam);
    const target = match?.name ?? coinParam;
    if (target !== selectedMarket) selectMarket(target);
    try { localStorage.setItem("coincess:lastTicker", coinParam); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketsReady]);

  // When the URL param changes (user types new URL or browser nav), sync to store
  // Intentionally excludes `markets` and `selectedMarket` to avoid feedback loops
  useEffect(() => {
    if (!marketsReady) return;
    const ms = useTradingStore.getState().markets;
    const sel = useTradingStore.getState().selectedMarket;
    const match = findMarketByCoin(ms, coinParam);
    const target = match?.name ?? coinParam;
    if (target !== sel) selectMarket(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinParam]);

  // When the store's selected market changes (user picks from dropdown), sync to URL.
  // Read the *latest* store value at effect-execution time (not the render closure)
  // to avoid a stale market from the previous navigation causing a redirect loop.
  useEffect(() => {
    if (!initialSynced.current) return;
    const sm = useTradingStore.getState().selectedMarket;
    if (!sm) return;
    const market = useTradingStore.getState().markets.find((m) => m.name === sm);
    let urlCoin: string;
    if (market?.dex === "spot") {
      urlCoin = "spot-" + sm.replace("spot:", "").toUpperCase();
    } else {
      urlCoin = sm.replace(/^.*:/, "").toUpperCase();
    }
    const current = params.coin?.toUpperCase() ?? "BTC";

    try { localStorage.setItem("coincess:lastTicker", urlCoin); } catch {}

    if (urlCoin !== current) {
      router.replace(`/trade/${urlCoin}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket]);

  useEffect(() => {
    const unsub = subscribeToMarket(selectedMarket);
    return unsub;
  }, [selectedMarket]);

  useEffect(() => {
    if (!address) return;
    const iv = setInterval(loadUserState, 10_000);
    return () => clearInterval(iv);
  }, [address, loadUserState]);

  useEffect(() => {
    if (!address) { setUserFills([]); return; }
    const load = () => fetchUserFills(address).then(setUserFills).catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [address]);

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
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 border-r border-[#2a2e39]">
            <TradingChart fills={userFills} />
          </div>
          <div className="w-[240px] shrink-0 flex flex-col border-r border-[#2a2e39]">
            <div className="flex border-b border-[#2a2e39]">
              {(["book", "trades"] as BookTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setBookTab(tab)}
                  className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                    bookTab === tab ? "text-white border-b-2 border-brand" : "text-[#848e9c] hover:text-white"
                  }`}
                >
                  {tab === "book" ? "Order Book" : "Recent Trades"}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              {bookTab === "book" ? <OrderBook hideHeader /> : <RecentTrades hideHeader />}
            </div>
          </div>
          <div className="w-[280px] shrink-0 overflow-y-auto">
            <OrderForm />
          </div>
        </div>
        <div className="h-[200px] shrink-0 border-t border-[#2a2e39]">
          <PositionsTable fills={userFills} />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex-1 min-h-0 md:hidden">
        {mobileTab === "chart" && (
          <div className="h-full">
            <TradingChart fills={userFills} />
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
            <PositionsTable fills={userFills} />
          </div>
        )}
      </div>
    </div>
  );
}
