import type {
  L2Book,
  WsTrade,
  Candle,
  Fill,
  ClearinghouseState,
  OpenOrder,
  SpotClearinghouseState,
} from "./types";

const WS_URL = "wss://api.hyperliquid.xyz/ws";

type MessageHandler = (data: unknown) => void;
type ConnectionState = "disconnected" | "connecting" | "connected";
type ConnectionListener = (state: ConnectionState) => void;

interface Subscription {
  type: string;
  coin?: string;
  interval?: string;
  user?: string;
  dex?: string;
  aggregateByTime?: boolean;
}

export interface WsUserFills {
  isSnapshot: boolean;
  user: string;
  fills: Fill[];
}

export interface WsOrder {
  order: {
    coin: string;
    side: string;
    limitPx: string;
    sz: string;
    oid: number;
    timestamp: number;
    origSz: string;
    cloid?: string;
  };
  status: string;
  statusTimestamp: number;
}

export interface WsUserFunding {
  time: number;
  coin: string;
  usdc: string;
  szi: string;
  fundingRate: string;
}

export interface WsUserFundings {
  isSnapshot: boolean;
  user: string;
  fundings: WsUserFunding[];
}

export interface WsSpotState {
  user: string;
  spotState: SpotClearinghouseState;
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;
const MAX_RETRIES = 50;

export class HyperliquidWs {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private subscriptions = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;
  private _connectionState: ConnectionState = "disconnected";
  private connectionListeners = new Set<ConnectionListener>();

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  onConnectionStateChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => { this.connectionListeners.delete(listener); };
  }

  private setConnectionState(state: ConnectionState) {
    if (this._connectionState === state) return;
    this._connectionState = state;
    for (const listener of this.connectionListeners) listener(state);
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    this.setConnectionState("connecting");
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.setConnectionState("connected");

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
        if (msg.channel === "pong" || msg.channel === "subscriptionResponse") return;

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
      this.setConnectionState("disconnected");

      if (this.retryCount >= MAX_RETRIES) return;
      const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, this.retryCount), BACKOFF_CAP_MS);
      this.retryCount++;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
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

  /* ---- Public market data subscriptions ---- */

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

  subscribeActiveAssetCtx(coin: string, handler: (ctx: { coin: string; ctx: Record<string, string> }) => void) {
    return this.subscribe({ type: "activeAssetCtx", coin }, "activeAssetCtx", handler as MessageHandler);
  }

  /* ---- Private user data subscriptions ---- */

  subscribeUserFills(user: string, handler: (data: WsUserFills) => void) {
    return this.subscribe(
      { type: "userFills", user, aggregateByTime: true },
      "userFills",
      handler as MessageHandler,
    );
  }

  subscribeClearinghouseState(user: string, handler: (state: ClearinghouseState) => void, dex?: string) {
    const sub: Subscription = { type: "clearinghouseState", user };
    if (dex) sub.dex = dex;
    // Use dex-scoped channel key so handlers for different dexes don't collide
    const channel = dex ? `clearinghouseState:${dex}` : "clearinghouseState";
    return this.subscribe(sub, channel, handler as MessageHandler);
  }

  subscribeOrderUpdates(user: string, handler: (orders: WsOrder[]) => void) {
    return this.subscribe(
      { type: "orderUpdates", user },
      "orderUpdates",
      handler as MessageHandler,
    );
  }

  subscribeUserFundings(user: string, handler: (data: WsUserFundings) => void) {
    return this.subscribe(
      { type: "userFundings", user },
      "userFundings",
      handler as MessageHandler,
    );
  }

  subscribeSpotState(user: string, handler: (data: WsSpotState) => void) {
    return this.subscribe(
      { type: "spotState", user },
      "spotState",
      handler as MessageHandler,
    );
  }

  disconnect() {
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.retryCount = 0;
    this.subscriptions.clear();
    this.handlers.clear();
    this.setConnectionState("disconnected");
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
