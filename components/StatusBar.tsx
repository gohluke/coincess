"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { useUserDataStore } from "@/lib/hyperliquid/user-data-store";

const MARKETING_ROUTES = ["/blog", "/swap-guide"];

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

const CONNECTION_COLORS: Record<string, { bg: string; title: string }> = {
  connected: { bg: "bg-[#0ecb81]", title: "Live" },
  connecting: { bg: "bg-[#f0b90b]", title: "Connecting..." },
  disconnected: { bg: "bg-[#f6465d]", title: "Disconnected" },
};

export function StatusBar() {
  const pathname = usePathname();
  const { address } = useEffectiveAddress();
  const ch = useUserDataStore((s) => s.clearinghouse);
  const orders = useUserDataStore((s) => s.openOrders);
  const connectionState = useUserDataStore((s) => s.connectionState);
  const connect = useUserDataStore((s) => s.connect);
  const disconnect = useUserDataStore((s) => s.disconnect);

  // Ensure user data stream is connected when we have an address
  useEffect(() => {
    if (address) connect(address);
    else disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const isMarketing = MARKETING_ROUTES.some(
    (r) => pathname === r || (r === "/blog" && pathname.startsWith("/blog/"))
  );

  const stats = useMemo(() => {
    if (!ch) return null;
    const positions = ch.assetPositions?.filter(
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
    const openNotional = longsNotional + shortsNotional;

    const buyOrders = orders.filter((o) => o.side === "B");
    const sellOrders = orders.filter((o) => o.side === "A");
    const buyNotional = buyOrders.reduce((s, o) => s + parseFloat(o.sz) * parseFloat(o.limitPx), 0);
    const sellNotional = sellOrders.reduce((s, o) => s + parseFloat(o.sz) * parseFloat(o.limitPx), 0);

    return {
      open: openNotional,
      longs: longsNotional,
      shorts: shortsNotional,
      delta,
      upnl: totalUpnl,
      orderCount: orders.length,
      orderNotional: buyNotional + sellNotional,
      buyCount: buyOrders.length,
      buyNotional,
      sellCount: sellOrders.length,
      sellNotional,
    };
  }, [ch, orders]);

  if (isMarketing || !address || !stats) return null;

  const connInfo = CONNECTION_COLORS[connectionState] ?? CONNECTION_COLORS.disconnected;

  return (
    <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-[#0f1116] border-t border-[#1e2130]">
      <div className="flex items-center gap-4 px-3 h-7 text-[11px] font-medium overflow-x-auto scrollbar-none whitespace-nowrap">
        <div className="flex items-center gap-1.5 shrink-0" title={connInfo.title}>
          <span className={`h-2 w-2 rounded-full ${connInfo.bg} ${connectionState === "connecting" ? "animate-pulse" : ""}`} />
          <span className="text-[#5d6169]">WS</span>
        </div>
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
