import { signL1Action, signUserSignedAction } from "@nktkas/hyperliquid/signing";
import type { AbstractWallet, AbstractViemLocalAccount } from "@nktkas/hyperliquid/signing";
import { ApproveBuilderFeeTypes, ApproveAgentTypes, order as sdkOrder, modify as sdkModify } from "@nktkas/hyperliquid/api/exchange";
import { HttpTransport } from "@nktkas/hyperliquid";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, custom } from "viem";
import { arbitrum } from "viem/chains";
import type { MarketInfo } from "./types";
import { BRAND_CONFIG } from "@/lib/brand.config";
import { getAgentAccount, storeAgent, clearStoredAgent, getStoredAgent } from "./agent";
import { trackTrader } from "@/lib/coincess/tracker";

export { getStoredAgent, clearStoredAgent } from "./agent";

export const STALE_AGENT_ERROR = "Trading session expired. Please enable trading again.";

const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

/**
 * Detect "User or API Wallet 0x... does not exist" errors where the address
 * belongs to the agent (not the user). This means the agent key stored locally
 * is no longer registered on Hyperliquid. Clear it so the user can re-approve.
 */
function handleStaleAgent(error: string, userAddr: string): boolean {
  const match = error.match(/0x[a-fA-F0-9]{40}/);
  if (!match) return false;
  const errorAddr = match[0].toLowerCase();
  if (errorAddr === userAddr.toLowerCase()) return false;

  const stored = getStoredAgent(userAddr);
  if (stored && stored.address.toLowerCase() === errorAddr) {
    clearStoredAgent(userAddr);
    return true;
  }
  // Even if the address doesn't match our stored agent exactly, if the error
  // says "does not exist" and the address isn't the user's, it's likely stale.
  if (error.includes("does not exist") && stored) {
    clearStoredAgent(userAddr);
    return true;
  }
  return false;
}

const BUILDER_ADDRESS = BRAND_CONFIG.builder.address;
const BUILDER_FEE = BRAND_CONFIG.builder.fee;
const BUILDER_FEE_SIMPLE = BRAND_CONFIG.builder.simpleFee;
const BUILDER_FEE_MAX_APPROVAL = BRAND_CONFIG.builder.maxFeeApproval;
const BUILDER_FEE_ENABLED = BRAND_CONFIG.builder.enabled;

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: EthProvider[];
};

let _privyProvider: EthProvider | null = null;
let _privyWalletGetter: (() => Promise<EthProvider>) | null = null;

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

function unwrapSigningError(err: unknown): string {
  const details = getErrorDetails(err);
  const causeDetails = details.cause ? getErrorDetails(details.cause) : null;
  const msg = causeDetails?.message || details.shortMessage || details.message || String(err);
  if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("denied")) {
    return "Signature rejected. Please approve the signing request in your wallet.";
  }
  if (msg.includes("not initialized") || msg.includes("not ready")) {
    return "Wallet is still loading. Please wait a moment and try again.";
  }
  return msg;
}

export function setPrivyProvider(
  provider: EthProvider | null,
  walletGetter?: () => Promise<EthProvider>,
) {
  _privyProvider = provider;
  if (walletGetter) _privyWalletGetter = walletGetter;
  if (!provider) _privyWalletGetter = null;
}

