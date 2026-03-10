"use client"

import { useState } from "react"
import { Shield, Smartphone, Building2, Lock, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"

type SwapMethod = {
  id: string
  title: string
  subtitle: string
  icon: React.ReactNode
  privacyRating: 1 | 2 | 3 | 4 | 5
  easeRating: 1 | 2 | 3 | 4 | 5
  feeLevel: "Low" | "Medium" | "High"
  speed: string
  kyc: boolean
  description: string
  pros: string[]
  cons: string[]
  services: { name: string; url: string; description: string }[]
  steps: string[]
}

const swapMethods: SwapMethod[] = [
  {
    id: "aggregator",
    title: "Swap Aggregators",
    subtitle: "Best Overall Balance",
    icon: <Shield className="h-6 w-6" />,
    privacyRating: 4,
    easeRating: 5,
    feeLevel: "Medium",
    speed: "10-30 min",
    kyc: false,
    description: "Aggregators scan multiple swap services to find you the best exchange rate in real-time. They don't hold your funds—they simply connect you to the best offer.",
    pros: [
      "No account required",
      "Best rates automatically found",
      "No KYC for standard amounts",
      "Privacy ratings for each service"
    ],
    cons: [
      "Slightly higher fees than CEX",
      "Relies on third-party services"
    ],
    services: [
      { name: "Trocador", url: "https://trocador.app/?ref=2dzDcvfQJY", description: "Privacy-focused aggregator with detailed privacy ratings" },
      { name: "OrangeFren", url: "https://orangefren.com", description: "Clean interface, multiple exchange comparisons" },
      { name: "Exch", url: "https://exch.cx", description: "No-JavaScript option available" }
    ],
    steps: [
      "Get a Monero wallet (Cake Wallet mobile or Feather Wallet desktop)",
      "Copy your XMR receive address (starts with 4 or 8)",
      "Go to Trocador.app or OrangeFren.com",
      "Select your source crypto and Monero (XMR) as destination",
      "Enter the amount you want to swap",
      "Paste your Monero address in the payout field",
      "Choose an offer with the best rate or privacy rating",
      "Send your crypto to the provided deposit address",
      "Wait 10-30 minutes for Monero to arrive"
    ]
  },
  {
    id: "mobile",
    title: "Mobile Wallet Swaps",
    subtitle: "Easiest & Fastest",
    icon: <Smartphone className="h-6 w-6" />,
    privacyRating: 4,
    easeRating: 5,
    feeLevel: "Medium",
    speed: "10-20 min",
    kyc: false,
    description: "Mobile wallets with built-in exchange features let you swap directly within the app. Your keys, your coins—XMR goes straight into your wallet.",
    pros: [
      "Extremely simple to use",
      "You own your private keys",
      "No extra steps needed",
      "Available 24/7"
    ],
    cons: [
      "Slightly higher convenience fees",
      "Limited to supported pairs"
    ],
    services: [
      { name: "Cake Wallet", url: "https://cakewallet.com", description: "Open-source Monero wallet with built-in Trocador exchange" },
      { name: "Monerujo", url: "https://monerujo.io", description: "Android-only Monero wallet with SideShift integration" }
    ],
    steps: [
      "Download Cake Wallet from App Store or Play Store",
      "Create a new wallet and backup your seed phrase",
      "Tap the Exchange icon in the app",
      "Select your source crypto (BTC, LTC, USDT, etc.)",
      "Enter the amount to swap",
      "Review the rate and confirm",
      "Send crypto to the provided address or use built-in wallet",
      "XMR arrives directly in your wallet"
    ]
  },
  {
    id: "cex",
    title: "Centralized Exchanges",
    subtitle: "Lowest Fees",
    icon: <Building2 className="h-6 w-6" />,
    privacyRating: 1,
    easeRating: 4,
    feeLevel: "Low",
    speed: "Instant",
    kyc: true,
    description: "Traditional exchanges offer the lowest trading fees but require full identity verification. Your transactions are linked to your real identity.",
    pros: [
      "Lowest fees (0.1% - 0.3%)",
      "High liquidity",
      "Instant trades",
      "Fiat on/off ramps"
    ],
    cons: [
      "Full KYC required",
      "XMR support shrinking",
      "Privacy compromised",
      "Withdrawal restrictions possible"
    ],
    services: [
      { name: "Kraken", url: "https://kraken.com", description: "Reputable exchange, XMR available in limited regions (not EU, some US states restricted)" },
      { name: "KuCoin", url: "https://kucoin.com", description: "Available in more regions but verify your location" }
    ],
    steps: [
      "Create an account on the exchange",
      "Complete full identity verification (KYC)",
      "Deposit crypto or fiat",
      "Navigate to XMR trading pair",
      "Place your buy order",
      "Withdraw XMR to your personal wallet immediately"
    ]
  },
  {
    id: "atomic",
    title: "Atomic Swaps",
    subtitle: "Maximum Privacy",
    icon: <Lock className="h-6 w-6" />,
    privacyRating: 5,
    easeRating: 2,
    feeLevel: "Low",
    speed: "30-60 min",
    kyc: false,
    description: "Trustless peer-to-peer swaps with no middleman. Just code executing on both blockchains. The gold standard for privacy but requires technical knowledge.",
    pros: [
      "No trusted third party",
      "Maximum privacy",
      "Uncensorable",
      "No KYC ever"
    ],
    cons: [
      "More technically complex",
      "Lower liquidity",
      "Slower transactions",
      "Tools still maturing"
    ],
    services: [
      { name: "BasicSwapDEX", url: "https://basicswapdex.com", description: "Decentralized exchange for XMR/BTC peer-to-peer swaps" },
      { name: "Bisq", url: "https://bisq.network", description: "Original P2P DEX, desktop app over Tor" },
      { name: "Haveno", url: "https://haveno.exchange", description: "Monero-focused DEX (Bisq fork)" }
    ],
    steps: [
      "Download and install the DEX software",
      "Let it sync with the network (can take time)",
      "Create or fund your trading wallet",
      "Browse available offers or create your own",
      "Select an offer and initiate the swap",
      "Follow the atomic swap protocol",
      "Funds are trustlessly exchanged when complete"
    ]
  }
]

function PrivacyStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <div
          key={star}
          className={`h-2 w-2 rounded-full ${
            star <= rating ? "bg-[#FF455B]" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  )
}

function MethodCard({ method, isExpanded, onToggle }: { method: SwapMethod; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-[#FF455B]/30 transition-all">
      {/* Card Header */}
      <button
        onClick={onToggle}
        className="w-full p-6 text-left flex items-start gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="p-3 rounded-xl bg-[#FF455B]/10 text-[#FF455B]">
          {method.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{method.title}</h3>
            {method.kyc && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">KYC</span>
            )}
            {!method.kyc && (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">No KYC</span>
            )}
          </div>
          <p className="text-sm text-[#FF455B] font-medium mb-3">{method.subtitle}</p>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Privacy:</span>
              <PrivacyStars rating={method.privacyRating} />
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">{method.speed}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">{method.feeLevel} fees</span>
            </div>
          </div>
        </div>
        <div className="text-gray-400">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          <p className="text-gray-600 mb-6">{method.description}</p>

          {/* Pros and Cons */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">Pros</h4>
              <ul className="space-y-1.5">
                {method.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">Cons</h4>
              <ul className="space-y-1.5">
                {method.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Services */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Recommended Services</h4>
            <div className="grid gap-2">
              {method.services.map((service) => (
                <a
                  key={service.name}
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-[#FF455B]/50 hover:bg-[#FF455B]/5 transition-colors group"
                >
                  <div>
                    <span className="font-medium text-gray-900 group-hover:text-[#FF455B]">{service.name}</span>
                    <p className="text-sm text-gray-500">{service.description}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-[#FF455B]" />
                </a>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">How to Use</h4>
            <ol className="space-y-2">
              {method.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF455B]/10 text-[#FF455B] flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-gray-600 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

export function SwapGuide() {
  const [expandedMethod, setExpandedMethod] = useState<string | null>("aggregator")

  return (
    <div className="py-12 md:py-20">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF455B]/10 rounded-full text-[#FF455B] text-sm font-medium mb-6">
          <Shield className="h-4 w-4" />
          Privacy Guide
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Swap Crypto for Monero
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Compare the best methods to exchange your crypto for XMR. Find the right balance between convenience, fees, and privacy.
        </p>
      </div>

      {/* Quick Comparison */}
      <div className="bg-gray-50 rounded-2xl p-6 mb-10 overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Comparison</h2>
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="pb-3 font-medium">Method</th>
              <th className="pb-3 font-medium">Privacy</th>
              <th className="pb-3 font-medium">Ease</th>
              <th className="pb-3 font-medium">Fees</th>
              <th className="pb-3 font-medium">Speed</th>
              <th className="pb-3 font-medium">KYC</th>
            </tr>
          </thead>
          <tbody>
            {swapMethods.map((method) => (
              <tr key={method.id} className="border-b border-gray-100 last:border-0">
                <td className="py-3 font-medium text-gray-900">{method.title}</td>
                <td className="py-3"><PrivacyStars rating={method.privacyRating} /></td>
                <td className="py-3"><PrivacyStars rating={method.easeRating} /></td>
                <td className="py-3 text-gray-600">{method.feeLevel}</td>
                <td className="py-3 text-gray-600">{method.speed}</td>
                <td className="py-3">
                  {method.kyc ? (
                    <span className="text-amber-600">Required</span>
                  ) : (
                    <span className="text-green-600">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Method Cards */}
      <div className="space-y-4 mb-12">
        {swapMethods.map((method) => (
          <MethodCard
            key={method.id}
            method={method}
            isExpanded={expandedMethod === method.id}
            onToggle={() => setExpandedMethod(expandedMethod === method.id ? null : method.id)}
          />
        ))}
      </div>

      {/* Warning Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-2">Important Security Notice</h3>
            <ul className="space-y-2 text-sm text-amber-800">
              <li>• <strong>Never leave Monero on exchanges.</strong> Regulatory pressure is high, and withdrawals can be frozen.</li>
              <li>• <strong>Always use your own wallet.</strong> Download Cake Wallet (mobile) or Feather Wallet (desktop).</li>
              <li>• <strong>Backup your seed phrase</strong> and store it securely offline.</li>
              <li>• <strong>Verify addresses carefully</strong> before sending any funds.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-12">
        <p className="text-gray-600 mb-4">Ready to start your journey into private cryptocurrency?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="bg-[#FF455B] hover:bg-[#E63B50] text-white"
          >
            <a href="https://cakewallet.com" target="_blank" rel="noopener noreferrer">
              Get Cake Wallet
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-gray-300"
          >
            <a href="https://trocador.app/?ref=2dzDcvfQJY" target="_blank" rel="noopener noreferrer">
              Try Trocador
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
