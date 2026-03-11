import { Metadata } from "next";
import Link from "next/link";
import {
  Calculator,
  ArrowRightLeft,
  BookOpen,
  TrendingUp,
  Shield,
  Zap,
  ArrowRight,
  BarChart3,
  Target,
  Eye,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Tools & Resources",
  description:
    "Trading calculators, crypto guides, and educational resources to level up your trading.",
};

const TRADING_TOOLS = [
  {
    icon: Calculator,
    title: "Leverage Calculator",
    desc: "Calculate P&L, liquidation price, and ROE for leveraged perps trades before you enter.",
    href: "/crypto-leverage-calculator",
    tags: ["PNL", "Liquidation", "ROE"],
    accent: "from-rose-500/20 to-rose-500/5",
    iconColor: "text-rose-400",
  },
  {
    icon: BarChart3,
    title: "Prediction Markets",
    desc: "Bet on real-world outcomes — elections, sports, crypto events — powered by Polymarket.",
    href: "/predict",
    tags: ["Polymarket", "Events", "Binary"],
    accent: "from-blue-500/20 to-blue-500/5",
    iconColor: "text-blue-400",
  },
  {
    icon: Target,
    title: "Market Discovery",
    desc: "Browse 100+ perpetual markets, track funding rates, and find trending coins.",
    href: "/coins",
    tags: ["Funding", "Trending", "Markets"],
    accent: "from-amber-500/20 to-amber-500/5",
    iconColor: "text-amber-400",
  },
];

const GUIDES = [
  {
    icon: ArrowRightLeft,
    title: "Swap Guide",
    desc: "Compare aggregators, wallets, and atomic swaps to exchange crypto with maximum privacy.",
    href: "/swap-guide",
    tag: "Privacy",
  },
  {
    icon: Shield,
    title: "Why Privacy Matters",
    desc: "Bitcoin isn't anonymous. Learn why privacy coins like Monero exist and how to protect yourself.",
    href: "/blog/why-privacy-matters-anonymous-crypto",
    tag: "Monero",
  },
  {
    icon: Zap,
    title: "Crypto 101",
    desc: "Get your first crypto in under 5 minutes. No exchanges, no KYC, no jargon.",
    href: "/blog/crypto-101-first-coin-5-minutes",
    tag: "Beginner",
  },
  {
    icon: TrendingUp,
    title: "Exchange vs Swap Aggregator",
    desc: "When to use a centralized exchange and when a swap aggregator is cheaper and faster.",
    href: "/blog/exchange-vs-swap-aggregator",
    tag: "Trading",
  },
  {
    icon: Eye,
    title: "Hot vs Cold Wallets",
    desc: "Understand the trade-offs between convenience and security for storing your crypto.",
    href: "/blog/hot-wallets-vs-cold-wallets",
    tag: "Security",
  },
];

export default function ToolsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-14">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Tools &amp; Resources
        </h1>
        <p className="text-sm text-[#848e9c]">
          Trading calculators, crypto guides, and everything you need to trade
          smarter.
        </p>
      </div>

      {/* Trading Tools */}
      <section className="mb-12">
        <h2 className="text-xs uppercase tracking-widest text-[#4a4e59] font-semibold mb-4">
          Trading Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TRADING_TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group relative bg-[#141620] hover:border-brand/40 rounded-2xl p-5 transition-all hover:shadow-lg hover:shadow-brand/5"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${t.accent} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              <div className="relative">
                <t.icon className={`h-7 w-7 ${t.iconColor} mb-3`} />
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  {t.title}
                </h3>
                <p className="text-xs text-[#848e9c] leading-relaxed mb-3">
                  {t.desc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-[#1e2130] text-[#848e9c]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="mt-3 flex items-center gap-1 text-xs font-medium text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Guides & Education */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-widest text-[#4a4e59] font-semibold">
            Guides &amp; Education
          </h2>
          <Link
            href="/blog"
            className="text-xs text-brand hover:text-brand-hover font-medium transition-colors flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {GUIDES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="flex items-center gap-4 bg-[#141620] hover:border-brand/40 rounded-xl px-4 py-3.5 transition-colors group"
            >
              <g.icon className="h-5 w-5 text-[#848e9c] group-hover:text-brand transition-colors shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {g.title}
                  </h3>
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-[#1e2130] text-[#4a4e59] shrink-0">
                    {g.tag}
                  </span>
                </div>
                <p className="text-xs text-[#848e9c] truncate">{g.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[#2a2e3e] group-hover:text-brand transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
