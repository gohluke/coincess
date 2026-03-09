"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, BarChart3, Bot, LayoutDashboard, Users, BookOpen, MessageSquare } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { href: "/trade", label: "Trade", icon: TrendingUp },
  { href: "/traders", label: "Traders", icon: Users },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/chat", label: "AI Coach", icon: MessageSquare },
];

const MARKETING_ROUTES = ["/", "/blog", "/swap-guide", "/crypto-leverage-calculator"];

export function MobileNav() {
  const pathname = usePathname();

  const isMarketing = MARKETING_ROUTES.some(
    (r) => pathname === r || (r === "/blog" && pathname.startsWith("/blog/"))
  );
  if (isMarketing) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0b0e11]/95 backdrop-blur-md border-t border-[#2a2e39] safe-area-bottom">
      <div className="flex items-stretch justify-around h-14">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors ${
                active ? "text-[#7C3AED]" : "text-[#848e9c]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
