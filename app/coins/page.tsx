"use client";

import { useState } from "react";
import { Coins, Flame, Sparkles, Shield, Search } from "lucide-react";
import { TrendingTokens } from "@/components/coins/TrendingTokens";
import { NewPairs } from "@/components/coins/NewPairs";
import { SecurityCheck } from "@/components/coins/SecurityCheck";
import { TopCoins } from "@/components/coins/TopCoins";
import { TokenSearch } from "@/components/coins/TokenSearch";

const TABS = [
  { id: "trending", label: "Trending", icon: Flame, color: "text-orange-400" },
  { id: "new", label: "New Pairs", icon: Sparkles, color: "text-blue-400" },
  { id: "top", label: "Top 100", icon: Coins, color: "text-brand" },
  { id: "security", label: "Security", icon: Shield, color: "text-emerald-400" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function CoinsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("trending");

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      {/* Token search bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        <TokenSearch />
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-[#2a2e39]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? `${tab.color} border-current`
                    : "text-[#848e9c] border-transparent hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "trending" && <TrendingTokens />}
        {activeTab === "new" && <NewPairs />}
        {activeTab === "top" && <TopCoins />}
        {activeTab === "security" && <SecurityCheck />}
      </div>
    </div>
  );
}
