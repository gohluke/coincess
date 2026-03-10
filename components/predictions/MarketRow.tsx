"use client";

import { useState } from "react";
import type { PolymarketMarket } from "@/lib/polymarket/types";
import { getOutcomePrice, formatVolume } from "@/lib/polymarket/api";
import { useWallet } from "@/hooks/useWallet";

export function MarketRow({ market }: { market: PolymarketMarket }) {
  const { address, connect } = useWallet();
  const prices = getOutcomePrice(market);
  const yesPct = Math.round(prices.yes * 100);
  const noPct = Math.round(prices.no * 100);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(null);
  const [amount, setAmount] = useState("");

  const potentialPayout = amount
    ? selectedSide === "yes"
      ? (parseFloat(amount) / prices.yes).toFixed(2)
      : (parseFloat(amount) / prices.no).toFixed(2)
    : "0.00";

  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl overflow-hidden">
      <div className="p-4">
        <h4 className="text-sm font-medium text-white mb-3 leading-tight">
          {market.question}
        </h4>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-[#848e9c]">
            Vol {formatVolume(market.volume_num ?? market.volume)}
          </span>
          <span className="text-[10px] text-[#848e9c]">
            Liq {formatVolume(market.liquidity_num ?? market.liquidity)}
          </span>
          {market.end_date_iso && (
            <span className="text-[10px] text-[#848e9c]">
              Ends {new Date(market.end_date_iso).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Price bar */}
        <div className="relative h-10 rounded-lg overflow-hidden bg-red-500/15 mb-3">
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500/25 transition-all duration-500"
            style={{ width: `${yesPct}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-4">
            <span className="text-sm font-bold text-emerald-400">Yes {yesPct}¢</span>
            <span className="text-sm font-bold text-red-400">No {noPct}¢</span>
          </div>
        </div>

        {/* Buy buttons */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelectedSide(selectedSide === "yes" ? null : "yes")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              selectedSide === "yes"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            Buy Yes {yesPct}¢
          </button>
          <button
            onClick={() => setSelectedSide(selectedSide === "no" ? null : "no")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              selectedSide === "no"
                ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
            }`}
          >
            Buy No {noPct}¢
          </button>
        </div>

        {/* Bet slip */}
        {selectedSide && (
          <div className="bg-[#0b0e17] rounded-lg p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#848e9c]">
                Buy {selectedSide === "yes" ? "Yes" : "No"} at{" "}
                {selectedSide === "yes" ? yesPct : noPct}¢
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#848e9c]">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 bg-[#141620] border border-[#2a2e3e] rounded-lg text-sm text-white placeholder-[#4a4e5c] focus:outline-none focus:border-[#FF455B]/50"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#848e9c]">Potential payout</span>
              <span className="text-white font-medium">${potentialPayout}</span>
            </div>
            {address ? (
              <button
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  selectedSide === "yes"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
                onClick={() => {
                  if (!amount || parseFloat(amount) <= 0) return;
                  alert(`Trade preview: Buy ${selectedSide?.toUpperCase()} for $${amount}\nPayout: $${potentialPayout}\n\nPolymarket CLOB trading coming soon.`);
                }}
              >
                Buy {selectedSide === "yes" ? "Yes" : "No"} — ${amount || "0"}
              </button>
            ) : (
              <button
                onClick={connect}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#FF455B] text-white hover:bg-[#E63B50] transition-colors"
              >
                Sign In to Trade
              </button>
            )}
            <p className="text-[9px] text-[#848e9c] text-center">
              Trades execute on Polygon via Polymarket CLOB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
