import { NextResponse } from "next/server"
import Parser from "rss-parser"

const parser = new Parser({
  customFields: {
    item: ["media:content", "media:thumbnail"],
  },
})

// Multiple crypto news RSS feeds
const RSS_FEEDS = [
  "https://cointelegraph.com/rss",
  "https://www.coindesk.com/arc/outboundfeeds/rss/",
  "https://cryptoslate.com/feed/",
  "https://decrypt.co/feed",
]

interface NewsItem {
  title: string
  link: string
  pubDate: string
  contentSnippet: string
  content?: string
  image?: string
  source: string
}

export async function GET() {
  try {
    const allNews: NewsItem[] = []

    // Fetch from all RSS feeds
    const feedPromises = RSS_FEEDS.map(async (feedUrl, index) => {
      try {
        const feed = await parser.parseURL(feedUrl)
        const sourceNames = ["CoinTelegraph", "CoinDesk", "CryptoSlate", "Decrypt"]
        
        return feed.items.slice(0, 10).map((item: any) => {
          // Extract image from content or media
          let image: string | undefined
          if (item["media:content"]) {
            image = item["media:content"]["$"]?.url || item["media:content"]?.url
          } else if (item["media:thumbnail"]) {
            image = item["media:thumbnail"]["$"]?.url || item["media:thumbnail"]?.url
          } else if (item.content) {
            // Try to extract image from HTML content
            const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/i)
            if (imgMatch) {
              image = imgMatch[1]
            }
          }

          return {
            title: item.title || "Untitled",
            link: item.link || "",
            pubDate: item.pubDate || new Date().toISOString(),
            contentSnippet: item.contentSnippet || item.content?.substring(0, 200) || "",
            content: item.content,
            image,
            source: sourceNames[index] || "Crypto News",
          }
        })
      } catch (error) {
        console.error(`Error fetching feed ${feedUrl}:`, error)
        return []
      }
    })

    const results = await Promise.all(feedPromises)
    
    // Flatten and combine all news items
    results.forEach((items) => {
      allNews.push(...items)
    })

    // Sort by date (newest first)
    allNews.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime()
      const dateB = new Date(b.pubDate).getTime()
      return dateB - dateA
    })

    // Return top 30 articles
    return NextResponse.json(allNews.slice(0, 30))
  } catch (error) {
    console.error("Error fetching news:", error)
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    )
  }
}

