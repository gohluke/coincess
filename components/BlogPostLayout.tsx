import Link from "next/link"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Calendar, Clock, ArrowLeft, User, Tag } from "lucide-react"
import { BlogPost } from "@/lib/blog-posts"

interface BlogPostLayoutProps {
  post: BlogPost
  children: React.ReactNode
}

export function BlogPostLayout({ post, children }: BlogPostLayoutProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const categoryColors: Record<string, string> = {
    Tutorial: "bg-blue-100 text-blue-800",
    Security: "bg-red-100 text-red-800",
    Guide: "bg-green-100 text-green-800",
    Privacy: "bg-rose-100 text-rose-800",
    Beginner: "bg-orange-100 text-orange-800",
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#FF455B]/5 to-[#FF455B]/10 py-12 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[#FF455B] hover:text-[#E63B50] mb-6 transition-colors"
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
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(post.publishedAt)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {post.readTime} read
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <article className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-[#FF455B] prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700">
              {children}
            </div>

            {/* Tags */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-gray-400" />
                {post.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12 bg-gradient-to-r from-[#FF455B] to-[#E63B50] rounded-2xl p-8 text-white text-center">
              <h3 className="text-2xl font-bold mb-3">Ready to Start Swapping?</h3>
              <p className="text-white/80 mb-6 max-w-lg mx-auto">
                Use our swap guide to find the best rates and exchange your crypto instantly—no account needed.
              </p>
              <Link
                href="/swap-guide"
                className="inline-block px-8 py-3 bg-white text-[#FF455B] font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                View Swap Guide
              </Link>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
