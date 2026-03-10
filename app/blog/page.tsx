import { Metadata } from "next"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { BlogPosts } from "@/components/BlogPosts"
import { FeaturedPosts } from "@/components/FeaturedPosts"
import { BookOpen, Rss } from "lucide-react"

export const metadata: Metadata = {
  title: "Crypto Blog & Guides - Learn About Cryptocurrency | Coincess",
  description: "Expert guides on cryptocurrency, privacy coins, wallets, and trading. Learn how to swap crypto, protect your assets, and navigate the digital currency world.",
  keywords: ["crypto blog", "cryptocurrency guides", "how to buy crypto", "monero guide", "bitcoin tutorial", "crypto wallet guide"],
}

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 md:py-20">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/10 rounded-full text-brand text-sm font-medium mb-6">
              <BookOpen className="h-4 w-4" />
              Learn & Explore
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Crypto Blog & Guides
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Expert tutorials on cryptocurrency, privacy coins, wallets, and trading. 
              From beginner basics to advanced privacy techniques.
            </p>
          </div>

          {/* Featured Posts */}
          <FeaturedPosts />

          {/* News Feed Section */}
          <div className="border-t border-gray-200 pt-12">
            <div className="flex items-center gap-2 mb-6">
              <Rss className="h-5 w-5 text-brand" />
              <h2 className="text-2xl font-bold text-gray-900">Latest Crypto News</h2>
            </div>
            <p className="text-gray-600 mb-8">
              Stay updated with real-time cryptocurrency news from around the web.
            </p>
            <BlogPosts />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
