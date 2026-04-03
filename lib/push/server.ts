import webpush from "web-push";
import { getServiceClient } from "@/lib/supabase/client";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails("mailto:hello@coincess.com", publicKey, privateKey);
  configured = true;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(
  subscription: PushSubscriptionData,
  payload: { title: string; body: string; tag?: string; url?: string },
) {
  ensureConfigured();
  const pushSub = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
  try {
    await webpush.sendNotification(pushSub, JSON.stringify(payload));
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await deactivateSubscription(subscription.endpoint);
    }
    return false;
  }
}

export async function sendPushToWallet(
  walletAddress: string,
  payload: { title: string; body: string; tag?: string; url?: string },
) {
  const supabase = getServiceClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("wallet_address", walletAddress.toLowerCase())
    .eq("is_active", true);

  if (!subs?.length) return 0;

  let sent = 0;
  for (const sub of subs) {
    const ok = await sendPush(sub, payload);
    if (ok) sent++;
  }
  return sent;
}

async function deactivateSubscription(endpoint: string) {
  const supabase = getServiceClient();
  await supabase
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint);
}
