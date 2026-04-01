import WebSocket from "ws";

const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";

type MessageHandler = (data: unknown) => void;

interface WsConnection {
  ws: WebSocket | null;
  subscriptions: { type: string; user?: string }[];
  handlers: Map<string, MessageHandler[]>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelay: number;
  alive: boolean;
}

const connections = new Map<string, WsConnection>();

function getOrCreateConnection(key: string): WsConnection {
  let conn = connections.get(key);
  if (!conn) {
    conn = {
      ws: null,
      subscriptions: [],
      handlers: new Map(),
      reconnectTimer: null,
      reconnectDelay: 1000,
      alive: false,
    };
    connections.set(key, conn);
  }
  return conn;
}

function connect(key: string): void {
  const conn = getOrCreateConnection(key);
  if (conn.ws && conn.ws.readyState === WebSocket.OPEN) return;

  console.log(`[ws] Connecting: ${key}`);
  const ws = new WebSocket(HL_WS_URL);

  ws.on("open", () => {
    console.log(`[ws] Connected: ${key}`);
    conn.ws = ws;
    conn.reconnectDelay = 1000;
    conn.alive = true;

    for (const sub of conn.subscriptions) {
      ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
    }
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const channel = msg.channel as string | undefined;
      if (channel) {
        const handlers = conn.handlers.get(channel);
        if (handlers) {
          for (const h of handlers) h(msg.data);
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on("close", () => {
    conn.alive = false;
    console.log(`[ws] Disconnected: ${key}, reconnecting in ${conn.reconnectDelay}ms`);
    scheduleReconnect(key);
  });

  ws.on("error", (err) => {
    console.error(`[ws] Error: ${key}:`, err.message);
    ws.close();
  });

  // Heartbeat
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: "ping" }));
    }
  }, 30_000);

  ws.on("close", () => clearInterval(pingInterval));
  conn.ws = ws;
}

function scheduleReconnect(key: string): void {
  const conn = connections.get(key);
  if (!conn) return;
  if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
  conn.reconnectTimer = setTimeout(() => {
    conn.reconnectDelay = Math.min(conn.reconnectDelay * 2, 60_000);
    connect(key);
  }, conn.reconnectDelay);
}

export function subscribeUserFills(walletAddress: string, handler: MessageHandler): void {
  const key = `user:${walletAddress}`;
  const conn = getOrCreateConnection(key);
  const sub = { type: "userFills", user: walletAddress };
  conn.subscriptions.push(sub);
  if (!conn.handlers.has("userFills")) conn.handlers.set("userFills", []);
  conn.handlers.get("userFills")!.push(handler);
  connect(key);
}

export function subscribeUserFundings(walletAddress: string, handler: MessageHandler): void {
  const key = `user:${walletAddress}`;
  const conn = getOrCreateConnection(key);
  const sub = { type: "userFundings", user: walletAddress };
  conn.subscriptions.push(sub);
  if (!conn.handlers.has("userFundings")) conn.handlers.set("userFundings", []);
  conn.handlers.get("userFundings")!.push(handler);
  connect(key);
}

export function subscribeOrderUpdates(walletAddress: string, handler: MessageHandler): void {
  const key = `user:${walletAddress}`;
  const conn = getOrCreateConnection(key);
  const sub = { type: "orderUpdates", user: walletAddress };
  conn.subscriptions.push(sub);
  if (!conn.handlers.has("orderUpdates")) conn.handlers.set("orderUpdates", []);
  conn.handlers.get("orderUpdates")!.push(handler);
  connect(key);
}

export function subscribeTrades(coin: string, handler: MessageHandler): void {
  const key = `trades:${coin}`;
  const conn = getOrCreateConnection(key);
  const sub = { type: "trades", coin };
  conn.subscriptions.push(sub);
  if (!conn.handlers.has("trades")) conn.handlers.set("trades", []);
  conn.handlers.get("trades")!.push(handler);
  connect(key);
}
