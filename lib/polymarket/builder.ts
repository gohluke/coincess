/**
 * Polymarket Builder Attribution
 *
 * To earn fees from Polymarket trades:
 * 1. Go to https://polymarket.com/settings?tab=builder
 * 2. Create a builder profile
 * 3. Get your API key, secret, and passphrase
 * 4. Set them as environment variables:
 *    - POLYMARKET_BUILDER_KEY
 *    - POLYMARKET_BUILDER_SECRET
 *    - POLYMARKET_BUILDER_PASSPHRASE
 *
 * Revenue: Polymarket distributes weekly USDC rewards based on
 * your share of total builder volume. Estimated 0.5-1% of volume.
 *
 * The signing server returns 4 headers that must be included
 * with every CLOB order:
 *   POLY_BUILDER_SIGNATURE
 *   POLY_BUILDER_TIMESTAMP
 *   POLY_BUILDER_API_KEY
 *   POLY_BUILDER_PASSPHRASE
 */

import { createHmac } from "crypto";

export interface BuilderHeaders {
  POLY_BUILDER_SIGNATURE: string;
  POLY_BUILDER_TIMESTAMP: string;
  POLY_BUILDER_API_KEY: string;
  POLY_BUILDER_PASSPHRASE: string;
}

export function signBuilderRequest(
  method: string,
  path: string,
  body: string,
  key: string,
  secret: string,
  passphrase: string,
): BuilderHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + body;
  const signature = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(message)
    .digest("base64");

  return {
    POLY_BUILDER_SIGNATURE: signature,
    POLY_BUILDER_TIMESTAMP: timestamp,
    POLY_BUILDER_API_KEY: key,
    POLY_BUILDER_PASSPHRASE: passphrase,
  };
}

export function isBuilderConfigured(): boolean {
  return !!(
    process.env.POLYMARKET_BUILDER_KEY &&
    process.env.POLYMARKET_BUILDER_SECRET &&
    process.env.POLYMARKET_BUILDER_PASSPHRASE
  );
}
