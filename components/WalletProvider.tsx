"use client";

import { useState, useEffect, createContext, useContext, useRef, type ReactNode } from "react";
import { arbitrum, mainnet } from "viem/chains";
import { BRAND, BRAND_CONFIG } from "@/lib/brand";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/* ── Privy auth context ───────────────────────────────────────────
 * Exposes Privy state to the tree without requiring downstream
 * components to call Privy hooks directly. This avoids conditional
 * hook violations when Privy is loaded asynchronously.
 */
export interface PrivyAuthState {
  ready: boolean;
  authenticated: boolean;
  user: {
    id: string;
    email?: { address: string };
    google?: { email: string; name?: string };
    wallet?: { address: string; chainType?: string };
    linkedAccounts?: Array<{ type: string; address?: string; email?: string; name?: string }>;
  } | null;
  login: () => void;
  logout: () => Promise<void>;
  wallets: Array<{
    address: string;
    chainType: string;
    walletClientType?: string;
    getEthereumProvider: () => Promise<{
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    }>;
  }>;
}

const DEFAULT_AUTH: PrivyAuthState = {
  ready: false,
  authenticated: false,
  user: null,
  login: () => {},
  logout: async () => {},
  wallets: [],
};

const PrivyAuthContext = createContext<PrivyAuthState>(DEFAULT_AUTH);

export function usePrivyAuth(): PrivyAuthState {
  return useContext(PrivyAuthContext);
}

/* ── WalletProvider ───────────────────────────────────────────── */

export function WalletProvider({ children }: { children: ReactNode }) {
  const [PrivyWrapper, setPrivyWrapper] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    if (!PRIVY_APP_ID) return;

    import("@privy-io/react-auth").then((mod) => {
      const { PrivyProvider } = mod;
      const usePrivy = mod.usePrivy as () => {
        ready: boolean;
        authenticated: boolean;
        user: PrivyAuthState["user"];
        login: () => void;
        logout: () => Promise<void>;
      };
      const useWallets = (mod as Record<string, unknown>).useWallets as
        | (() => { wallets: PrivyAuthState["wallets"] })
        | undefined;

      function PrivyBridge({ children: c }: { children: ReactNode }) {
        const privy = usePrivy();
        const walletsResult = useWallets ? useWallets() : { wallets: [] };
        const stateRef = useRef<PrivyAuthState>(DEFAULT_AUTH);

        stateRef.current = {
          ready: privy.ready,
          authenticated: privy.authenticated,
          user: privy.user,
          login: privy.login,
          logout: privy.logout,
          wallets: walletsResult.wallets ?? [],
        };

        return (
          <PrivyAuthContext.Provider value={stateRef.current}>
            {c}
          </PrivyAuthContext.Provider>
        );
      }
      PrivyBridge.displayName = "PrivyBridge";

      const Wrapper = ({ children: c }: { children: ReactNode }) => (
        <PrivyProvider
          appId={PRIVY_APP_ID!}
          config={{
            appearance: {
              theme: "dark",
              accentColor: BRAND.hex,
              logo: BRAND_CONFIG.assets.logoSvg,
              showWalletLoginFirst: false,
            },
            loginMethods: ["email", "google", "wallet"],
            defaultChain: arbitrum,
            supportedChains: [arbitrum, mainnet],
            embeddedWallets: {
              ethereum: {
                createOnLogin: "users-without-wallets",
              },
            },
          }}
        >
          <PrivyBridge>{c}</PrivyBridge>
        </PrivyProvider>
      );
      Wrapper.displayName = "PrivyWrapper";
      setPrivyWrapper(() => Wrapper);
    }).catch((err) => {
      console.error("Failed to load Privy:", err);
    });
  }, []);

  if (PrivyWrapper) {
    return <PrivyWrapper>{children}</PrivyWrapper>;
  }

  return <>{children}</>;
}
