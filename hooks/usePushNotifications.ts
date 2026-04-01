"use client";

import { useState, useEffect, useCallback } from "react";

type PushState = "unsupported" | "default" | "granted" | "denied" | "loading";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function usePushNotifications(walletAddress: string | null) {
  const [state, setState] = useState<PushState>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    if (typeof Notification === "undefined") {
      setState("unsupported");
      return;
    }

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setSubscription(existing);
        setState("granted");
      } else {
        setState(Notification.permission === "denied" ? "denied" : "default");
      }
    });
  }, []);

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!walletAddress) return { ok: false, error: "Connect a wallet first" };
    setError(null);
    setState("loading");
    try {
      // iOS requires explicit permission request before pushManager.subscribe()
      if (typeof Notification === "undefined") {
        setState("unsupported");
        return { ok: false, error: "Notifications are not supported on this device" };
      }

      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("denied");
        return { ok: false, error: "Notification permission was denied. Enable in Settings." };
      }
      if (permission !== "granted") {
        setState("default");
        return { ok: false, error: "Notification permission was dismissed. Please try again." };
      }

      const reg = await navigator.serviceWorker.ready;

      const vapidRes = await fetch("/api/notifications/subscribe");
      const { publicKey } = await vapidRes.json();
      if (!publicKey) {
        setState("default");
        return { ok: false, error: "Server not configured for push notifications" };
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const deviceName = /iPhone/.test(navigator.userAgent)
        ? "iPhone"
        : /Android/.test(navigator.userAgent)
          ? "Android"
          : /Mac/.test(navigator.userAgent)
            ? "Mac"
            : "Browser";

      const saveRes = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          walletAddress,
          deviceName,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        setState("default");
        return { ok: false, error: err.error || "Failed to save subscription" };
      }

      setSubscription(sub);
      setState("granted");
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error enabling notifications";
      console.error("[push] subscribe error:", msg);
      setError(msg);
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setState("denied");
      } else {
        setState("default");
      }
      return { ok: false, error: msg };
    }
  }, [walletAddress]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    try {
      await subscription.unsubscribe();
      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          walletAddress,
        }),
      });
      setSubscription(null);
      setState("default");
    } catch {
      // silent
    }
  }, [subscription, walletAddress]);

  const testPush = useCallback(async () => {
    if (!subscription) return false;
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }, [subscription]);

  return {
    state,
    subscription,
    isSubscribed: state === "granted" && !!subscription,
    isStandalone,
    error,
    subscribe,
    unsubscribe,
    testPush,
  };
}
