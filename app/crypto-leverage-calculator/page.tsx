import { Metadata } from "next"
import { LeverageCalculator } from "@/components/LeverageCalculator"
import { DarkWaveFooter } from "@/components/DarkWaveFooter"
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
    <div className="min-h-screen bg-[#0b0e11]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-10 md:py-16">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand/10 rounded-full text-brand text-xs font-medium mb-5 tracking-wide uppercase">
              <Calculator className="h-3.5 w-3.5" />
              Professional Trading Tools
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight">
              Crypto Leverage Calculator
            </h1>
            <p className="text-base text-[#848e9c] max-w-xl mx-auto leading-relaxed">
              The only calculator that factors in trading fees, hourly funding rates, and trade duration —
              so you see your <strong className="text-white font-medium">real</strong> profit.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {[
              { icon: Zap, label: "Real-Time" },
              { icon: TrendingUp, label: "Long & Short" },
              { icon: DollarSign, label: "Maker / Taker" },
              { icon: Clock, label: "Funding Rates" },
              { icon: Target, label: "Break-Even" },
              { icon: Shield, label: "Liquidation" },
              { icon: BarChart3, label: "Net ROE" },
              { icon: Calculator, label: "Solver" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 bg-[#141620] rounded-full px-3 py-1.5">
                <Icon className="h-3.5 w-3.5 text-brand" />
                <span className="text-xs font-medium text-[#c8ccd4]">{label}</span>
              </div>
            ))}
          </div>

          {/* Calculator */}
          <div className="max-w-4xl mx-auto mb-16">
            <LeverageCalculator />
          </div>

          {/* What Makes This Different */}
          <div className="grid lg:grid-cols-3 gap-4 mb-14">
            {[
              {
                icon: DollarSign,
                title: "Real Fee Accounting",
                desc: "Most calculators ignore fees. We include maker/taker rates on both entry and exit, so a \"profitable\" trade that loses money to fees is flagged before you execute.",
                bullets: ["Hyperliquid default: 0.010% maker / 0.035% taker", "Separate entry & exit fee rates", "One-click maker/taker toggle"],
              },
              {
                icon: Clock,
                title: "Funding Rate Impact",
                desc: "Perpetual futures charge funding every hour (Hyperliquid) or 8 hours (Binance/Bybit). Over days or weeks, funding can exceed your gross profit.",
                bullets: ["Hourly funding rate input", "Adjustable trade duration (hours)", "Negative rates = shorts pay, longs earn"],
              },
              {
                icon: Target,
                title: "Interactive Solver",
                desc: "Click any result field to reverse-solve. Type a target PNL to find the exit price. Set a budget (margin) to calculate your max position size.",
                bullets: ["Type margin \u2192 auto-sizes position", "Type PNL \u2192 solves required exit price", "Type ROE \u2192 solves required exit price"],
              },
            ].map(({ icon: Icon, title, desc, bullets }) => (
              <div key={title} className="rounded-2xl p-5 bg-[#141620]">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-brand/10 text-brand shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white mb-1">{title}</h2>
                    <p className="text-[#848e9c] text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
                <div className="space-y-1.5 mt-3 pl-11">
                  {bullets.map((t) => (
                    <div key={t} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand flex-shrink-0 mt-0.5" />
                      <span className="text-[11px] text-[#848e9c]">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="bg-[#141620] rounded-2xl p-6 md:p-8 mb-14">
            <h2 className="text-lg font-bold text-white mb-5 text-center">How the Math Works</h2>
            <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
              {[
                { title: "Position & Margin", formulas: ["Notional = Quantity \u00d7 Entry Price", "Margin = Notional / Leverage", "Liq. Price = Entry \u00b1 Entry / Leverage"] },
                { title: "Costs", formulas: ["Entry Fee = Notional \u00d7 Fee Rate", "Exit Fee = Exit Notional \u00d7 Fee Rate", "Funding = Notional \u00d7 Rate \u00d7 Hours"] },
                { title: "Profit & Loss", formulas: ["Gross PNL = (Exit \u2212 Entry) \u00d7 Qty", "Net PNL = Gross \u2212 Fees \u2212 Funding", "ROE = Net PNL / Margin \u00d7 100"] },
                { title: "Break-Even", formulas: ["Total Costs = Fees + Funding", "Break-Even = Entry + Costs / Qty", "For shorts: Entry \u2212 Costs / Qty"] },
              ].map(({ title, formulas }) => (
                <div key={title}>
                  <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                  <div className="space-y-1">
                    {formulas.map((f, i) => (
                      <p key={i} className="text-xs text-[#848e9c]">
                        <code className="bg-[#0b0e11] px-2 py-0.5 rounded text-[11px] text-[#c8ccd4] font-mono">{f}</code>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/5 rounded-2xl p-5 mb-14">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-400 text-sm mb-2">Risk Warning</h3>
                <ul className="space-y-1.5 text-xs text-[#848e9c]">
                  <li>&bull; <strong className="text-white">Leverage amplifies both gains AND losses.</strong> You can lose more than your initial margin.</li>
                  <li>&bull; <strong className="text-white">Funding rates fluctuate.</strong> A position profitable today may bleed via funding tomorrow.</li>
                  <li>&bull; <strong className="text-white">Liquidation risk is real.</strong> Cross-margin and maintenance margin rules affect your actual liquidation price.</li>
                  <li>&bull; <strong className="text-white">Start with low leverage</strong> (2\u20135x) and always set stop-losses.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-5 text-center">Trading Best Practices</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                "Start with 2\u20135x leverage to understand market dynamics before scaling up",
                "Always set stop-loss orders \u2014 use the calculator to find your max acceptable loss",
                "Factor in funding rates for any trade you plan to hold longer than a few hours",
                "Check the break-even price to know the minimum move needed to cover costs",
                "Use maker orders (limit) instead of taker (market) to reduce fees by 3.5x",
                "Monitor your margin ratio \u2014 exit before it approaches the danger zone",
              ].map((tip, i) => (
                <div key={i} className="bg-[#141620] rounded-xl p-4 flex gap-3">
                  <span className="text-xl font-bold text-[#2a2e3e] leading-none shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-[#848e9c] text-xs leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <DarkWaveFooter />
    </div>
  )
}
