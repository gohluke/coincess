"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { Search, X, Star, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { getWs } from "@/lib/hyperliquid/websocket";
import type { MarketInfo } from "@/lib/hyperliquid/types";
import { getMarketCategory, type MarketCategory } from "@/lib/hyperliquid/categories";
import { getLogoForTicker, type LogoResult } from "@/lib/coinLogos";

/* ── Coin logo ──────────────────────────────────────────── */

const FALLBACK_COLORS = [
  "#f6465d", "#0ecb81", "#f0b90b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

function CoinLogo({ symbol, size = 36 }: { symbol: string; size?: number }) {
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
      style={{
        width: size,
        height: size,
        backgroundColor: FALLBACK_COLORS[ci],
        fontSize: size * 0.38,
      }}
    >
      {stripped.charAt(0)}
    </div>
  );
}

/* ── Category tabs ──────────────────────────────────────── */

interface Tab {
  id: MarketCategory | "all" | "hot";
  label: string;
  icon?: React.ReactNode;
}

const TABS: Tab[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites", icon: <Star className="h-3 w-3" /> },
  { id: "hot", label: "Hot", icon: <Flame className="h-3 w-3 text-orange-400" /> },
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Stocks" },
  { id: "commodities", label: "Commodities" },
  { id: "forex", label: "Forex" },
  { id: "indices", label: "Indices" },
];

/* ── Category badge ─────────────────────────────────────── */

