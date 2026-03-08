"use client";

import { useState, useEffect, useCallback } from "react";
import { getConnectedAddress, connectWallet } from "@/lib/hyperliquid/wallet";

interface WalletState {
  address: string | null;
  loading: boolean;
  source: "privy" | "metamask" | null;
  connect: () => Promise<void>;
}

let usePrivyHook: (() => {
  ready: boolean;
  authenticated: boolean;
  user: { wallet?: { address: string } } | null;
  login: () => void;
}) | null = null;

let privyLoaded = false;

function loadPrivy() {
  if (privyLoaded) return;
  privyLoaded = true;
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) return;
  import("@privy-io/react-auth")
    .then((mod) => {
      usePrivyHook = mod.usePrivy as unknown as typeof usePrivyHook;
    })
    .catch(() => {});
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"privy" | "metamask" | null>(null);

  let privyAddr: string | null = null;
  let privyReady = false;
  let privyLogin: (() => void) | null = null;

  try {
    loadPrivy();
    if (usePrivyHook) {
      const privy = usePrivyHook();
      privyReady = privy.ready;
      privyAddr = privy.authenticated ? (privy.user?.wallet?.address ?? null) : null;
      privyLogin = privy.login;
    }
  } catch {
    // Privy not in provider tree
  }

  useEffect(() => {
    if (privyAddr) {
      setAddress(privyAddr);
      setSource("privy");
      setLoading(false);
      return;
    }

    if (privyReady && !privyAddr) {
      getConnectedAddress().then((addr) => {
        if (addr) {
          setAddress(addr);
          setSource("metamask");
        }
        setLoading(false);
      });
    } else if (!usePrivyHook) {
      getConnectedAddress().then((addr) => {
        if (addr) {
          setAddress(addr);
          setSource("metamask");
        }
        setLoading(false);
      });
    }
  }, [privyAddr, privyReady]);

  const connect = useCallback(async () => {
    if (privyLogin) {
      privyLogin();
      return;
    }
    const addr = await connectWallet();
    if (addr) {
      setAddress(addr);
      setSource("metamask");
    }
  }, [privyLogin]);

  return { address, loading, source, connect };
}
