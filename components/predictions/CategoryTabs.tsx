"use client";

import type { EventCategory } from "@/lib/polymarket/types";
import { usePredictionsStore } from "@/lib/polymarket/store";
import {
  Flame,
  Sparkles,
  Timer,
  Landmark,
  Trophy,
  Bitcoin,
  Tv,
  Briefcase,
  FlaskConical,
  Cpu,
} from "lucide-react";

const CATEGORIES: { label: EventCategory; icon: React.ReactNode }[] = [
  { label: "All", icon: <Flame className="h-3.5 w-3.5" /> },
  { label: "Ending Soon", icon: <Timer className="h-3.5 w-3.5" /> },
  { label: "New", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { label: "Politics", icon: <Landmark className="h-3.5 w-3.5" /> },
  { label: "Sports", icon: <Trophy className="h-3.5 w-3.5" /> },
  { label: "Crypto", icon: <Bitcoin className="h-3.5 w-3.5" /> },
  { label: "Pop Culture", icon: <Tv className="h-3.5 w-3.5" /> },
  { label: "Business", icon: <Briefcase className="h-3.5 w-3.5" /> },
  { label: "Science", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { label: "Technology", icon: <Cpu className="h-3.5 w-3.5" /> },
];

export function CategoryTabs() {
  const selected = usePredictionsStore((s) => s.selectedCategory);
  const setCategory = usePredictionsStore((s) => s.setCategory);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {CATEGORIES.map(({ label, icon }) => (
        <button
          key={label}
          onClick={() => setCategory(label)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
            selected === label
              ? "bg-[#FF455B] text-white shadow-lg shadow-[#FF455B]/25"
              : "bg-[#1a1d2e] text-[#848e9c] hover:bg-[#252840] hover:text-white"
          }`}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}
