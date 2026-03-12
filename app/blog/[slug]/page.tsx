import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  Calendar,
  Clock,
  ArrowLeft,
  User,
  Tag,
  Eye,
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
  Tutorial: "bg-blue-100 text-blue-800",
  Security: "bg-red-100 text-red-800",
  Guide: "bg-green-100 text-green-800",
  Privacy: "bg-rose-100 text-rose-800",
  Beginner: "bg-orange-100 text-orange-800",
  Intelligence: "bg-amber-100 text-amber-800",
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
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

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
        <div className="bg-gradient-to-br from-brand/5 to-brand/10 py-12 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-brand hover:text-brand-hover mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>

            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                categoryColors[post.category] || "bg-gray-100 text-gray-800"
              }`}
            >
              {post.category}
            </span>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {post.title}
            </h1>

            <p className="text-xl text-gray-600 mb-8">{post.description}</p>

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
              className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            {post.keywords.length > 0 && (
              <div className="mt-12 pt-8 border-t border-gray-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-gray-400" />
                  {post.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
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
                        ? "inline-block px-8 py-3 bg-white text-brand font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                        : "inline-block px-8 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors border border-white/30"
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
      <Footer />
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
    title: "Ready to Start Swapping?",
    body: "Use our swap guide to find the best rates and exchange your crypto instantly — no account needed.",
    buttons: [{ href: "/swap-guide", label: "View Swap Guide" }],
  };
}
