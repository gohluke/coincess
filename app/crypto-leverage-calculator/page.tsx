import { Metadata } from "next"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { LeverageCalculator } from "@/components/LeverageCalculator"
import { Calculator, TrendingUp, Shield, Target, AlertTriangle, CheckCircle2, Zap, BarChart3, DollarSign, Clock } from "lucide-react"

export const metadata: Metadata = {
  title: "Crypto Leverage Calculator — Fees, Funding & Break-Even | Coincess",
  description: "Industry-grade perpetual futures calculator with maker/taker fees, hourly funding rates, break-even price, liquidation risk, and interactive PNL/ROE solving. Plan every trade before you execute.",
  keywords: [
    "crypto leverage calculator", "perpetual futures calculator", "PNL calculator",
    "liquidation price calculator", "funding rate calculator", "break-even price",
    "trading fees calculator", "ROE calculator", "margin calculator",
    "hyperliquid calculator", "dydx calculator", "bybit calculator",
  ],
}

export default function CryptoLeverageCalculatorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 md:py-20">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/10 rounded-full text-brand text-sm font-medium mb-6">
              <Calculator className="h-4 w-4" />
              Professional Trading Tools
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Crypto Leverage Calculator
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              The only calculator that factors in trading fees, hourly funding rates, and trade duration —
              so you see your <strong>real</strong> profit, not just the headline number.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-12">
            {[
              { icon: Zap, label: "Real-Time" },
              { icon: TrendingUp, label: "Long & Short" },
              { icon: DollarSign, label: "Maker/Taker Fees" },
              { icon: Clock, label: "Funding Rates" },
              { icon: Target, label: "Break-Even Price" },
              { icon: Shield, label: "Liquidation Risk" },
              { icon: BarChart3, label: "Net ROE" },
              { icon: Calculator, label: "Interactive Solver" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <Icon className="h-5 w-5 text-brand mx-auto mb-1.5" />
                <p className="text-xs font-medium text-gray-900">{label}</p>
              </div>
            ))}
          </div>

          {/* Calculator */}
          <div className="max-w-4xl mx-auto mb-16">
            <LeverageCalculator />
          </div>

          {/* What Makes This Different */}
          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-brand/10 text-brand">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Real Fee Accounting</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Most calculators ignore fees. We include maker/taker rates on both entry and exit,
                    so a &ldquo;profitable&rdquo; trade that loses money to fees is flagged before you execute.
                  </p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Hyperliquid default: 0.01% maker / 0.035% taker</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Separate entry & exit fee rates</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">One-click maker/taker toggle</span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-brand/10 text-brand">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Funding Rate Impact</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Perpetual futures charge funding every hour (Hyperliquid) or 8 hours (Binance/Bybit).
                    Over days or weeks, funding can exceed your gross profit.
                  </p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Hourly funding rate input</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Adjustable trade duration (hours)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Negative rates = shorts pay, longs earn</span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-6 bg-white">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-brand/10 text-brand">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Interactive Solver</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Click any result field to reverse-solve. Type a target PNL to find the exit price.
                    Set a budget (margin) to calculate your max position size. All updates live.
                  </p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Type margin → auto-sizes position</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Type PNL → solves required exit price</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">Type ROE → solves required exit price</span>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-gray-50 rounded-2xl p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How the Math Works</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Position & Margin</h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Notional = Quantity x Entry Price</code></p>
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Margin = Notional / Leverage</code></p>
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Liq. Price = Entry +/- Entry / Leverage</code></p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Costs</h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Entry Fee = Notional x Fee Rate</code></p>
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Exit Fee = Exit Notional x Fee Rate</code></p>
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Funding = Notional x Rate x Hours</code></p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Profit & Loss</h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Gross PNL = (Exit - Entry) x Qty</code></p>
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Net PNL = Gross - Fees - Funding</code></p>
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">ROE = Net PNL / Margin x 100</code></p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Break-Even</h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Total Costs = Fees + Funding</code></p>
                  <p><code className="bg-white px-1.5 py-0.5 rounded text-xs">Break-Even = Entry + Costs / Qty</code></p>
                  <p className="text-xs text-gray-400">For shorts: Entry - Costs / Qty</p>
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-12">
            <div className="flex gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-2">Important Risk Warning</h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li>&bull; <strong>Leverage amplifies both gains AND losses.</strong> You can lose more than your initial margin.</li>
                  <li>&bull; <strong>Funding rates fluctuate.</strong> A position profitable today may bleed via funding tomorrow.</li>
                  <li>&bull; <strong>Liquidation risk is real.</strong> Cross-margin and maintenance margin rules affect your actual liquidation price.</li>
                  <li>&bull; <strong>Start with low leverage</strong> (2–5x) and always set stop-losses.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-gradient-to-br from-brand to-brand-hover rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-6 text-center">Trading Best Practices</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                "Start with 2–5x leverage to understand market dynamics before scaling up",
                "Always set stop-loss orders — use the calculator to find your max acceptable loss",
                "Factor in funding rates for any trade you plan to hold longer than a few hours",
                "Check the break-even price to know the minimum move needed to cover costs",
                "Use maker orders (limit) instead of taker (market) to reduce fees by 3.5x",
                "Monitor your margin ratio — exit before it approaches the danger zone",
              ].map((tip, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-4">
                  <span className="text-2xl font-bold text-white/60">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-2 text-white/90 text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
