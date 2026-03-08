"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Logo } from "@/components/Logo";
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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#2a2e39] bg-[#0b0e11]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-[#848e9c] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <Logo />
            </Link>
            <div className="h-5 w-px bg-[#2a2e39]" />
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-[#7C3AED]" />
              <span className="text-sm font-semibold">Predictions</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/trade"
              className="text-xs text-[#848e9c] hover:text-white transition-colors hidden sm:block"
            >
              Perps Trading →
            </Link>
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#848e9c] hover:text-white transition-colors hidden sm:block"
            >
              Powered by Polymarket
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">
          Prediction Markets
        </h1>
        <p className="text-sm text-[#848e9c] mb-6">
          Trade on real-world events. Politics, sports, crypto, and more.
        </p>

        {/* Search */}
        <div className="max-w-md mb-5">
          <SearchBar />
        </div>

        {/* Categories */}
        <CategoryTabs />
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <EventGrid />
      </div>
    </div>
  );
}
