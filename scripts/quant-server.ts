#!/usr/bin/env npx tsx
/**
 * Coincess Quant Trading Server
 *
 * Standalone process that runs trading strategies 24/7.
 * Deploy on Contabo VPS with pm2:
 *   pm2 start scripts/quant-server.ts --name coincess-quant --interpreter npx --interpreter-args "tsx"
 *
 * Required env vars:
 *   HL_API_PRIVATE_KEY     - Hyperliquid API wallet private key
 *   HL_ACCOUNT_ADDRESS     - Main Hyperliquid account address
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local with override so PM2-cached env vars get refreshed
config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env") });

import { QuantEngine } from "../lib/quant/engine";
import { DataCollector } from "../lib/quant/data/collector";

const REQUIRED_ENV = [
  "HL_API_PRIVATE_KEY",
  "HL_ACCOUNT_ADDRESS",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const AI_ENV = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
];

function checkEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    console.error("\nRequired:");
    console.error("  HL_API_PRIVATE_KEY       - Hyperliquid API wallet key");
    console.error("  HL_ACCOUNT_ADDRESS       - Your Hyperliquid wallet address");
    console.error("  SUPABASE_SERVICE_ROLE_KEY - Supabase service role key");
    console.error("  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
    process.exit(1);
  }
}

async function main(): Promise<void> {
  checkEnv();

  const hasAiKeys = AI_ENV.every((k) => !!process.env[k]);

  console.log("┌──────────────────────────────────────────────────────────┐");
  console.log("│     Coincess Quant Trading Server  v8.0                  │");
  console.log("│  Rebate Farmer v3: Volume Tracking + Smart Routing       │");
  console.log("│  ─────────────────────────────────────────────────────── │");
  console.log("│  Parallel L2 scanning | Best-spread-first execution      │");
  console.log("│  Per-coin win rate tracking | Adaptive fee tiers          │");
  console.log("│  Live 14-day volume + fee tier progression               │");
  console.log("│  One position at a time | Maker-only unwind              │");
  console.log("└──────────────────────────────────────────────────────────┘");
  console.log();
  console.log(`Account: ${process.env.HL_ACCOUNT_ADDRESS}`);
  console.log(`Time:    ${new Date().toISOString()}`);
  console.log();

  const engine = new QuantEngine();
  const collector = new DataCollector();

  process.on("SIGINT", async () => {
    console.log("\n[server] Shutting down gracefully...");
    collector.stop();
    await engine.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[server] SIGTERM received, stopping...");
    collector.stop();
    await engine.stop();
    process.exit(0);
  });

  // Start data collection alongside the engine
  await collector.start();
  await engine.start();
  console.log("[server] Engine + data collector running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[server] Fatal error:", err);
  process.exit(1);
});
