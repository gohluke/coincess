"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  TrendingUp, BarChart3, Bot, LayoutDashboard, Search,
  Users, BookOpen, MessageSquare, Wrench, LayoutGrid,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { AuthButton } from "@/components/AuthButton";
import { DepositButton } from "@/components/DepositModal";
import { SearchModal } from "@/components/SearchModal";

const NAV_ICONS = [
  { href: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { href: "/trade/BTC", label: "Trade", icon: TrendingUp },
  { href: "/predict", label: "Predict", icon: BarChart3 },
  { href: "/automate", label: "Automate", icon: Bot },
];

const MORE_LINKS = [
  { href: "/traders", label: "Traders", icon: Users },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/chat", label: "AI Coach", icon: MessageSquare },
  { href: "/tools", label: "Tools", icon: Wrench },
];

const MARKETING_ROUTES = ["/blog", "/swap-guide", "/crypto-leverage-calculator"];

function NavIcon({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: LucideIcon; active: boolean;
}) {
  return (
    <Link href={href} className="group relative flex items-center justify-center">
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
          active
            ? "bg-brand/12 border-brand/25 text-brand"
            : "bg-[#1a1d26] border-[#2a2e3e] text-[#848e9c] hover:bg-[#252830] hover:text-white"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#1e2130] text-[11px] font-medium text-white whitespace-nowrap opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-150 shadow-lg shadow-black/40 z-50">
        {label}
      </span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [gridOpen, setGridOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setGridOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cmd/Ctrl+K to open search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => { setGridOpen(false); }, [pathname]);

  const isMarketing = MARKETING_ROUTES.some(
    (r) => pathname === r || (r === "/blog" && pathname.startsWith("/blog/"))
  );
  if (isMarketing) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#2a2e39] bg-[#0b0e11]/95 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center">
        {/* Logo */}
        <Link href="/dashboard" className="shrink-0">
          <Logo />
        </Link>

        {/* Spacer pushes everything to the right */}
        <div className="flex-1" />

        {/* Right-aligned: Search + Nav icons + Utility icons + Avatar */}
        <div className="flex items-center gap-1.5">
          {/* Search pill — click to open modal */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 bg-[#1a1d26] rounded-full px-3.5 py-2 w-44 lg:w-52 hover:bg-[#1e2130] transition-colors mr-1 cursor-pointer"
          >
            <Search className="h-4 w-4 text-[#555a66] shrink-0" />
            <span className="text-[13px] text-[#555a66] flex-1 text-left">Search</span>
            <kbd className="text-[10px] text-[#3a3e4e] font-mono">⌘K</kbd>
          </button>

          {/* Nav icons (desktop) + More */}
          <nav className="hidden md:flex items-center gap-1.5">
            {NAV_ICONS.map(({ href, label, icon }) => {
              const base = href.startsWith("/trade/") ? "/trade" : href;
              const active = pathname === href || pathname.startsWith(base + "/");
              return <NavIcon key={href} href={href} label={label} icon={icon} active={active} />;
            })}

            {/* Grid / More dropdown (right after Automate) */}
            <div ref={gridRef} className="relative">
              <div className="group relative flex items-center justify-center">
                <button
                  onClick={() => setGridOpen(!gridOpen)}
                  className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
                    gridOpen
                      ? "bg-[#252830] border-[#3a3e4e] text-white"
                      : "bg-[#1a1d26] border-[#2a2e3e] text-[#848e9c] hover:bg-[#252830] hover:text-white"
                  }`}
                >
                  <LayoutGrid className="h-[18px] w-[18px]" />
                </button>
                {!gridOpen && (
                  <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#1e2130] text-[11px] font-medium text-white whitespace-nowrap opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-150 shadow-lg shadow-black/40 z-50">
                    More
                  </span>
                )}
              </div>
              {gridOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#141620] rounded-2xl shadow-2xl shadow-black/50 py-1.5 z-50">
                  {MORE_LINKS.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                          active
                            ? "text-brand bg-brand/8"
                            : "text-[#848e9c] hover:text-white hover:bg-[#1a1d26]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Separator */}
          <div className="hidden md:block w-px h-5 bg-[#2a2e3e] mx-0.5" />

          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-[#1a1d26] text-[#848e9c] hover:text-white transition-colors"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>

          {/* Deposit */}
          <DepositButton variant="icon" />

          {/* Avatar / Auth */}
          <AuthButton />
        </div>
      </div>

      {/* Search modal */}
      <SearchModal open={searchOpen} onClose={closeSearch} />
    </header>
  );
}
