import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";
import { BRAND_CONFIG } from "@/lib/brand.config";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (
    !address ||
    !BRAND_CONFIG.admin.addresses
      .map((a: string) => a.toLowerCase())
      .includes(address.toLowerCase())
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sb = getServiceClient();
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Check if tables exist first
    const tableCheck = await sb
      .from("page_views")
      .select("id", { count: "exact", head: true });
    if (tableCheck.error) {
      return NextResponse.json({
        setup_required: true,
        error: "Analytics tables not found. Run: npx tsx scripts/run-analytics-schema.ts",
      });
    }

    const [totalViews, views24h, views7d] = await Promise.all([
      sb
        .from("page_views")
        .select("id", { count: "exact", head: true }),
      sb
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte("created_at", h24),
      sb
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte("created_at", d7),
    ]);

    // Top pages — pull raw data and aggregate in JS (no RPC needed)
    const topPagesRaw = await sb
      .from("page_views")
      .select("path")
      .gte("created_at", d30);

    const pageCounts = new Map<string, number>();
    for (const row of topPagesRaw.data ?? []) {
      pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1);
    }
    const topPages = [...pageCounts.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    // Top clicks
    const topClicksRaw = await sb
      .from("click_events")
      .select("target, event_name")
      .gte("created_at", d7);

    const clickCounts = new Map<string, { target: string; event_name: string; clicks: number }>();
    for (const row of topClicksRaw.data ?? []) {
      const key = `${row.target}::${row.event_name}`;
      const existing = clickCounts.get(key);
      if (existing) {
        existing.clicks++;
      } else {
        clickCounts.set(key, {
          target: row.target,
          event_name: row.event_name,
          clicks: 1,
        });
      }
    }
    const topClicks = [...clickCounts.values()]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 15);

    // Recent user sessions
    const recentUsers = await sb
      .from("user_sessions")
      .select("wallet_address, path, entered_at, duration_ms")
      .order("entered_at", { ascending: false })
      .limit(50);

    // Unique wallets (30d)
    const uniqueWallets = await sb
      .from("page_views")
      .select("wallet_address")
      .not("wallet_address", "is", null)
      .gte("created_at", d30);

    const walletSet = new Set(
      (uniqueWallets.data ?? []).map(
        (r: { wallet_address: string }) => r.wallet_address
      )
    );

    return NextResponse.json({
      overview: {
        total_views: totalViews.count ?? 0,
        views_24h: views24h.count ?? 0,
        views_7d: views7d.count ?? 0,
        unique_wallets_30d: walletSet.size,
      },
      top_pages: topPages,
      recent_users: recentUsers.data ?? [],
      top_clicks: topClicks,
      hourly_views: [],
    });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
