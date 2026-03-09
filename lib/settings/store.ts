import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LinkedWallet {
  id: string;
  label: string;
  address: string;
  addedAt: number;
}

export interface ApiWalletConfig {
  name: string;
  address: string;
  privateKey: string;
}

export interface DayzeConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
}

interface SettingsState {
  linkedWallets: LinkedWallet[];
  activeWalletId: string | null;
  apiWallet: ApiWalletConfig | null;
  dayze: DayzeConfig | null;

  addWallet: (label: string, address: string) => void;
  removeWallet: (id: string) => void;
  setActiveWallet: (id: string | null) => void;
  updateWalletLabel: (id: string, label: string) => void;
  getActiveAddress: () => string | null;

  setApiWallet: (config: ApiWalletConfig | null) => void;
  clearApiWallet: () => void;

  setDayze: (config: DayzeConfig | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      linkedWallets: [],
      activeWalletId: null,
      apiWallet: null,
      dayze: null,

      addWallet: (label, address) => {
        const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const wallet: LinkedWallet = {
          id,
          label,
          address: address.trim(),
          addedAt: Date.now(),
        };
        set((s) => ({
          linkedWallets: [...s.linkedWallets, wallet],
          activeWalletId: s.activeWalletId ?? id,
        }));
      },

      removeWallet: (id) => {
        set((s) => {
          const remaining = s.linkedWallets.filter((w) => w.id !== id);
          return {
            linkedWallets: remaining,
            activeWalletId:
              s.activeWalletId === id
                ? remaining[0]?.id ?? null
                : s.activeWalletId,
          };
        });
      },

      setActiveWallet: (id) => set({ activeWalletId: id }),

      updateWalletLabel: (id, label) => {
        set((s) => ({
          linkedWallets: s.linkedWallets.map((w) =>
            w.id === id ? { ...w, label } : w,
          ),
        }));
      },

      getActiveAddress: () => {
        const { linkedWallets, activeWalletId } = get();
        if (!activeWalletId) return null;
        return linkedWallets.find((w) => w.id === activeWalletId)?.address ?? null;
      },

      setApiWallet: (config) => set({ apiWallet: config }),
      clearApiWallet: () => set({ apiWallet: null }),

      setDayze: (config) => set({ dayze: config }),
    }),
    {
      name: "coincess-settings",
      partialize: (state) => ({
        linkedWallets: state.linkedWallets,
        activeWalletId: state.activeWalletId,
        apiWallet: state.apiWallet,
        dayze: state.dayze,
      }),
    },
  ),
);
