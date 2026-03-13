import { Metadata } from "next"
import { CompoundingCalculator } from "@/components/CompoundingCalculator"
import { DarkWaveFooter } from "@/components/DarkWaveFooter"
import { Repeat, TrendingUp, Target, Shield, BarChart3, DollarSign, Percent, Clock } from "lucide-react"

export const metadata: Metadata = {
  title: "Compounding Calculator — Grow Your Trading Account | Coincess",
  description: "See how consistent trading compounds your account over months and years. Monte Carlo simulation with win rate, risk management, and interactive growth charts.",
  keywords: [
    "compounding calculator", "trading account growth", "compound interest crypto",
    "trading growth calculator", "risk management calculator", "monte carlo trading",
    "account growth simulator", "compound returns", "trading journal",
  ],
}

export default function CompoundingCalculatorPage() {
  return (
    <div className="min-h-screen bg-[#0b0e11]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-10 md:py-16">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand/10 rounded-full text-brand text-xs font-medium mb-5 tracking-wide uppercase">
              <Repeat className="h-3.5 w-3.5" />
              Account Growth Simulator
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight">
              Compounding Calculator
            </h1>
            <p className="text-base text-[#848e9c] max-w-xl mx-auto leading-relaxed">
              See how consistent trading with proper risk management can grow your account
              exponentially. <strong className="text-white font-medium">Small edges compound into huge results.</strong>
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {[
              { icon: TrendingUp, label: "Growth Chart" },
              { icon: BarChart3, label: "Monte Carlo" },
              { icon: Percent, label: "Win Rate" },
              { icon: Shield, label: "Risk Mgmt" },
              { icon: Target, label: "Milestones" },
              { icon: DollarSign, label: "Deposits" },
              { icon: Clock, label: "Time Horizon" },
              { icon: Repeat, label: "Compounding" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 bg-[#141620] rounded-full px-3 py-1.5">
                <Icon className="h-3.5 w-3.5 text-brand" />
                <span className="text-xs font-medium text-[#c8ccd4]">{label}</span>
              </div>
            ))}
          </div>

          {/* Calculator */}
          <div className="max-w-4xl mx-auto mb-16">
            <CompoundingCalculator />
          </div>

          {/* Why Compounding Matters */}
          <div className="grid lg:grid-cols-3 gap-4 mb-14">
            {[
              {
                icon: Repeat,
                title: "The Power of Compounding",
                desc: "A 1% daily gain doesn't sound like much. But compounded over a year, it turns $1,000 into $37,000. Small, consistent edges create exponential growth.",
                stat: "37x",
                statLabel: "1% daily for 1 year",
              },
              {
                icon: Shield,
                title: "Risk Management is Everything",
                desc: "Risking 1-2% per trade means you can survive 50 consecutive losses and still have capital. The math protects you when psychology fails.",
                stat: "2%",
                statLabel: "Max risk per trade",
              },
              {
                icon: Target,
                title: "Win Rate vs Risk:Reward",
                desc: "A 40% win rate is profitable if your average win is 2.5x your average loss. The calculator shows how these parameters interact.",
                stat: "40%",
                statLabel: "Can still be profitable",
              },
            ].map(({ icon: Icon, title, desc, stat, statLabel }) => (
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
                <div className="mt-3 pl-11 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-brand">{stat}</span>
                  <span className="text-[11px] text-[#555a66]">{statLabel}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Common Scenarios */}
          <div className="bg-[#141620] rounded-2xl p-6 md:p-8 mb-14">
            <h2 className="text-lg font-bold text-white mb-5 text-center">Common Scenarios</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  title: "Conservative Trader",
                  params: "55% WR \u00b7 1.5% win \u00b7 1% loss \u00b7 1% risk \u00b7 3 trades/week",
                  result: "$1,000 \u2192 ~$1,800 in 12 months",
                  style: "text-emerald-400",
                },
                {
                  title: "Balanced Trader",
                  params: "50% WR \u00b7 2% win \u00b7 1% loss \u00b7 2% risk \u00b7 5 trades/week",
                  result: "$1,000 \u2192 ~$3,500 in 12 months",
                  style: "text-brand",
                },
                {
                  title: "Aggressive Trader",
                  params: "45% WR \u00b7 3% win \u00b7 1.2% loss \u00b7 3% risk \u00b7 10 trades/week",
                  result: "$1,000 \u2192 ~$8,000 in 12 months",
                  style: "text-amber-400",
                },
              ].map(({ title, params, result, style }) => (
                <div key={title} className="bg-[#0b0e11] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
                  <p className="text-[11px] text-[#555a66] mb-2">{params}</p>
                  <p className={`text-sm font-bold ${style}`}>{result}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#555a66] text-center mt-4">
              Results are approximate and based on Monte Carlo simulation. Actual results vary per run.
            </p>
          </div>

          {/* Tips */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-5 text-center">Keys to Compounding Success</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                "Never risk more than 2% of your account on a single trade",
                "A 55% win rate with 2:1 reward-to-risk is a proven formula",
                "Add monthly deposits to accelerate growth even during drawdowns",
                "Track every trade in a journal to measure your actual win rate",
                "Reduce position size during losing streaks to protect your capital",
                "The first 10x is the hardest \u2014 the second 10x comes much faster",
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