async function refreshPrivyProvider(): Promise<EthProvider | null> {
  if (_privyWalletGetter) {
    try {
      _privyProvider = await _privyWalletGetter();
    } catch {
      // keep existing _privyProvider
    }
  }
  if (_privyProvider) {
    try {
      await _privyProvider.request({ method: "eth_requestAccounts" });
    } catch {
      // best-effort; some providers don't need this
    }
  }
  return _privyProvider;
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
 * SDK Browser (viem) pattern — for native browser wallets (MetaMask etc.)
 * See: https://nktkas.gitbook.io/hyperliquid/signing
 */
function createBrowserWallet(provider: EthProvider, account: `0x${string}`): AbstractWallet {
  return createWalletClient({
    account,
    chain: arbitrum,
    transport: custom(provider),
  });
}

/**
 * SDK Custom pattern — for MPC/embedded wallets (Privy etc.) that already
 * use viem internally. Wrapping them in another WalletClient causes infinite
 * recursion, so we call eth_signTypedData_v4 directly.
 *
 * See: https://nktkas.gitbook.io/hyperliquid/signing (Custom tab)
 */
function createCustomWallet(provider: EthProvider, account: `0x${string}`): AbstractViemLocalAccount {
  return {
    address: account,
    async signTypedData({ domain, types, primaryType, message }) {
      const { EIP712Domain: _, ...typesWithoutDomain } = types as Record<string, unknown>;
      const payload = JSON.stringify({
        domain,
        types: typesWithoutDomain,
        primaryType,
        message,
      });
      const sig = await provider.request({
        method: "eth_signTypedData_v4",
        params: [account, payload],
      });
      return sig as `0x${string}`;
    },
  };
}

/**
 * Get the best available provider and create a wallet for signing.
 * Uses viem WalletClient for MetaMask, Custom adapter for Privy.
 */
async function getSigningWallet(expectedAddress?: string): Promise<{ wallet: AbstractWallet; provider: EthProvider; address: string } | null> {
  const nativeEth = getNativeEthereum();
  if (nativeEth) {
    const addr = await resolveAddressVia(nativeEth, expectedAddress);
    return { wallet: createBrowserWallet(nativeEth, addr as `0x${string}`), provider: nativeEth, address: addr };
  }
  await refreshPrivyProvider();
  if (_privyProvider) {
    const addr = await resolveAddressVia(_privyProvider, expectedAddress);
    return { wallet: createCustomWallet(_privyProvider, addr as `0x${string}`), provider: _privyProvider, address: addr };
  }
  return null;
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
    // Passive check only — use eth_accounts (no popup).
    // eth_requestAccounts is reserved for user-initiated connect actions.
    const provider = getProvider();
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return accounts[0]?.toLowerCase() ?? null;
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
  builderFee?: number;
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

export async function signAndApproveAgent(
  expectedAddress?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const resolved = await getSigningWallet(expectedAddress);
    if (!resolved) {
      return { success: false, error: "No wallet detected. Please connect your wallet first." };
    }
    const { wallet, address: userAddr } = resolved;

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
    pushSigningDebug("approveAgent.start", { userAddr, action });

    const signature = await signUserSignedAction({ wallet, action, types: ApproveAgentTypes });

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

      if (BRAND_CONFIG.referral?.code) {
        try {
          await fetch(EXCHANGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: { type: "setReferrer", code: BRAND_CONFIG.referral.code },
              nonce: Date.now(),
            }),
          });
        } catch { /* best-effort */ }
      }

      return { success: true };
    }

    const apiError = typeof data.response === "string" ? data.response : JSON.stringify(data);
    return { success: false, error: `Hyperliquid rejected: ${apiError}` };
  } catch (err) {
    pushSigningDebug("approveAgent.error", getErrorDetails(err));
    return { success: false, error: unwrapSigningError(err) };
  }
}

// ---------------------------------------------------------------------------
// Order placement (uses SDK's high-level order function)
// ---------------------------------------------------------------------------
//
// KEY LESSON (2026-03-11): We originally signed orders manually — constructing
// the action object ourselves, calling signL1Action, and POSTing to the API.
// This caused a persistent "User or API Wallet 0x... does not exist" error
// because the **action hash** (connectionId in the phantom Agent EIP-712
// message) was computed from our local msgpack encoding of the action, which
// differed from what Hyperliquid's server computed from the same JSON body.
// The hash mismatch meant the recovered signer from the signature was a random
// address, not the approved agent.
//
// The fix: use the SDK's high-level `order()` function from
// @nktkas/hyperliquid/api/exchange. It handles action construction, msgpack
// hashing, EIP-712 signing, nonce management, and HTTP serialization as a
// single atomic operation — guaranteeing the client-side hash always matches
// what the server expects.
//
// TL;DR: Never manually construct + sign + POST Hyperliquid L1 actions.
//        Always use the SDK's high-level functions (order, cancel, etc.).
// ---------------------------------------------------------------------------

