import {
  getActiveAlerts,
  markAlertTriggered,
  getPreferences,
  getAllWallets,
  type NotificationAlert,
} from "./supabase.js";
import { sendPushToWallet } from "./push-sender.js";
import {
  subscribeUserFills,
  subscribeUserFundings,
  subscribeOrderUpdates,
} from "./ws-manager.js";

const PRICE_POLL_INTERVAL = parseInt(process.env.PRICE_POLL_INTERVAL ?? "10000", 10);
const WHALE_THRESHOLD = parseInt(process.env.WHALE_THRESHOLD ?? "100000", 10);

interface HLFill {
  coin: string;
  side: string;
  sz: string;
  px: string;
  closedPnl: string;
  oid: number;
}

interface HLFunding {
  coin: string;
  usdc: string;
  szi: string;
  fundingRate: string;
}

interface HLOrderUpdate {
  order: {
    coin: string;
    side: string;
    sz: string;
    limitPx: string;
    orderType: string;
  };
  status: string;
  statusTimestamp: number;
}

// ── Order Fills ──

function setupFillMonitoring(wallet: string): void {
  subscribeUserFills(wallet, async (data) => {
    const fills = data as HLFill[];
    const prefs = await getPreferences(wallet);
    if (!prefs?.fills_enabled) return;

    for (const fill of fills) {
      const side = fill.side === "B" ? "Buy" : "Sell";
      const pnl = parseFloat(fill.closedPnl);
      const pnlStr = pnl !== 0 ? ` | PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "";

      await sendPushToWallet(wallet, {
        title: `${side} ${fill.coin} Filled`,
        body: `${fill.sz} ${fill.coin} @ $${parseFloat(fill.px).toLocaleString()}${pnlStr}`,
        tag: `fill-${fill.oid}`,
        url: `/trade/${fill.coin}`,
      });
    }
  });
}

// ── Order Updates (limit order fills) ──

function setupOrderMonitoring(wallet: string): void {
  subscribeOrderUpdates(wallet, async (data) => {
    const updates = data as HLOrderUpdate[];
    const prefs = await getPreferences(wallet);
    if (!prefs?.fills_enabled) return;

    for (const update of updates) {
      if (update.status !== "filled") continue;
      const { coin, side, sz, limitPx } = update.order;
      const sideStr = side === "B" ? "Buy" : "Sell";

      await sendPushToWallet(wallet, {
        title: `Limit ${sideStr} Filled`,
        body: `${sz} ${coin} @ $${parseFloat(limitPx).toLocaleString()}`,
        tag: `order-${update.statusTimestamp}`,
        url: `/trade/${coin}`,
      });
    }
  });
}

// ── Funding Payments ──

function setupFundingMonitoring(wallet: string): void {
  subscribeUserFundings(wallet, async (data) => {
    const fundings = data as HLFunding[];
    const prefs = await getPreferences(wallet);
    if (!prefs?.funding_enabled) return;

    for (const f of fundings) {
      const usdc = parseFloat(f.usdc);
      if (Math.abs(usdc) < 0.01) continue;
      const sign = usdc >= 0 ? "+" : "";

      await sendPushToWallet(wallet, {
        title: `Funding: ${f.coin}`,
        body: `${sign}$${usdc.toFixed(4)} (rate: ${(parseFloat(f.fundingRate) * 100).toFixed(4)}%)`,
        tag: `funding-${f.coin}-${Date.now()}`,
        url: "/dashboard",
      });
    }
  });
}

// ── Price Alerts ──

let priceAlertCache: NotificationAlert[] = [];

async function refreshAlerts(): Promise<void> {
  priceAlertCache = await getActiveAlerts();
}

async function checkPriceAlerts(): Promise<void> {
  const priceAlerts = priceAlertCache.filter(
    (a) => a.type === "price_above" || a.type === "price_below",
  );
  if (priceAlerts.length === 0) return;

  const coins = [...new Set(priceAlerts.map((a) => a.coin).filter(Boolean))];
  if (coins.length === 0) return;

  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });
    const mids: Record<string, string> = await res.json();

    for (const alert of priceAlerts) {
      if (!alert.coin || alert.threshold == null) continue;
      const price = parseFloat(mids[alert.coin] ?? "0");
      if (price === 0) continue;

      const triggered =
        (alert.type === "price_above" && price >= alert.threshold) ||
        (alert.type === "price_below" && price <= alert.threshold);

      if (triggered) {
        const direction = alert.type === "price_above" ? "above" : "below";
        await sendPushToWallet(alert.wallet_address, {
          title: `${alert.coin} Price Alert`,
          body: `${alert.coin} is now $${price.toLocaleString()} (${direction} $${alert.threshold.toLocaleString()})`,
          tag: `price-${alert.id}`,
          url: `/trade/${alert.coin}`,
        });

        if (alert.one_shot) {
          await markAlertTriggered(alert.id);
          priceAlertCache = priceAlertCache.filter((a) => a.id !== alert.id);
        }
      }
    }
  } catch (err) {
    console.error("[alert-engine] Price check error:", (err as Error).message);
  }
}

// ── PnL Alerts ──

const dailyPnl = new Map<string, number>();

function trackPnl(wallet: string, closedPnl: number): void {
  const current = dailyPnl.get(wallet) ?? 0;
  dailyPnl.set(wallet, current + closedPnl);
}

async function checkPnlAlerts(): Promise<void> {
  const pnlAlerts = priceAlertCache.filter(
    (a) => a.type === "pnl_above" || a.type === "pnl_below",
  );

  for (const alert of pnlAlerts) {
    if (alert.threshold == null) continue;
    const pnl = dailyPnl.get(alert.wallet_address) ?? 0;

    const triggered =
      (alert.type === "pnl_above" && pnl >= alert.threshold) ||
      (alert.type === "pnl_below" && pnl <= alert.threshold);

    if (triggered) {
      const sign = pnl >= 0 ? "+" : "";
      await sendPushToWallet(alert.wallet_address, {
        title: "Daily PnL Alert",
        body: `Today's PnL: ${sign}$${pnl.toFixed(2)} (threshold: $${alert.threshold.toLocaleString()})`,
        tag: `pnl-${alert.id}`,
        url: "/dashboard",
      });

      if (alert.one_shot) {
        await markAlertTriggered(alert.id);
        priceAlertCache = priceAlertCache.filter((a) => a.id !== alert.id);
      }
    }
  }
}

