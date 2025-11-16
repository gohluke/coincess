import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { BlogPosts } from "@/components/BlogPosts"
import { Newspaper } from "lucide-react"

export const metadata = {
  title: "Crypto News & Blog - coincess",
  description: "Stay updated with the latest cryptocurrency news, market analysis, and trading insights",
}

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-purple-50 to-blue-50 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-6">
                <Newspaper className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Crypto News & Insights
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Stay informed with the latest cryptocurrency news, market trends, and expert analysis to make smarter trading decisions.
              </p>
            </div>
          </div>
        </section>

        {/* Blog Posts */}
        <section className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
            <BlogPosts />
          </div>
        </section>
      </main>
      <div className="flex-1"></div>
      <Footer />
    </div>
  )
}

