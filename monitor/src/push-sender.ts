import webpush from "web-push";
import { getActiveSubscriptions, getSupabase, type PushSubscription } from "./supabase.js";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails("mailto:hello@coincess.com", publicKey, privateKey);
  configured = true;
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

async function sendToSubscription(sub: PushSubscription, payload: PushPayload): Promise<boolean> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await getSupabase()
        .from("push_subscriptions")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("endpoint", sub.endpoint);
      console.log(`[push] Deactivated stale subscription: ${sub.endpoint.slice(0, 50)}...`);
    } else {
      console.error(`[push] Failed to send:`, (err as Error).message);
    }
    return false;
  }
}

export async function sendPushToWallet(walletAddress: string, payload: PushPayload): Promise<number> {
  const subs = await getActiveSubscriptions(walletAddress);
  if (!subs.length) return 0;

  let sent = 0;
  for (const sub of subs) {
    const ok = await sendToSubscription(sub, payload);
    if (ok) sent++;
  }
  console.log(`[push] Sent "${payload.title}" to ${sent}/${subs.length} devices for ${walletAddress.slice(0, 10)}...`);
  return sent;
}
