import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const extractedPath = resolve(process.cwd(), "BLOG_ARTICLES_HTML_EXTRACT.md");
const raw = readFileSync(extractedPath, "utf-8");

function extractHtmlBlock(md: string, slug: string): string {
  const slugHeader = slug.replace(/-/g, "[-\\s]");
  const regex = new RegExp(
    `## \\d+\\.\\s+${slug}[\\s\\S]*?\`\`\`html\\n([\\s\\S]*?)\`\`\``,
    "i",
  );
  const match = md.match(regex);
  if (!match) throw new Error(`Could not extract HTML for slug: ${slug}`);
  return match[1].trim();
}

const posts = [
  {
    slug: "oil-prices-iran-war-how-to-trade-crude-oil-2026",
    title: "Oil Prices Are Surging: How the Iran War Is Driving Crude to $120 and How to Trade It",
    description: "Crude oil surged 35% in one week as Iran threatens to close the Strait of Hormuz. Learn what drives oil prices, why this is the biggest supply disruption in history, and how to trade oil on Coincess.",
    category: "Intelligence",
    read_time: "10 min",
    published_at: "2026-03-09T12:00:00Z",
    author: "Coincess Intelligence",
    featured: true,
    published: true,
    keywords: ["oil prices", "crude oil trading", "Iran war oil", "Strait of Hormuz", "Brent crude", "WTI crude oil", "how to trade oil", "oil price forecast 2026", "geopolitical oil trading", "trade crude oil crypto", "oil perpetual futures", "Coincess oil trading"],
    cta_type: "trade",
    cta_coins: ["CL", "BRENTOIL"],
  },
  {
    slug: "how-to-swap-bitcoin-for-monero",
    title: "How to Swap Bitcoin for Monero (XMR) Instantly: No Account Needed",
    description: "Want to turn Bitcoin into Monero without ID verification? Learn the fastest way to swap BTC for XMR instantly. No account required, done in 15 minutes.",
    category: "Tutorial",
    read_time: "6 min",
    published_at: "2025-12-08T12:00:00Z",
    author: "Coincess Team",
    featured: true,
    published: true,
    keywords: ["swap bitcoin for monero", "buy monero no kyc", "instant xmr swap", "anonymous crypto exchange", "btc to xmr"],
    cta_type: "swap",
    cta_coins: [],
  },
  {
    slug: "hot-wallets-vs-cold-wallets",
    title: "Hot Wallets vs. Cold Wallets: How to Keep Your Crypto Safe in 2025",
    description: "Understand the critical differences between hot and cold wallets. Learn which one you need and how to protect your cryptocurrency from hackers.",
    category: "Security",
    read_time: "7 min",
    published_at: "2025-12-08T12:00:00Z",
    author: "Coincess Team",
    featured: true,
    published: true,
    keywords: ["hot wallet", "cold wallet", "crypto security", "hardware wallet", "ledger", "trezor"],
    cta_type: "swap",
    cta_coins: [],
  },
  {
    slug: "exchange-vs-swap-aggregator",
    title: "Exchange vs. Swap Aggregator: What is the Cheapest Way to Buy Crypto?",
    description: "Compare centralized exchanges like Binance with swap aggregators. Find out which method saves you time, money, and hassle when buying cryptocurrency.",
    category: "Guide",
    read_time: "6 min",
    published_at: "2025-12-08T12:00:00Z",
    author: "Coincess Team",
    featured: true,
    published: true,
    keywords: ["crypto exchange comparison", "swap aggregator", "cheapest crypto", "no kyc exchange"],
    cta_type: "swap",
    cta_coins: [],
  },
  {
    slug: "why-privacy-matters-anonymous-crypto",
    title: "Why Privacy Matters: A Beginner's Guide to Anonymous Crypto",
    description: "Bitcoin isn't as private as you think. Learn why financial privacy matters and how privacy coins like Monero protect your transactions.",
    category: "Privacy",
    read_time: "8 min",
    published_at: "2025-12-08T12:00:00Z",
    author: "Coincess Team",
    featured: true,
    published: true,
    keywords: ["anonymous crypto", "privacy coins", "monero privacy", "bitcoin not private", "financial privacy"],
    cta_type: "swap",
    cta_coins: [],
  },
  {
    slug: "crypto-101-first-coin-5-minutes",
    title: "Crypto 101: How to Get Your First Coin in Under 5 Minutes",
    description: "The simplest guide to buying your first cryptocurrency. No complex jargon, no lengthy verification—just three easy steps to coin access.",
    category: "Beginner",
    read_time: "4 min",
    published_at: "2025-12-08T12:00:00Z",
    author: "Coincess Team",
    featured: true,
    published: true,
    keywords: ["buy first crypto", "crypto for beginners", "how to buy bitcoin", "crypto 101", "coin access"],
    cta_type: "swap",
    cta_coins: [],
  },
];

async function insertPost(post: (typeof posts)[0], content: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_blog_post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      p_slug: post.slug,
      p_title: post.title,
      p_description: post.description,
      p_content: content,
      p_category: post.category,
      p_author: post.author,
      p_read_time: post.read_time,
      p_featured: post.featured,
      p_published: post.published,
      p_published_at: post.published_at,
      p_keywords: post.keywords,
      p_cta_type: post.cta_type,
      p_cta_coins: post.cta_coins,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log("Starting blog migration...");

  for (const post of posts) {
    try {
      const content = extractHtmlBlock(raw, post.slug);
      console.log(`  Extracted ${content.length} chars for ${post.slug}`);

      const data = await insertPost(post, content);
      console.log(`  OK: ${post.slug} (${data?.[0]?.id ?? "inserted"})`);
    } catch (e) {
      console.error(`  FAILED ${post.slug}:`, (e as Error).message);
    }
  }

  console.log("\nMigration complete!");
}

main();
