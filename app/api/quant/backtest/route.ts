import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const strategy = searchParams.get("strategy");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

    const supabase = getServiceClient();
    let query = supabase
      .from("backtest_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (strategy) query = query.eq("strategy_type", strategy);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ runs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { strategy_type, config, coins, days, initial_capital, interval } = body;

    if (!strategy_type) {
      return NextResponse.json({ error: "strategy_type required" }, { status: 400 });
    }

    const validStrategies = ["funding_rate", "momentum", "grid", "mean_reversion", "market_maker", "all"];
    if (!validStrategies.includes(strategy_type)) {
      return NextResponse.json({ error: `Invalid strategy: ${strategy_type}` }, { status: 400 });
    }

    const supabase = getServiceClient();

    const endTime = Date.now();
    const startTime = endTime - (days ?? 7) * 86400_000;

    const { count } = await supabase
      .from("market_candles")
      .select("*", { count: "exact", head: true })
      .gte("open_time", startTime)
      .lte("open_time", endTime);

    if (!count || count < 10) {
      return NextResponse.json({
        error: "Insufficient candle data. Run backfill first: npx tsx scripts/backtest.ts backfill",
        candleCount: count ?? 0,
      }, { status: 400 });
    }

    return NextResponse.json({
      status: "queued",
      message: "Backtest queued. Run via CLI for now: npx tsx scripts/backtest.ts run " + strategy_type,
      params: {
        strategy_type,
        config: config ?? {},
        coins: coins ?? [],
        days: days ?? 7,
        initial_capital: initial_capital ?? 1000,
        interval: interval ?? "5m",
        start_time: startTime,
        end_time: endTime,
        available_candles: count,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
