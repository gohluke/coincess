import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const strategyId = searchParams.get("strategy_id");

    const supabase = getServiceClient();

    if (strategyId) {
      const { data, error } = await supabase
        .from("strategy_performance")
        .select("*")
        .eq("strategy_id", strategyId)
        .order("window_end", { ascending: false })
        .limit(50);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ performance: data ?? [] });
    }

    // Aggregate view: latest performance for each strategy
    const { data: strategies, error: stratErr } = await supabase
      .from("quant_strategies")
      .select("id, type, status, total_trades, total_pnl");

    if (stratErr) return NextResponse.json({ error: stratErr.message }, { status: 500 });

    const { data: backtests, error: btErr } = await supabase
      .from("backtest_runs")
      .select("strategy_type, total_pnl, sharpe_ratio, win_rate, max_drawdown, total_trades, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (btErr) return NextResponse.json({ error: btErr.message }, { status: 500 });

    const { data: candles, error: candleErr } = await supabase
      .from("data_collection_state")
      .select("coin, total_candles")
      .order("total_candles", { ascending: false })
      .limit(20);

    if (candleErr) return NextResponse.json({ error: candleErr.message }, { status: 500 });

    return NextResponse.json({
      strategies: strategies ?? [],
      backtests: backtests ?? [],
      dataStatus: candles ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
