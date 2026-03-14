export type MarketCategory =
  | "all" | "favorites" | "hot"
  | "crypto" | "spot" | "major" | "defi" | "meme" | "ai" | "l2" | "gaming"
  | "stocks" | "commodities" | "forex" | "indices"
  | "new";

interface CategoryDef {
  id: MarketCategory;
  label: string;
  emoji: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "all", label: "All", emoji: "" },
  { id: "favorites", label: "Favorites", emoji: "★" },
  { id: "hot", label: "Hot", emoji: "🔥" },
  { id: "crypto", label: "Crypto", emoji: "" },
  { id: "spot", label: "Spot", emoji: "" },
  { id: "stocks", label: "Stocks", emoji: "" },
  { id: "commodities", label: "Commodities", emoji: "" },
  { id: "forex", label: "Forex", emoji: "" },
  { id: "indices", label: "Indices", emoji: "" },
  { id: "major", label: "Major", emoji: "" },
  { id: "defi", label: "DeFi", emoji: "" },
  { id: "meme", label: "Meme", emoji: "" },
  { id: "ai", label: "AI", emoji: "" },
  { id: "l2", label: "L2", emoji: "" },
  { id: "gaming", label: "Gaming", emoji: "" },
  { id: "new", label: "New", emoji: "" },
];

const MAJOR = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOT", "LINK", "LTC",
  "BCH", "ATOM", "UNI", "FIL", "NEAR", "APT", "SUI", "TIA", "TRX", "TON",
  "HBAR", "XLM", "ETC", "ICP", "HYPE", "PAXG", "XMR",
]);

const DEFI = new Set([
  "UNI", "AAVE", "COMP", "MKR", "CRV", "LDO", "FXS", "SNX", "SUSHI", "GMX",
  "DYDX", "INJ", "PENDLE", "STG", "ONDO", "RUNE", "CAKE", "RSR", "ENS",
  "UMA", "EIGEN", "ETHFI", "ENA", "MORPHO", "RENDER", "JUP", "CELO",
  "AERO", "HYPER",
]);

const MEME = new Set([
  "DOGE", "kSHIB", "kPEPE", "WIF", "kBONK", "MEME", "BRETT", "POPCAT",
  "kFLOKI", "TURBO", "MEW", "MYRO", "BOME", "PNUT", "CHILLGUY", "FARTCOIN",
  "kNEIRO", "NEIROETH", "MOODENG", "GOAT", "TRUMP", "MELANIA", "SPX", "PURR",
  "kDOGS", "HMSTR", "PEOPLE", "HPOS", "SHIA", "BIGTIME", "NOT", "VINE",
  "TST", "BABY", "PUMP", "YZY", "MEGA",
]);

const AI = new Set([
  "FET", "RENDER", "TAO", "AR", "AI16Z", "AIXBT", "VIRTUAL", "ZEREBRO",
  "GRIFFAIN", "IO", "GRASS", "KAITO", "PROMPT", "SOPH",
]);

const L2 = new Set([
  "ARB", "OP", "MANTA", "STRK", "ZETA", "BLAST", "PIXEL", "ZK",
  "MINA", "POLYX", "MOVE", "SCROLL", "SCR", "BERA", "LAYER", "LINEA",
  "INIT", "HEMI", "0G", "ASTER", "AZTEC",
]);

const GAMING = new Set([
  "IMX", "GALA", "YGG", "SUPER", "APE", "ILV", "SAND", "GMT",
  "XAI", "PIXEL", "NXPC", "ANIME", "DOOD",
]);

const NEW_LISTINGS = new Set([
  "ZORA", "INIT", "DOOD", "LAUNCHCOIN", "NXPC", "SOPH", "RESOLV",
  "SYRUP", "PUMP", "PROVE", "YZY", "XPL", "WLFI", "LINEA", "SKY",
  "ASTER", "AVNT", "STBL", "0G", "HEMI", "APEX", "2Z", "ZEC", "MON",
  "MET", "MEGA", "CC", "AERO", "STABLE", "FOGO", "LIT", "SKR", "AZTEC",
]);

// HIP-3 (xyz dex) specific sets — matched on the raw name after stripping "xyz:" prefix
const STOCKS = new Set([
  "TSLA", "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AMD", "INTC",
  "PLTR", "COIN", "HOOD", "ORCL", "MU", "SNDK", "MSTR", "CRCL", "NFLX",
  "COST", "LLY", "SKHX", "TSM", "RIVN", "BABA", "GME",
  "SOFTBANK", "HYUNDAI", "KIOXIA", "SMSN", "CRWV",
]);

const COMMODITIES = new Set([
  "GOLD", "SILVER", "CL", "BRENTOIL", "COPPER", "NATGAS", "URANIUM",
  "ALUMINIUM", "PLATINUM", "PALLADIUM",
]);

const FOREX = new Set(["JPY", "EUR", "DXY"]);
const INDICES = new Set(["JP225", "KR200", "XYZ100"]);
const ETFS = new Set(["EWY", "EWJ", "URNM", "USAR"]);

function stripPrefix(name: string): string {
  const idx = name.indexOf(":");
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function isHip3(name: string): boolean {
  return name.includes(":");
}

function isSpot(name: string): boolean {
  return name.startsWith("spot:");
}

export function getMarketCategory(name: string): MarketCategory[] {
  const cats: MarketCategory[] = [];
  const raw = stripPrefix(name);

  if (isSpot(name)) {
    cats.push("spot");
  } else if (isHip3(name)) {
    if (STOCKS.has(raw) || ETFS.has(raw)) cats.push("stocks");
    if (COMMODITIES.has(raw)) cats.push("commodities");
    if (FOREX.has(raw)) cats.push("forex");
    if (INDICES.has(raw)) cats.push("indices");
  } else {
    cats.push("crypto");
    if (MAJOR.has(raw)) cats.push("major");
    if (DEFI.has(raw)) cats.push("defi");
    if (MEME.has(raw)) cats.push("meme");
    if (AI.has(raw)) cats.push("ai");
    if (L2.has(raw)) cats.push("l2");
    if (GAMING.has(raw)) cats.push("gaming");
    if (NEW_LISTINGS.has(raw)) cats.push("new");
  }
  return cats;
}

export function filterByCategory(
  names: string[],
  category: MarketCategory,
  favorites: Set<string>,
): string[] {
  if (category === "all") return names;
  if (category === "favorites") return names.filter((n) => favorites.has(n));
  if (category === "hot") return names;

  if (category === "crypto") return names.filter((n) => !isHip3(n) && !isSpot(n));
  if (category === "spot") return names.filter((n) => isSpot(n));

  const hip3SetMap: Record<string, Set<string>> = {
    stocks: new Set([...STOCKS, ...ETFS]),
    commodities: COMMODITIES,
    forex: FOREX,
    indices: INDICES,
  };
  if (hip3SetMap[category]) {
    return names.filter((n) => {
      const raw = stripPrefix(n);
      return hip3SetMap[category].has(raw);
    });
  }

  const cryptoSetMap: Record<string, Set<string>> = {
    major: MAJOR, defi: DEFI, meme: MEME, ai: AI, l2: L2, gaming: GAMING, new: NEW_LISTINGS,
  };
  const s = cryptoSetMap[category];
  return s ? names.filter((n) => s.has(stripPrefix(n))) : names;
}
