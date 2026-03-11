/**
 * Coincess Twitter/X Content Engine
 *
 * Posts automated content to @coincess on a schedule.
 * Runs as a long-lived process (use pm2 for production).
 *
 * Usage:
 *   npx tsx scripts/twitter-engine.ts              # run scheduler (posts at optimal times)
 *   npx tsx scripts/twitter-engine.ts --post now    # post one piece of content immediately
 *   npx tsx scripts/twitter-engine.ts --post market  # post market movers now
 *   npx tsx scripts/twitter-engine.ts --post funding # post funding rate alpha now
 *   npx tsx scripts/twitter-engine.ts --post volume  # post volume update now
 *   npx tsx scripts/twitter-engine.ts --post thread  # post educational thread now
 *   npx tsx scripts/twitter-engine.ts --post engage  # post engagement content now
 *   npx tsx scripts/twitter-engine.ts --dry-run      # generate content without posting
 *   npx tsx scripts/twitter-engine.ts --preview all   # preview all content types
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { postTweet, postThread } from "../lib/twitter/client";
import {
  generateContent,
  getScheduledContentType,
  type ContentType,
} from "../lib/twitter/content";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const postArg = args.includes("--post") ? args[args.indexOf("--post") + 1] : null;
const previewAll = args.includes("--preview");

async function publishContent(type: ContentType) {
  console.log(`\n[${new Date().toISOString()}] Generating ${type} content...`);

  const content = await generateContent(type);

  if (Array.isArray(content)) {
    console.log(`\n--- Thread (${content.length} tweets) ---`);
    content.forEach((t, i) => console.log(`\n[${i + 1}/${content.length}]\n${t}`));
    console.log("---\n");

    if (!isDryRun) {
      const ids = await postThread(content);
      console.log(`Posted thread: ${ids.length} tweets`);
    }
  } else {
    console.log(`\n--- Single Post ---\n${content}\n---\n`);
    console.log(`Characters: ${content.length}/280`);

    if (content.length > 280) {
      console.warn("WARNING: Tweet exceeds 280 characters! Will be truncated or rejected.");
    }

    if (!isDryRun) {
      const result = await postTweet(content);
      if (result) console.log(`Posted: https://x.com/coincess/status/${result.id}`);
    }
  }
}

async function main() {
  // One-off post mode
  if (postArg) {
    const typeMap: Record<string, ContentType> = {
      market: "market_movers",
      funding: "funding_alpha",
      volume: "volume",
      thread: "thread",
      engage: "engagement",
      engagement: "engagement",
    };

    if (postArg === "now") {
      const hour = new Date().getUTCHours();
      const type = getScheduledContentType(hour) ?? "engagement";
      await publishContent(type);
    } else if (typeMap[postArg]) {
      await publishContent(typeMap[postArg]);
    } else {
      console.error(`Unknown content type: ${postArg}`);
      console.log("Available: market, funding, volume, thread, engage");
    }
    process.exit(0);
  }

  // Preview all mode
  if (previewAll) {
    const types: ContentType[] = ["market_movers", "funding_alpha", "volume", "thread", "engagement"];
    for (const type of types) {
      await publishContent(type);
    }
    process.exit(0);
  }

  // Scheduler mode — runs continuously, posts at scheduled times
  console.log("Coincess Twitter Engine starting...");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log("Schedule (UTC):");
  console.log("  07:00 — Market Movers");
  console.log("  09:00 — Engagement");
  console.log("  11:00 — Funding Rate Alpha");
  console.log("  13:00 — Engagement");
  console.log("  15:00 — Volume Update");
  console.log("  17:00 — Educational Thread");
  console.log("  19:00 — Engagement");
  console.log("  21:00 — Market Recap");
  console.log("\nWaiting for next scheduled slot...\n");

  const postedHours = new Set<string>();

  async function tick() {
    const now = new Date();
    const hour = now.getUTCHours();
    const dateKey = `${now.toISOString().slice(0, 10)}-${hour}`;

    if (postedHours.has(dateKey)) return;

    const type = getScheduledContentType(hour);
    if (!type) return;

    if (now.getUTCMinutes() > 10) return;

    postedHours.add(dateKey);

    try {
      await publishContent(type);
    } catch (err) {
      console.error(`[${dateKey}] Failed:`, (err as Error).message);
    }
  }

  setInterval(tick, 5 * 60 * 1000);
  tick();

  process.on("SIGINT", () => {
    console.log("\nTwitter engine stopped.");
    process.exit(0);
  });
}

main().catch(console.error);
