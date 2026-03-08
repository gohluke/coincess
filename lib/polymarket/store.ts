import { create } from "zustand";
import type { PolymarketEvent, PolymarketTag, EventCategory } from "./types";
import {
  fetchTrendingEvents,
  fetchEventsByTag,
  fetchNewEvents,
  fetchTags,
  searchEvents,
} from "./api";

const CATEGORY_TAG_MAP: Record<string, string> = {
  Politics: "politics",
  Sports: "sports",
  Crypto: "crypto",
  "Pop Culture": "pop-culture",
  Business: "business",
  Science: "science",
  Technology: "tech",
};

interface PredictionsState {
  events: PolymarketEvent[];
  tags: PolymarketTag[];
  selectedCategory: EventCategory;
  loading: boolean;
  searchQuery: string;
  hasMore: boolean;

  loadEvents: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadTags: () => Promise<void>;
  setCategory: (cat: EventCategory) => void;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const usePredictionsStore = create<PredictionsState>((set, get) => ({
  events: [],
  tags: [],
  selectedCategory: "All",
  loading: false,
  searchQuery: "",
  hasMore: true,

  loadEvents: async () => {
    const { selectedCategory, searchQuery } = get();
    if (searchQuery) return;
    set({ loading: true, hasMore: true });
    try {
      let events: PolymarketEvent[];
      if (selectedCategory === "All") {
        events = await fetchTrendingEvents(20, 0);
      } else if (selectedCategory === "New") {
        events = await fetchNewEvents(20);
      } else {
        const tagSlug = CATEGORY_TAG_MAP[selectedCategory];
        events = tagSlug
          ? await fetchEventsByTag(tagSlug, 20, 0)
          : await fetchTrendingEvents(20, 0);
      }
      set({ events, loading: false, hasMore: events.length >= 20 });
    } catch (err) {
      console.error("Failed to load events:", err);
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { selectedCategory, events, loading, hasMore, searchQuery } = get();
    if (loading || !hasMore) return;
    set({ loading: true });
    try {
      let more: PolymarketEvent[];
      if (searchQuery) {
        more = [];
      } else if (selectedCategory === "All") {
        more = await fetchTrendingEvents(20, events.length);
      } else if (selectedCategory === "New") {
        more = [];
      } else {
        const tagSlug = CATEGORY_TAG_MAP[selectedCategory];
        more = tagSlug
          ? await fetchEventsByTag(tagSlug, 20, events.length)
          : [];
      }
      set({
        events: [...events, ...more],
        loading: false,
        hasMore: more.length >= 20,
      });
    } catch (err) {
      console.error("Failed to load more:", err);
      set({ loading: false });
    }
  },

  loadTags: async () => {
    try {
      const tags = await fetchTags();
      set({ tags });
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  },

  setCategory: (cat) => {
    set({ selectedCategory: cat, events: [], searchQuery: "" });
    get().loadEvents();
  },

  search: async (query) => {
    if (!query.trim()) {
      get().clearSearch();
      return;
    }
    set({ searchQuery: query, loading: true, hasMore: false });
    try {
      const events = await searchEvents(query, 30);
      set({ events, loading: false });
    } catch (err) {
      console.error("Search failed:", err);
      set({ loading: false });
    }
  },

  clearSearch: () => {
    set({ searchQuery: "" });
    get().loadEvents();
  },
}));
