import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { LiveTicker } from "@/components/blog/LiveTicker"
import { getBlogPost } from "@/lib/blog-posts"
import {
  Calculator,
  Zap,
  Shield,
  Target,
  AlertTriangle,
  ArrowRight,
  BarChart3,
} from "lucide-react"

const post = getBlogPost("crypto-funding-rates-explained-earn-passive-income")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess Intelligence`,
  description: post.description,
  keywords: post.keywords.join(", "),
  openGraph: {
    title: post.title,
    description: post.description,
    type: "article",
    publishedTime: post.publishedAt,
    authors: ["Coincess Intelligence"],
    tags: post.keywords,
  },
}

export default function CryptoFundingRatesExplainedPage() {
  return (
    <BlogPostLayout post={post}>
      <div className="not-prose mb-8">
        <LiveTicker coins={["BTC", "ETH", "SOL", "HYPE"]} />
      </div>

      {/* Lead */}
      <p className="text-xl leading-relaxed">
        What if you could earn money every hour just by holding a position?
        Funding rates are one of crypto&apos;s best-kept income strategies—and
        most traders don&apos;t even know they exist.
      </p>

      <h2>What Are Funding Rates?</h2>

      <p>
        In plain English: <strong>funding rates</strong> are periodic payments
        between long and short traders. They exist to keep the perpetual futures
        price aligned with the spot price. When the perp trades above spot,
        longs pay shorts. When it trades below, shorts pay longs.
      </p>

      <p>
        On <strong>Hyperliquid</strong>—the L1 that powers Coincess—funding is
        paid every <strong>1 hour</strong>. That means you can earn (or pay)
        funding up to 24 times per day. For traders on the right side of the
        rate, this adds up fast.
      </p>

      <h2>How Funding Rates Work</h2>

      <p>
        The direction of the payment depends on the sign of the funding rate:
      </p>

      <ul>
        <li>
          <strong>When funding rate is positive</strong>: Longs pay shorts. The
          market is bullish; perp trades above spot. Shorts collect income.
        </li>
        <li>
          <strong>When funding rate is negative</strong>: Shorts pay longs. The
          market is bearish; perp trades below spot. Longs collect income.
        </li>
      </ul>

      <div className="not-prose my-8 bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-400" />
          Funding Rate Calculation Example
        </h4>
        <div className="space-y-3 text-sm">
          <p className="text-gray-200">
            Rate: <span className="text-emerald-400 font-mono">+0.01%</span> per
            hour | Position: <span className="text-amber-400">$10,000</span>{" "}
            notional
          </p>
          <p className="text-gray-200">
            Payment per hour = $10,000 × 0.0001 ={" "}
            <span className="text-emerald-400 font-bold">$1/hour</span>
          </p>
          <p className="text-gray-200">
            Per day = $1 × 24 ={" "}
            <span className="text-emerald-400 font-bold">$24/day</span>
          </p>
          <p className="text-gray-200">
            Per month = $24 × 30 ={" "}
            <span className="text-emerald-400 font-bold">$720/month</span>
          </p>
          <p className="text-amber-400 text-xs mt-2">
            That&apos;s 8.64% APR on a $10K position—from funding alone. At
            higher rates during crises, yields can exceed 50%+ APR.
          </p>
        </div>
      </div>

      <h2>Why Funding Rates Spike During Crises</h2>

      <p>
        During the Iran-Oil crisis of March 2026, oil funding rates on
        Hyperliquid exceeded <strong>0.1% per hour</strong>—that&apos;s{" "}
        <strong>2.4% per day</strong>. Why? Extreme demand for longs (everyone
        wanted to bet oil would rise) pushed the perp price far above spot.
        Shorts were paid handsomely to balance the market.
      </p>

      <p>
        The same dynamic plays out in crypto: when BTC or ETH is in a strong
        uptrend, funding often turns highly positive. Longs pay shorts every
        hour. Conversely, during capitulation, funding can go deeply negative—and
        longs collect from shorts.
      </p>

      <p>
        Right now, oil (CL) and Brent (BRENTOIL) on Coincess often show
        elevated funding during supply shocks. It&apos;s one of the highest-yield
        funding markets when geopolitics heat up.
      </p>

      <h2>Funding Rate Strategies</h2>

      <div className="not-prose my-8 space-y-4">
        <div className="bg-emerald-950/50 rounded-xl p-6 ">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-white">
              Cash &amp; Carry Arbitrage
            </h3>
            <span className="text-xs font-medium px-2 py-0.5 bg-emerald-200 text-emerald-400 rounded-full">
              Conservative
            </span>
          </div>
          <p className="text-sm text-gray-200 mb-2">
            Long spot + Short perp = collect funding. You&apos;re hedged on
            price direction; your profit comes from the funding payments.{" "}
            <strong>Risk-free if executed properly</strong>—though execution and
            basis risk exist.
          </p>
          <p className="text-xs text-gray-500">
            Best when: Funding is strongly positive and you can hold both legs.
          </p>
        </div>

        <div className="bg-amber-950/50 rounded-xl p-6 ">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-bold text-white">
              Funding Rate Harvesting
            </h3>
            <span className="text-xs font-medium px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded-full">
              Moderate
            </span>
          </div>
          <p className="text-sm text-gray-200 mb-2">
            Go short when funding is extremely positive. Collect payments every
            hour. You accept some directional risk—if price rips up, you lose on
            the position—but the funding income can offset or exceed it.
          </p>
          <p className="text-xs text-gray-500">
            Best when: Funding &gt; 0.05%/hour and you have a view or stop-loss.
          </p>
        </div>

        <div className="bg-blue-950/50 rounded-xl p-6 ">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-bold text-white">Rate Hunting</h3>
            <span className="text-xs font-medium px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full">
              Active
            </span>
          </div>
          <p className="text-sm text-gray-200 mb-2">
            Monitor multiple markets. Enter positions in markets with the
            highest funding rates. Exit when rates normalize. Requires active
            management and capital allocation across BTC, ETH, SOL, oil, and
            others.
          </p>
          <p className="text-xs text-gray-500">
            Best when: You can track funding across many assets and rebalance
            quickly.
          </p>
        </div>
      </div>

      <h2>Funding Rate Harvesting on Coincess</h2>

      <p>
        Coincess offers an automated <strong>Funding Rate Harvester</strong> bot
        on the <Link href="/automate" className="text-brand font-semibold hover:underline">/automate</Link> page. It automates the funding harvesting
        strategy: when funding is extremely positive, it goes short and collects
        payments. When rates normalize, it can reduce or close the position.
      </p>

      <p>
        No need to watch charts 24/7. Connect your wallet, configure the bot,
        and let it run. It&apos;s one of the most popular strategies among
        Coincess users—especially during volatile periods like the oil crisis.
      </p>

      <p>
        <Link href="/automate" className="text-brand font-semibold hover:underline">
          Try the Funding Rate Harvester on Coincess →
        </Link>{" "}
        |{" "}
        <Link href="/trade/CL" className="text-brand font-semibold hover:underline">
          Trade Oil (CL) →
        </Link>
      </p>

      <h2>Where to Find the Best Funding Rates</h2>

      <p>
        Funding rates vary by market and time. Here are typical ranges for
        popular markets on Coincess (built on Hyperliquid):
      </p>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm rounded-xl overflow-hidden ">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="text-left p-3 font-semibold text-white border-b">
                Market
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Symbol
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Typical Funding Range
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#2a2e39] bg-brand/5">
              <td className="p-3 font-semibold text-white">Bitcoin</td>
              <td className="p-3 font-mono">BTC</td>
              <td className="p-3">-0.01% to +0.03%/hr</td>
              <td className="p-3 text-gray-300">Spikes in bull runs</td>
            </tr>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium">Ethereum</td>
              <td className="p-3 font-mono">ETH</td>
              <td className="p-3">-0.01% to +0.02%/hr</td>
              <td className="p-3 text-gray-300">Tracks BTC</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-[#1a1d26]">
              <td className="p-3 font-medium">Solana</td>
              <td className="p-3 font-mono">SOL</td>
              <td className="p-3">-0.02% to +0.05%/hr</td>
              <td className="p-3 text-gray-300">More volatile</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-amber-950/50/50">
              <td className="p-3 font-medium">Crude Oil (WTI)</td>
              <td className="p-3 font-mono">CL</td>
              <td className="p-3">0.01% to 0.15%+/hr</td>
              <td className="p-3 text-amber-400">
                Spikes during supply crises
              </td>
            </tr>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium">Brent Crude Oil</td>
              <td className="p-3 font-mono">BRENTOIL</td>
              <td className="p-3">0.01% to 0.12%+/hr</td>
              <td className="p-3 text-gray-300">Similar to CL</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-[#141620]/50">
              <td className="p-3 font-medium">Hyperliquid</td>
              <td className="p-3 font-mono">HYPE</td>
              <td className="p-3">-0.02% to +0.04%/hr</td>
              <td className="p-3 text-gray-300">Native token</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Risks of Funding Rate Trading</h2>

      <div className="not-prose my-8 space-y-4">
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">Rate can flip</h4>
            <p className="text-sm text-red-400">
              Funding can reverse. You might start earning, then suddenly pay. If
              you&apos;re short and price rips, you lose on both the move and
              potentially the new funding direction.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-amber-950/50">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-amber-400">Liquidation risk</h4>
            <p className="text-sm text-amber-400">
              With leverage, a sharp move against your position can trigger
              liquidation. Funding income won&apos;t save you if you get
              liquidated. Use conservative leverage when harvesting funding.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-amber-950/50">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-amber-400">Basis risk (cash &amp; carry)</h4>
            <p className="text-sm text-amber-400">
              Spot and perp can diverge. If the basis moves against you, your
              &quot;hedged&quot; position can lose money. Execution timing and
              slippage matter.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-[#1a1d26] border border-slate-200">
          <BarChart3 className="h-6 w-6 text-slate-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-slate-900">Opportunity cost</h4>
            <p className="text-sm text-slate-700">
              Capital tied up in funding strategies could be deployed elsewhere.
              Compare yields to other opportunities (staking, lending, etc.).
            </p>
          </div>
        </div>
      </div>

      <h2>Risk Disclosure</h2>

      <div className="not-prose my-8 bg-amber-950/50 border-2 border-amber-300 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-400 mb-2">
              Risk Disclosure
            </h4>
            <p className="text-amber-400 text-sm">
              Trading perpetual futures and harvesting funding rates involves
              significant risk. Leverage amplifies both gains and losses—you can
              lose your entire margin or more. Funding rates can flip without
              notice. Past performance does not guarantee future results. Never
              trade with money you cannot afford to lose. This article is for
              educational purposes only and does not constitute financial,
              investment, or trading advice. Do your own research and consider
              consulting a professional before trading.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose mt-12">
        <div className="bg-gradient-to-r from-brand to-brand-hover rounded-2xl p-8 text-white text-center ">
          <h3 className="text-2xl font-bold mb-3">
            Start Harvesting Funding on Coincess
          </h3>
          <p className="text-white/90 mb-6 max-w-lg mx-auto">
            Trade oil, BTC, ETH, and more with up to 50x leverage. Try the
            Funding Rate Harvester bot or go manual—no KYC, 24/7.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trade/CL"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#141620] text-brand font-semibold rounded-lg hover:bg-[#1a1d26] transition-colors"
            >
              Trade Oil (CL)
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/automate"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#141620]/10 text-white font-semibold rounded-lg hover:bg-[#141620]/20 transition-colors border border-white/30"
            >
              <Zap className="h-5 w-5" />
              Funding Rate Harvester
            </Link>
          </div>
        </div>
      </div>

      {/* Related articles */}
      <div className="not-prose mt-12 space-y-4">
        <h3 className="font-bold text-white">Related Articles</h3>

        <Link
          href="/blog/what-are-perpetual-futures-complete-guide"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              What Are Perpetual Futures? The Complete Beginner&apos;s Guide
            </h4>
            <p className="text-gray-300 text-sm">
              Learn how perps work, leverage, and funding—before you trade
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>

        <Link
          href="/blog/oil-prices-iran-war-how-to-trade-crude-oil-2026"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              Oil Prices Are Surging: How to Trade Crude Oil in 2026
            </h4>
            <p className="text-gray-300 text-sm">
              Geopolitics, supply shocks, and why oil funding spiked during the
              Iran crisis
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>
      </div>
    </BlogPostLayout>
  )
}
