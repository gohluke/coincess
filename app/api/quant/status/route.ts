import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET() {
  try {
    const supabase = getServiceClient();

    const [stateRes, strategiesRes, tradesRes] = await Promise.all([
      supabase.from("quant_state").select("*").eq("id", 1).single(),
      supabase.from("quant_strategies").select("id, type, status, total_trades, total_pnl, last_executed_at"),
      supabase
        .from("quant_trades")
        .select("*")
        .eq("status", "open")
        .order("opened_at", { ascending: false }),
    ]);

    const state = stateRes.data;
    const strategies = strategiesRes.data ?? [];
    const openTrades = tradesRes.data ?? [];

    // Recent closed trades for PnL chart data
    const { data: recentTrades } = await supabase
      .from("quant_trades")
      .select("pnl, closed_at, strategy_type")
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(100);

    return NextResponse.json({
      engine: state,
      strategies,
      openTrades,
      recentPnl: recentTrades ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { engine_status } = body;

    if (!engine_status) {
      return NextResponse.json({ error: "engine_status required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("quant_state")
      .update({ engine_status })
      .eq("id", 1)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
