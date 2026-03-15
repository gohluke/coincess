import type { OrderRequest, OrderResult } from "./types";
import { BRAND_CONFIG } from "@/lib/brand.config";

const HL_API = "https://api.hyperliquid.xyz";

const BUILDER_ADDRESS = BRAND_CONFIG.builder.address;
const BUILDER_FEE = BRAND_CONFIG.builder.fee;

function getCredentials() {
  const privateKey = process.env.HL_API_PRIVATE_KEY;
  const accountAddress = process.env.HL_ACCOUNT_ADDRESS;
  if (!privateKey || !accountAddress) {
    throw new Error("Missing HL_API_PRIVATE_KEY or HL_ACCOUNT_ADDRESS env vars");
  }
  return { privateKey: privateKey as `0x${string}`, accountAddress };
}

async function createExchangeClient() {
  const { privateKey } = getCredentials();
  const { ExchangeClient, HttpTransport } = await import("@nktkas/hyperliquid");
  const { privateKeyToAccount } = await import("viem/accounts");
  const wallet = privateKeyToAccount(privateKey);
  const transport = new HttpTransport();
  return new ExchangeClient({ wallet, transport });
}

function isWhitelisted(addr: string): boolean {
  return BRAND_CONFIG.builder.feeWhitelist.some(
    (a) => a.toLowerCase() === addr.toLowerCase(),
  );
}

function getBuilderOpt(accountAddr: string) {
  if (isWhitelisted(accountAddr)) return undefined;
  return { b: BUILDER_ADDRESS, f: BUILDER_FEE };
}

async function trackBotTrade(accountAddr: string, volume = 0) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const addr = accountAddr.toLowerCase();
    const now = Date.now();
    await fetch(`${url}/rest/v1/rpc/upsert_coincess_trader`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_address: addr, p_now: now, p_volume: volume }),
    });
  } catch {
    // non-critical; don't block trading
  }
}

export async function placeOrder(req: OrderRequest): Promise<OrderResult> {
  const { accountAddress } = getCredentials();
  try {
    const exchange = await createExchangeClient();
    const result = await exchange.order(
      {
        orders: [
          {
            a: req.assetIndex,
            b: req.isBuy,
            p: req.price,
            s: req.size,
            r: req.reduceOnly ?? false,
            t: { limit: { tif: req.tif ?? "Gtc" } },
          },
        ],
        grouping: "na",
        builder: getBuilderOpt(accountAddress),
      },
      { vaultAddress: accountAddress },
    );

    const status = (result as Record<string, unknown>)?.response as
      | { data?: { statuses?: Array<Record<string, unknown>> } }
      | undefined;
    const s = status?.data?.statuses?.[0];
    if (!s) return { success: false, error: "No status in response" };

    const notional = parseFloat(req.size) * parseFloat(req.price);
    const filled = s.filled as { avgPx: string; oid: number } | undefined;
    if (filled) {
      trackBotTrade(accountAddress, notional);
      return { success: true, avgPx: filled.avgPx, oid: filled.oid };
    }

    const resting = s.resting as { oid: number } | undefined;
    if (resting) {
      trackBotTrade(accountAddress, notional);
      return { success: true, avgPx: req.price, oid: resting.oid };
    }

    if (s.error) return { success: false, error: String(s.error) };
    return { success: false, error: "Unknown order response" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function cancelOrder(assetIndex: number, oid: number): Promise<OrderResult> {
  const { accountAddress } = getCredentials();
  try {
    const exchange = await createExchangeClient();
    await exchange.cancel(
      { cancels: [{ a: assetIndex, o: oid }] },
      { vaultAddress: accountAddress },
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

function hlRoundPrice(price: number): string {
  if (price >= 100_000) return (Math.round(price / 10) * 10).toString();
  if (price >= 10_000) return (Math.round(price)).toString();
  if (price >= 1_000) return (Math.round(price * 10) / 10).toFixed(1);
  if (price >= 100) return (Math.round(price * 100) / 100).toFixed(2);
  if (price >= 10) return (Math.round(price * 1000) / 1000).toFixed(3);
  if (price >= 1) return (Math.round(price * 10000) / 10000).toFixed(4);
  return (Math.round(price * 100000) / 100000).toFixed(5);
}

export async function closePosition(params: {
  coin: string;
  size: number;
  isBuy: boolean;
  markPrice: number;
  assetIndex: number;
}): Promise<OrderResult> {
  const isSpot = params.assetIndex >= 10000;
  const slippage = params.isBuy ? 1.03 : 0.97;
  const limitPx = hlRoundPrice(params.markPrice * slippage);
  return placeOrder({
    coin: params.coin,
    isBuy: params.isBuy,
    size: Math.abs(params.size).toFixed(4),
    price: limitPx,
    reduceOnly: isSpot ? false : true, // spot has no reduceOnly concept
    tif: "Ioc",
    assetIndex: params.assetIndex,
  });
}

export async function fetchAccountValue(): Promise<number> {
  const { accountAddress } = getCredentials();
  const [perpsRes, spotRes, allMidsRes] = await Promise.all([
    fetch(`${HL_API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: accountAddress }),
    }),
    fetch(`${HL_API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotClearinghouseState", user: accountAddress }),
    }),
    fetch(`${HL_API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    }),
  ]);

  const perpsData = (await perpsRes.json()) as { marginSummary: { accountValue: string } };
  const spotData = (await spotRes.json()) as {
    balances: Array<{ coin: string; total: string }>;
  };
  const allMids = (await allMidsRes.json()) as Record<string, string>;

  const perpsValue = parseFloat(perpsData.marginSummary.accountValue);
  const stableCoins = new Set(["USDC", "USDE", "USDT0"]);
  let spotValue = 0;
  for (const b of spotData.balances ?? []) {
    const bal = parseFloat(b.total);
    if (bal === 0) continue;
    if (stableCoins.has(b.coin)) {
      spotValue += bal;
    } else {
      // Value non-stable tokens (HIP-3 stocks, etc.) using allMids
      const mid = parseFloat(allMids[b.coin] ?? "0");
      if (mid > 0) spotValue += bal * mid;
    }
  }

  return perpsValue + spotValue;
}

export async function fetchPositions() {
  const { accountAddress } = getCredentials();
  const res = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: accountAddress }),
  });
  const data = (await res.json()) as {
    assetPositions: Array<{
      position: {
        coin: string;
        szi: string;
        entryPx: string | null;
        unrealizedPnl: string;
        marginUsed: string;
        leverage: { value: number };
      };
    }>;
  };
  return data.assetPositions;
}

export function getAccountAddress(): string {
  return getCredentials().accountAddress;
}
