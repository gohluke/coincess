import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  Bot,
  Search,
  LayoutDashboard,
  Calculator,
  BookOpen,
  ArrowRight,
  Shield,
  Globe,
  ArrowRightLeft,
} from "lucide-react";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Perpetual Trading",
    desc: "Trade 100+ perpetual futures on Hyperliquid with deep liquidity and sub-second fills.",
    href: "/trade",
    accent: "from-emerald-500/20 to-emerald-500/5",
    iconColor: "text-emerald-400",
  },
  {
    icon: BarChart3,
    title: "Prediction Markets",
    desc: "Bet on real-world outcomes — politics, sports, crypto events — powered by Polymarket.",
    href: "/predictions",
    accent: "from-blue-500/20 to-blue-500/5",
    iconColor: "text-blue-400",
  },
  {
    icon: Bot,
    title: "Quant Automation",
    desc: "Deploy grid bots, momentum scalpers, and funding rate harvesters that run 24/7.",
    href: "/automate",
    accent: "from-rose-500/20 to-rose-500/5",
    iconColor: "text-rose-400",
  },
  {
    icon: Search,
    title: "Market Discovery",
    desc: "Discover trending coins, track live funding rates, and find your next trade setup.",
    href: "/coins",
    accent: "from-amber-500/20 to-amber-500/5",
    iconColor: "text-amber-400",
  },
  {
    icon: LayoutDashboard,
    title: "Portfolio Dashboard",
    desc: "Track positions, P&L, asset allocation, and performance analytics in real time.",
    href: "/dashboard",
    accent: "from-cyan-500/20 to-cyan-500/5",
    iconColor: "text-cyan-400",
  },
];

const STATS = [
  { value: "100+", label: "Perpetual Markets", icon: TrendingUp },
  { value: "100%", label: "No KYC Required", icon: Shield },
  { value: "Fully", label: "On-chain", icon: Globe },
  { value: "Live", label: "Prediction Markets", icon: BarChart3 },
];

const TOOLS = [
  {
    icon: Calculator,
    title: "Leverage Calculator",
    desc: "Plan your perps trades",
    href: "/crypto-leverage-calculator",
  },
  {
    icon: ArrowRightLeft,
    title: "Swap Guide",
    desc: "Exchange crypto privately",
    href: "/swap-guide",
  },
  {
    icon: BookOpen,
    title: "Blog & Guides",
    desc: "Learn about crypto",
    href: "/blog",
  },
];

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <section className="relative overflow-hidden">

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-12 md:pt-28 md:pb-20 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Trade. Predict.
            <br />
            <span className="bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">
              Automate.
            </span>
          </h1>

          <p className="text-base md:text-lg text-[#848e9c] max-w-2xl mx-auto mb-10 leading-relaxed">
            Your all-in-one crypto terminal. Perpetual futures, prediction
            markets, and quant strategies — no middlemen, no KYC.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/trade"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-all hover:scale-[1.03] active:scale-95 shadow-lg shadow-brand/25"
            >
              Start Trading
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/coins"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#141620] border border-[#2a2e3e] hover:border-brand/50 text-white font-semibold text-sm transition-all"
            >
              Explore Markets
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Everything you need
          </h2>
          <p className="text-[#848e9c] text-sm md:text-base">
            One platform for trading, predictions, and automation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group relative bg-[#141620] border border-[#2a2e3e] hover:border-brand/40 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-brand/5"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${f.accent} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              <div className="relative">
                <f.icon className={`h-8 w-8 ${f.iconColor} mb-4`} />
                <h3 className="text-base font-semibold text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-[#848e9c] leading-relaxed">
                  {f.desc}
                </p>
                <span className="mt-4 flex items-center gap-1 text-xs font-medium text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-4 text-center"
            >
              <s.icon className="h-5 w-5 text-brand mx-auto mb-2" />
              <p className="text-xl md:text-2xl font-bold text-white">
                {s.value}
              </p>
              <p className="text-[10px] md:text-xs text-[#848e9c] mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools & Resources */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 text-center">
          Tools &amp; Resources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex items-center gap-3 bg-[#141620] border border-[#2a2e3e] hover:border-brand/40 rounded-xl p-4 transition-colors"
            >
              <t.icon className="h-5 w-5 text-brand shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{t.title}</p>
                <p className="text-[11px] text-[#848e9c]">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e2130] py-8 mt-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#4a4e59]">
            &copy; 2025 Coincess.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#4a4e59]">
            <Link
              href="/blog"
              className="hover:text-white transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/swap-guide"
              className="hover:text-white transition-colors"
            >
              Swap Guide
            </Link>
            <Link
              href="/crypto-leverage-calculator"
              className="hover:text-white transition-colors"
            >
              Calculator
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
