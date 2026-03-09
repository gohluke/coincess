"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, BarChart3, Bot, LayoutDashboard, Search, Settings } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AuthButton } from "@/components/AuthButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { href: "/trade", label: "Trade", icon: TrendingUp },
  { href: "/coins", label: "Discover", icon: Search },
  { href: "/predictions", label: "Predictions", icon: BarChart3 },
  { href: "/automate", label: "Automate", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MARKETING_ROUTES = ["/", "/blog", "/swap-guide", "/crypto-leverage-calculator"];

export function Navbar() {
  const pathname = usePathname();

  const isMarketing = MARKETING_ROUTES.some(
    (r) => pathname === r || (r === "/blog" && pathname.startsWith("/blog/"))
  );
  if (isMarketing) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#2a2e39] bg-[#0b0e11]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Logo + nav */}
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/dashboard" className="shrink-0">
            <Logo />
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#7C3AED]/15 text-[#7C3AED]"
                      : "text-[#848e9c] hover:text-white hover:bg-[#1a1d26]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Auth button */}
        <div className="flex items-center gap-3 shrink-0">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
