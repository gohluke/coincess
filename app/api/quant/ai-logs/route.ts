import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const strategyId = searchParams.get("strategy_id");
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

    const supabase = getServiceClient();
    let query = supabase
      .from("ai_agent_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (strategyId) {
      query = query.eq("strategy_id", strategyId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
