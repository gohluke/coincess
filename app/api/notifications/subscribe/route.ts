import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }
  return NextResponse.json({ publicKey });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, walletAddress, deviceName } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        wallet_address: walletAddress.toLowerCase(),
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        device_name: deviceName || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ensure default notification preferences exist
    await supabase.from("notification_preferences").upsert(
      {
        wallet_address: walletAddress.toLowerCase(),
        fills_enabled: true,
        funding_enabled: false,
        whale_enabled: false,
      },
      { onConflict: "wallet_address" },
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, walletAddress } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const query = supabase
      .from("push_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("endpoint", endpoint);

    if (walletAddress) {
      query.eq("wallet_address", walletAddress.toLowerCase());
    }

    await query;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
