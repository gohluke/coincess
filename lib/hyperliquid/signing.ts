import { signL1Action, signUserSignedAction } from "@nktkas/hyperliquid/signing";
import type { AbstractViemJsonRpcAccount } from "@nktkas/hyperliquid/signing";
import { ApproveBuilderFeeTypes, ApproveAgentTypes } from "@nktkas/hyperliquid/api/exchange";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, custom } from "viem";
import { arbitrum } from "viem/chains";
import type { MarketInfo } from "./types";
import { BRAND_CONFIG } from "@/lib/brand.config";
import { getAgentAccount, storeAgent, clearStoredAgent } from "./agent";

export { getStoredAgent, clearStoredAgent } from "./agent";

const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

const BUILDER_ADDRESS = BRAND_CONFIG.builder.address;
const BUILDER_FEE = BRAND_CONFIG.builder.fee;
const BUILDER_FEE_ENABLED = BRAND_CONFIG.builder.enabled;

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: EthProvider[];
};

let _privyProvider: EthProvider | null = null;

type SigningDebugEntry = {
  at: string;
  event: string;
  data?: unknown;
};

function isSigningDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return process.env.NODE_ENV !== "production" || window.localStorage.getItem("coincess:signing-debug") === "1";
  } catch {
    return process.env.NODE_ENV !== "production";
  }
}

function pushSigningDebug(event: string, data?: unknown) {
  if (!isSigningDebugEnabled() || typeof window === "undefined") return;
  const entry: SigningDebugEntry = {
    at: new Date().toISOString(),
    event,
    data,
  };
  try {
    const globalWindow = window as typeof window & {
      __coincessSigningDebug?: SigningDebugEntry[];
      __coincessLastSigningPayload?: unknown;
    };
    const next = [...(globalWindow.__coincessSigningDebug ?? []), entry].slice(-30);
    globalWindow.__coincessSigningDebug = next;
    if (event.includes("payload")) {
      globalWindow.__coincessLastSigningPayload = data;
    }
  } catch {
    // Ignore storage/debug sink issues.
  }
  console.debug("[coincess signing]", entry);
}

function getErrorDetails(err: unknown) {
  const candidate = err as {
    code?: number | string;
    message?: string;
    shortMessage?: string;
    details?: string;
    data?: unknown;
    cause?: unknown;
  };

  return {
    code: candidate?.code,
    message: candidate?.message ?? String(err),
    shortMessage: candidate?.shortMessage,
    details: candidate?.details,
    data: candidate?.data,
    cause: candidate?.cause,
  };
}

export function setPrivyProvider(provider: EthProvider | null) {
  _privyProvider = provider;
}

