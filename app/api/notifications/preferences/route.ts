import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  const walletAddress = request.nextUrl.searchParams.get("walletAddress");
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: data ?? {
      wallet_address: walletAddress.toLowerCase(),
      fills_enabled: true,
      funding_enabled: false,
      whale_enabled: false,
    },
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, fills_enabled, funding_enabled, whale_enabled } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        wallet_address: walletAddress.toLowerCase(),
        fills_enabled: fills_enabled ?? true,
        funding_enabled: funding_enabled ?? false,
        whale_enabled: whale_enabled ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
