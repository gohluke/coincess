"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, ExternalLink, RefreshCw, Filter } from "lucide-react";
import {
  fetchLatestProfiles,
  fetchTokenPairs,
  chainLabel,
  chainColor,
  timeAgo,
  formatUsd,
  type BoostedToken,
  type DexPair,
} from "@/lib/dexscreener/api";

const CHAINS = ["all", "solana", "ethereum", "base", "bsc", "arbitrum", "polygon"] as const;

interface PairRow {
  profile: BoostedToken;
  pair: DexPair | null;
}

export function NewPairs() {
  const [rows, setRows] = useState<PairRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainFilter, setChainFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profiles = await fetchLatestProfiles();
      const unique = profiles.slice(0, 40);

      const enriched = await Promise.all(
        unique.map(async (profile) => {
          try {
            const pairs = await fetchTokenPairs(profile.tokenAddress);
            return { profile, pair: pairs[0] ?? null };
          } catch {
            return { profile, pair: null };
          }
        })
      );

      setRows(enriched);
    } catch (err) {
      console.error("Failed to load new pairs:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = chainFilter === "all"
    ? rows
    : rows.filter((r) => r.profile.chainId === chainFilter);

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
          <Sparkles className="h-5 w-5 text-blue-400" />
          <h2 className="text-sm font-semibold">New Token Profiles</h2>
          <span className="text-[10px] text-[#848e9c]">recently listed on DEXScreener</span>
        </div>
        <button onClick={load} className="p-1.5 text-[#848e9c] hover:text-white transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Chain filter */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none">
        <Filter className="h-3.5 w-3.5 text-[#848e9c] shrink-0" />
        {CHAINS.map((c) => (
          <button
            key={c}
            onClick={() => setChainFilter(c)}
            className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
              chainFilter === c
                ? "bg-[#7C3AED] text-white"
                : "bg-[#1a1d26] text-[#848e9c] hover:text-white"
            }`}
          >
            {c === "all" ? "All Chains" : chainLabel(c)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((row, i) => {
          const p = row.pair;
          return (
            <a
              key={`${row.profile.chainId}-${row.profile.tokenAddress}-${i}`}
              href={row.profile.url || (p ? p.url : "#")}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#141620] border border-[#2a2e3e] rounded-xl p-4 hover:border-[#3a3e4e] transition-colors"
            >
              <div className="flex items-start gap-3 mb-3">
                {row.profile.icon ? (
                  <img src={row.profile.icon} alt="" className="w-10 h-10 rounded-full shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#2a2e3e] flex items-center justify-center text-sm font-bold shrink-0">
                    {(p?.baseToken.symbol ?? "?")[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">
                      {p?.baseToken.symbol ?? row.profile.tokenAddress.slice(0, 8)}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ backgroundColor: `${chainColor(row.profile.chainId)}20`, color: chainColor(row.profile.chainId) }}
                    >
                      {chainLabel(row.profile.chainId)}
                    </span>
                  </div>
                  {p?.baseToken.name && (
                    <p className="text-[10px] text-[#848e9c] truncate">{p.baseToken.name}</p>
                  )}
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-[#848e9c] shrink-0" />
              </div>

              {row.profile.description && (
                <p className="text-[10px] text-[#848e9c] line-clamp-2 mb-3">{row.profile.description}</p>
              )}

              {p ? (
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-[#848e9c] block">Price</span>
                    <span className="font-mono font-medium">{formatUsd(parseFloat(p.priceUsd))}</span>
                  </div>
                  <div>
                    <span className="text-[#848e9c] block">24h</span>
                    <span className={p.priceChange?.h24 != null && p.priceChange.h24 >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {p.priceChange?.h24 != null ? `${p.priceChange.h24 >= 0 ? "+" : ""}${p.priceChange.h24.toFixed(1)}%` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#848e9c] block">Liq</span>
                    <span className="text-[#848e9c] font-medium">{p.liquidity?.usd != null ? formatUsd(p.liquidity.usd) : "-"}</span>
                  </div>
                  <div>
                    <span className="text-[#848e9c] block">Vol 24h</span>
                    <span className="text-[#848e9c] font-medium">{p.volume?.h24 != null ? formatUsd(p.volume.h24) : "-"}</span>
                  </div>
                  <div>
                    <span className="text-[#848e9c] block">FDV</span>
                    <span className="text-[#848e9c] font-medium">{p.fdv != null ? formatUsd(p.fdv) : "-"}</span>
                  </div>
                  <div>
                    <span className="text-[#848e9c] block">Age</span>
                    <span className="text-[#848e9c] font-medium">{timeAgo(p.pairCreatedAt)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-[#848e9c]">No pair data available</p>
              )}
            </a>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[#848e9c] text-sm">No new pairs found for this chain.</div>
      )}
    </div>
  );
}
