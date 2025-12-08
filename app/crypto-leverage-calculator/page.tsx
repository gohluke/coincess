import { Metadata } from "next"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { LeverageCalculator } from "@/components/LeverageCalculator"
import { Calculator, TrendingUp, Shield, Target, AlertTriangle, CheckCircle2, Zap, BarChart3 } from "lucide-react"

export const metadata: Metadata = {
  title: "Crypto Leverage Calculator - Perpetual Futures | Coincess",
  description: "Calculate potential profits and losses for leveraged cryptocurrency trades. Our professional perpetual futures calculator helps you manage risk and plan trades effectively.",
  keywords: ["crypto leverage calculator", "perpetual futures", "trading calculator", "PNL calculator", "liquidation price", "ROE calculator"],
}

export default function CryptoLeverageCalculatorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 md:py-20">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7C3AED]/10 rounded-full text-[#7C3AED] text-sm font-medium mb-6">
              <Calculator className="h-4 w-4" />
              Trading Tools
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Crypto Leverage Calculator
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Strategically gauge the leverage potential of your position. Calculate profits, losses, and liquidation prices before you trade.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <Zap className="h-6 w-6 text-[#7C3AED] mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Real-Time</p>
              <p className="text-xs text-gray-500">Instant calculations</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <TrendingUp className="h-6 w-6 text-[#7C3AED] mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Long & Short</p>
              <p className="text-xs text-gray-500">Both directions</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <Shield className="h-6 w-6 text-[#7C3AED] mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Risk Analysis</p>
              <p className="text-xs text-gray-500">Liquidation prices</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <BarChart3 className="h-6 w-6 text-[#7C3AED] mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">ROE Tracking</p>
              <p className="text-xs text-gray-500">Return on equity</p>
            </div>
          </div>

          {/* Calculator */}
          <div className="max-w-3xl mx-auto mb-16">
            <LeverageCalculator />
          </div>

          {/* Understanding Leverage Section */}
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Understanding Leverage</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Leverage in cryptocurrency trading allows you to control larger positions with less capital. 
                    A 10x leverage means $100 controls a $1,000 position. While this amplifies potential profits, 
                    it equally magnifies losses.
                  </p>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Multiply your buying power</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Trade both directions (long/short)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Capital efficient trading</span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Calculator Features</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Our calculator helps you plan trades before execution. Input your parameters to see 
                    potential outcomes, identify liquidation prices, and make data-driven decisions.
                  </p>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Calculate PNL for any exit price</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Find liquidation price instantly</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Reverse calculate from ROE targets</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-12">
            <div className="flex gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-2">Important Risk Warning</h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li>• <strong>Leverage amplifies both gains AND losses.</strong> You can lose more than your initial investment.</li>
                  <li>• <strong>Liquidation risk is real.</strong> If the price moves against you beyond your margin, your position is automatically closed.</li>
                  <li>• <strong>Start with low leverage</strong> (2-5x) until you understand market dynamics.</li>
                  <li>• <strong>Always set stop-losses</strong> to limit potential downside.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-6 text-center">Trading Best Practices</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white/10 rounded-xl p-4">
                <span className="text-2xl font-bold text-white/60">01</span>
                <p className="mt-2 text-white/90">Start with lower leverage (2-5x) to understand market dynamics before scaling up</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <span className="text-2xl font-bold text-white/60">02</span>
                <p className="mt-2 text-white/90">Always set stop-loss orders to limit potential losses on every position</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <span className="text-2xl font-bold text-white/60">03</span>
                <p className="mt-2 text-white/90">Never invest more than you can afford to lose—crypto is highly volatile</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <span className="text-2xl font-bold text-white/60">04</span>
                <p className="mt-2 text-white/90">Use this calculator to plan every trade before execution</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <span className="text-2xl font-bold text-white/60">05</span>
                <p className="mt-2 text-white/90">Monitor positions regularly and be ready to adjust or exit</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <span className="text-2xl font-bold text-white/60">06</span>
                <p className="mt-2 text-white/90">Keep learning—follow market news and continuously improve your strategy</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