export async function signAndPlaceOrder(
  params: PlaceOrderParams & { expectedAddress?: string },
  _isRetry = false,
): Promise<{ success: boolean; error?: string; oid?: number }> {
  try {
    const userAddr = await resolveAddress(params.expectedAddress);
    const agentAcc = getAgentAccount(userAddr);
    const wallet = agentAcc ?? createBrowserWallet(getProvider(), userAddr as `0x${string}`);

    pushSigningDebug("placeOrder.start", {
      userAddr,
      hasAgent: !!agentAcc,
      agentAddress: agentAcc?.address,
      coin: params.coin,
      side: params.isBuy ? "buy" : "sell",
      size: params.size,
    });

    const orderWire = buildOrderWire(params);

    const isWhitelisted = BRAND_CONFIG.builder.feeWhitelist.some(
      (a) => a.toLowerCase() === userAddr,
    );
    const effectiveFee = params.builderFee ?? BUILDER_FEE;
    const builderOpt = BUILDER_FEE_ENABLED && !isWhitelisted
      ? { b: BUILDER_ADDRESS, f: effectiveFee }
      : undefined;

    const transport = new HttpTransport();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await sdkOrder({ transport, wallet } as any, {
      orders: [orderWire],
      grouping: "na",
      builder: builderOpt,
    });

    pushSigningDebug("placeOrder.response", data);

    const status = data.response.data.statuses[0];
    if (typeof status === "object" && "error" in status) {
      const errMsg = (status as { error: string }).error;

      // Auto-approve builder fee and retry once if not yet approved
      if (!_isRetry && errMsg.toLowerCase().includes("builder fee") && errMsg.toLowerCase().includes("not been approved")) {
        pushSigningDebug("placeOrder.autoApproveBuilderFee", { errMsg });
        const approval = await signAndApproveBuilderFee(BUILDER_ADDRESS, BUILDER_FEE_MAX_APPROVAL, params.expectedAddress);
        if (approval.success) {
          return signAndPlaceOrder(params, true);
        }
      }

      return { success: false, error: errMsg };
    }
    const notional = Math.abs(parseFloat(params.size)) * parseFloat(params.price);
    if (typeof status === "object" && "filled" in status) {
      trackTrader(userAddr, notional);
      return { success: true, oid: (status as { filled: { oid: number } }).filled.oid };
    }
    if (typeof status === "object" && "resting" in status) {
      trackTrader(userAddr, notional);
      return { success: true, oid: (status as { resting: { oid: number } }).resting.oid };
    }
    trackTrader(userAddr, notional);
    return { success: true };
  } catch (err) {
    pushSigningDebug("placeOrder.exception", getErrorDetails(err));
    const msg = (err as Error).message || String(err);
    pushSigningDebug("placeOrder.errorMsg", msg);

    if (!_isRetry && msg.toLowerCase().includes("builder fee") && msg.toLowerCase().includes("not been approved")) {
      const userAddr = await resolveAddress(params.expectedAddress).catch(() => "");
      if (userAddr) {
        const approval = await signAndApproveBuilderFee(BUILDER_ADDRESS, BUILDER_FEE_MAX_APPROVAL, params.expectedAddress);
        if (approval.success) {
          return signAndPlaceOrder(params, true);
        }
      }
    }

    if (msg.includes("does not exist")) {
      const userAddr = await resolveAddress(params.expectedAddress).catch(() => "");
      if (userAddr && handleStaleAgent(msg, userAddr)) {
        return { success: false, error: STALE_AGENT_ERROR };
      }
    }
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Order modification (uses SDK's high-level modify function)
// ---------------------------------------------------------------------------

export async function signAndModifyOrder(params: {
  oid: number;
  coin: string;
  isBuy: boolean;
  newPrice: string;
  newSize: string;
  reduceOnly: boolean;
  orderType: "limit" | "trigger";
  tpsl?: { triggerPx: string; type: "tp" | "sl" };
  markets: MarketInfo[];
  expectedAddress?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userAddr = await resolveAddress(params.expectedAddress);
    const agentAcc = getAgentAccount(userAddr);
    const wallet = agentAcc ?? createBrowserWallet(getProvider(), userAddr as `0x${string}`);

    const market = params.markets.find((m) => m.name === params.coin);
    if (!market) throw new Error(`Market ${params.coin} not found`);

    const price = parseFloat(params.newPrice);
    const size = parseFloat(params.newSize);

    const priceStr = priceToWire(price);
    const sizeStr = sizeToWire(size, market.szDecimals);

    let orderType: { limit: { tif: "Gtc" | "Ioc" } } | { trigger: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" } };
    if (params.tpsl) {
      orderType = {
        trigger: {
          isMarket: true,
          triggerPx: priceToWire(parseFloat(params.tpsl.triggerPx)),
          tpsl: params.tpsl.type,
        },
      };
    } else {
      orderType = { limit: { tif: "Gtc" } };
    }

    const transport = new HttpTransport();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sdkModify({ transport, wallet } as any, {
      oid: params.oid,
      order: {
        a: market.assetIndex,
        b: params.isBuy,
        p: priceStr,
        s: sizeStr,
        r: params.reduceOnly,
        t: orderType,
      },
    });

    return { success: true };
  } catch (err) {
    pushSigningDebug("modifyOrder.exception", getErrorDetails(err));
    const msg = (err as Error).message || String(err);
    if (msg.includes("does not exist")) {
      const userAddr = await resolveAddress(params.expectedAddress).catch(() => "");
      if (userAddr && handleStaleAgent(msg, userAddr)) {
        return { success: false, error: STALE_AGENT_ERROR };
      }
    }
    return { success: false, error: msg };
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
    const wallet = agentAcc ?? createBrowserWallet(getProvider(), userAddr as `0x${string}`);

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
    const cancelErr = data.response?.data?.statuses?.[0]?.error ?? "Cancel failed";
    if (cancelErr.includes("does not exist") && handleStaleAgent(cancelErr, userAddr)) {
      return { success: false, error: STALE_AGENT_ERROR };
    }
    return { success: false, error: cancelErr };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (msg.includes("does not exist")) {
      const addr = await resolveAddress(expectedAddress).catch(() => "");
      if (addr && handleStaleAgent(msg, addr)) {
        return { success: false, error: STALE_AGENT_ERROR };
      }
    }
    return { success: false, error: msg };
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
    const wallet = agentAcc ?? createBrowserWallet(getProvider(), userAddr as `0x${string}`);

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
    if (nativeEth) {
      try { await switchToArbitrum(nativeEth); } catch { /* non-blocking */ }
    } else {
      await refreshPrivyProvider();
    }
    const provider = nativeEth ?? _privyProvider ?? getProvider();
    const addr = await resolveAddressVia(provider, expectedAddress);
    const wallet = nativeEth
      ? createBrowserWallet(provider, addr as `0x${string}`)
      : createCustomWallet(provider, addr as `0x${string}`);

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
    if (nativeEth) {
      try { await switchToArbitrum(nativeEth); } catch { /* non-blocking */ }
    } else {
      await refreshPrivyProvider();
    }
    const provider = nativeEth ?? _privyProvider ?? getProvider();
    const address = await resolveAddressVia(provider, expectedAddress);
    const wallet = nativeEth
      ? createBrowserWallet(provider, address as `0x${string}`)
      : createCustomWallet(provider, address as `0x${string}`);

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
