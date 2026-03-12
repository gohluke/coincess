import { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://coincess.com";

  const topCoins = [
    "BTC", "ETH", "SOL", "HYPE", "DOGE", "XRP", "AVAX", "LINK", "ARB", "SUI",
    "APT", "ONDO", "PEPE", "WIF", "BONK", "AAPL", "TSLA", "NVDA", "GOOGL",
    "META", "CL", "BRENTOIL",
  ];

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/trade`, lastModified: new Date(), changeFrequency: "daily", priority: 0.95 },
    { url: `${baseUrl}/predict`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/dashboard`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/coins`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/traders`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
    { url: `${baseUrl}/automate`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/swap-guide`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/crypto-leverage-calculator`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
    { url: `${baseUrl}/join`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
  ];

  const tradePages: MetadataRoute.Sitemap = topCoins.map((coin) => ({
    url: `${baseUrl}/trade/${coin}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.75,
  }));

  const posts = await getPublishedPosts();
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at || post.published_at || post.created_at),
    changeFrequency: "weekly" as const,
    priority: post.category === "Intelligence" ? 0.85 : 0.7,
  }));

  return [...staticPages, ...tradePages, ...blogPages];
}
