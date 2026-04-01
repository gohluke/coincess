import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

function db() {
  try {
    return getServiceClient();
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const isPublic = req.nextUrl.searchParams.get("public") === "true";

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  if (isPublic) {
    const { data, error } = await client
      .from("journal_entries")
      .select("*")
      .eq("is_public", true)
      .order("published_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const { data, error } = await client
    .from("journal_entries")
    .select("*")
    .eq("wallet_address", wallet.toLowerCase())
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    wallet_address, title, content, tags, trade_data,
    pnl_amount, coin, mood, is_public, slug, linked_trades,
  } = body;
  if (!wallet_address || !title) {
    return NextResponse.json({ error: "wallet_address and title required" }, { status: 400 });
  }

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const row: Record<string, unknown> = {
    wallet_address: wallet_address.toLowerCase(),
    title,
    content: content ?? "",
    tags: tags ?? [],
    trade_data: trade_data ?? null,
    pnl_amount: pnl_amount ?? null,
    coin: coin ?? null,
    mood: mood ?? null,
    is_public: is_public ?? false,
    linked_trades: linked_trades ?? [],
  };

  if (is_public) {
    row.published_at = new Date().toISOString();
    row.slug = slug || slugify(title);
  }

  const { data, error } = await client
    .from("journal_entries")
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  if (updates.is_public === true && !updates.published_at) {
    updates.published_at = new Date().toISOString();
  }
  if (updates.is_public === true && !updates.slug && updates.title) {
    updates.slug = slugify(updates.title);
  }

  const { data, error } = await client
    .from("journal_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const client = db();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await client.from("journal_entries").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
