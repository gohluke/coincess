"use client";

import { useState, useEffect, useCallback } from "react";
import { getConnectedAddress, connectWallet } from "@/lib/hyperliquid/wallet";
import { setPrivyProvider } from "@/lib/hyperliquid/signing";
import { usePrivyAuth } from "@/components/WalletProvider";

interface WalletState {
  address: string | null;
  loading: boolean;
  source: "privy" | "metamask" | null;
  connect: () => Promise<void>;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"privy" | "metamask" | null>(null);

  const privy = usePrivyAuth();

  const privyAddr = privy.authenticated ? (privy.user?.wallet?.address ?? null) : null;
  const privyReady = privy.ready;
  const privyLogin = privy.login;
  const privyWallets = privy.wallets;

  useEffect(() => {
    if (privyAddr) {
      const externalWallet = privyWallets.find(
        (w) => w.chainType === "ethereum" && w.walletClientType !== "privy",
      );
      const embeddedWallet = privyWallets.find(
        (w) => w.chainType === "ethereum" && w.walletClientType === "privy",
      );

      const preferredWallet = externalWallet ?? embeddedWallet ?? privyWallets.find(
        (w) => w.address.toLowerCase() === privyAddr!.toLowerCase(),
      );
      const effectiveAddr = preferredWallet?.address ?? privyAddr;
      setAddress(effectiveAddr);
      setSource("privy");
      setLoading(false);
      try { localStorage.setItem("coincess:lastWallet", effectiveAddr); } catch {}

      if (preferredWallet) {
        const walletGetter = () => preferredWallet.getEthereumProvider();
        walletGetter().then((provider) => {
          setPrivyProvider(provider, walletGetter);
        }).catch(() => {});
      }
      return;
    }

    if (!privyAddr) {
      setPrivyProvider(null);
    }

    if (privyReady && !privyAddr) {
      getConnectedAddress().then((addr) => {
        if (addr) {
          setAddress(addr);
          setSource("metamask");
          try { localStorage.setItem("coincess:lastWallet", addr); } catch {}
        }
        setLoading(false);
      });
    } else if (!privy.ready && !PRIVY_APP_ID) {
      getConnectedAddress().then((addr) => {
        if (addr) {
          setAddress(addr);
          setSource("metamask");
          try { localStorage.setItem("coincess:lastWallet", addr); } catch {}
        }
        setLoading(false);
      });
    }
  }, [privyAddr, privyReady, privyWallets.length]);

  const connect = useCallback(async () => {
    if (privyLogin) {
      privyLogin();
      return;
    }
    const addr = await connectWallet();
    if (addr) {
      setAddress(addr);
      setSource("metamask");
      try { localStorage.setItem("coincess:lastWallet", addr); } catch {}
    }
  }, [privyLogin]);

  return { address, loading, source, connect };
}

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