// Reset daily PnL at midnight UTC
function scheduleDailyReset(): void {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  setTimeout(() => {
    dailyPnl.clear();
    console.log("[alert-engine] Daily PnL reset");
    scheduleDailyReset();
  }, msUntilMidnight);
}

// ── Main Start ──

export async function startAlertEngine(): Promise<void> {
  console.log("[alert-engine] Starting...");

  const wallets = await getAllWallets();
  console.log(`[alert-engine] Monitoring ${wallets.length} wallet(s)`);

  for (const wallet of wallets) {
    setupFillMonitoring(wallet);
    setupOrderMonitoring(wallet);
    setupFundingMonitoring(wallet);

    // Track PnL from fills
    subscribeUserFills(wallet, async (data) => {
      const fills = data as HLFill[];
      for (const fill of fills) {
        const pnl = parseFloat(fill.closedPnl);
        if (pnl !== 0) trackPnl(wallet, pnl);
      }
    });
  }

  // Initial alert load + periodic refresh
  await refreshAlerts();
  setInterval(refreshAlerts, 60_000);

  // Price + PnL alert checks
  setInterval(async () => {
    await checkPriceAlerts();
    await checkPnlAlerts();
  }, PRICE_POLL_INTERVAL);

  scheduleDailyReset();
  console.log(`[alert-engine] Running (price poll: ${PRICE_POLL_INTERVAL}ms, whale threshold: $${WHALE_THRESHOLD})`);
}
