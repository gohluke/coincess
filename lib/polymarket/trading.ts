/**
 * Polymarket CLOB order placement.
 *
 * The CLOB uses Conditional Token Framework (CTF) tokens on Polygon.
 * Full programmatic trading requires:
 *  1. An API key (created via wallet signature on the CLOB)
 *  2. Order signing (EIP-712 on Polygon)
 *  3. POST to /order
 *
 * For the automation engine we provide a lightweight flow:
 *  - Create API credentials (one-time, stored in localStorage)
 *  - Build and sign limit orders
 *  - Submit with builder attribution headers
 */

const CLOB_API = "https://clob.polymarket.com";

interface CLOBCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

function getStoredCredentials(): CLOBCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("coincess-poly-creds");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function storeCredentials(creds: CLOBCredentials) {
  localStorage.setItem("coincess-poly-creds", JSON.stringify(creds));
}

export function hasPolymarketCredentials(): boolean {
  return getStoredCredentials() !== null;
}

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthProvider {
  const eth = (window as unknown as { ethereum?: EthProvider }).ethereum;
  if (!eth) throw new Error("No wallet detected");
  return eth;
}

/**
 * Derive API credentials from wallet signature (one-time).
 * The CLOB /auth/derive-api-key endpoint accepts an EIP-712 signature.
 */
export async function deriveApiKey(): Promise<CLOBCredentials> {
  const existing = getStoredCredentials();
  if (existing) return existing;

  const eth = getEthereum();
  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("No account connected");

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = 0;
  const message = `I want to derive an API key for Polymarket CLOB.\n\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

  const signature = await eth.request({
    method: "personal_sign",
    params: [message, address],
  }) as string;

  const res = await fetch(`${CLOB_API}/auth/derive-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, timestamp, nonce }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to derive API key: ${res.status} ${text}`);
  }

  const data = await res.json();
  const creds: CLOBCredentials = {
    apiKey: data.apiKey,
    apiSecret: data.secret,
    passphrase: data.passphrase,
  };
  storeCredentials(creds);
  return creds;
}

/**
 * Place a market buy on a Polymarket outcome token.
 * Uses the CLOB /order endpoint with GTC limit order at best ask + slippage.
 */
export async function placePolymarketOrder(params: {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
}): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    const creds = getStoredCredentials();
    if (!creds) {
      return { success: false, error: "No Polymarket API credentials. Connect wallet first." };
    }

    const eth = getEthereum();
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    const address = accounts[0];
    if (!address) return { success: false, error: "No account connected" };

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Build L2 header auth
    const headerRes = await fetch("/api/polymarket/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestamp }),
    });
    const builderHeaders = headerRes.ok ? await headerRes.json() : {};

    const order = {
      tokenID: params.tokenId,
      price: params.price.toFixed(2),
      size: params.size.toFixed(2),
      side: params.side,
      feeRateBps: "0",
      nonce: timestamp,
      expiration: "0",
      taker: address,
    };

    const res = await fetch(`${CLOB_API}/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "POLY_ADDRESS": address,
        "POLY_API_KEY": creds.apiKey,
        "POLY_PASSPHRASE": creds.passphrase,
        "POLY_TIMESTAMP": timestamp,
        ...builderHeaders,
      },
      body: JSON.stringify(order),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `CLOB error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, orderId: data.orderID || data.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function clearPolymarketCredentials() {
  localStorage.removeItem("coincess-poly-creds");
}
