"use client";

import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { usePredictionsStore } from "@/lib/polymarket/store";
import { CategoryTabs } from "@/components/predictions/CategoryTabs";
import { SearchBar } from "@/components/predictions/SearchBar";
import { EventGrid } from "@/components/predictions/EventGrid";

export default function PredictionsPage() {
  const loadEvents = usePredictionsStore((s) => s.loadEvents);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-4 sm:pb-6">
        <h1 className="text-xl sm:text-3xl font-bold mb-1">
          Prediction Markets
        </h1>
        <p className="text-xs sm:text-sm text-[#848e9c] mb-4 sm:mb-6">
          Trade on real-world events. Politics, sports, crypto, and more.
        </p>

        {/* Search */}
        <div className="max-w-md mb-4 sm:mb-5">
          <SearchBar />
        </div>

        {/* Categories */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          <CategoryTabs />
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <EventGrid />
      </div>
    </div>
  );
}
