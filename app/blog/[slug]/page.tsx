import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  ArrowLeft,
  User,
  Tag,
  Eye,
  ChevronRight,
} from "lucide-react";
import {
  getPostBySlug,
  getAllSlugs,
  getArticleJsonLd,
} from "@/lib/blog";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Not Found" };

  const baseUrl = "https://coincess.com";

  return {
    title: `${post.title} | Coincess Intelligence`,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${baseUrl}/blog/${post.slug}`,
      siteName: "Coincess",
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      authors: [post.author],
      tags: post.keywords,
      ...(post.og_image ? { images: [{ url: post.og_image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      ...(post.og_image ? { images: [post.og_image] } : {}),
    },
    alternates: {
      canonical: post.canonical_url || `${baseUrl}/blog/${post.slug}`,
    },
  };
}

const categoryColors: Record<string, string> = {
  Tutorial: "bg-blue-950/500/15 text-blue-400",
  Security: "bg-red-950/500/15 text-red-400",
  Guide: "bg-emerald-950/500/15 text-emerald-400",
  Privacy: "bg-rose-950/500/15 text-rose-400",
  Beginner: "bg-orange-950/500/15 text-orange-400",
  Intelligence: "bg-amber-950/500/15 text-amber-400",
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || !post.published) return notFound();
  if (!post.content) return notFound();

  const baseUrl = "https://coincess.com";
  const jsonLd = getArticleJsonLd(post, baseUrl);

  const ctaConfig = getCta(post);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e11]">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            jsonLd,
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog` },
                { "@type": "ListItem", position: 3, name: post.title, item: `${baseUrl}/blog/${post.slug}` },
              ],
            },
          ]),
        }}
      />

      <main className="flex-1">
        {/* Hero */}
        <div className="bg-gradient-to-b from-[#0f1219] to-[#0b0e11] py-12 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
              <Link href="/" className="hover:text-gray-200 transition-colors">Coincess</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href="/blog" className="hover:text-gray-200 transition-colors">Blog</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-gray-300 truncate max-w-[200px] sm:max-w-none">{post.title}</span>
            </nav>

            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                categoryColors[post.category] || "bg-gray-700/50 text-gray-200"
              }`}
            >
              {post.category}
            </span>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              {post.title}
            </h1>

            <p className="text-xl text-gray-300 mb-8">{post.description}</p>

            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {post.author}
              </div>
              {post.published_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(post.published_at)}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {post.read_time} read
              </div>
              {post.view_count > 0 && (
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {post.view_count.toLocaleString()} views
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <article className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div
              className="prose prose-lg prose-invert max-w-none prose-headings:text-white prose-p:text-gray-200 prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-ul:text-gray-200 prose-ol:text-gray-200 prose-blockquote:border-brand/50 prose-blockquote:text-gray-300 prose-code:text-emerald-400 prose-code:bg-[#141620] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#141620] prose-pre:border prose-pre:border-[#2a2e39] prose-hr:border-[#2a2e39] prose-th:text-gray-200 prose-td:text-gray-300"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            {post.keywords.length > 0 && (
              <div className="mt-12 pt-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-gray-500" />
                  {post.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-3 py-1 bg-[#1a1d26] text-gray-300 rounded-full text-sm"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className={`mt-12 bg-gradient-to-r ${ctaConfig.gradient} rounded-2xl p-8 text-white text-center`}>
              <h3 className="text-2xl font-bold mb-3">{ctaConfig.title}</h3>
              <p className="text-white/80 mb-6 max-w-lg mx-auto">{ctaConfig.body}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {ctaConfig.buttons.map((btn, i) => (
                  <Link
                    key={btn.href}
                    href={btn.href}
                    className={
                      i === 0
                        ? "inline-block px-8 py-3 bg-[#141620] text-brand font-semibold rounded-lg hover:bg-[#1a1d26] transition-colors"
                        : "inline-block px-8 py-3 bg-[#141620]/20 text-white font-semibold rounded-lg hover:bg-[#141620]/30 transition-colors border border-white/30"
                    }
                  >
                    {btn.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}

function getCta(post: { cta_type: string; cta_coins: string[] }) {
  if (post.cta_type === "trade" && post.cta_coins.length > 0) {
    return {
      gradient: "from-amber-600 to-orange-600",
      title: "Trade Now on Coincess",
      body: "Go long or short with up to 50x leverage. No KYC, 24/7, starting from $10.",
      buttons: post.cta_coins.map((coin) => ({
        href: `/trade/${coin}`,
        label: `Trade ${coin}`,
      })),
    };
  }
  return {
    gradient: "from-brand to-brand-hover",
    title: "Start Trading on Coincess",
    body: "Trade crypto, oil, and gold with up to 50x leverage. No KYC required.",
    buttons: [
      { href: "/trade/BTC", label: "Trade Now" },
      { href: "/blog", label: "More Articles" },
    ],
  };
}
