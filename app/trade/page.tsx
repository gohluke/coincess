"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "coincess:lastTicker";

export default function TradePage() {
  const router = useRouter();

  useEffect(() => {
    const last = localStorage.getItem(STORAGE_KEY)?.toUpperCase() || "BTC";
    router.replace(`/trade/${last}`);
  }, [router]);

  return null;
}
