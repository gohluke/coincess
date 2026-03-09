import { useSettingsStore } from "./store";

const HL_API = "https://api.hyperliquid.xyz";

/**
 * Place an order using the stored API wallet private key.
 * Runs entirely client-side — signs with the API wallet key stored in localStorage.
 */
export async function placeApiOrder(params: {
  coin: string;
  isBuy: boolean;
  size: string;
  price: string;
  reduceOnly?: boolean;
  tif?: "Ioc" | "Gtc";
  assetIndex: number;
}): Promise<{ success: boolean; error?: string; filled?: { avgPx: string; oid: number } }> {
  const { apiWallet } = useSettingsStore.getState();
  if (!apiWallet) {
    return { success: false, error: "No API wallet configured. Go to Settings to add one." };
  }

  try {
    const { ExchangeClient, HttpTransport } = await import("@nktkas/hyperliquid");
    const { privateKeyToAccount } = await import("viem/accounts");

    const wallet = privateKeyToAccount(apiWallet.privateKey as `0x${string}`);
    const transport = new HttpTransport();
    const exchange = new ExchangeClient({ wallet, transport });

    const result = await exchange.order({
      orders: [
        {
          a: params.assetIndex,
          b: params.isBuy,
          p: params.price,
          s: params.size,
          r: params.reduceOnly ?? false,
          t: { limit: { tif: params.tif ?? "Gtc" } },
        },
      ],
      grouping: "na",
    });

    const status = (result as any).response?.data?.statuses?.[0];
    if (status?.filled) {
      return { success: true, filled: { avgPx: status.filled.avgPx, oid: status.filled.oid } };
    }
    if (status?.resting) {
      return { success: true, filled: { avgPx: params.price, oid: status.resting.oid } };
    }
    if (status?.error) {
      return { success: false, error: status.error };
    }
    return { success: false, error: "Unknown response" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Cancel an order using the stored API wallet.
 */
export async function cancelApiOrder(
  assetIndex: number,
  oid: number,
): Promise<{ success: boolean; error?: string }> {
  const { apiWallet } = useSettingsStore.getState();
  if (!apiWallet) {
    return { success: false, error: "No API wallet configured." };
  }

  try {
    const { ExchangeClient, HttpTransport } = await import("@nktkas/hyperliquid");
    const { privateKeyToAccount } = await import("viem/accounts");

    const wallet = privateKeyToAccount(apiWallet.privateKey as `0x${string}`);
    const transport = new HttpTransport();
    const exchange = new ExchangeClient({ wallet, transport });

    await exchange.cancel({ cancels: [{ a: assetIndex, o: oid }] });
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Close a position using the stored API wallet.
 */
export async function closeApiPosition(params: {
  coin: string;
  size: number;
  isBuy: boolean;
  markPrice: number;
  assetIndex: number;
}): Promise<{ success: boolean; error?: string }> {
  const slippage = params.isBuy ? 1.03 : 0.97;
  const limitPx = (params.markPrice * slippage).toPrecision(5);

  return placeApiOrder({
    coin: params.coin,
    isBuy: params.isBuy,
    size: Math.abs(params.size).toFixed(4),
    price: parseFloat(limitPx).toString(),
    reduceOnly: true,
    tif: "Ioc",
    assetIndex: params.assetIndex,
  });
}

/**
 * Check if API wallet is configured and ready.
 */
export function isApiWalletReady(): boolean {
  const { apiWallet } = useSettingsStore.getState();
  return !!(apiWallet?.privateKey && apiWallet?.address);
}

/**
 * Get API wallet info without exposing the private key.
 */
export function getApiWalletInfo(): { name: string; address: string } | null {
  const { apiWallet } = useSettingsStore.getState();
  if (!apiWallet) return null;
  return { name: apiWallet.name, address: apiWallet.address };
}