function CategoryBadge({ market }: { market: MarketInfo }) {
  const cats = getMarketCategory(market.name);
  if (market.dex && cats.length === 0) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2130] text-[#555a66] font-medium">HIP-3</span>;
  if (cats.includes("stocks")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">Stock</span>;
  if (cats.includes("commodities")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">Commodity</span>;
  if (cats.includes("forex")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">Forex</span>;
  if (cats.includes("indices")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-medium">Index</span>;
  if (cats.includes("meme")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-400 font-medium">Meme</span>;
  if (cats.includes("ai")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-medium">AI</span>;
  if (cats.includes("defi")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">DeFi</span>;
  if (cats.includes("new")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">New</span>;
  return null;
}

/* ── Format helpers ─────────────────────────────────────── */

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}

/* ── Favorites persistence ──────────────────────────────── */

const FAV_KEY = "coincess_favorites";

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/* ── Loading skeleton ───────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 px-5 py-2.5 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-[#1e2130] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-28 rounded bg-[#1e2130]" />
        <div className="h-2.5 w-20 rounded bg-[#1a1d26]" />
      </div>
      <div className="space-y-2 text-right">
        <div className="h-3.5 w-16 rounded bg-[#1e2130] ml-auto" />
        <div className="h-2.5 w-12 rounded bg-[#1a1d26] ml-auto" />
      </div>
    </div>
  );
}

/* ── Live price cell with flash ─────────────────────────── */

function PriceCell({ markPx, prevDayPx }: { markPx: string; prevDayPx: string }) {
  const mark = Number(markPx);
  const prev = Number(prevDayPx);
  const pct = prev > 0 ? ((mark - prev) / prev) * 100 : 0;
  const isUp = pct >= 0;

  const prevMarkRef = useRef(markPx);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (markPx !== prevMarkRef.current) {
      const newMark = Number(markPx);
      const oldMark = Number(prevMarkRef.current);
      setFlash(newMark > oldMark ? "up" : "down");
      prevMarkRef.current = markPx;
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
  }, [markPx]);

  return (
    <div className="text-right shrink-0">
      <p
        className={`text-[13px] font-medium tabular-nums transition-colors duration-300 ${
          flash === "up"
            ? "text-[#0ecb81]"
            : flash === "down"
              ? "text-[#f6465d]"
              : "text-white"
        }`}
      >
        ${fmtPrice(mark)}
      </p>
      <p
        className={`text-[12px] font-medium tabular-nums ${
          isUp ? "text-[#0ecb81]" : "text-[#f6465d]"
        }`}
      >
        {isUp ? "+" : ""}
        {pct.toFixed(2)}%
      </p>
    </div>
  );
}

/* ── Main modal ─────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MarketCategory | "all" | "hot">("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const markets = useTradingStore((s) => s.markets);
  const marketsLoading = useTradingStore((s) => s.marketsLoading);
  const loadMarkets = useTradingStore((s) => s.loadMarkets);
  const updateMids = useTradingStore((s) => s.updateMids);

  const isLoading = marketsLoading || markets.length === 0;

  // Load markets if needed
  useEffect(() => {
    if (open && markets.length === 0) loadMarkets();
  }, [open, markets.length, loadMarkets]);

  // Subscribe to real-time allMids WebSocket while modal is open
  useEffect(() => {
    if (!open) return;
    const ws = getWs();
    const unsub = ws.subscribeAllMids((mids) => {
      updateMids(mids);
    });
    return unsub;
  }, [open, updateMids]);

  // Also do periodic full market refresh (volume, OI, funding) every 8s
  useEffect(() => {
    if (!open) return;
    const store = useTradingStore.getState();
    const timer = setInterval(() => store.refreshMarkets(), 8_000);
    return () => clearInterval(timer);
  }, [open]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveTab("all");
      setFavorites(loadFavorites());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* ── Filtering ──────────────────────────────────────── */

  const byCategory = useMemo(() => {
    if (activeTab === "all") return markets;
    if (activeTab === "hot") {
      return [...markets].sort((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm)).slice(0, 30);
    }
    if (activeTab === "favorites") {
      return markets.filter((m) => favorites.has(m.name));
    }
    return markets.filter((m) => {
      const cats = getMarketCategory(m.name);
      if (activeTab === "crypto") return !m.name.includes(":");
      return cats.includes(activeTab as MarketCategory);
    });
  }, [markets, activeTab, favorites]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = byCategory;
    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q),
      );
    }
    return [...list]
      .sort((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm))
      .slice(0, 80);
  }, [byCategory, query]);

  const favCount = useMemo(
    () => markets.filter((m) => favorites.has(m.name)).length,
    [markets, favorites],
  );

  const handleSelect = useCallback(
    (m: MarketInfo) => {
      // Use the raw API name for the store to resolve correctly;
      // strip any dex prefix (e.g. "@140:TSLA" → "TSLA") for a clean URL.
      const urlCoin = m.name.includes(":") ? m.name.split(":")[1] : m.name;
      router.push(`/trade/${urlCoin}`);
      onClose();
    },
    [router, onClose],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[6vh] sm:pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative w-full max-w-[520px] bg-[#12141a] rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─ Search header (fixed) ─ */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4">
          <Search className="h-[18px] w-[18px] text-[#555a66] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets"
            className="flex-1 bg-transparent text-[15px] text-white placeholder-[#555a66] outline-none"
          />
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#1e2130] hover:bg-[#2a2e3e] transition-colors"
          >
            <X className="h-3.5 w-3.5 text-[#848e9c]" />
          </button>
        </div>

        {/* ─ Category tabs (fixed) ─ */}
        <div className="shrink-0 flex items-center gap-1 px-5 pb-3 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tab.id === "favorites" ? favCount : null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "bg-brand text-white"
                    : "bg-[#1e2130] text-[#848e9c] hover:text-white hover:bg-[#252830]"
                }`}
              >
                {tab.icon}
                {tab.label}
                {count !== null && count > 0 && (
                  <span className={`text-[10px] ${isActive ? "text-white/70" : "text-[#555a66]"}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─ Divider ─ */}
        <div className="shrink-0 h-px bg-[#1e2130]" />

        {/* ─ Section label (fixed) ─ */}
        <div className="shrink-0 px-5 pt-3 pb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#555a66]">
            {query.trim()
              ? `Results (${filtered.length})`
              : activeTab === "all"
                ? "Popular"
                : activeTab === "favorites"
                  ? `Favorites (${favCount})`
                  : TABS.find((t) => t.id === activeTab)?.label ?? "Markets"}
          </p>
          <p className="text-[10px] text-[#3a3e4e]">Price / 24h</p>
        </div>

        {/* ─ Market list (scrollable) ─ */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
          {isLoading ? (
            <>
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#555a66]">
              <Search className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">
                {activeTab === "favorites"
                  ? "No favorites yet"
                  : "No markets found"}
              </p>
              <p className="text-xs mt-1">
                {activeTab === "favorites"
                  ? "Star markets on the trade page to add them here"
                  : "Try a different search term"}
              </p>
            </div>
          ) : (
            filtered.map((m) => {
              const vol = Number(m.dayNtlVlm);
              const displayName = m.displayName || m.name.replace(/^.*:/, "");
              const isFav = favorites.has(m.name);

              return (
                <button
                  key={m.name}
                  onClick={() => handleSelect(m)}
                  className="w-full flex items-center gap-3.5 px-5 py-2.5 hover:bg-[#1a1d26] transition-colors cursor-pointer group"
                >
                  <CoinLogo symbol={m.name} size={36} />

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      {isFav && (
                        <Star className="h-3 w-3 text-[#f0b90b] fill-[#f0b90b] shrink-0" />
                      )}
                      <span className="text-[14px] font-semibold text-white truncate">
                        {displayName}
                      </span>
                      <CategoryBadge market={m} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[#555a66] uppercase">
                        {m.name.replace(/^.*:/, "")}
                      </span>
                      <span className="text-[11px] text-[#3a3e4e]">·</span>
                      <span className="text-[11px] text-[#555a66]">
                        Vol {fmtVol(vol)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {m.maxLeverage > 0 && (
                      <span className="text-[10px] text-[#555a66] tabular-nums whitespace-nowrap">
                        {m.maxLeverage}x
                      </span>
                    )}
                    <PriceCell markPx={m.markPx} prevDayPx={m.prevDayPx} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ─ Footer (minimal) ─ */}
        <div className="shrink-0 h-px bg-[#1e2130]" />
        <div className="shrink-0 px-5 py-2 text-[10px] text-[#3a3e4e]">
          {isLoading ? "Loading markets…" : `${markets.length} markets · Live`}
        </div>
      </div>
    </div>,
    document.body,
  );
}
