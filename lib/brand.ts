/**
 * Centralized brand palette.
 *
 * CSS variables (--brand, --brand-hex, etc.) are defined in globals.css.
 * This file provides the same values for JS contexts (chart libraries, SVG, etc.)
 * that can't read CSS variables at init time.
 *
 * TO REBRAND: change the hex values here AND in globals.css :root / .dark blocks.
 */
export const BRAND = {
  hex: "#FF455B",
  hover: "#E63B50",
  rgb: "255, 69, 91",
  hoverRgb: "230, 59, 80",
} as const;
