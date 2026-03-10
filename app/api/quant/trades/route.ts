import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const strategyId = searchParams.get("strategy_id");
    const status = searchParams.get("status");

    const supabase = getServiceClient();
    let query = supabase
      .from("quant_trades")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(limit);

    if (strategyId) query = query.eq("strategy_id", strategyId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const totalPnl = (data ?? []).reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalFees = (data ?? []).reduce((sum, t) => sum + (t.fees ?? 0), 0);

    return NextResponse.json({
      trades: data,
      summary: {
        count: data?.length ?? 0,
        totalPnl,
        totalFees,
        netPnl: totalPnl - totalFees,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