function getNativeEthereum(): EthProvider | null {
  const eth = (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
  if (!eth) return null;
  if (eth.providers?.length) {
    const selected = eth.providers.find((provider) => provider.isMetaMask) ?? eth.providers[0] ?? eth;
    pushSigningDebug("provider.selected", {
      hasMultipleProviders: true,
      selectedIsMetaMask: !!selected.isMetaMask,
      providerCount: eth.providers.length,
    });
    return selected;
  }
  pushSigningDebug("provider.selected", {
    hasMultipleProviders: false,
    selectedIsMetaMask: !!eth.isMetaMask,
  });
  return eth;
}

function getProvider(): EthProvider {
  if (_privyProvider) return _privyProvider;
  const eth = getNativeEthereum();
  if (!eth) throw new Error("No wallet detected. Please connect your wallet first.");
  return eth;
}

/**
 * Build a wallet adapter conforming to @nktkas/hyperliquid's AbstractViemJsonRpcAccount.
 * Internally delegates signTypedData to viem's WalletClient which correctly
 * handles EIP-712 encoding, EIP712Domain types, and JSON-RPC payload construction.
 *
 * See SDK browser (viem) examples: https://nktkas.gitbook.io/hyperliquid/signing
 */
function createHyperliquidWallet(preferredAddress?: string): AbstractViemJsonRpcAccount {
  const provider = getProvider();
  return makeWalletAdapter(provider, preferredAddress);
}

/**
 * Build a wallet adapter that talks to window.ethereum directly (MetaMask),
 * bypassing any Privy wrapper. Used for one-time EIP-712 approvals so the
 * signing popup goes straight to MetaMask on Arbitrum -- matching based.one.
 */
function createNativeWallet(preferredAddress?: string): AbstractViemJsonRpcAccount {
  const eth = getNativeEthereum();
  if (!eth) throw new Error("No browser wallet detected. Please install MetaMask.");
  return {
    async getAddresses() {
      const addr = await resolveAddressVia(eth, preferredAddress);
      return [addr] as `0x${string}`[];
    },

    async getChainId() {
      const chainId = (await eth.request({ method: "eth_chainId" })) as string;
      return Number(chainId);
    },

    async signTypedData(params) {
      const addr = await resolveAddressVia(eth, preferredAddress);

      // The SDK includes EIP712Domain in params.types, but MetaMask's
      // eth_signTypedData_v4 auto-derives it from the domain object.
      // Passing both causes MetaMask to error or hang. Strip it.
      const { EIP712Domain: _, ...typesWithoutDomain } = params.types as Record<string, unknown>;

      const payload = JSON.stringify({
        domain: params.domain,
        types: typesWithoutDomain,
        primaryType: params.primaryType,
        message: params.message,
      });
      pushSigningDebug("native.signTypedData.payload", {
        address: addr,
        domain: params.domain,
        primaryType: params.primaryType,
        typesStripped: Object.keys(typesWithoutDomain),
        message: params.message,
      });

      let result: unknown;
      try {
        result = await eth.request({
          method: "eth_signTypedData_v4",
          params: [addr, payload],
        });
      } catch (err) {
        pushSigningDebug("native.signTypedData.error", {
          address: addr,
          chainId: await eth.request({ method: "eth_chainId" }).catch(() => "unknown"),
          error: getErrorDetails(err),
        });
        throw err;
      }

      pushSigningDebug("native.signTypedData.success", {
        address: addr,
        signaturePreview: typeof result === "string" ? `${result.slice(0, 10)}...${result.slice(-8)}` : result,
      });

      return result as `0x${string}`;
    },
  };
}

function makeWalletAdapter(provider: EthProvider, preferredAddress?: string): AbstractViemJsonRpcAccount {
  return {
    async getAddresses() {
      const addr = await resolveAddressVia(provider, preferredAddress);
      return [addr] as `0x${string}`[];
    },

    async getChainId() {
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      return Number(chainId);
    },

    async signTypedData(params) {
      const addr = await resolveAddressVia(provider, preferredAddress);
      const domainChainId = params.domain?.chainId;
      const signingChain = domainChainId != null
        ? { ...arbitrum, id: Number(domainChainId) }
        : arbitrum;

      const client = createWalletClient({
        account: addr as `0x${string}`,
        chain: signingChain,
        transport: custom(provider),
      });

      return client.signTypedData({
        domain: params.domain as Parameters<typeof client.signTypedData>[0]["domain"],
        types: params.types as Parameters<typeof client.signTypedData>[0]["types"],
        primaryType: params.primaryType as string,
        message: params.message as Record<string, unknown>,
      });
    },
  };
}

async function resolveAddressVia(provider: EthProvider, preferredAddress?: string): Promise<string> {
  if (preferredAddress) return preferredAddress.toLowerCase();
  let accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts.length) {
    accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  }
  if (!accounts[0]) throw new Error("No account connected");
  return accounts[0].toLowerCase();
}

/**
 * Switch MetaMask to Arbitrum One and verify the active chain afterwards.
 * User-signed Hyperliquid approvals still sign with domain chainId 0x66eee,
 * but the wallet UX should be connected to Arbitrum like based.one.
 */
async function switchToArbitrum(provider: EthProvider): Promise<void> {
  pushSigningDebug("chain.switch.start");
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xa4b1" }],
    });
  } catch (err) {
    if ((err as { code?: number }).code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xa4b1",
            chainName: "Arbitrum One",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://arb1.arbitrum.io/rpc"],
            blockExplorerUrls: ["https://arbiscan.io"],
          }],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xa4b1" }],
        });
      } catch {
        throw new Error("Please switch MetaMask to Arbitrum One to enable trading.");
      }
    } else {
      throw new Error("Please switch MetaMask to Arbitrum One to enable trading.");
    }
  }

  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  pushSigningDebug("chain.switch.done", { chainId });
  if (chainId !== "0xa4b1") {
    throw new Error("Please switch MetaMask to Arbitrum One to enable trading.");
  }
}

async function resolveAddress(preferredAddress?: string): Promise<string> {
  return resolveAddressVia(getProvider(), preferredAddress);
}

