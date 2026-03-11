import { getSupabaseClient } from "@/lib/supabase/client";

const STORAGE_KEY = "coincess_traders";
const STARRED_KEY = "coincess_starred";

export interface TrackedTrader {
  address: string;
  firstSeen: number;
  lastSeen: number;
  orderCount: number;
  coincessVolume: number;
  displayName?: string | null;
}

// --- localStorage helpers for tracked traders ---

function getTrackedMap(): Map<string, TrackedTrader> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr: TrackedTrader[] = JSON.parse(raw);
    return new Map(arr.map((t) => [t.address.toLowerCase(), t]));
  } catch {
    return new Map();
  }
}

function saveTrackedMap(map: Map<string, TrackedTrader>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...map.values()]));
  } catch {
    // storage full or unavailable
  }
}

// --- localStorage helpers for starred traders ---

function getStarredTradersLocal(userAddress: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STARRED_KEY}_${userAddress.toLowerCase()}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStarredLocal(userAddress: string, addresses: string[]) {
  try {
    localStorage.setItem(
      `${STARRED_KEY}_${userAddress.toLowerCase()}`,
      JSON.stringify(addresses)
    );
  } catch {
    // ignore
  }
}

// --- Tracked traders (localStorage + Supabase) ---

/**
 * Record that an address traded through Coincess.
 * Called after a successful order placement.
 * @param volume - notional value of the trade in USD (size * price)
 */
export function trackTrader(address: string, volume = 0) {
  const map = getTrackedMap();
  const key = address.toLowerCase();
  const existing = map.get(key);
  const now = Date.now();

  if (existing) {
    existing.lastSeen = now;
    existing.orderCount += 1;
    existing.coincessVolume += volume;
  } else {
    map.set(key, {
      address: key,
      firstSeen: now,
      lastSeen: now,
      orderCount: 1,
      coincessVolume: volume,
    });
  }
  saveTrackedMap(map);

  trackTraderSupabase(address, volume).catch(() => {});
}

export function getTrackedTraders(): TrackedTrader[] {
  return [...getTrackedMap().values()].sort((a, b) => b.lastSeen - a.lastSeen);
}

export function getTrackedAddresses(): string[] {
  return getTrackedTraders().map((t) => t.address);
}

// --- Supabase functions ---

export async function trackTraderSupabase(address: string, volume = 0): Promise<void> {
  try {
    const sb = getSupabaseClient();
    const key = address.toLowerCase();
    const now = Date.now();

    const { error } = await sb.rpc("upsert_coincess_trader", {
      p_address: key,
      p_now: now,
      p_volume: volume,
    });

    if (error) {
      const { data: existing } = await sb
        .from("coincess_traders")
        .select("order_count, coincess_volume")
        .eq("address", key)
        .single();

      await sb.from("coincess_traders").upsert(
        {
          address: key,
          first_seen: now,
          last_seen: now,
          order_count: existing ? (existing.order_count ?? 0) + 1 : 1,
          coincess_volume: (existing?.coincess_volume ?? 0) + volume,
        },
        { onConflict: "address" }
      );
    }
  } catch {
    // Supabase unavailable; localStorage already handled by trackTrader()
  }
}

export async function fetchTrackedTradersFromSupabase(): Promise<TrackedTrader[]> {
  try {
    const sb = getSupabaseClient();
    const { data } = await sb
      .from("coincess_traders")
      .select("*")
      .order("last_seen", { ascending: false });

    if (!data) return [];
    return data.map((row: Record<string, unknown>) => ({
      address: row.address as string,
      firstSeen: row.first_seen as number,
      lastSeen: row.last_seen as number,
      orderCount: row.order_count as number,
      coincessVolume: Number(row.coincess_volume ?? 0),
      displayName: row.display_name as string | null | undefined,
    }));
  } catch {
    return getTrackedTraders(); // fallback to localStorage
  }
}

// --- Star/unstar functions ---

export async function starTrader(
  userAddress: string,
  traderAddress: string
): Promise<void> {
  const userKey = userAddress.toLowerCase();
  const traderKey = traderAddress.toLowerCase();

  try {
    const sb = getSupabaseClient();
    await sb.from("coincess_starred_traders").upsert(
      {
        user_address: userKey,
        trader_address: traderKey,
      },
      { onConflict: "user_address,trader_address" }
    );
  } catch {
    // fallback to localStorage only
  }

  const starred = getStarredTradersLocal(userAddress);
  if (!starred.includes(traderKey)) {
    starred.push(traderKey);
    saveStarredLocal(userAddress, starred);
  }
}

export async function unstarTrader(
  userAddress: string,
  traderAddress: string
): Promise<void> {
  const userKey = userAddress.toLowerCase();
  const traderKey = traderAddress.toLowerCase();

  try {
    const sb = getSupabaseClient();
    await sb
      .from("coincess_starred_traders")
      .delete()
      .eq("user_address", userKey)
      .eq("trader_address", traderKey);
  } catch {
    // ignore
  }

  const starred = getStarredTradersLocal(userAddress).filter((a) => a !== traderKey);
  saveStarredLocal(userAddress, starred);
}

export async function getStarredTraders(userAddress: string): Promise<string[]> {
  try {
    const sb = getSupabaseClient();
    const { data } = await sb
      .from("coincess_starred_traders")
      .select("trader_address")
      .eq("user_address", userAddress.toLowerCase());

    if (data && data.length > 0) {
      return data.map((r: { trader_address: string }) => r.trader_address);
    }
  } catch {
    // fallback to localStorage
  }
  return getStarredTradersLocal(userAddress);
}
