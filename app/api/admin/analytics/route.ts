import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/client";
import { BRAND_CONFIG } from "@/lib/brand.config";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !BRAND_CONFIG.admin.addresses.map((a: string) => a.toLowerCase()).includes(address.toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sb = getServiceClient();
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      totalViews,
      views24h,
      views7d,
      topPages,
      recentUsers,
      topClicks,
      hourlyViews,
    ] = await Promise.all([
      sb.from("page_views").select("id", { count: "exact", head: true }),
      sb.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", h24),
      sb.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", d7),

      sb.rpc("get_top_pages", { since: d30, lim: 20 }).then(r => r.data ?? []),

      sb.from("user_sessions")
        .select("wallet_address, path, entered_at, duration_ms")
        .order("entered_at", { ascending: false })
        .limit(50),

      sb.rpc("get_top_clicks", { since: d7, lim: 15 }).then(r => r.data ?? []),

      sb.rpc("get_hourly_views", { since: d7 }).then(r => r.data ?? []),
    ]);

    const uniqueWallets = await sb
      .from("page_views")
      .select("wallet_address")
      .not("wallet_address", "is", null)
      .gte("created_at", d30);

    const walletSet = new Set((uniqueWallets.data ?? []).map((r: { wallet_address: string }) => r.wallet_address));

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
      hourly_views: hourlyViews,
    });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
