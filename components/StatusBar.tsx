"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTradingStore } from "@/lib/hyperliquid/store";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { Activity } from "lucide-react";

const MARKETING_ROUTES = ["/", "/blog", "/swap-guide", "/crypto-leverage-calculator"];

function fmt(n: number, decimals = 2): string {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function signedFmt(n: number, decimals = 2): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[#5d6169]">{label}:</span>
      <span className={color ?? "text-[#c8cdd3]"}>{value}</span>
    </div>
  );
}

export function StatusBar() {
  const pathname = usePathname();
  const { address } = useEffectiveAddress();
  const clearinghouse = useTradingStore((s) => s.clearinghouse);
  const openOrders = useTradingStore((s) => s.openOrders);

  const isMarketing = MARKETING_ROUTES.some(
    (r) => pathname === r || (r === "/blog" && pathname.startsWith("/blog/"))
  );

  const stats = useMemo(() => {
    if (!clearinghouse) return null;
    const positions = clearinghouse.assetPositions?.filter(
      (p) => parseFloat(p.position.szi) !== 0,
    ) ?? [];

    let longsNotional = 0;
    let shortsNotional = 0;
    let totalUpnl = 0;

    for (const ap of positions) {
      const pos = ap.position;
      const sz = parseFloat(pos.szi);
      const entryPx = parseFloat(pos.entryPx ?? "0");
      const notional = Math.abs(sz) * entryPx;
      const upnl = parseFloat(pos.unrealizedPnl);
      totalUpnl += upnl;
      if (sz > 0) longsNotional += notional;
      else shortsNotional += notional;
    }

    const delta = longsNotional - shortsNotional;
    const accountValue = parseFloat(clearinghouse.marginSummary.accountValue);

    const buyOrders = openOrders.filter((o) => o.side === "B");
    const sellOrders = openOrders.filter((o) => o.side === "A");
    const buyNotional = buyOrders.reduce((s, o) => s + parseFloat(o.sz) * parseFloat(o.limitPx), 0);
    const sellNotional = sellOrders.reduce((s, o) => s + parseFloat(o.sz) * parseFloat(o.limitPx), 0);

    return {
      open: accountValue,
      longs: longsNotional,
      shorts: shortsNotional,
      delta,
      upnl: totalUpnl,
      orderCount: openOrders.length,
      orderNotional: buyNotional + sellNotional,
      buyCount: buyOrders.length,
      buyNotional,
      sellCount: sellOrders.length,
      sellNotional,
    };
  }, [clearinghouse, openOrders]);

  if (isMarketing || !address || !stats) return null;

  return (
    <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-[#0f1116] border-t border-[#1e2130]">
      <div className="flex items-center gap-4 px-3 h-7 text-[11px] font-medium overflow-x-auto scrollbar-none whitespace-nowrap">
        <Activity className="h-3 w-3 text-[#7C3AED] shrink-0" />
        <Stat label="Open" value={fmt(stats.open)} />
        <Stat label="Longs" value={fmt(stats.longs)} color="text-[#0ecb81]" />
        <Stat label="Shorts" value={fmt(stats.shorts)} color="text-[#f6465d]" />
        <Stat label="Delta" value={signedFmt(stats.delta)} color={stats.delta >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"} />
        <Stat label="UPnL" value={signedFmt(stats.upnl)} color={stats.upnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"} />
        <Stat label="Orders" value={`${stats.orderCount} (${fmt(stats.orderNotional, 0)})`} />
        <Stat
          label="Buys/Sells"
          value={`${stats.buyCount} (${fmt(stats.buyNotional, 0)})/${stats.sellCount} (${fmt(stats.sellNotional, 0)})`}
        />
      </div>
    </div>
  );
}
