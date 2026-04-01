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

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
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

  const subscribe = useCallback(async () => {
    if (!walletAddress) return false;
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;

      const vapidRes = await fetch("/api/notifications/subscribe");
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error("No VAPID key");

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

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          walletAddress,
          deviceName,
        }),
      });

      setSubscription(sub);
      setState("granted");
      return true;
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "default");
      return false;
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
    subscribe,
    unsubscribe,
    testPush,
  };
}
