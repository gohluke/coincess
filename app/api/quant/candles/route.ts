import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const coin = searchParams.get("coin");
    const interval = searchParams.get("interval") ?? "5m";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "500"), 5000);
    const startTime = searchParams.get("start");
    const endTime = searchParams.get("end");

    const supabase = getServiceClient();

    if (!coin) {
      const { data, error } = await supabase
        .from("data_collection_state")
        .select("coin, interval, last_collected_at, total_candles")
        .order("total_candles", { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { count: totalCandles } = await supabase
        .from("market_candles")
        .select("*", { count: "exact", head: true });

      return NextResponse.json({
        coins: data ?? [],
        totalCandles: totalCandles ?? 0,
      });
    }

    let query = supabase
      .from("market_candles")
      .select("*")
      .eq("coin", coin)
      .eq("interval", interval)
      .order("open_time", { ascending: false })
      .limit(limit);

    if (startTime) query = query.gte("open_time", parseInt(startTime));
    if (endTime) query = query.lte("open_time", parseInt(endTime));

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      coin,
      interval,
      count: data?.length ?? 0,
      candles: (data ?? []).reverse(),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
