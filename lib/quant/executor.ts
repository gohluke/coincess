import type { OrderRequest, OrderResult } from "./types";

const HL_API = "https://api.hyperliquid.xyz";

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

export async function placeOrder(req: OrderRequest): Promise<OrderResult> {
  try {
    const exchange = await createExchangeClient();
    const result = await exchange.order({
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
    });

    const status = (result as Record<string, unknown>)?.response as
      | { data?: { statuses?: Array<Record<string, unknown>> } }
      | undefined;
    const s = status?.data?.statuses?.[0];
    if (!s) return { success: false, error: "No status in response" };

    const filled = s.filled as { avgPx: string; oid: number } | undefined;
    if (filled) return { success: true, avgPx: filled.avgPx, oid: filled.oid };

    const resting = s.resting as { oid: number } | undefined;
    if (resting) return { success: true, avgPx: req.price, oid: resting.oid };

    if (s.error) return { success: false, error: String(s.error) };
    return { success: false, error: "Unknown order response" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function cancelOrder(assetIndex: number, oid: number): Promise<OrderResult> {
  try {
    const exchange = await createExchangeClient();
    await exchange.cancel({ cancels: [{ a: assetIndex, o: oid }] });
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function closePosition(params: {
  coin: string;
  size: number;
  isBuy: boolean;
  markPrice: number;
  assetIndex: number;
}): Promise<OrderResult> {
  const slippage = params.isBuy ? 1.03 : 0.97;
  const limitPx = (params.markPrice * slippage).toPrecision(5);
  return placeOrder({
    coin: params.coin,
    isBuy: params.isBuy,
    size: Math.abs(params.size).toFixed(4),
    price: parseFloat(limitPx).toString(),
    reduceOnly: true,
    tif: "Ioc",
    assetIndex: params.assetIndex,
  });
}

export async function fetchAccountValue(): Promise<number> {
  const { accountAddress } = getCredentials();
  const [perpsRes, spotRes] = await Promise.all([
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
  ]);

  const perpsData = (await perpsRes.json()) as { marginSummary: { accountValue: string } };
  const spotData = (await spotRes.json()) as {
    balances: Array<{ coin: string; total: string }>;
  };

  const perpsValue = parseFloat(perpsData.marginSummary.accountValue);
  const spotUsdc = spotData.balances
    ?.filter((b) => ["USDC", "USDE", "USDT0"].includes(b.coin))
    .reduce((sum, b) => sum + parseFloat(b.total), 0) ?? 0;

  return perpsValue + spotUsdc;
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
