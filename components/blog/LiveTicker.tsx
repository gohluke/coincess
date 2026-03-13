"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getWs } from "@/lib/hyperliquid/websocket";

interface TickerData {
  price: string;
  prevPrice: string;
  direction: "up" | "down" | "flat";
}

interface LiveTickerProps {
  coins: string[];
}

const COIN_LABELS: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  HYPE: "HYPE",
  BRENTOIL: "Brent Oil",
  CL: "Crude Oil",
  XAU: "Gold",
  XAG: "Silver",
  PAXG: "Gold",
};

const COIN_ROUTES: Record<string, string> = {
  BTC: "/trade/BTC",
  ETH: "/trade/ETH",
  SOL: "/trade/SOL",
  HYPE: "/trade/HYPE",
  BRENTOIL: "/trade/BRENTOIL",
  CL: "/trade/CL",
  XAU: "/trade/XAU",
  XAG: "/trade/XAG",
  PAXG: "/trade/PAXG",
};

function formatPrice(price: string): string {
  const n = parseFloat(price);
  if (n >= 10000) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function Pill({ coin, data }: { coin: string; data: TickerData | null }) {
  const label = COIN_LABELS[coin] ?? coin;
  const href = COIN_ROUTES[coin] ?? `/trade/${coin}`;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-[#2a2e39] bg-[#141620] px-3 py-1.5 text-xs font-medium transition-colors hover:border-[#3a3e4e] hover:bg-[#1a1d26]"
    >
      <span className="text-gray-300">{label}</span>
      {data ? (
        <>
          <span className="text-white font-mono">${formatPrice(data.price)}</span>
          <span
            className={`font-mono ${
              data.direction === "up"
                ? "text-emerald-400"
                : data.direction === "down"
                ? "text-red-400"
                : "text-gray-500"
            }`}
          >
            {data.direction === "up" ? "▲" : data.direction === "down" ? "▼" : "–"}
          </span>
        </>
      ) : (
        <span className="text-gray-600 animate-pulse">--</span>
      )}
    </Link>
  );
}

export function LiveTicker({ coins }: LiveTickerProps) {
  const [prices, setPrices] = useState<Record<string, TickerData>>({});
  const prevRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const ws = getWs();
    const unsub = ws.subscribeAllMids((mids) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const coin of coins) {
          const raw = mids[coin];
          if (!raw) continue;
          const prevPrice = prevRef.current[coin] ?? raw;
          const direction =
            parseFloat(raw) > parseFloat(prevPrice)
              ? "up"
              : parseFloat(raw) < parseFloat(prevPrice)
              ? "down"
              : (prev[coin]?.direction ?? "flat");
          next[coin] = { price: raw, prevPrice, direction };
          prevRef.current[coin] = raw;
        }
        return next;
      });
    });

    return unsub;
  }, [coins]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {coins.map((coin) => (
        <Pill key={coin} coin={coin} data={prices[coin] ?? null} />
      ))}
    </div>
  );
}
