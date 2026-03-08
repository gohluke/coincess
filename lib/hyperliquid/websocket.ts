import type { L2Book, WsTrade, Candle } from "./types";

const WS_URL = "wss://api.hyperliquid.xyz/ws";

type MessageHandler = (data: unknown) => void;

interface Subscription {
  type: string;
  coin?: string;
  interval?: string;
}

export class HyperliquidWs {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private subscriptions = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      for (const sub of this.subscriptions) {
        this.ws?.send(JSON.stringify({
          method: "subscribe",
          subscription: JSON.parse(sub),
        }));
      }
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ method: "ping" }));
        }
      }, 15000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.channel === "pong") return;

        const channel = msg.channel as string;
        const handlers = this.handlers.get(channel);
        if (handlers) {
          for (const handler of handlers) handler(msg.data);
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private cleanup() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private subscribe(sub: Subscription, channel: string, handler: MessageHandler) {
    const key = JSON.stringify(sub);
    this.subscriptions.add(key);

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
    }

    return () => {
      this.handlers.get(channel)?.delete(handler);
      if (this.handlers.get(channel)?.size === 0) {
        this.handlers.delete(channel);
        this.subscriptions.delete(key);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ method: "unsubscribe", subscription: sub }));
        }
      }
    };
  }

  subscribeL2Book(coin: string, handler: (book: L2Book) => void) {
    return this.subscribe({ type: "l2Book", coin }, "l2Book", handler as MessageHandler);
  }

  subscribeTrades(coin: string, handler: (trades: WsTrade[]) => void) {
    return this.subscribe({ type: "trades", coin }, "trades", handler as MessageHandler);
  }

  subscribeCandle(coin: string, interval: string, handler: (candles: Candle[]) => void) {
    return this.subscribe(
      { type: "candle", coin, interval },
      "candle",
      handler as MessageHandler,
    );
  }

  subscribeAllMids(handler: (mids: Record<string, string>) => void) {
    return this.subscribe({ type: "allMids" }, "allMids", (data) => {
      const d = data as { mids: Record<string, string> };
      handler(d.mids);
    });
  }

  disconnect() {
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.subscriptions.clear();
    this.handlers.clear();
    this.ws?.close();
    this.ws = null;
  }
}

let instance: HyperliquidWs | null = null;

export function getWs(): HyperliquidWs {
  if (!instance) {
    instance = new HyperliquidWs();
    instance.connect();
  }
  return instance;
}
