"use client";

import { useState, useEffect } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, ShoppingCart, RefreshCw, Coins, Sparkles, ExternalLink } from "lucide-react";

interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  price_change_percentage_24h: number | null;
}

const SPONSORED_COIN = {
  name: "BOOF",
  symbol: "BOOF",
  website: "https://boof.gg",
  contractAddress: "73xkaJou2EzfNxh2Q14Mw61emuVZjX6xHHv75aD8GqN",
  blockchain: "solana",
};

interface SponsoredData {
  price: number | null;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  image: string | null;
}

type SortField = "market_cap_rank" | "current_price" | "price_change_percentage_24h" | "market_cap" | "total_volume";

export function TopCoins() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [sponsored, setSponsored] = useState<SponsoredData>({ price: null, change24h: null, marketCap: null, volume24h: null, image: null });
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("market_cap_rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchCoins = async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false"
      );
      const data = await res.json();
      if (Array.isArray(data)) setCoins(data);
    } catch (err) {
      console.error("CoinGecko error:", err);
    }
    setLoading(false);
  };

  const fetchSponsored = async () => {
    try {
      const tokenRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${SPONSORED_COIN.contractAddress}`);
      const tokenData = await tokenRes.json();
      const imageUrl = tokenData?.data?.attributes?.image_url || null;

      const poolsRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${SPONSORED_COIN.contractAddress}/pools`);
      const poolsData = await poolsRes.json();

      if (poolsData.data?.length > 0) {
        const mainPool = poolsData.data.reduce((best: typeof poolsData.data[0], cur: typeof poolsData.data[0]) =>
          parseFloat(cur.attributes?.reserve_in_usd || "0") > parseFloat(best.attributes?.reserve_in_usd || "0") ? cur : best
        , poolsData.data[0]);
        const a = mainPool.attributes;
        setSponsored({
          price: parseFloat(a.base_token_price_usd) || null,
          change24h: parseFloat(a.price_change_percentage?.h24) || null,
          marketCap: a.market_cap_usd ? parseFloat(a.market_cap_usd) : (a.fdv_usd ? parseFloat(a.fdv_usd) : null),
          volume24h: parseFloat(a.volume_usd?.h24) || null,
          image: imageUrl,
        });
      }
    } catch (err) {
      console.error("Sponsored coin error:", err);
    }
  };

  useEffect(() => {
    fetchCoins();
    fetchSponsored();
    const iv = setInterval(() => { fetchCoins(); fetchSponsored(); }, 30000);
    return () => clearInterval(iv);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  let filtered = coins.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  filtered.sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const fmt = (v: number | null) => {
    if (v == null) return "-";
    return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const fmtLarge = (v: number | null) => {
    if (v == null) return "-";
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toFixed(0)}`;
  };

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
          <Coins className="h-5 w-5 text-brand" />
          <h2 className="text-sm font-semibold">Top 100 by Market Cap</h2>
          <span className="text-[10px] text-[#848e9c]">via CoinGecko</span>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or symbol..."
          className="w-full sm:max-w-xs bg-[#141620] border border-[#2a2e3e] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#848e9c] focus:outline-none focus:border-brand"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#2a2e3e]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#141620] border-b border-[#2a2e3e] text-[#848e9c]">
              <th className="text-left py-2.5 px-3 font-medium">
                <button onClick={() => handleSort("market_cap_rank")} className="flex items-center gap-1 hover:text-white">
                  # <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left py-2.5 px-3 font-medium">Coin</th>
              <th className="text-right py-2.5 px-3 font-medium">
                <button onClick={() => handleSort("current_price")} className="flex items-center gap-1 ml-auto hover:text-white">
                  Price <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right py-2.5 px-3 font-medium">
                <button onClick={() => handleSort("price_change_percentage_24h")} className="flex items-center gap-1 ml-auto hover:text-white">
                  24h <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right py-2.5 px-3 font-medium hidden md:table-cell">
                <button onClick={() => handleSort("market_cap")} className="flex items-center gap-1 ml-auto hover:text-white">
                  Mkt Cap <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right py-2.5 px-3 font-medium hidden lg:table-cell">
                <button onClick={() => handleSort("total_volume")} className="flex items-center gap-1 ml-auto hover:text-white">
                  Volume <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2.5 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {/* Sponsored: BOOF */}
            <tr className="border-b border-[#2a2e3e] bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5 hover:from-amber-500/10 hover:to-amber-500/10 transition-colors">
              <td className="py-2.5 px-3">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded">
                  <Sparkles className="h-2.5 w-2.5" />
                  AD
                </span>
              </td>
              <td className="py-2.5 px-3">
                <a href={SPONSORED_COIN.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                  {sponsored.image ? (
                    <img src={sponsored.image} alt={SPONSORED_COIN.name} className="w-6 h-6 rounded-full group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-bold text-black">B</div>
                  )}
                  <div>
                    <span className="font-semibold group-hover:text-amber-400 transition-colors">{SPONSORED_COIN.name}</span>
                    <span className="text-[#848e9c] ml-1 uppercase">{SPONSORED_COIN.symbol}</span>
                  </div>
                </a>
              </td>
              <td className="py-2.5 px-3 text-right font-mono">{sponsored.price != null ? fmt(sponsored.price) : "-"}</td>
              <td className={`py-2.5 px-3 text-right ${(sponsored.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                <div className="flex items-center justify-end gap-0.5">
                  {sponsored.change24h != null && ((sponsored.change24h >= 0) ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                  {sponsored.change24h != null ? `${sponsored.change24h >= 0 ? "+" : ""}${sponsored.change24h.toFixed(2)}%` : "-"}
                </div>
              </td>
              <td className="py-2.5 px-3 text-right text-[#848e9c] hidden md:table-cell">{sponsored.marketCap != null ? fmtLarge(sponsored.marketCap) : "-"}</td>
              <td className="py-2.5 px-3 text-right text-[#848e9c] hidden lg:table-cell">{sponsored.volume24h != null ? fmtLarge(sponsored.volume24h) : "-"}</td>
              <td className="py-2.5 px-3">
                <a
                  href={SPONSORED_COIN.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg text-[10px] font-semibold text-black transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Visit
                </a>
              </td>
            </tr>

            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-[#1a1d26] hover:bg-[#1a1d26] transition-colors">
                <td className="py-2.5 px-3 text-[#848e9c]">{c.market_cap_rank ?? "-"}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <img src={c.image} alt={c.name} className="w-6 h-6 rounded-full" />
                    <div>
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-[#848e9c] ml-1 uppercase">{c.symbol}</span>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono">{fmt(c.current_price)}</td>
                <td className={`py-2.5 px-3 text-right ${(c.price_change_percentage_24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  <div className="flex items-center justify-end gap-0.5">
                    {(c.price_change_percentage_24h ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {c.price_change_percentage_24h != null ? `${c.price_change_percentage_24h >= 0 ? "+" : ""}${c.price_change_percentage_24h.toFixed(2)}%` : "-"}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right text-[#848e9c] hidden md:table-cell">{fmtLarge(c.market_cap)}</td>
                <td className="py-2.5 px-3 text-right text-[#848e9c] hidden lg:table-cell">{fmtLarge(c.total_volume)}</td>
                <td className="py-2.5 px-3">
                  <a
                    href={`https://trocador.app/?ticker_to=${c.symbol.toLowerCase()}&ref=2dzDcvfQJY`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand hover:bg-brand-hover rounded-lg text-[10px] font-semibold text-white transition-colors"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Buy
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[#848e9c] text-sm">No coins found.</div>
      )}
    </div>
  );
}
