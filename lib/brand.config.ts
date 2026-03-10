/**
 * Centralized brand configuration — the ONLY file to change when white-labeling.
 *
 * Controls: app name, URLs, colors, builder fees, PWA manifest, asset paths.
 * CSS variables in globals.css must also be updated to match `colors` below.
 *
 * See REBRAND.md for the full checklist.
 */
export const BRAND_CONFIG = {
  name: "Coincess",
  nameLower: "coincess",
  tagline: "Trade Perps, Predict & Automate",
  description:
    "Trade perpetuals on Hyperliquid, bet on prediction markets, and automate your strategies — all in one app.",
  url: "https://coincess.com",
  twitter: "@coincess",
  category: "Finance",
  keywords: [
    "cryptocurrency",
    "perpetuals",
    "hyperliquid",
    "polymarket",
    "prediction markets",
    "crypto trading",
    "defi",
    "automation",
  ],

  colors: {
    hex: "#FF455B",
    hover: "#E63B50",
    rgb: "255, 69, 91",
    hoverRgb: "230, 59, 80",
  },

  builder: {
    address: "0x635b3B453De75e873A02B4898f615C5E8909070a" as const,
    fee: 10,
    enabled: true,
  },

  assets: {
    icon: "/assets/coincess-icon.png",
    logo: "/assets/coincess-logo.png",
    favicon: "/favicon.png",
  },

  pwa: {
    themeColor: "#FF455B",
    backgroundColor: "#0b0e11",
    startUrl: "/trade",
  },
} as const;

/**
 * Backward-compatible color export used by chart libraries and canvas drawing.
 * Existing `import { BRAND } from "@/lib/brand"` calls still work.
 */
export const BRAND = BRAND_CONFIG.colors;
