import { openDB, type IDBPDatabase } from "idb";
import type { Strategy, TradeLog, AlertRule, AlertHistory } from "./types";

const DB_NAME = "coincess-automation";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("strategies")) {
          db.createObjectStore("strategies", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("tradeLogs")) {
          const store = db.createObjectStore("tradeLogs", { keyPath: "id" });
          store.createIndex("strategyId", "strategyId");
          store.createIndex("timestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("alerts")) {
          db.createObjectStore("alerts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("alertHistory")) {
          const store = db.createObjectStore("alertHistory", { keyPath: "id" });
          store.createIndex("alertId", "alertId");
          store.createIndex("timestamp", "timestamp");
        }
      },
    });
  }
  return dbPromise;
}

// --- Strategies ---

export async function getAllStrategies(): Promise<Strategy[]> {
  const db = await getDB();
  return db.getAll("strategies");
}

export async function getStrategy(id: string): Promise<Strategy | undefined> {
  const db = await getDB();
  return db.get("strategies", id);
}

export async function putStrategy(strategy: Strategy): Promise<void> {
  const db = await getDB();
  await db.put("strategies", strategy);
}

export async function deleteStrategy(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("strategies", id);
}

// --- Trade Logs ---

export async function addTradeLog(log: TradeLog): Promise<void> {
  const db = await getDB();
  await db.put("tradeLogs", log);
}

export async function getTradeLogsByStrategy(strategyId: string): Promise<TradeLog[]> {
  const db = await getDB();
  return db.getAllFromIndex("tradeLogs", "strategyId", strategyId);
}

export async function getRecentTradeLogs(limit = 50): Promise<TradeLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("tradeLogs", "timestamp");
  return all.slice(-limit).reverse();
}

export async function clearTradeLogsForStrategy(strategyId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("tradeLogs", "readwrite");
  const index = tx.store.index("strategyId");
  let cursor = await index.openCursor(strategyId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// --- Alerts ---

export async function getAllAlerts(): Promise<AlertRule[]> {
  const db = await getDB();
  return db.getAll("alerts");
}

export async function putAlert(alert: AlertRule): Promise<void> {
  const db = await getDB();
  await db.put("alerts", alert);
}

export async function deleteAlert(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("alerts", id);
}

// --- Alert History ---

export async function addAlertHistory(entry: AlertHistory): Promise<void> {
  const db = await getDB();
  await db.put("alertHistory", entry);
}

export async function getAlertHistoryRecent(limit = 50): Promise<AlertHistory[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("alertHistory", "timestamp");
  return all.slice(-limit).reverse();
}
