import { Metadata } from "next"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { CoinsTable } from "@/components/CoinsTable"
import { Coins, ShoppingCart } from "lucide-react"

export const metadata: Metadata = {
  title: "Cryptocurrency Prices - Buy Any Coin Instantly | Coincess",
  description: "Real-time cryptocurrency prices, market cap, and volume data. Buy any coin instantly with one click—no account needed, best rates guaranteed.",
  keywords: ["crypto prices", "cryptocurrency market", "bitcoin price", "buy crypto", "live crypto prices", "no kyc crypto"],
}

export default function CoinsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 md:py-16">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7C3AED]/10 rounded-full text-[#7C3AED] text-sm font-medium mb-6">
              <Coins className="h-4 w-4" />
              Live Prices
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Cryptocurrency Prices
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Real-time prices, market cap, and volume data. Click <span className="inline-flex items-center gap-1 text-[#7C3AED] font-medium"><ShoppingCart className="h-4 w-4" />Buy</span> to instantly purchase any coin—no account needed.
            </p>
          </div>

          {/* Coins Table */}
          <CoinsTable />

          {/* Info Box */}
          <div className="mt-10 bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-gray-600 text-sm">
              Prices update every 30 seconds. Data provided by CoinGecko. 
              Buy buttons link to <a href="https://trocador.app/?ref=2dzDcvfQJY" target="_blank" rel="noopener noreferrer" className="text-[#7C3AED] hover:underline">Trocador</a>—a no-KYC exchange aggregator that finds you the best rates.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
