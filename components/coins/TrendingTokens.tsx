"use client";

import { useState, useEffect, useCallback } from "react";
import { Flame, ExternalLink, RefreshCw, Zap, Sparkles } from "lucide-react";
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

const BOOF = {
  name: "BOOF",
  symbol: "BOOF",
  website: "https://boof.gg",
  contractAddress: "73xkaJou2EzfNxh2Q14Mw61emuVZjX6xHHv75aD8GqN",
  chainId: "solana",
};

interface SponsoredData {
  price: string | null;
  change5m: number | null;
  change1h: number | null;
  change24h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  fdv: number | null;
  image: string | null;
}

export function TrendingTokens() {
  const [rows, setRows] = useState<TrendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [boof, setBoof] = useState<SponsoredData>({ price: null, change5m: null, change1h: null, change24h: null, volume24h: null, liquidity: null, fdv: null, image: null });

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

  const loadBoof = useCallback(async () => {
    try {
      const tokenRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${BOOF.contractAddress}`);
      const tokenData = await tokenRes.json();
      const imageUrl = tokenData?.data?.attributes?.image_url || null;

      const poolsRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${BOOF.contractAddress}/pools`);
      const poolsData = await poolsRes.json();

      if (poolsData.data?.length > 0) {
        const pool = poolsData.data.reduce((best: typeof poolsData.data[0], cur: typeof poolsData.data[0]) =>
          parseFloat(cur.attributes?.reserve_in_usd || "0") > parseFloat(best.attributes?.reserve_in_usd || "0") ? cur : best
        , poolsData.data[0]);
        const a = pool.attributes;
        setBoof({
          price: a.base_token_price_usd ?? null,
          change5m: parseFloat(a.price_change_percentage?.m5) || null,
          change1h: parseFloat(a.price_change_percentage?.h1) || null,
          change24h: parseFloat(a.price_change_percentage?.h24) || null,
          volume24h: parseFloat(a.volume_usd?.h24) || null,
          liquidity: a.reserve_in_usd ? parseFloat(a.reserve_in_usd) / 2 : null,
          fdv: a.fdv_usd ? parseFloat(a.fdv_usd) : null,
          image: imageUrl,
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    loadBoof();
  }, [load, loadBoof]);

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
            {/* Sponsored: BOOF */}
            <tr className="border-b border-[#2a2e3e] bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5 hover:from-amber-500/10 hover:to-amber-500/10 transition-colors">
              <td className="py-2.5 px-3">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded">
                  <Sparkles className="h-2.5 w-2.5" />AD
                </span>
              </td>
              <td className="py-2.5 px-3">
                <a href={BOOF.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                  {boof.image ? (
                    <img src={boof.image} alt="BOOF" className="w-6 h-6 rounded-full group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-bold text-black">B</div>
                  )}
                  <div>
                    <span className="font-semibold group-hover:text-amber-400 transition-colors">BOOF</span>
                    <span className="text-[#848e9c] ml-1 hidden sm:inline">Booftron 9000</span>
                  </div>
                </a>
              </td>
              <td className="py-2.5 px-3">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${chainColor("solana")}20`, color: chainColor("solana") }}>
                  {chainLabel("solana")}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right font-mono">{boof.price ? formatUsd(parseFloat(boof.price)) : "-"}</td>
              <td className={`py-2.5 px-3 text-right hidden sm:table-cell ${(boof.change5m ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {boof.change5m != null ? `${boof.change5m >= 0 ? "+" : ""}${boof.change5m.toFixed(1)}%` : "-"}
              </td>
              <td className={`py-2.5 px-3 text-right ${(boof.change1h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {boof.change1h != null ? `${boof.change1h >= 0 ? "+" : ""}${boof.change1h.toFixed(1)}%` : "-"}
              </td>
              <td className={`py-2.5 px-3 text-right hidden md:table-cell ${(boof.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {boof.change24h != null ? `${boof.change24h >= 0 ? "+" : ""}${boof.change24h.toFixed(1)}%` : "-"}
              </td>
              <td className="py-2.5 px-3 text-right hidden sm:table-cell text-[#848e9c]">{boof.volume24h != null ? formatUsd(boof.volume24h) : "-"}</td>
              <td className="py-2.5 px-3 text-right hidden md:table-cell text-[#848e9c]">{boof.liquidity != null ? formatUsd(boof.liquidity) : "-"}</td>
              <td className="py-2.5 px-3 text-right hidden lg:table-cell text-[#848e9c]">{boof.fdv != null ? formatUsd(boof.fdv) : "-"}</td>
              <td className="py-2.5 px-3 text-center">
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-bold">
                  <Sparkles className="h-3 w-3" />
                  Sponsored
                </span>
              </td>
              <td className="py-2.5 px-3">
                <a href={BOOF.website} target="_blank" rel="noopener noreferrer" className="p-1 text-amber-400 hover:text-amber-300 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>

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
