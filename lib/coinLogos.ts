/**
 * Coin / asset logo resolver.
 *
 * Strategy:
 *  1. Check explicit local overrides (commodities, indices, special tokens).
 *  2. For stocks → Clearbit logo CDN via company domain.
 *  3. For crypto  → CoinCap CDN by symbol.
 *  4. Fallback   → colored letter avatar (handled by the CoinLogo component).
 */

/* ── Local overrides (served from /assets/logos/) ──────── */

const LOCAL: Record<string, string> = {
  GOLD: "/assets/logos/gold.svg",
  SILVER: "/assets/logos/silver.svg",
  CL: "/assets/logos/crude-oil.svg",
  BRENTOIL: "/assets/logos/crude-oil.svg",
  XYZ100: "/assets/logos/xyz100.png",
};

/* ── Stock ticker → company domain (Clearbit logos) ────── */

const STOCK_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com",
  NVDA: "nvidia.com",
  AAPL: "apple.com",
  MSFT: "microsoft.com",
  GOOGL: "google.com",
  AMZN: "amazon.com",
  META: "meta.com",
  AMD: "amd.com",
  INTC: "intel.com",
  PLTR: "palantir.com",
  COIN: "coinbase.com",
  HOOD: "robinhood.com",
  ORCL: "oracle.com",
  MU: "micron.com",
  SNDK: "westerndigital.com",
  MSTR: "microstrategy.com",
  CRCL: "circle.com",
  NFLX: "netflix.com",
  COST: "costco.com",
  LLY: "lilly.com",
  TSM: "tsmc.com",
  RIVN: "rivian.com",
  BABA: "alibaba.com",
  GME: "gamestop.com",
  SOFTBANK: "softbank.jp",
  HYUNDAI: "hyundai.com",
  KIOXIA: "kioxia.com",
  SMSN: "samsung.com",
  CRWV: "coreweave.com",
  SKHX: "skhynix.com",
  EWY: "ishares.com",
  EWJ: "ishares.com",
  URNM: "sprott.com",
  USAR: "ishares.com",
};

/* ── Commodity / Forex / Index → emoji or SVG ──────────── */

const COMMODITY_EMOJI: Record<string, string> = {
  COPPER: "🟤",
  NATGAS: "🔥",
  URANIUM: "☢️",
  ALUMINIUM: "🔩",
  PLATINUM: "⚪",
  PALLADIUM: "🪙",
};

const FOREX_FLAGS: Record<string, string> = {
  JPY: "🇯🇵",
  EUR: "🇪🇺",
  DXY: "🇺🇸",
};

const INDEX_EMOJI: Record<string, string> = {
  JP225: "🇯🇵",
  KR200: "🇰🇷",
};

/* ── Crypto symbol aliases (CoinCap uses different names) ─ */

const CRYPTO_ALIASES: Record<string, string> = {
  HYPE: "hype",
  kSHIB: "shib",
  kPEPE: "pepe",
  kBONK: "bonk",
  kFLOKI: "floki",
  kDOGS: "dogs",
  kNEIRO: "neiro",
  NEIROETH: "neiro",
  PAXG: "pax-gold",
  RENDER: "rndr",
};

/* ── Public API ────────────────────────────────────────── */

export type LogoResult =
  | { type: "url"; src: string }
  | { type: "emoji"; emoji: string }
  | { type: "fallback" };

export function getLogoForTicker(rawName: string): LogoResult {
  const stripped = rawName.includes(":") ? rawName.split(":")[1] : rawName;
  const upper = stripped.toUpperCase();

  // 1. Local override
  if (LOCAL[upper]) {
    return { type: "url", src: LOCAL[upper] };
  }

  // 2. Stock domain → Clearbit
  if (STOCK_DOMAINS[upper]) {
    return {
      type: "url",
      src: `https://logo.clearbit.com/${STOCK_DOMAINS[upper]}`,
    };
  }

  // 3. Commodity emoji
  if (COMMODITY_EMOJI[upper]) {
    return { type: "emoji", emoji: COMMODITY_EMOJI[upper] };
  }

  // 4. Forex flag
  if (FOREX_FLAGS[upper]) {
    return { type: "emoji", emoji: FOREX_FLAGS[upper] };
  }

  // 5. Index emoji
  if (INDEX_EMOJI[upper]) {
    return { type: "emoji", emoji: INDEX_EMOJI[upper] };
  }

  // 6. Crypto → CoinCap CDN
  const alias = CRYPTO_ALIASES[stripped] || stripped.toLowerCase();
  return {
    type: "url",
    src: `https://assets.coincap.io/assets/icons/${alias}@2x.png`,
  };
}
