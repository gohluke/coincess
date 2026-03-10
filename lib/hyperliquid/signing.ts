import { signL1Action, signUserSignedAction } from "@nktkas/hyperliquid/signing";
import type { AbstractViemJsonRpcAccount } from "@nktkas/hyperliquid/signing";
import { ApproveBuilderFeeTypes } from "@nktkas/hyperliquid/api/exchange";
import type { MarketInfo } from "./types";
import { BRAND_CONFIG } from "@/lib/brand.config";

const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

const BUILDER_ADDRESS = BRAND_CONFIG.builder.address;
const BUILDER_FEE = BRAND_CONFIG.builder.fee;
const BUILDER_FEE_ENABLED = BRAND_CONFIG.builder.enabled;

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
 * When preferredAddress is provided, we ensure that specific account is used
 * for signing — critical when the store shows a linked wallet address that
 * differs from the wallet's default active account.
 */
function getWalletAdapter(preferredAddress?: string): AbstractViemJsonRpcAccount {
  const eth = getEthereum();

  async function resolveSigningAddress(): Promise<string> {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    if (!accounts.length) throw new Error("No account connected");

    if (preferredAddress) {
      const match = accounts.find(
        (a) => a.toLowerCase() === preferredAddress.toLowerCase(),
      );
      if (match) return match;
      const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
      throw new Error(
        `Wallet mismatch: trading as ${short(preferredAddress)} but your wallet is on ${short(accounts[0])}. ` +
        `Switch to ${short(preferredAddress)} in Zerion/MetaMask, or go to Settings and remove the linked wallet.`,
      );
    }
    return accounts[0];
  }

  return {
    async getAddresses() {
      const addr = await resolveSigningAddress();
      return [addr] as `0x${string}`[];
    },
    async getChainId() {
      const chainId = (await eth.request({ method: "eth_chainId" })) as string;
      return Number(chainId);
    },
    async signTypedData(params) {
      const address = await resolveSigningAddress();

      // Strip EIP712Domain from types — eth_signTypedData_v4 providers
      // (especially Privy embedded wallets) derive it from the domain object
      // and reject/conflict when it appears explicitly in types.
      const { EIP712Domain: _, ...filteredTypes } = params.types as Record<string, unknown>;

      const result = await eth.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify({
          domain: params.domain,
          types: filteredTypes,
          primaryType: params.primaryType,
          message: params.message,
        })],
      });
      return result as `0x${string}`;
    },
  };
}

async function getAddress(preferredAddress?: string): Promise<string> {
  const eth = getEthereum();
  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  if (!accounts[0]) throw new Error("No account connected");
  if (preferredAddress) {
    const match = accounts.find(
      (a) => a.toLowerCase() === preferredAddress.toLowerCase(),
    );
    if (match) return match;
  }
  return accounts[0];
}

export async function getSigningAddress(): Promise<string | null> {
  try {
    return await getAddress();
  } catch {
    return null;
  }
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
  params: PlaceOrderParams & { expectedAddress?: string },
): Promise<{ success: boolean; error?: string; oid?: number }> {
  try {
    const wallet = getWalletAdapter(params.expectedAddress);
    const userAddr = await getAddress(params.expectedAddress);

    const orderWire = buildOrderWire(params);
    const nonce = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const action: Record<string, any> = {
      type: "order",
      orders: [orderWire],
      grouping: "na",
    };
    const isBuilder = userAddr.toLowerCase() === BUILDER_ADDRESS.toLowerCase();
    if (BUILDER_FEE_ENABLED && !isBuilder) {
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
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter(expectedAddress);
    await getAddress(expectedAddress);

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
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter(expectedAddress);
    await getAddress(expectedAddress);

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
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter(expectedAddress);
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

// EIP-712 types for userSetAbstraction (from @nktkas/hyperliquid SDK)
const UserSetAbstractionTypes = {
  "HyperliquidTransaction:UserSetAbstraction": [
    { name: "hyperliquidChain", type: "string" },
    { name: "user", type: "address" },
    { name: "abstraction", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
};

/**
 * Enable unified account so user can trade HIP-3/XYZ markets (stocks,
 * commodities, forex) using their main USDC balance.
 * Uses userSetAbstraction (EIP-712 user-signed action) for browser wallets.
 */
export async function signAndEnableDexAbstraction(
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const wallet = getWalletAdapter(expectedAddress);
    const address = await getAddress(expectedAddress);
    const chainId = await wallet.getChainId();

    const nonce = Date.now();
    const action = {
      type: "userSetAbstraction" as const,
      hyperliquidChain: "Mainnet" as const,
      signatureChainId: `0x${chainId.toString(16)}` as `0x${string}`,
      user: address as `0x${string}`,
      abstraction: "unifiedAccount",
      nonce,
    };

    const signature = await signUserSignedAction({
      wallet,
      action,
      types: UserSetAbstractionTypes,
    });

    const res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, nonce }),
    });

    const data = await res.json();
    if (data.status === "ok") return { success: true };
    const apiError = data.response?.data?.statuses?.[0]?.error
      || data.response?.error
      || data.error
      || JSON.stringify(data);
    return { success: false, error: apiError };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export { BUILDER_ADDRESS, BUILDER_FEE };
