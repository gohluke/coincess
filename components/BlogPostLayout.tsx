import Link from "next/link"
import { Calendar, Clock, ArrowLeft, User, Tag, ChevronRight } from "lucide-react"
import { BlogPost } from "@/lib/blog-posts"

interface BlogPostLayoutProps {
  post: BlogPost
  children: React.ReactNode
  tickerCoins?: string[]
}

const categoryColors: Record<string, string> = {
  Tutorial: "bg-blue-500/15 text-blue-400",
  Security: "bg-red-500/15 text-red-400",
  Guide: "bg-emerald-500/15 text-emerald-400",
  Privacy: "bg-rose-500/15 text-rose-400",
  Beginner: "bg-orange-500/15 text-orange-400",
  Intelligence: "bg-amber-500/15 text-amber-400",
}

export function BlogPostLayout({ post, children, tickerCoins }: BlogPostLayoutProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e11]">
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
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(post.publishedAt)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {post.readTime} read
              </div>
            </div>

            {/* LiveTicker placeholder — rendered client-side by articles that pass tickerCoins */}
            {tickerCoins && tickerCoins.length > 0 && (
              <div className="mt-6" id="blog-ticker" data-coins={JSON.stringify(tickerCoins)} />
            )}
          </div>
        </div>

        {/* Content */}
        <article className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="prose prose-lg prose-invert max-w-none prose-headings:text-white prose-p:text-gray-200 prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-ul:text-gray-200 prose-ol:text-gray-200 prose-blockquote:border-brand/50 prose-blockquote:text-gray-300 prose-code:text-emerald-400 prose-code:bg-[#141620] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#141620] prose-pre:border prose-pre:border-[#2a2e39] prose-hr:border-[#2a2e39] prose-th:text-gray-200 prose-td:text-gray-300">
              {children}
            </div>

            {/* Tags */}
            <div className="mt-12 pt-8">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-gray-500" />
                {post.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="px-3 py-1 bg-[#1a1d26] text-gray-300 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12 bg-gradient-to-r from-brand to-brand-hover rounded-2xl p-8 text-white text-center">
              <h3 className="text-2xl font-bold mb-3">Start Trading on Coincess</h3>
              <p className="text-white/80 mb-6 max-w-lg mx-auto">
                Trade crypto, oil, and gold with up to 50x leverage. No KYC required.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/trade/BTC"
                  className="inline-block px-8 py-3 bg-white text-brand font-semibold rounded-full hover:bg-gray-100 transition-colors"
                >
                  Trade Now
                </Link>
                <Link
                  href="/blog"
                  className="inline-block px-8 py-3 bg-white/20 text-white font-semibold rounded-full hover:bg-white/30 transition-colors border border-white/30"
                >
                  More Articles
                </Link>
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
