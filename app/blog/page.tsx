import { Metadata } from "next";
import { BookOpen, Rss, Clock, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { getPublishedPosts, getFeaturedPosts, BlogPost } from "@/lib/blog";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Coincess Intelligence — Crypto Blog, Market Analysis & Trading Guides",
  description:
    "Expert market intelligence, trading strategies, and crypto guides. Oil price analysis, funding rate plays, and on-chain insights from Coincess.",
  keywords: [
    "crypto blog",
    "cryptocurrency guides",
    "oil trading analysis",
    "Coincess Intelligence",
    "crypto market analysis",
    "trading strategies",
    "DeFi guides",
  ],
};

const categoryColors: Record<string, string> = {
  Tutorial: "bg-blue-500/15 text-blue-400",
  Security: "bg-red-500/15 text-red-400",
  Guide: "bg-emerald-500/15 text-emerald-400",
  Privacy: "bg-rose-500/15 text-rose-400",
  Beginner: "bg-orange-500/15 text-orange-400",
  Intelligence: "bg-amber-500/15 text-amber-400",
};

function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group block bg-[#141620] rounded-xl overflow-hidden hover:bg-[#1a1d26] transition-all ${
        featured ? "md:col-span-2 md:grid md:grid-cols-2" : ""
      }`}
    >
      <div
        className={`bg-gradient-to-br from-brand/10 to-brand/5 ${
          featured ? "h-full min-h-[200px]" : "h-40"
        } flex items-center justify-center`}
      >
        <div className="text-brand/20 text-6xl font-bold">{post.category.charAt(0)}</div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              categoryColors[post.category] || "bg-gray-700/50 text-gray-300"
            }`}
          >
            {post.category}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {post.read_time}
          </span>
        </div>
        <h3
          className={`font-bold text-white group-hover:text-brand transition-colors mb-2 ${
            featured ? "text-xl md:text-2xl" : "text-lg"
          }`}
        >
          {post.title}
        </h3>
        <p className="text-gray-300 text-sm line-clamp-2 mb-4">{post.description}</p>
        <span className="inline-flex items-center gap-2 text-brand font-medium text-sm group-hover:gap-3 transition-all">
          Read Article
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export default async function BlogPage() {
  const [featuredPosts, allPosts] = await Promise.all([
    getFeaturedPosts(),
    getPublishedPosts(),
  ]);

  const nonFeaturedPosts = allPosts.filter(
    (p) => !featuredPosts.some((f) => f.id === p.id),
  );

  const [firstFeatured, ...restFeatured] = featuredPosts;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e11]">
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 md:py-20">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/10 rounded-full text-brand text-sm font-medium mb-6">
              <BookOpen className="h-4 w-4" />
              Coincess Intelligence
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Market Intelligence & Guides
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Expert market analysis, trading strategies, and crypto guides.
              From oil price movements to funding rate plays.
            </p>
          </div>

          {/* Featured Posts */}
          {featuredPosts.length > 0 && (
            <div className="mb-16">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-brand" />
                <h2 className="text-2xl font-bold text-white">Featured</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {firstFeatured && <PostCard post={firstFeatured} featured />}
                {restFeatured.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            </div>
          )}

          {/* All Posts */}
          {nonFeaturedPosts.length > 0 && (
            <div className="pt-12">
              <div className="flex items-center gap-2 mb-6">
                <Rss className="h-5 w-5 text-brand" />
                <h2 className="text-2xl font-bold text-white">All Articles</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nonFeaturedPosts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            </div>
          )}

          {allPosts.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <p>No articles yet. Check back soon.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
