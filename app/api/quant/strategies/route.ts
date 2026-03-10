import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const supabase = getServiceClient();

    let query = supabase.from("quant_strategies").select("*").order("created_at", { ascending: false });
    if (wallet) query = query.eq("wallet_address", wallet);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, config, wallet_address } = body;

    if (!type || !wallet_address) {
      return NextResponse.json({ error: "type and wallet_address required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("quant_strategies")
      .insert({ type, config: config ?? {}, wallet_address, status: "paused" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, config } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = getServiceClient();
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (config) updates.config = config;

    const { data, error } = await supabase
      .from("quant_strategies")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = getServiceClient();
    const { error } = await supabase.from("quant_strategies").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
