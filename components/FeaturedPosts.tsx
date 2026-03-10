import Link from "next/link"
import { blogPosts, BlogPost } from "@/lib/blog-posts"
import { Clock, ArrowRight, Sparkles } from "lucide-react"

const categoryColors: Record<string, string> = {
  Tutorial: "bg-blue-100 text-blue-800",
  Security: "bg-red-100 text-red-800",
  Guide: "bg-green-100 text-green-800",
  Privacy: "bg-rose-100 text-rose-800",
  Beginner: "bg-orange-100 text-orange-800",
}

function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group block bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-brand/50 hover:shadow-lg transition-all ${
        featured ? "md:col-span-2 md:grid md:grid-cols-2" : ""
      }`}
    >
      {/* Placeholder image area */}
      <div className={`bg-gradient-to-br from-brand/10 to-brand/5 ${featured ? "h-full min-h-[200px]" : "h-40"} flex items-center justify-center`}>
        <div className="text-brand/30 text-6xl font-bold">
          {post.category.charAt(0)}
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              categoryColors[post.category] || "bg-gray-100 text-gray-800"
            }`}
          >
            {post.category}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {post.readTime}
          </span>
        </div>

        <h3 className={`font-bold text-gray-900 group-hover:text-brand transition-colors mb-2 ${featured ? "text-xl md:text-2xl" : "text-lg"}`}>
          {post.title}
        </h3>

        <p className="text-gray-600 text-sm line-clamp-2 mb-4">
          {post.description}
        </p>

        <span className="inline-flex items-center gap-2 text-brand font-medium text-sm group-hover:gap-3 transition-all">
          Read Article
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}

export function FeaturedPosts() {
  const featuredPosts = blogPosts.filter((post) => post.featured)
  const [firstPost, ...restPosts] = featuredPosts

  return (
    <div className="mb-16">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-5 w-5 text-brand" />
        <h2 className="text-2xl font-bold text-gray-900">Featured Guides</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Featured (large) post */}
        {firstPost && <PostCard post={firstPost} featured />}

        {/* Rest of posts */}
        {restPosts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  )
}
