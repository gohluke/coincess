import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { CoinsTable } from "@/components/CoinsTable"

export const metadata = {
  title: "Coins - coincess",
  description: "Real-time cryptocurrency prices and market data",
}

export default function CoinsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cryptocurrency Prices</h1>
          <p className="text-gray-600">Real-time prices, market cap, and volume data</p>
        </div>
        <CoinsTable />
      </main>
      <div className="flex-1"></div>
      <Footer />
    </div>
  )
}

