"use client";

import { useState, useEffect, type ReactNode } from "react";
import { BRAND, BRAND_CONFIG } from "@/lib/brand";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [PrivyWrapper, setPrivyWrapper] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    if (!PRIVY_APP_ID) return;

    import("@privy-io/react-auth").then(({ PrivyProvider }) => {
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
            embeddedWallets: {
              ethereum: {
                createOnLogin: "users-without-wallets",
              },
            },
          }}
        >
          {c}
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
