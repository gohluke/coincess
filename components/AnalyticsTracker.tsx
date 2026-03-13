"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("cx_sid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("cx_sid", sid);
  }
  return sid;
}

function getWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("coincess:lastWallet") || null;
  } catch {
    return null;
  }
}

function sendBeacon(payload: Record<string, unknown>) {
  const url = "/api/analytics/track";
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, JSON.stringify(payload));
  } else {
    fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const enterTime = useRef(Date.now());

  useEffect(() => {
    const sid = getSessionId();
    const wallet = getWalletAddress();

    sendBeacon({
      type: "pageview",
      path: pathname,
      referrer: document.referrer || null,
      wallet_address: wallet,
      session_id: sid,
    });

    enterTime.current = Date.now();

    return () => {
      if (wallet) {
        const duration = Date.now() - enterTime.current;
        sendBeacon({
          type: "session",
          wallet_address: wallet,
          session_id: sid,
          path: pathname,
          duration_ms: duration,
        });
      }
    };
  }, [pathname]);

  useEffect(() => {
    const sid = getSessionId();
    const wallet = getWalletAddress();

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      const button = target.closest("button");
      const el = anchor || button;
      if (!el) return;

      const label =
        el.getAttribute("data-track") ||
        el.textContent?.trim().slice(0, 60) ||
        "";
      if (!label) return;

      sendBeacon({
        type: "click",
        event_name: anchor ? "link_click" : "button_click",
        path: pathname,
        target: label,
        wallet_address: wallet,
        session_id: sid,
      });
    }

    document.addEventListener("click", handleClick, { passive: true });
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  return null;
}
