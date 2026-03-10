"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { searchTokens, chainLabel, chainColor, formatUsd, formatPrice, type DexPair } from "@/lib/dexscreener/api";

export function TokenSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const pairs = await searchTokens(val.trim());
        // De-dup by base token address, keep best pair per token
        const seen = new Map<string, DexPair>();
        for (const p of pairs) {
          const key = `${p.chainId}:${p.baseToken.address}`;
          const existing = seen.get(key);
          if (!existing || p.liquidity.usd > existing.liquidity.usd) {
            seen.set(key, p);
          }
        }
        setResults(Array.from(seen.values()).slice(0, 12));
        setOpen(true);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#848e9c]" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search any token by name, symbol, or contract address..."
          className="w-full bg-[#141620] border border-[#2a2e3e] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-[#848e9c] focus:outline-none focus:border-brand transition-colors"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#848e9c] animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#141620] border border-[#2a2e3e] rounded-xl shadow-2xl max-h-[400px] overflow-y-auto scrollbar-thin">
          {results.map((p, i) => (
            <a
              key={`${p.chainId}-${p.pairAddress}-${i}`}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 hover:bg-[#1a1d26] transition-colors border-b border-[#1a1d26] last:border-0"
              onClick={() => setOpen(false)}
            >
              <div className="flex items-center gap-3 min-w-0">
                {p.info?.imageUrl ? (
                  <img src={p.info.imageUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#2a2e3e] flex items-center justify-center text-[10px] font-bold shrink-0">
                    {p.baseToken.symbol[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">{p.baseToken.symbol}</span>
                    <span className="text-[10px] text-[#848e9c] truncate">{p.baseToken.name}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ backgroundColor: `${chainColor(p.chainId)}20`, color: chainColor(p.chainId) }}
                    >
                      {chainLabel(p.chainId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#848e9c]">
                    <span>Liq: {formatUsd(p.liquidity.usd)}</span>
                    <span>Vol: {formatUsd(p.volume.h24)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-xs font-mono">{formatPrice(parseFloat(p.priceUsd))}</div>
                <div className={`text-[10px] ${p.priceChange?.h24 != null && p.priceChange.h24 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {p.priceChange?.h24 != null ? `${p.priceChange.h24 >= 0 ? "+" : ""}${p.priceChange.h24.toFixed(1)}%` : "-"}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
