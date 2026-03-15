"use client";

import { useState, useMemo } from "react";
import { getLogoForTicker, type LogoResult } from "@/lib/coinLogos";

const FALLBACK_COLORS = [
  "#f6465d", "#0ecb81", "#f0b90b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

export function CoinLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const logo: LogoResult = useMemo(() => getLogoForTicker(symbol), [symbol]);

  if (logo.type === "emoji") {
    return (
      <div
        className="rounded-full flex items-center justify-center bg-[#1e2130] shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {logo.emoji}
      </div>
    );
  }

  if (logo.type === "url" && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo.src}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full shrink-0 object-cover bg-[#1e2130]"
        onError={() => setFailed(true)}
      />
    );
  }

  const ci = symbol.charCodeAt(0) % FALLBACK_COLORS.length;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: FALLBACK_COLORS[ci], fontSize: size * 0.36 }}
    >
      {symbol.charAt(0)}
    </div>
  );
}
