import { signL1Action, signUserSignedAction } from "@nktkas/hyperliquid/signing";
import type { AbstractViemJsonRpcAccount } from "@nktkas/hyperliquid/signing";
import { ApproveBuilderFeeTypes } from "@nktkas/hyperliquid/api/exchange";
import type { MarketInfo } from "./types";

const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

// Coincess builder address — this receives builder fees
const BUILDER_ADDRESS = "0x635b3B453De75e873A02B4898f615C5E8909070a" as const;
// Fee in tenths of a basis point. 10 = 1bp = 0.01%. Max perps: 100 (= 10bp = 0.1%)
const BUILDER_FEE = 10;
// Set to true once your builder address has ≥100 USDC on Hyperliquid perps.
// Trades will work without this — you just won't collect fees yet.
const BUILDER_FEE_ENABLED = true;

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

let _privyProvider: EthProvider | null = null;

export function setPrivyProvider(provider: EthProvider | null) {
  _privyProvider = provider;
}

function getEthereum(): EthProvider {
  if (_privyProvider) return _privyProvider;
  const eth = (window as unknown as { ethereum?: EthProvider }).ethereum;
  if (!eth) throw new Error("No wallet detected. Please sign in first.");
  return eth;
}

/**
 * Build a wallet adapter matching AbstractViemJsonRpcAccount interface.
 * Wraps window.ethereum for MetaMask / injected providers.
 */
function getWalletAdapter(): AbstractViemJsonRpcAccount {
  const eth = getEthereum();

  return {
    async getAddresses() {
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      return accounts as `0x${string}`[];
    },
    async getChainId() {
      const chainId = (await eth.request({ method: "eth_chainId" })) as string;
      return Number(chainId);
    },
    async signTypedData(params) {
      const [address] = (await eth.request({ method: "eth_accounts" })) as string[];
      if (!address) throw new Error("No account connected");

      const result = await eth.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify({
          domain: params.domain,
          types: params.types,
          primaryType: params.primaryType,
          message: params.message,
        })],
      });
      return result as `0x${string}`;
    },
  };
}

async function getAddress(): Promise<string> {
  const eth = getEthereum();
  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  if (!accounts[0]) throw new Error("No account connected");
  return accounts[0];
}

interface OrderWire {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t:
    | { limit: { tif: "Gtc" | "Ioc" | "Alo" } }
    | { trigger: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" } };
  c?: string;
}

interface PlaceOrderParams {
  coin: string;
  isBuy: boolean;
  price: string;
  size: string;
  orderType: "limit" | "market";
  reduceOnly?: boolean;
  tpsl?: { triggerPx: string; type: "tp" | "sl" };
  markets: MarketInfo[];
}

function priceToWire(price: number): string {
  const rounded = parseFloat(price.toPrecision(5));
  if (rounded === Math.round(rounded)) return rounded.toFixed(1);
  return rounded.toString();
}

function sizeToWire(size: number, szDecimals: number): string {
  return size.toFixed(szDecimals);
}

export function buildOrderWire(params: PlaceOrderParams): OrderWire {
  const market = params.markets.find((m) => m.name === params.coin);
  if (!market) throw new Error(`Market ${params.coin} not found`);

  const price = parseFloat(params.price);
  const size = parseFloat(params.size);

  let orderType: OrderWire["t"];
  if (params.tpsl) {
    orderType = {
      trigger: {
        isMarket: true,
        triggerPx: priceToWire(parseFloat(params.tpsl.triggerPx)),
        tpsl: params.tpsl.type,
      },
    };
  } else if (params.orderType === "market") {
    orderType = { limit: { tif: "Ioc" } };
  } else {
    orderType = { limit: { tif: "Gtc" } };
  }

  return {
    a: market.assetIndex,
    b: params.isBuy,
    p: priceToWire(price),
    s: sizeToWire(size, market.szDecimals),
    r: params.reduceOnly ?? false,
    t: orderType,
  };
}

export function getMarketOrderPrice(isBuy: boolean, markPx: number): string {
  const slippage = isBuy ? 1.01 : 0.99;
  return priceToWire(markPx * slippage);
}

export async function signAndPlaceOrder(
  params: PlaceOrderParams,
): Promise<{ success: boolean; error?: string; oid?: number }> {
  try {
    const wallet = getWalletAdapter();
    await getAddress();

    const orderWire = buildOrderWire(params);
    const nonce = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const action: Record<string, any> = {
      type: "order",
      orders: [orderWire],
      grouping: "na",
    };

    if (BUILDER_FEE_ENABLED) {
      action.builder = { b: BUILDER_ADDRESS, f: BUILDER_FEE };
    }

    const signature = await signL1Action({ wallet, action, nonce });

    const res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, nonce }),
    });

    const data = await res.json();

    if (data.status === "ok" && data.response?.type === "order") {
      const status = data.response.data.statuses[0];
      if (status.error) return { success: false, error: status.error };
      if (status.filled) return { success: true, oid: status.filled.oid };
      if (status.resting) return { success: true, oid: status.resting.oid };
    }

    return { success: false, error: data.response?.data?.statuses?.[0]?.error ?? JSON.stringify(data) };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function signAndCancelOrder(
  asset: number,
  oid: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter();
    await getAddress();

    const nonce = Date.now();
    const action = { type: "cancel", cancels: [{ a: asset, o: oid }] };

    const signature = await signL1Action({ wallet, action, nonce });

    const res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, nonce }),
    });

    const data = await res.json();
    if (data.status === "ok") return { success: true };
    return { success: false, error: data.response?.data?.statuses?.[0]?.error ?? "Cancel failed" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function signAndUpdateLeverage(
  asset: number,
  leverage: number,
  isCross: boolean = true,
): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter();
    await getAddress();

    const nonce = Date.now();
    const action = { type: "updateLeverage", asset, isCross, leverage };

    const signature = await signL1Action({ wallet, action, nonce });

    const res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, nonce }),
    });

    const data = await res.json();
    if (data.status === "ok") return { success: true };
    return { success: false, error: "Failed to update leverage" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * User must approve a builder fee before the builder can charge fees.
 * One-time approval per builder address per user.
 */
export async function signAndApproveBuilderFee(
  builderAddress: string = BUILDER_ADDRESS,
  maxFeeRate: string = "0.01%",
): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter();
    const chainId = await wallet.getChainId();

    const nonce = Date.now();
    const action = {
      type: "approveBuilderFee" as const,
      hyperliquidChain: "Mainnet" as const,
      signatureChainId: `0x${chainId.toString(16)}` as `0x${string}`,
      maxFeeRate,
      builder: builderAddress,
      nonce,
    };

    const signature = await signUserSignedAction({
      wallet,
      action,
      types: ApproveBuilderFeeTypes,
    });

    const res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, nonce }),
    });

    const data = await res.json();
    if (data.status === "ok") return { success: true };
    return { success: false, error: "Failed to approve builder fee" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Enable unified account / dex abstraction so user can trade HIP-3 markets
 * using their main USDC balance. Uses the agent variant (L1 action).
 */
export async function signAndEnableDexAbstraction(): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter();
    await getAddress();

    const nonce = Date.now();
    const action = { type: "agentSetAbstraction", abstraction: "u" };

    const signature = await signL1Action({ wallet, action, nonce });

    const res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, nonce }),
    });

    const data = await res.json();
    if (data.status === "ok") return { success: true };
    return { success: false, error: "Failed to enable unified account" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export { BUILDER_ADDRESS, BUILDER_FEE };
