/**
 * Real-time WebSocket price feed from Hyperliquid.
 *
 * Subscribes to `allMids` for live mid-prices across all markets and
 * `userEvents` for fills/liquidations.  Provides instant price updates
 * to the PositionGuard for sub-second SL/TP enforcement.
 */

import WebSocket from "ws";

const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";

export type PriceCallback = (prices: Map<string, number>) => void;

export interface UserEvent {
  type: "fill" | "liquidation" | "funding" | "other";
  coin?: string;
  size?: number;
  price?: number;
  side?: string;
  raw: unknown;
}

export type UserEventCallback = (event: UserEvent) => void;

export class PriceFeed {
  private ws: WebSocket | null = null;
  private prices: Map<string, number> = new Map();
  private priceCallbacks: PriceCallback[] = [];
  private userEventCallbacks: UserEventCallback[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private userAddress: string | null;
  /** Map human-readable coin names to allMids keys (e.g. TSLA -> @264) */
  private aliases: Map<string, string> = new Map();

  constructor(userAddress?: string) {
    this.userAddress = userAddress ?? null;
  }

  onPrice(cb: PriceCallback): void {
    this.priceCallbacks.push(cb);
  }

  onUserEvent(cb: UserEventCallback): void {
    this.userEventCallbacks.push(cb);
  }

  /** Register a coin alias so getPrice("TSLA") resolves to the @N pair key */
  setAlias(coin: string, midKey: string): void {
    this.aliases.set(coin, midKey);
  }

  getPrice(coin: string): number | undefined {
    const key = this.aliases.get(coin) ?? coin;
    return this.prices.get(key);
  }

  getAllPrices(): Map<string, number> {
    return new Map(this.prices);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get priceCount(): number {
    return this.prices.size;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.cleanup();
    console.log("[price-feed] Stopped.");
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  private connect(): void {
    if (!this.running) return;

    try {
      this.ws = new WebSocket(HL_WS_URL);

      this.ws.on("open", () => {
        console.log("[price-feed] WebSocket connected");
        this.reconnectAttempts = 0;
        this.subscribe();
        this.startPing();
      });

      this.ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(msg);
        } catch { /* ignore parse errors */ }
      });

      this.ws.on("close", () => {
        console.log("[price-feed] WebSocket disconnected");
        this.stopPing();
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[price-feed] WS error:", err.message);
      });
    } catch (err) {
      console.error("[price-feed] Connect failed:", (err as Error).message);
      this.scheduleReconnect();
    }
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      method: "subscribe",
      subscription: { type: "allMids" },
    }));

    if (this.userAddress) {
      this.ws.send(JSON.stringify({
        method: "subscribe",
        subscription: { type: "userEvents", user: this.userAddress },
      }));
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const channel = msg.channel as string;
    const data = msg.data as Record<string, unknown> | undefined;
    if (!data) return;

    if (channel === "allMids") {
      const mids = data.mids as Record<string, string> | undefined;
      if (!mids) return;

      for (const [key, priceStr] of Object.entries(mids)) {
        const px = parseFloat(priceStr);
        if (px > 0) this.prices.set(key, px);
      }

      for (const cb of this.priceCallbacks) {
        try { cb(this.prices); } catch (e) {
          console.error("[price-feed] Callback error:", (e as Error).message);
        }
      }
    } else if (channel === "userEvents") {
      const events = data.events as Array<Record<string, unknown>> | undefined;
      if (!events) return;

      for (const evt of events) {
        const parsed = this.parseUserEvent(evt);
        if (!parsed) continue;
        for (const cb of this.userEventCallbacks) {
          try { cb(parsed); } catch (e) {
            console.error("[price-feed] User-event callback error:", (e as Error).message);
          }
        }
      }
    }
  }

  private parseUserEvent(raw: Record<string, unknown>): UserEvent | null {
    const fills = raw.fills as Array<Record<string, string>> | undefined;
    if (fills && fills.length > 0) {
      const f = fills[0];
      return { type: "fill", coin: f.coin, size: parseFloat(f.sz ?? "0"), price: parseFloat(f.px ?? "0"), side: f.side, raw };
    }
    if (raw.liquidation) return { type: "liquidation", coin: (raw.liquidation as Record<string, string>).coin, raw };
    return null;
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.ping();
    }, 30_000);
  }

  private stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("[price-feed] Max reconnects reached");
      }
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60_000);
    this.reconnectAttempts++;
    console.log(`[price-feed] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
