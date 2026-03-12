"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, TrendingUp, TrendingDown, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { CATEGORIES, filterByCategory, type MarketCategory } from "@/lib/hyperliquid/categories";
import { getLogoForTicker, type LogoResult } from "@/lib/coinLogos";

type SortKey = "name" | "price" | "change" | "volume";

const LS_KEY = "coincess_favorites";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
  } catch { return new Set(); }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...favs]));
}

const FALLBACK_COLORS = [
  "#f6465d", "#0ecb81", "#f0b90b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

function CoinLogo({ symbol, size = 24 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const logo: LogoResult = useMemo(() => getLogoForTicker(symbol), [symbol]);
  const stripped = symbol.replace(/^.*:/, "");

  if (logo.type === "emoji") {
    return (
      <div
        className="rounded-full flex items-center justify-center bg-[#1e2130] shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {logo.emoji}
      </div>
    );
  }

  if (logo.type === "url" && !failed) {
    return (
      <img
        src={logo.src}
        alt={stripped}
        width={size}
        height={size}
        className="rounded-full shrink-0 object-cover bg-[#1e2130]"
        onError={() => setFailed(true)}
      />
    );
  }

  const ci = stripped.charCodeAt(0) % FALLBACK_COLORS.length;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: FALLBACK_COLORS[ci], fontSize: size * 0.36 }}
    >
      {stripped.charAt(0)}
    </div>
  );
}

function marketTypeBadge(name: string): { label: string; color: string } | null {
  if (!name.includes(":")) return null;
  return { label: "HIP-3", color: "#f0b90b" };
}

