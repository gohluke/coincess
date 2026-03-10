"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, TrendingUp, ArrowRight, ExternalLink } from "lucide-react"

interface NewsItem {
  title: string
  link: string
  pubDate: string
  contentSnippet: string
  image?: string
  source: string
}

const categoryColors: Record<string, string> = {
  "Market Analysis": "bg-blue-100 text-blue-800",
  "Technology": "bg-rose-100 text-rose-800",
  "Trading": "bg-green-100 text-green-800",
  "Regulation": "bg-yellow-100 text-yellow-800",
  "NFTs": "bg-pink-100 text-pink-800",
  "Education": "bg-indigo-100 text-indigo-800",
  "Tax & Legal": "bg-red-100 text-red-800",
  "DeFi": "bg-cyan-100 text-cyan-800",
  "News": "bg-orange-100 text-orange-800",
}

export function BlogPosts() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchNews()
    // Refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchNews = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/news")
      if (response.ok) {
        const data = await response.json()
        setNews(data)
      } else {
        console.error("Failed to fetch news")
      }
    } catch (error) {
      console.error("Error fetching news:", error)
    } finally {
      setLoading(false)
    }
  }

  // Extract categories from news sources and titles
  const getCategory = (item: NewsItem): string => {
    const title = item.title.toLowerCase()
    const snippet = item.contentSnippet.toLowerCase()
    const text = `${title} ${snippet}`

    if (text.includes("bitcoin") || text.includes("ethereum") || text.includes("price") || text.includes("market")) {
      return "Market Analysis"
    }
    if (text.includes("defi") || text.includes("yield") || text.includes("staking")) {
      return "DeFi"
    }
    if (text.includes("nft") || text.includes("non-fungible")) {
      return "NFTs"
    }
    if (text.includes("regulation") || text.includes("sec") || text.includes("legal") || text.includes("law")) {
      return "Regulation"
    }
    if (text.includes("tax") || text.includes("irs")) {
      return "Tax & Legal"
    }
    if (text.includes("trading") || text.includes("exchange") || text.includes("leverage")) {
      return "Trading"
    }
    if (text.includes("blockchain") || text.includes("protocol") || text.includes("upgrade")) {
      return "Technology"
    }
    if (text.includes("learn") || text.includes("guide") || text.includes("how to") || text.includes("tutorial")) {
      return "Education"
    }
    return "News"
  }

  const categories = ["All", ...Array.from(new Set(news.map((item) => getCategory(item))))]

  const filteredNews = news.filter((item) => {
    const category = getCategory(item)
    const matchesCategory = selectedCategory === "All" || category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contentSnippet.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

      if (diffInHours < 1) {
        return "Just now"
      } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
      } else if (diffInHours < 48) {
        return "Yesterday"
      } else {
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      }
    } catch {
      return "Recently"
    }
  }

  const estimateReadTime = (text: string) => {
    const wordsPerMinute = 200
    const words = text.split(/\s+/).length
    const minutes = Math.ceil(words / wordsPerMinute)
    return `${minutes} min read`
  }

  if (loading && news.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          <div className="text-gray-600">Loading latest crypto news...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Search and Filter */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? "bg-rose-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* News Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredNews.map((item, index) => {
          const category = getCategory(item)
          return (
            <article
              key={`${item.link}-${index}`}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col"
            >
              {/* Image */}
              {item.image && (
                <div className="w-full h-48 bg-gray-200 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col">
                {/* Category and Source */}
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      categoryColors[category] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {category}
                  </span>
                  <span className="text-xs text-gray-500">{item.source}</span>
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {item.title}
                </h2>

                {/* Excerpt */}
                <p className="text-gray-600 mb-4 line-clamp-3 flex-1 text-sm">
                  {item.contentSnippet}
                </p>

                {/* Meta Information */}
                <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(item.pubDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{estimateReadTime(item.contentSnippet)}</span>
                    </div>
                  </div>
                </div>

                {/* Read More */}
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center gap-2 text-rose-500 hover:text-rose-600 font-medium text-sm transition-colors"
                >
                  Read Full Article
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </article>
          )
        })}
      </div>

      {filteredNews.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No articles found matching your criteria.</p>
          <button
            onClick={fetchNews}
            className="mt-4 px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            Refresh News
          </button>
        </div>
      )}

      {/* Newsletter Signup */}
      <div className="mt-16 bg-gradient-to-br from-rose-500 to-blue-600 rounded-lg p-8 text-white text-center">
        <TrendingUp className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">Stay Updated with Crypto News</h3>
        <p className="text-rose-100 mb-6 max-w-2xl mx-auto">
          Get the latest cryptocurrency news, market analysis, and trading insights delivered to your inbox.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button className="px-6 py-3 bg-white text-rose-500 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
            Subscribe
          </button>
        </div>
      </div>
    </div>
  )
}