export async function getSigningAddress(): Promise<string | null> {
  try {
    return await resolveAddress();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Order wire helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Agent approval (one-time "Enable Trading")
// ---------------------------------------------------------------------------

/**
 * One-time agent approval: generates a local keypair, switches MetaMask to
 * Arbitrum, has the user sign an ApproveAgent EIP-712 message directly via
 * window.ethereum (bypasses Privy so the popup goes to MetaMask like based.one),
 * registers with Hyperliquid, and stores the agent key in localStorage.
 */
export async function signAndApproveAgent(
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const nativeEth = getNativeEthereum();
    if (!nativeEth) {
      return {
        success: false,
        error: "Enable Trading requires MetaMask or another injected wallet connected on Arbitrum One.",
      };
    }
    await switchToArbitrum(nativeEth);

    // Use native MetaMask directly, not Privy's wrapper, so the signing
    // popup goes straight to MetaMask on Arbitrum (matching based.one UX).
    const wallet = createNativeWallet(expectedAddress);
    const userAddr = await resolveAddressVia(nativeEth, expectedAddress);

    const agentPrivateKey = generatePrivateKey();
    const agentAcc = privateKeyToAccount(agentPrivateKey);

    const nonce = Date.now();
    const action = {
      type: "approveAgent" as const,
      signatureChainId: "0x66eee" as `0x${string}`,
      hyperliquidChain: "Mainnet" as const,
      agentAddress: agentAcc.address.toLowerCase() as `0x${string}`,
      agentName: BRAND_CONFIG.name,
      nonce,
    };
    pushSigningDebug("approveAgent.start", {
      userAddr,
      action,
      activeWalletChainId: await nativeEth.request({ method: "eth_chainId" }).catch(() => "unknown"),
    });

    const signature = await signUserSignedAction({
      wallet,
      action,
      types: ApproveAgentTypes,
    });

    const res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, nonce }),
    });

    const data = await res.json();
    pushSigningDebug("approveAgent.response", data);

    if (data.status === "ok") {
      storeAgent(userAddr, {
        privateKey: agentPrivateKey,
        address: agentAcc.address,
        approvedAt: Date.now(),
      });
      return { success: true };
    }

    const apiError = typeof data.response === "string"
      ? data.response
      : JSON.stringify(data);
    return { success: false, error: `Hyperliquid rejected: ${apiError}` };
  } catch (err) {
    pushSigningDebug("approveAgent.error", getErrorDetails(err));
    const msg = (err as Error).message || String(err);
    if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("denied")) {
      return { success: false, error: "Signature rejected. Please approve the signing request in your wallet." };
    }
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Order placement (uses agent key if available, else wallet popup)
// ---------------------------------------------------------------------------

export async function signAndPlaceOrder(
  params: PlaceOrderParams & { expectedAddress?: string },
): Promise<{ success: boolean; error?: string; oid?: number }> {
  try {
    const userAddr = await resolveAddress(params.expectedAddress);
    const agentAcc = getAgentAccount(userAddr);
    const wallet = agentAcc ?? createHyperliquidWallet(params.expectedAddress);

    const orderWire = buildOrderWire(params);
    const nonce = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const action: Record<string, any> = {
      type: "order",
      orders: [orderWire],
      grouping: "na",
    };
    const isBuilder = userAddr === BUILDER_ADDRESS.toLowerCase();
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

    const errMsg = data.response?.data?.statuses?.[0]?.error ?? JSON.stringify(data);
    if (agentAcc && (errMsg.includes("agent") || errMsg.includes("not authorized"))) {
      clearStoredAgent(userAddr);
    }
    return { success: false, error: errMsg };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Cancel, leverage, builder fee, dex abstraction
// ---------------------------------------------------------------------------

export async function signAndCancelOrder(
  asset: number,
  oid: number,
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userAddr = await resolveAddress(expectedAddress);
    const agentAcc = getAgentAccount(userAddr);
    const wallet = agentAcc ?? createHyperliquidWallet(expectedAddress);

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
    const userAddr = await resolveAddress(expectedAddress);
    const agentAcc = getAgentAccount(userAddr);
    const wallet = agentAcc ?? createHyperliquidWallet(expectedAddress);

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

export async function signAndApproveBuilderFee(
  builderAddress: string = BUILDER_ADDRESS,
  maxFeeRate: string = "0.01%",
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const nativeEth = getNativeEthereum();
    if (nativeEth) await switchToArbitrum(nativeEth);
    const wallet = nativeEth ? createNativeWallet(expectedAddress) : createHyperliquidWallet(expectedAddress);

    const nonce = Date.now();
    const action = {
      type: "approveBuilderFee" as const,
      hyperliquidChain: "Mainnet" as const,
      signatureChainId: "0x66eee" as `0x${string}`,
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

const UserSetAbstractionTypes = {
  "HyperliquidTransaction:UserSetAbstraction": [
    { name: "hyperliquidChain", type: "string" },
    { name: "user", type: "address" },
    { name: "abstraction", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
};

export async function signAndEnableDexAbstraction(
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const nativeEth = getNativeEthereum();
    if (nativeEth) await switchToArbitrum(nativeEth);
    const wallet = nativeEth ? createNativeWallet(expectedAddress) : createHyperliquidWallet(expectedAddress);
    const address = await resolveAddress(expectedAddress);

    const nonce = Date.now();
    const action = {
      type: "userSetAbstraction" as const,
      hyperliquidChain: "Mainnet" as const,
      signatureChainId: "0x66eee" as `0x${string}`,
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