export function MarketSelector() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MarketCategory>("all");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortAsc, setSortAsc] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { markets, selectedMarket, selectMarket } = useTradingStore();
  const currentMarket = markets.find((m) => m.name === selectedMarket);

  useEffect(() => setFavorites(loadFavorites()), []);

  const toggleFavorite = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      saveFavorites(next);
      return next;
    });
  }, []);

  const totalCount = markets.length;

  const filtered = useMemo(() => {
    let items = markets;

    if (search) {
      const q = search.toUpperCase();
      items = items.filter((m) =>
        m.name.toUpperCase().includes(q) ||
        m.displayName.toUpperCase().includes(q)
      );
    }

    const names = items.map((m) => m.name);
    const catFiltered = filterByCategory(names, category, favorites);
    items = items.filter((m) => catFiltered.includes(m.name));

    items = [...items].sort((a, b) => {
      const pxA = parseFloat(a.markPx);
      const pxB = parseFloat(b.markPx);
      const prevA = parseFloat(a.prevDayPx);
      const prevB = parseFloat(b.prevDayPx);

      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.displayName.localeCompare(b.displayName); break;
        case "price": cmp = pxA - pxB; break;
        case "change": {
          const chgA = prevA > 0 ? (pxA - prevA) / prevA : 0;
          const chgB = prevB > 0 ? (pxB - prevB) / prevB : 0;
          cmp = chgA - chgB;
          break;
        }
        case "volume": cmp = parseFloat(a.dayNtlVlm) - parseFloat(b.dayNtlVlm); break;
      }
      return sortAsc ? cmp : -cmp;
    });

    if (category === "hot") items = items.slice(0, 30);

    return items;
  }, [markets, search, category, sortKey, sortAsc, favorites]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const markPx = currentMarket ? parseFloat(currentMarket.markPx) : 0;
  const prevPx = currentMarket ? parseFloat(currentMarket.prevDayPx) : 0;
  const change24h = prevPx > 0 ? ((markPx - prevPx) / prevPx) * 100 : 0;
  const isPositive = change24h >= 0;

  const badge = currentMarket ? marketTypeBadge(currentMarket.name) : null;
  const displayLabel = currentMarket?.displayName || selectedMarket;

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#1a1d26] transition-colors"
      >
        <Star
          className={`h-3.5 w-3.5 cursor-pointer transition-colors ${
            favorites.has(selectedMarket) ? "fill-[#f0b90b] text-[#f0b90b]" : "text-[#4a4e59]"
          }`}
          onClick={(e) => toggleFavorite(selectedMarket, e)}
        />
        <CoinLogo symbol={selectedMarket} size={24} />
        <span className="text-white font-bold text-lg">{displayLabel}</span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${badge.color}22`, color: badge.color }}>
            {badge.label}
          </span>
        )}
        <span className="text-[#848e9c] text-xs">/USD</span>
        <ChevronDown className={`h-4 w-4 text-[#848e9c] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {currentMarket && (
        <div className="hidden lg:flex items-center gap-6 ml-4">
          <span className={`text-lg font-semibold ${isPositive ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
            {markPx >= 1 ? markPx.toLocaleString(undefined, { maximumFractionDigits: 2 }) : markPx.toPrecision(5)}
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#848e9c]">24h Change</span>
            <span className={`text-xs font-medium flex items-center gap-1 ${isPositive ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#848e9c]">24h Volume</span>
            <span className="text-xs text-white">
              ${parseFloat(currentMarket.dayNtlVlm) >= 1e9
                ? (parseFloat(currentMarket.dayNtlVlm) / 1e9).toFixed(2) + "B"
                : (parseFloat(currentMarket.dayNtlVlm) / 1e6).toFixed(2) + "M"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#848e9c]">Funding / 8h</span>
            <span className={`text-xs ${parseFloat(currentMarket.funding) >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              {(parseFloat(currentMarket.funding) * 100).toFixed(4)}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#848e9c]">Open Interest</span>
            <span className="text-xs text-white">
              ${(parseFloat(currentMarket.openInterest) * markPx / 1e6).toFixed(2)}M
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#848e9c]">Max Leverage</span>
            <span className="text-xs text-[#f0b90b]">{currentMarket.maxLeverage}x</span>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[520px] bg-[#12141a] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#848e9c]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${totalCount} markets — crypto, stocks, commodities, forex...`}
                className="w-full bg-[#1a1d26] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#4a4e59] focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="flex items-center gap-0.5 px-2 pb-2 overflow-x-auto scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${
                  category === cat.id
                    ? "bg-brand text-white"
                    : "text-[#848e9c] hover:text-white hover:bg-[#1a1d26]"
                }`}
              >
                {cat.emoji ? cat.emoji + " " : ""}{cat.label}
                {cat.id === "favorites" ? ` (${favorites.size})` : ""}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[20px_1.6fr_0.5fr_0.8fr_0.8fr_0.8fr] gap-1 px-3 py-1 text-[10px] text-[#848e9c] uppercase border-b border-[#2a2e39]">
            <span />
            <button className="text-left hover:text-white" onClick={() => handleSort("name")}>
              Market {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
            <span className="text-right">Lev</span>
            <button className="text-right hover:text-white" onClick={() => handleSort("price")}>
              Price {sortKey === "price" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
            <button className="text-right hover:text-white" onClick={() => handleSort("change")}>
              24h % {sortKey === "change" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
            <button className="text-right hover:text-white" onClick={() => handleSort("volume")}>
              Volume {sortKey === "volume" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[#4a4e59] text-sm">
                {category === "favorites" ? "No favorites yet — click ★ to add" : "No markets found"}
              </div>
            ) : (
              filtered.map((m) => {
                const px = parseFloat(m.markPx);
                const prev = parseFloat(m.prevDayPx);
                const chg = prev > 0 ? ((px - prev) / prev) * 100 : 0;
                const pos = chg >= 0;
                const isFav = favorites.has(m.name);
                const mBadge = marketTypeBadge(m.name);

                return (
                  <button
                    key={m.name}
                    onClick={() => {
                      const urlCoin = m.name.includes(":") ? m.name.split(":")[1] : m.name;
                      router.push(`/trade/${urlCoin}`);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`grid grid-cols-[20px_1.6fr_0.5fr_0.8fr_0.8fr_0.8fr] gap-1 w-full px-3 py-2 text-xs hover:bg-[#1a1d26] transition-colors ${
                      m.name === selectedMarket ? "bg-[#1a1d26]" : ""
                    }`}
                  >
                    <Star
                      className={`h-3 w-3 mt-0.5 transition-colors ${
                        isFav ? "fill-[#f0b90b] text-[#f0b90b]" : "text-[#2a2e39] hover:text-[#4a4e59]"
                      }`}
                      onClick={(e) => toggleFavorite(m.name, e)}
                    />
                    <span className="text-left flex items-center gap-1.5">
                      <CoinLogo symbol={m.name} size={20} />
                      <span className="text-white font-medium">{m.displayName}</span>
                      {mBadge && (
                        <span className="text-[8px] px-1 py-0.5 rounded font-medium" style={{ background: `${mBadge.color}22`, color: mBadge.color }}>
                          {mBadge.label}
                        </span>
                      )}
                      <span className="text-[#4a4e59]">/USD</span>
                    </span>
                    <span className="text-right text-[#555a66] tabular-nums">
                      {m.maxLeverage > 0 ? `${m.maxLeverage}x` : "—"}
                    </span>
                    <span className="text-right text-[#eaecef]">
                      {px >= 1000 ? px.toLocaleString(undefined, { maximumFractionDigits: 1 })
                        : px >= 1 ? px.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : px.toPrecision(4)}
                    </span>
                    <span className={`text-right font-medium ${pos ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                      {pos ? "+" : ""}{chg.toFixed(2)}%
                    </span>
                    <span className="text-right text-[#848e9c]">
                      {parseFloat(m.dayNtlVlm) >= 1e9
                        ? "$" + (parseFloat(m.dayNtlVlm) / 1e9).toFixed(1) + "B"
                        : parseFloat(m.dayNtlVlm) >= 1e6
                        ? "$" + (parseFloat(m.dayNtlVlm) / 1e6).toFixed(1) + "M"
                        : "$" + parseFloat(m.dayNtlVlm).toFixed(0)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-[#2a2e39] text-[10px] text-[#4a4e59] text-center">
            {filtered.length} of {totalCount} markets · Crypto, Stocks, Commodities, Forex on Hyperliquid
          </div>
        </div>
      )}
    </div>
  );
}
