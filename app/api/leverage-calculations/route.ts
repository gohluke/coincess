import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

function db() {
  try {
    return getServiceClient();
  } catch {
    return null;
  }
}

export type LeverageCalcPayload = {
  leverage: string;
  quantity: string;
  entryPrice: string;
  exitPrice: string;
  direction: "long" | "short";
  feeType: "maker" | "taker";
  entryFeeRate: string;
  exitFeeRate: string;
  fundingRate: string;
  durationHours: string;
  /** Hyperliquid mid key when prices came from dropdown, else null for custom */
  coinSymbol: string | null;
};

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await client
    .from("leverage_calculator_saves")
    .select("id, wallet_address, title, payload, created_at")
    .eq("wallet_address", wallet.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { wallet_address, title, payload } = body as {
    wallet_address?: string;
    title?: string | null;
    payload?: LeverageCalcPayload;
  };

  if (!wallet_address || !payload || typeof payload !== "object") {
    return NextResponse.json({ error: "wallet_address and payload required" }, { status: 400 });
  }

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await client
    .from("leverage_calculator_saves")
    .insert({
      wallet_address: wallet_address.toLowerCase(),
      title: title?.trim() || null,
      payload,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!id || !wallet) {
    return NextResponse.json({ error: "id and wallet required" }, { status: 400 });
  }

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await client
    .from("leverage_calculator_saves")
    .delete()
    .eq("id", id)
    .eq("wallet_address", wallet.toLowerCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
