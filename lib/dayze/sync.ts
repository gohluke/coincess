import type { DayzeConfig } from "@/lib/settings/store";

interface DayzeActivity {
  source: "coincess";
  activity_type: string;
  title: string;
  metadata: Record<string, unknown>;
  occurred_at?: string;
}

export async function pushActivity(
  config: DayzeConfig,
  activity: DayzeActivity,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.enabled || !config.apiKey) {
    return { ok: false, error: "Dayze sync not configured" };
  }

  try {
    const res = await fetch(`${config.baseUrl}/api/v1/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(activity),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function formatTradeActivity(trade: {
  coin: string;
  side: string;
  size: string;
  price: string;
  pnl?: string;
  closedAt?: string;
}): DayzeActivity {
  const pnlStr = trade.pnl ? ` | PnL: $${trade.pnl}` : "";
  return {
    source: "coincess",
    activity_type: "trade_closed",
    title: `${trade.side.toUpperCase()} ${trade.size} ${trade.coin} @ $${trade.price}${pnlStr}`,
    metadata: {
      coin: trade.coin,
      side: trade.side,
      size: trade.size,
      price: trade.price,
      pnl: trade.pnl,
    },
    occurred_at: trade.closedAt,
  };
}

export function formatDailyPnlActivity(pnl: {
  date: string;
  totalPnl: string;
  tradeCount: number;
  topWin?: string;
  topLoss?: string;
}): DayzeActivity {
  const sign = parseFloat(pnl.totalPnl) >= 0 ? "+" : "";
  return {
    source: "coincess",
    activity_type: "daily_pnl",
    title: `Daily PnL: ${sign}$${pnl.totalPnl} (${pnl.tradeCount} trades)`,
    metadata: {
      date: pnl.date,
      total_pnl: pnl.totalPnl,
      trade_count: pnl.tradeCount,
      top_win: pnl.topWin,
      top_loss: pnl.topLoss,
    },
    occurred_at: new Date(pnl.date + "T23:59:59Z").toISOString(),
  };
}

export function formatPositionActivity(position: {
  coin: string;
  side: string;
  size: string;
  entryPrice: string;
  leverage?: string;
}): DayzeActivity {
  const lev = position.leverage ? ` ${position.leverage}x` : "";
  return {
    source: "coincess",
    activity_type: "position_opened",
    title: `Opened ${position.side.toUpperCase()}${lev} ${position.size} ${position.coin} @ $${position.entryPrice}`,
    metadata: {
      coin: position.coin,
      side: position.side,
      size: position.size,
      entry_price: position.entryPrice,
      leverage: position.leverage,
    },
  };
}
