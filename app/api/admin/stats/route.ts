import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BRAND_CONFIG } from "@/lib/brand.config";

const INFO_URL = "https://api.hyperliquid.xyz/info";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address || !BRAND_CONFIG.admin.addresses.includes(address)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sb = getServiceClient();

  // Fetch Coincess traders from Supabase
  let traders: {
    address: string;
    order_count: number;
    coincess_volume: number;
    first_seen: number;
    last_seen: number;
    display_name: string | null;
  }[] = [];

  if (sb) {
    const { data } = await sb
      .from("coincess_traders")
      .select("*")
      .order("coincess_volume", { ascending: false });
    if (data) traders = data;
  }

  const totalTraders = traders.length;
  const totalOrders = traders.reduce((s, t) => s + (t.order_count ?? 0), 0);
  const totalVolume = traders.reduce((s, t) => s + Number(t.coincess_volume ?? 0), 0);

  // Traders active in last 24h / 7d
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const active24h = traders.filter((t) => now - t.last_seen < day).length;
  const active7d = traders.filter((t) => now - t.last_seen < 7 * day).length;

  // New traders in last 24h / 7d
  const new24h = traders.filter((t) => now - t.first_seen < day).length;
  const new7d = traders.filter((t) => now - t.first_seen < 7 * day).length;

  // Builder wallet account value on Hyperliquid (revenue proxy)
  let builderAccountValue = 0;
  try {
    const res = await fetch(INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: BRAND_CONFIG.builder.address,
      }),
    });
    const data = await res.json();
    builderAccountValue = parseFloat(data?.marginSummary?.accountValue ?? "0");
  } catch {
    // non-critical
  }

  // Managed accounts (bot fleet)
  let fleet: {
    address: string;
    strategy: string | null;
    is_active: boolean;
    total_pnl: number;
    total_volume: number;
    trade_count: number;
  }[] = [];

  if (sb) {
    const { data } = await sb
      .from("coincess_accounts")
      .select("address, strategy, is_active, total_pnl, total_volume, trade_count")
      .order("total_volume", { ascending: false });
    if (data) fleet = data;
  }

  const fleetActive = fleet.filter((a) => a.is_active).length;
  const fleetVolume = fleet.reduce((s, a) => s + Number(a.total_volume ?? 0), 0);
  const fleetPnl = fleet.reduce((s, a) => s + Number(a.total_pnl ?? 0), 0);
  const fleetTrades = fleet.reduce((s, a) => s + (a.trade_count ?? 0), 0);

  const advancedFeeRate = BRAND_CONFIG.builder.fee / 100000;
  const simpleFeeRate = BRAND_CONFIG.builder.simpleFee / 100000;
  const estRevenueAdvanced = totalVolume * advancedFeeRate;
  const estRevenueSimple = totalVolume * simpleFeeRate;
  const estRevenue = totalVolume * advancedFeeRate;

  // Top 20 traders by volume
  const topTraders = traders.slice(0, 20).map((t) => ({
    address: t.address,
    volume: Number(t.coincess_volume ?? 0),
    orders: t.order_count ?? 0,
    lastSeen: t.last_seen,
    name: t.display_name,
  }));

  return NextResponse.json({
    overview: {
      totalTraders,
      totalOrders,
      totalVolume,
      active24h,
      active7d,
      new24h,
      new7d,
      builderAccountValue,
      estRevenue,
    },
    fees: {
      advancedBps: BRAND_CONFIG.builder.fee / 10,
      simpleBps: BRAND_CONFIG.builder.simpleFee / 10,
      advancedPct: `${(BRAND_CONFIG.builder.fee / 100).toFixed(3)}%`,
      simplePct: `${(BRAND_CONFIG.builder.simpleFee / 100).toFixed(3)}%`,
      maxApproval: BRAND_CONFIG.builder.maxFeeApproval,
      estRevenueAdvanced,
      estRevenueSimple,
    },
    fleet: {
      total: fleet.length,
      active: fleetActive,
      volume: fleetVolume,
      pnl: fleetPnl,
      trades: fleetTrades,
    },
    topTraders,
    referral: {
      code: BRAND_CONFIG.referral.code,
      link: `${BRAND_CONFIG.url}${BRAND_CONFIG.referral.ghostLink}`,
    },
  });
}
