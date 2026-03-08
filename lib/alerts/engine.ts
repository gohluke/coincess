import type { AlertRule, AlertHistory, AlertCondition } from "@/lib/automation/types";
import { getAllAlerts, putAlert, addAlertHistory } from "@/lib/automation/storage";
import { fetchAllMarkets } from "@/lib/hyperliquid/api";
import type { MarketInfo } from "@/lib/hyperliquid/types";

const ALERT_TICK = 10_000;
let alertTimer: ReturnType<typeof setInterval> | null = null;
let onAlertTriggered: ((alert: AlertRule, message: string) => void) | null = null;

export function setAlertCallback(cb: (alert: AlertRule, message: string) => void) {
  onAlertTriggered = cb;
}

function requestNotificationPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // audio context may not be available
  }
}

function checkCondition(condition: AlertCondition, markets: MarketInfo[]): { triggered: boolean; message: string } {
  switch (condition.type) {
    case "price_above": {
      const m = markets.find((mk) => mk.name === condition.coin);
      if (!m) return { triggered: false, message: "" };
      const price = parseFloat(m.markPx);
      if (price >= condition.price) {
        return { triggered: true, message: `${condition.coin} price crossed above $${condition.price} (now $${price.toFixed(2)})` };
      }
      return { triggered: false, message: "" };
    }
    case "price_below": {
      const m = markets.find((mk) => mk.name === condition.coin);
      if (!m) return { triggered: false, message: "" };
      const price = parseFloat(m.markPx);
      if (price <= condition.price) {
        return { triggered: true, message: `${condition.coin} price dropped below $${condition.price} (now $${price.toFixed(2)})` };
      }
      return { triggered: false, message: "" };
    }
    case "market_closing": {
      const endTime = new Date(condition.eventTitle).getTime(); // endDate stored in eventTitle field for simplicity
      if (isNaN(endTime)) return { triggered: false, message: "" };
      const timeLeft = endTime - Date.now();
      if (timeLeft > 0 && timeLeft <= condition.beforeMs) {
        const mins = Math.round(timeLeft / 60_000);
        return { triggered: true, message: `Market "${condition.eventTitle}" closing in ${mins} minutes` };
      }
      return { triggered: false, message: "" };
    }
    default:
      return { triggered: false, message: "" };
  }
}

async function alertTick() {
  const alerts = await getAllAlerts();
  const active = alerts.filter((a) => a.enabled && !a.triggered);
  if (active.length === 0) return;

  let markets: MarketInfo[] = [];
  const needsMarkets = active.some((a) =>
    a.condition.type === "price_above" || a.condition.type === "price_below" ||
    a.condition.type === "pnl_above" || a.condition.type === "pnl_below" ||
    a.condition.type === "whale_move"
  );

  if (needsMarkets) {
    try {
      markets = await fetchAllMarkets();
    } catch {
      return;
    }
  }

  for (const alert of active) {
    const { triggered, message } = checkCondition(alert.condition, markets);
    if (!triggered) continue;

    if (alert.notifyMethod === "browser" || alert.notifyMethod === "both") {
      sendBrowserNotification(`Coincess Alert: ${alert.name}`, message);
    }
    if (alert.notifyMethod === "sound" || alert.notifyMethod === "both") {
      playAlertSound();
    }

    const historyEntry: AlertHistory = {
      id: `ah-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      alertId: alert.id,
      timestamp: Date.now(),
      message,
      acknowledged: false,
    };
    await addAlertHistory(historyEntry);

    if (alert.oneShot) {
      alert.triggered = true;
    }
    alert.lastTriggeredAt = Date.now();
    await putAlert(alert);

    onAlertTriggered?.(alert, message);
  }
}

export function startAlertEngine() {
  if (alertTimer) return;
  requestNotificationPermission();
  alertTick();
  alertTimer = setInterval(alertTick, ALERT_TICK);
}

export function stopAlertEngine() {
  if (alertTimer) {
    clearInterval(alertTimer);
    alertTimer = null;
  }
}
