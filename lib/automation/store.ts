"use client";

import { create } from "zustand";
import type { Strategy, StrategyStatus, TradeLog, AlertRule, AlertHistory } from "./types";
import {
  getAllStrategies,
  putStrategy,
  deleteStrategy as dbDeleteStrategy,
  getRecentTradeLogs,
  clearTradeLogsForStrategy,
  getAllAlerts,
  putAlert,
  deleteAlert as dbDeleteAlert,
  getAlertHistoryRecent,
} from "./storage";
import {
  startEngine,
  stopEngine,
  isEngineRunning,
  setEngineUpdateCallback,
  cleanupStrategy,
} from "./engine";

interface AutomationState {
  strategies: Strategy[];
  logs: TradeLog[];
  alerts: AlertRule[];
  alertHistory: AlertHistory[];
  engineRunning: boolean;
  loading: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  addStrategy: (strategy: Strategy) => Promise<void>;
  updateStrategyStatus: (id: string, status: StrategyStatus) => Promise<void>;
  removeStrategy: (id: string) => Promise<void>;
  toggleEngine: () => void;
  refreshLogs: () => Promise<void>;

  // Alerts
  addAlert: (alert: AlertRule) => Promise<void>;
  updateAlert: (alert: AlertRule) => Promise<void>;
  removeAlert: (id: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
  refreshAlertHistory: () => Promise<void>;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  strategies: [],
  logs: [],
  alerts: [],
  alertHistory: [],
  engineRunning: false,
  loading: true,

  init: async () => {
    set({ loading: true });
    const [strategies, logs, alerts, alertHistory] = await Promise.all([
      getAllStrategies(),
      getRecentTradeLogs(100),
      getAllAlerts(),
      getAlertHistoryRecent(50),
    ]);
    set({ strategies, logs, alerts, alertHistory, loading: false, engineRunning: isEngineRunning() });

    setEngineUpdateCallback(() => get().refresh());

    const hasActive = strategies.some((s) => s.status === "active");
    if (hasActive && !isEngineRunning()) {
      startEngine();
      set({ engineRunning: true });
    }
  },

  refresh: async () => {
    const [strategies, logs] = await Promise.all([
      getAllStrategies(),
      getRecentTradeLogs(100),
    ]);
    set({ strategies, logs, engineRunning: isEngineRunning() });
  },

  addStrategy: async (strategy) => {
    await putStrategy(strategy);
    const strategies = await getAllStrategies();
    set({ strategies });

    if (strategy.status === "active" && !isEngineRunning()) {
      startEngine();
      set({ engineRunning: true });
    }
  },

  updateStrategyStatus: async (id, status) => {
    const strategies = await getAllStrategies();
    const s = strategies.find((s) => s.id === id);
    if (!s) return;

    s.status = status;
    s.updatedAt = Date.now();
    if (status === "active") s.errorMessage = undefined;
    await putStrategy(s);

    const updated = await getAllStrategies();
    set({ strategies: updated });

    const hasActive = updated.some((s) => s.status === "active");
    if (hasActive && !isEngineRunning()) {
      startEngine();
      set({ engineRunning: true });
    } else if (!hasActive && isEngineRunning()) {
      stopEngine();
      set({ engineRunning: false });
    }
  },

  removeStrategy: async (id) => {
    cleanupStrategy(id);
    await dbDeleteStrategy(id);
    await clearTradeLogsForStrategy(id);
    const [strategies, logs] = await Promise.all([
      getAllStrategies(),
      getRecentTradeLogs(100),
    ]);
    set({ strategies, logs });

    if (!strategies.some((s) => s.status === "active") && isEngineRunning()) {
      stopEngine();
      set({ engineRunning: false });
    }
  },

  toggleEngine: () => {
    if (isEngineRunning()) {
      stopEngine();
      set({ engineRunning: false });
    } else {
      startEngine();
      set({ engineRunning: true });
    }
  },

  refreshLogs: async () => {
    const logs = await getRecentTradeLogs(100);
    set({ logs });
  },

  addAlert: async (alert) => {
    await putAlert(alert);
    const alerts = await getAllAlerts();
    set({ alerts });
  },

  updateAlert: async (alert) => {
    await putAlert(alert);
    const alerts = await getAllAlerts();
    set({ alerts });
  },

  removeAlert: async (id) => {
    await dbDeleteAlert(id);
    const alerts = await getAllAlerts();
    set({ alerts });
  },

  refreshAlerts: async () => {
    const alerts = await getAllAlerts();
    set({ alerts });
  },

  refreshAlertHistory: async () => {
    const alertHistory = await getAlertHistoryRecent(50);
    set({ alertHistory });
  },
}));
