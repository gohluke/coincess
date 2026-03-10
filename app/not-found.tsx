import Link from "next/link";
import {
  Home,
  TrendingUp,
  Search,
  BarChart3,
  Bot,
  Calculator,
  BookOpen,
  ArrowRightLeft,
} from "lucide-react";

const QUICK_LINKS = [
  { href: "/trade", label: "Trade", icon: TrendingUp },
  { href: "/coins", label: "Discover", icon: Search },
  { href: "/predict", label: "Predict", icon: BarChart3 },
  { href: "/automate", label: "Automate", icon: Bot },
  { href: "/crypto-leverage-calculator", label: "Calculator", icon: Calculator },
  { href: "/swap-guide", label: "Swap Guide", icon: ArrowRightLeft },
  { href: "/blog", label: "Blog", icon: BookOpen },
];

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-lg w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-brand/10 rounded-full blur-2xl" />
            <div className="relative bg-[#141620] border border-[#2a2e3e] rounded-2xl p-5">
              <span className="text-4xl">🔍</span>
            </div>
          </div>
        </div>

        <h1 className="text-7xl font-black bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent mb-3">
          404
        </h1>
        <h2 className="text-xl font-bold text-white mb-4">Page Not Found</h2>
        <p className="text-sm text-[#848e9c] mb-8 max-w-sm mx-auto leading-relaxed">
          The link might be broken or the page may have been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-all hover:scale-[1.03] active:scale-95 shadow-lg shadow-brand/25"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="/trade"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-brand/50 text-white font-semibold text-sm transition-all"
          >
            <TrendingUp className="h-4 w-4" />
            Start Trading
          </Link>
        </div>

        <div className="border-t border-[#1e2130] pt-8">
          <p className="text-[10px] uppercase tracking-widest text-[#4a4e59] mb-4">
            Quick Links
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#141620] border border-[#2a2e3e] hover:border-brand/40 transition-colors group"
              >
                <Icon className="h-4 w-4 text-[#848e9c] group-hover:text-brand transition-colors" />
                <span className="text-[10px] font-medium text-[#848e9c] group-hover:text-white transition-colors">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
