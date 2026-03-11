"use client";

import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { usePredictionsStore } from "@/lib/polymarket/store";

export function SearchBar() {
  const [value, setValue] = useState("");
  const searchFn = usePredictionsStore((s) => s.search);
  const clearSearch = usePredictionsStore((s) => s.clearSearch);
  const searchQuery = usePredictionsStore((s) => s.searchQuery);

  const handleSearch = useCallback(() => {
    if (value.trim()) searchFn(value.trim());
  }, [value, searchFn]);

  const handleClear = useCallback(() => {
    setValue("");
    clearSearch();
  }, [clearSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#848e9c]" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        placeholder="Search prediction markets…"
        className="w-full pl-9 pr-9 py-2.5 bg-[#141620] rounded-xl text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-brand/50 transition-colors"
      />
      {(value || searchQuery) && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
