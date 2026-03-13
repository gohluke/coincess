"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  TrendingUp,
  BarChart3,
  DollarSign,
  Activity,
  Bot,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Clock,
  Loader2,
  Share2,
  ExternalLink,
  Eye,
  MousePointer,
  Globe,
  Wallet,
} from "lucide-react";
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress";
import { BRAND_CONFIG } from "@/lib/brand.config";

type AdminTab = "platform" | "analytics";

interface AnalyticsData {
  overview: {
    total_views: number;
    views_24h: number;
    views_7d: number;
    unique_wallets_30d: number;
  };
  top_pages: { path: string; views: number }[];
  recent_users: { wallet_address: string; path: string; entered_at: string; duration_ms: number | null }[];
  top_clicks: { target: string; event_name: string; clicks: number }[];
  hourly_views: { hour: string; views: number }[];
}

interface Stats {
  overview: {
    totalTraders: number;
    totalOrders: number;
    totalVolume: number;
    active24h: number;
    active7d: number;
    new24h: number;
    new7d: number;
    builderAccountValue: number;
    estRevenue: number;
  };
  fleet: {
    total: number;
    active: number;
    volume: number;
    pnl: number;
    trades: number;
  };
  topTraders: {
    address: string;
    volume: number;
    orders: number;
    lastSeen: number;
    name: string | null;
  }[];
  referral: {
    code: string;
    link: string;
  };
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminPage() {
  const { address } = useEffectiveAddress();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<AdminTab>("platform");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const isAdmin = address && BRAND_CONFIG.admin.addresses.includes(address.toLowerCase());

  const fetchStats = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats?address=${address}`);
      if (!res.ok) {
        setError(res.status === 403 ? "Unauthorized" : "Failed to load");
        return;
      }
      setStats(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const fetchAnalytics = useCallback(async () => {
    if (!address) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?address=${address}`);
      if (res.ok) setAnalytics(await res.json());
    } catch {}
    setAnalyticsLoading(false);
  }, [address]);

  useEffect(() => {
    if (isAdmin) fetchStats();
  }, [isAdmin, fetchStats]);

  useEffect(() => {
    if (isAdmin && tab === "analytics" && !analytics) fetchAnalytics();
  }, [isAdmin, tab, analytics, fetchAnalytics]);

  const handleCopyRef = () => {
    if (!stats) return;
    navigator.clipboard.writeText(stats.referral.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-12 w-12 text-[#848e9c]" />
        <p className="text-[#848e9c] text-sm">Connect your wallet to access the admin dashboard.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-12 w-12 text-[#f6465d]" />
        <p className="text-[#f6465d] text-sm font-semibold">Access Denied</p>
        <p className="text-[#848e9c] text-xs">{shortAddr(address)} is not an admin wallet.</p>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
        <p className="text-[#848e9c] text-sm">Loading admin metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-12 w-12 text-[#f6465d]" />
        <p className="text-[#f6465d] text-sm">{error}</p>
        <button onClick={fetchStats} className="text-xs text-brand underline">
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, fleet, topTraders, referral } = stats;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-xs text-[#848e9c] mt-1">Coincess platform metrics &amp; analytics</p>
        </div>
        <button
          onClick={tab === "analytics" ? fetchAnalytics : fetchStats}
          disabled={loading || analyticsLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141620] text-xs text-[#848e9c] hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading || analyticsLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#141620] rounded-full p-1 w-fit">
        {(["platform", "analytics"] as AdminTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t ? "bg-brand text-white" : "text-[#848e9c] hover:text-white"
            }`}
          >
            {t === "platform" ? "Platform" : "Analytics"}
          </button>
        ))}
      </div>

      {tab === "analytics" && <AnalyticsView data={analytics} loading={analyticsLoading} />}

      {tab === "platform" && <>
      {/* Referral Card */}
      <div className="bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 rounded-2xl p-4 flex items-center gap-4">
        <Share2 className="h-8 w-8 text-brand shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Referral Code: {referral.code}</p>
          <p className="text-xs text-[#848e9c] truncate">{referral.link}</p>
        </div>
        <button
          onClick={handleCopyRef}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand/20 text-brand text-xs font-medium hover:bg-brand/30 transition-colors shrink-0"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy Link"}
        </button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard icon={Users} label="Total Traders" value={overview.totalTraders.toString()} />
        <MetricCard icon={BarChart3} label="Total Orders" value={overview.totalOrders.toLocaleString()} />
        <MetricCard icon={TrendingUp} label="Total Volume" value={formatUsd(overview.totalVolume)} />
        <MetricCard icon={DollarSign} label="Est. Revenue" value={formatUsd(overview.estRevenue)} sub="1bp of volume" />
        <MetricCard icon={DollarSign} label="Builder Balance" value={formatUsd(overview.builderAccountValue)} sub="Hyperliquid perps" />
      </div>

      {/* Activity Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={Activity} label="Active (24h)" value={overview.active24h.toString()} accent />
        <MetricCard icon={Clock} label="Active (7d)" value={overview.active7d.toString()} />
        <MetricCard icon={UserPlus} label="New (24h)" value={overview.new24h.toString()} accent />
        <MetricCard icon={UserPlus} label="New (7d)" value={overview.new7d.toString()} />
      </div>

      {/* Bot Fleet */}
      {fleet.total > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-brand" /> Bot Fleet
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MetricCard icon={Bot} label="Bots Total" value={fleet.total.toString()} />
            <MetricCard icon={Activity} label="Active Bots" value={fleet.active.toString()} accent />
            <MetricCard icon={TrendingUp} label="Fleet Volume" value={formatUsd(fleet.volume)} />
            <MetricCard
              icon={DollarSign}
              label="Fleet PnL"
              value={formatUsd(fleet.pnl)}
              accent={fleet.pnl > 0}
              negative={fleet.pnl < 0}
            />
            <MetricCard icon={BarChart3} label="Fleet Trades" value={fleet.trades.toLocaleString()} />
          </div>
        </div>
      )}

      {/* Top Traders */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Top Traders by Volume</h2>
        {topTraders.length === 0 ? (
          <div className="text-center py-12 bg-[#141620] rounded-2xl">
            <Users className="h-8 w-8 text-[#848e9c] mx-auto mb-2" />
            <p className="text-xs text-[#848e9c]">No traders yet</p>
          </div>
        ) : (
          <div className="bg-[#141620] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e] text-[10px] text-[#555a66] uppercase tracking-wider font-medium">
              <span>#</span>
              <span>Trader</span>
              <span className="text-right">Volume</span>
              <span className="text-right">Orders</span>
              <span className="text-right hidden sm:block">Last Active</span>
            </div>
            {topTraders.map((t, i) => (
              <div
                key={t.address}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e]/50 last:border-b-0 hover:bg-[#1a1d2e] transition-colors items-center"
              >
                <span className="text-[10px] text-[#555a66] w-5 text-right tabular-nums">{i + 1}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <a
                    href={`https://app.hyperliquid.xyz/explorer/address/${t.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white font-mono hover:text-brand transition-colors truncate"
                  >
                    {t.name || shortAddr(t.address)}
                  </a>
                  <ExternalLink className="h-2.5 w-2.5 text-[#555a66] shrink-0" />
                </div>
                <span className="text-xs text-white tabular-nums text-right">{formatUsd(t.volume)}</span>
                <span className="text-xs text-[#848e9c] tabular-nums text-right">{t.orders}</span>
                <span className="text-[10px] text-[#555a66] tabular-nums text-right hidden sm:block">{timeAgo(t.lastSeen)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

/* ──────────────── Analytics View ──────────────── */

function AnalyticsView({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
        <p className="text-[#848e9c] text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-[#848e9c] text-sm">
        No analytics data yet. Views will appear as users visit the site.
      </div>
    );
  }

  const { overview, top_pages, recent_users, top_clicks } = data;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={Eye} label="Total Views" value={overview.total_views.toLocaleString()} />
        <MetricCard icon={Eye} label="Views (24h)" value={overview.views_24h.toLocaleString()} accent />
        <MetricCard icon={Globe} label="Views (7d)" value={overview.views_7d.toLocaleString()} />
        <MetricCard icon={Wallet} label="Unique Wallets (30d)" value={overview.unique_wallets_30d.toLocaleString()} />
      </div>

      {/* Top Pages */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-brand" /> Top Pages (30d)
        </h2>
        {top_pages.length === 0 ? (
          <div className="text-center py-12 bg-[#141620] rounded-2xl">
            <Globe className="h-8 w-8 text-[#848e9c] mx-auto mb-2" />
            <p className="text-xs text-[#848e9c]">No page views recorded yet</p>
          </div>
        ) : (
          <div className="bg-[#141620] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e] text-[10px] text-[#555a66] uppercase tracking-wider font-medium">
              <span>Page</span>
              <span className="text-right">Views</span>
            </div>
            {top_pages.map((p) => (
              <div
                key={p.path}
                className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e]/50 last:border-b-0 hover:bg-[#1a1d2e] transition-colors"
              >
                <span className="text-xs text-white font-mono truncate">{p.path}</span>
                <span className="text-xs text-white tabular-nums text-right">{Number(p.views).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Clicks */}
      {top_clicks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <MousePointer className="h-4 w-4 text-brand" /> Top Clicks (7d)
          </h2>
          <div className="bg-[#141620] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e] text-[10px] text-[#555a66] uppercase tracking-wider font-medium">
              <span>Element</span>
              <span>Type</span>
              <span className="text-right">Clicks</span>
            </div>
            {top_clicks.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e]/50 last:border-b-0 hover:bg-[#1a1d2e] transition-colors"
              >
                <span className="text-xs text-white truncate">{c.target}</span>
                <span className="text-[10px] text-[#848e9c] px-2 py-0.5 bg-[#1a1d26] rounded-full">{c.event_name}</span>
                <span className="text-xs text-white tabular-nums text-right">{Number(c.clicks).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Logged-in Users */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-brand" /> Recent User Activity
        </h2>
        {recent_users.length === 0 ? (
          <div className="text-center py-12 bg-[#141620] rounded-2xl">
            <Users className="h-8 w-8 text-[#848e9c] mx-auto mb-2" />
            <p className="text-xs text-[#848e9c]">No logged-in user sessions yet</p>
          </div>
        ) : (
          <div className="bg-[#141620] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e] text-[10px] text-[#555a66] uppercase tracking-wider font-medium">
              <span>Wallet</span>
              <span>Page</span>
              <span className="text-right">Duration</span>
              <span className="text-right hidden sm:block">When</span>
            </div>
            {recent_users.map((u, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2.5 border-b border-[#2a2e3e]/50 last:border-b-0 hover:bg-[#1a1d2e] transition-colors items-center"
              >
                <span className="text-xs text-brand font-mono">{shortAddr(u.wallet_address)}</span>
                <span className="text-xs text-white font-mono truncate">{u.path}</span>
                <span className="text-xs text-[#848e9c] tabular-nums text-right">
                  {u.duration_ms ? `${Math.round(u.duration_ms / 1000)}s` : "–"}
                </span>
                <span className="text-[10px] text-[#555a66] tabular-nums text-right hidden sm:block">
                  {timeAgo(new Date(u.entered_at).getTime())}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  negative,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="bg-[#141620] rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-[#555a66]" />
        <span className="text-[10px] text-[#848e9c] uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`text-lg font-bold tabular-nums ${
          negative ? "text-[#f6465d]" : accent ? "text-[#0ecb81]" : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#555a66] mt-0.5">{sub}</p>}
    </div>
  );
}
