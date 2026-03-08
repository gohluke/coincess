"use client";

import { useState, useEffect, useCallback } from "react";
import { Flame, ExternalLink, RefreshCw, Zap } from "lucide-react";
import {
  fetchTrendingTokens,
  fetchTokenPairs,
  chainLabel,
  chainColor,
  formatUsd,
  type BoostedToken,
  type DexPair,
} from "@/lib/dexscreener/api";

interface TrendingRow {
  token: BoostedToken;
  pair: DexPair | null;
}

export function TrendingTokens() {
  const [rows, setRows] = useState<TrendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tokens = await fetchTrendingTokens();
      const unique = tokens.slice(0, 30);

      const enriched = await Promise.all(
        unique.map(async (token) => {
          try {
            const pairs = await fetchTokenPairs(token.tokenAddress);
            return { token, pair: pairs[0] ?? null };
          } catch {
            return { token, pair: null };
          }
        })
      );

      setRows(enriched);
    } catch (err) {
      console.error("Failed to load trending:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-5 w-5 animate-spin text-[#848e9c]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h2 className="text-sm font-semibold">Trending Tokens</h2>
          <span className="text-[10px] text-[#848e9c]">via DEXScreener Boosts</span>
        </div>
        <button onClick={load} className="p-1.5 text-[#848e9c] hover:text-white transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2a2e3e] text-[#848e9c]">
              <th className="text-left py-2 px-3 font-medium">#</th>
              <th className="text-left py-2 px-3 font-medium">Token</th>
              <th className="text-left py-2 px-3 font-medium">Chain</th>
              <th className="text-right py-2 px-3 font-medium">Price</th>
              <th className="text-right py-2 px-3 font-medium hidden sm:table-cell">5m</th>
              <th className="text-right py-2 px-3 font-medium">1h</th>
              <th className="text-right py-2 px-3 font-medium hidden md:table-cell">24h</th>
              <th className="text-right py-2 px-3 font-medium hidden sm:table-cell">Volume 24h</th>
              <th className="text-right py-2 px-3 font-medium hidden md:table-cell">Liquidity</th>
              <th className="text-right py-2 px-3 font-medium hidden lg:table-cell">FDV</th>
              <th className="text-center py-2 px-3 font-medium">Boost</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const p = row.pair;
              return (
                <tr key={`${row.token.chainId}-${row.token.tokenAddress}-${i}`} className="border-b border-[#1a1d26] hover:bg-[#1a1d26] transition-colors">
                  <td className="py-2.5 px-3 text-[#848e9c]">{i + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      {row.token.icon ? (
                        <img src={row.token.icon} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#2a2e3e] flex items-center justify-center text-[10px] font-bold">
                          {(p?.baseToken.symbol ?? "?")[0]}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold">{p?.baseToken.symbol ?? row.token.tokenAddress.slice(0, 6)}</span>
                        <span className="text-[#848e9c] ml-1 hidden sm:inline">
                          {p?.baseToken.name ? `${p.baseToken.name.slice(0, 16)}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${chainColor(row.token.chainId)}20`, color: chainColor(row.token.chainId) }}
                    >
                      {chainLabel(row.token.chainId)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {p?.priceUsd ? formatUsd(parseFloat(p.priceUsd)) : "-"}
                  </td>
                  <td className={`py-2.5 px-3 text-right hidden sm:table-cell ${p?.priceChange?.m5 != null && p.priceChange.m5 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {p?.priceChange?.m5 != null ? `${p.priceChange.m5 >= 0 ? "+" : ""}${p.priceChange.m5.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`py-2.5 px-3 text-right ${p?.priceChange?.h1 != null && p.priceChange.h1 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {p?.priceChange?.h1 != null ? `${p.priceChange.h1 >= 0 ? "+" : ""}${p.priceChange.h1.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`py-2.5 px-3 text-right hidden md:table-cell ${p?.priceChange?.h24 != null && p.priceChange.h24 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {p?.priceChange?.h24 != null ? `${p.priceChange.h24 >= 0 ? "+" : ""}${p.priceChange.h24.toFixed(1)}%` : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-right hidden sm:table-cell text-[#848e9c]">
                    {p?.volume?.h24 != null ? formatUsd(p.volume.h24) : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-right hidden md:table-cell text-[#848e9c]">
                    {p?.liquidity?.usd != null ? formatUsd(p.liquidity.usd) : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-right hidden lg:table-cell text-[#848e9c]">
                    {p?.fdv != null ? formatUsd(p.fdv) : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-400 font-bold">
                      <Zap className="h-3 w-3" />
                      {row.token.totalAmount}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <a
                      href={row.token.url || (p ? p.url : "#")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-[#848e9c] hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-12 text-[#848e9c] text-sm">No trending tokens found.</div>
      )}
    </div>
  );
}
