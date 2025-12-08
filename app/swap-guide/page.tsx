import { Metadata } from "next"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { SwapGuide } from "@/components/SwapGuide"

export const metadata: Metadata = {
  title: "Swap Crypto for Monero (XMR) - Privacy Guide | Coincess",
  description: "Learn the best ways to swap your cryptocurrency for Monero. Compare aggregators, mobile wallets, exchanges, and atomic swaps with privacy ratings and step-by-step guides.",
  keywords: ["crypto swap", "Monero", "XMR", "privacy", "no KYC", "atomic swap", "Trocador", "Cake Wallet"],
}

export default function SwapGuidePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        <SwapGuide />
      </main>
      <Footer />
    </div>
  )
}
