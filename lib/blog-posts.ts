export interface BlogPost {
  slug: string
  title: string
  description: string
  category: string
  readTime: string
  publishedAt: string
  author: string
  featured: boolean
  keywords: string[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-swap-bitcoin-for-monero",
    title: "How to Swap Bitcoin for Monero (XMR) Instantly: No Account Needed",
    description: "Want to turn Bitcoin into Monero without ID verification? Learn the fastest way to swap BTC for XMR instantly. No account required, done in 15 minutes.",
    category: "Tutorial",
    readTime: "6 min",
    publishedAt: "2025-12-08",
    author: "Coincess Team",
    featured: true,
    keywords: ["swap bitcoin for monero", "buy monero no kyc", "instant xmr swap", "anonymous crypto exchange", "btc to xmr"],
  },
  {
    slug: "hot-wallets-vs-cold-wallets",
    title: "Hot Wallets vs. Cold Wallets: How to Keep Your Crypto Safe in 2025",
    description: "Understand the critical differences between hot and cold wallets. Learn which one you need and how to protect your cryptocurrency from hackers.",
    category: "Security",
    readTime: "7 min",
    publishedAt: "2025-12-08",
    author: "Coincess Team",
    featured: true,
    keywords: ["hot wallet", "cold wallet", "crypto security", "hardware wallet", "ledger", "trezor"],
  },
  {
    slug: "exchange-vs-swap-aggregator",
    title: "Exchange vs. Swap Aggregator: What is the Cheapest Way to Buy Crypto?",
    description: "Compare centralized exchanges like Binance with swap aggregators. Find out which method saves you time, money, and hassle when buying cryptocurrency.",
    category: "Guide",
    readTime: "6 min",
    publishedAt: "2025-12-08",
    author: "Coincess Team",
    featured: true,
    keywords: ["crypto exchange comparison", "swap aggregator", "cheapest crypto", "no kyc exchange"],
  },
  {
    slug: "why-privacy-matters-anonymous-crypto",
    title: "Why Privacy Matters: A Beginner's Guide to Anonymous Crypto",
    description: "Bitcoin isn't as private as you think. Learn why financial privacy matters and how privacy coins like Monero protect your transactions.",
    category: "Privacy",
    readTime: "8 min",
    publishedAt: "2025-12-08",
    author: "Coincess Team",
    featured: true,
    keywords: ["anonymous crypto", "privacy coins", "monero privacy", "bitcoin not private", "financial privacy"],
  },
  {
    slug: "crypto-101-first-coin-5-minutes",
    title: "Crypto 101: How to Get Your First Coin in Under 5 Minutes",
    description: "The simplest guide to buying your first cryptocurrency. No complex jargon, no lengthy verification—just three easy steps to coin access.",
    category: "Beginner",
    readTime: "4 min",
    publishedAt: "2025-12-08",
    author: "Coincess Team",
    featured: true,
    keywords: ["buy first crypto", "crypto for beginners", "how to buy bitcoin", "crypto 101", "coin access"],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug)
}

export function getFeaturedPosts(): BlogPost[] {
  return blogPosts.filter((post) => post.featured)
}
