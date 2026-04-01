import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  client = createClient(url, key);
  return client;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  wallet_address: string;
}

export interface NotificationAlert {
  id: string;
  wallet_address: string;
  type: string;
  coin: string | null;
  threshold: number | null;
  enabled: boolean;
  triggered_at: string | null;
  one_shot: boolean;
}

export interface NotificationPreferences {
  wallet_address: string;
  fills_enabled: boolean;
  funding_enabled: boolean;
  whale_enabled: boolean;
}

export async function getActiveSubscriptions(walletAddress: string): Promise<PushSubscription[]> {
  const { data } = await getSupabase()
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, wallet_address")
    .eq("wallet_address", walletAddress.toLowerCase())
    .eq("is_active", true);
  return data ?? [];
}

export async function getActiveAlerts(): Promise<NotificationAlert[]> {
  const { data } = await getSupabase()
    .from("notification_alerts")
    .select("*")
    .eq("enabled", true);
  return data ?? [];
}

export async function markAlertTriggered(alertId: string): Promise<void> {
  await getSupabase()
    .from("notification_alerts")
    .update({ triggered_at: new Date().toISOString(), enabled: false })
    .eq("id", alertId);
}

export async function getPreferences(walletAddress: string): Promise<NotificationPreferences | null> {
  const { data } = await getSupabase()
    .from("notification_preferences")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .single();
  return data;
}

export async function getAllWallets(): Promise<string[]> {
  const { data } = await getSupabase()
    .from("push_subscriptions")
    .select("wallet_address")
    .eq("is_active", true);
  if (!data) return [];
  return [...new Set(data.map((d) => d.wallet_address))];
}
