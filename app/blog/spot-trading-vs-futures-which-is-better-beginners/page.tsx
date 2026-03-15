import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Target,
  Zap,
} from "lucide-react"

const post = getBlogPost("spot-trading-vs-futures-which-is-better-beginners")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function SpotTradingVsFuturesPage() {
  return (
    <BlogPostLayout post={post}>
      {/* Opening */}
      <p className="text-xl leading-relaxed text-gray-200">
        Spot trading means buying and owning crypto. Futures trading means
        betting on price without owning it. Both have their place — but one is
        much safer for beginners.
      </p>

      <h2>Spot Trading Explained</h2>

      <p>
        What it is: you buy BTC, you own BTC. It goes into your wallet. You sell
        when you want. Like buying a share of stock.
      </p>

      <div className="not-prose border-none my-8 bg-[#141620] rounded-2xl p-6">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
          <Shield className="h-5 w-5 text-emerald-400" />
          Key Points
        </h4>
        <ul className="space-y-3 text-gray-300">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            You own the actual asset
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            No liquidation risk
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            No expiry date
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            Profit when price goes up
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            Max loss = what you invested
          </li>
        </ul>
      </div>

      <h2>Futures Trading Explained</h2>

      <p>
        What it is: you open a position (long or short) on a price. You can use
        leverage (2x–50x). You don&apos;t own the underlying asset.
      </p>

      <div className="not-prose border-none my-8 bg-[#141620] rounded-2xl p-6">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
          <Zap className="h-5 w-5 text-amber-400" />
          Key Points
        </h4>
        <ul className="space-y-3 text-gray-300">
          <li className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-400 flex-shrink-0" />
            Trade with leverage (amplify gains AND losses)
          </li>
          <li className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-400 flex-shrink-0" />
            Can profit when price goes down (short)
          </li>
          <li className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            Risk of liquidation
          </li>
          <li className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400 flex-shrink-0" />
            Funding rates every 8 hours
          </li>
          <li className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            Max loss can exceed initial margin
          </li>
        </ul>
      </div>

      <h2>The Key Differences</h2>

      <div className="not-prose border-none my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="text-left p-3 font-semibold text-white border-b border-[#1a1d26]">
                Feature
              </th>
              <th className="text-left p-3 font-semibold text-white border-b border-[#1a1d26]">
                Spot
              </th>
              <th className="text-left p-3 font-semibold text-white border-b border-[#1a1d26]">
                Futures
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#1a1d26]">
              <td className="p-3 font-medium text-gray-200">Ownership</td>
              <td className="p-3 text-gray-300">You own the token</td>
              <td className="p-3 text-gray-300">You hold a contract</td>
            </tr>
            <tr className="border-b border-[#1a1d26] bg-[#141620]/50">
              <td className="p-3 font-medium text-gray-200">Leverage</td>
              <td className="p-3 text-gray-300">1x (none)</td>
              <td className="p-3 text-gray-300">2x – 50x</td>
            </tr>
            <tr className="border-b border-[#1a1d26]">
              <td className="p-3 font-medium text-gray-200">Can Short?</td>
              <td className="p-3 text-gray-300">No</td>
              <td className="p-3 text-emerald-400">Yes</td>
            </tr>
            <tr className="border-b border-[#1a1d26] bg-[#141620]/50">
              <td className="p-3 font-medium text-gray-200">Liquidation Risk</td>
              <td className="p-3 text-emerald-400">None</td>
              <td className="p-3 text-red-400">Yes</td>
            </tr>
            <tr className="border-b border-[#1a1d26]">
              <td className="p-3 font-medium text-gray-200">Funding Fees</td>
              <td className="p-3 text-gray-300">None</td>
              <td className="p-3 text-gray-300">Every 8 hours</td>
            </tr>
            <tr className="border-b border-[#1a1d26] bg-[#141620]/50">
              <td className="p-3 font-medium text-gray-200">Best For</td>
              <td className="p-3 text-gray-300">Long-term holding</td>
              <td className="p-3 text-gray-300">Active trading</td>
            </tr>
            <tr className="border-b border-[#1a1d26]">
              <td className="p-3 font-medium text-gray-200">Risk Level</td>
              <td className="p-3 text-emerald-400">Lower</td>
              <td className="p-3 text-amber-400">Higher</td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-gray-200">Available on Coincess</td>
              <td className="p-3">
                <Link href="/buy" className="text-brand hover:underline">
                  /buy page
                </Link>
              </td>
              <td className="p-3">
                <Link href="/trade" className="text-brand hover:underline">
                  /trade page
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>When to Use Spot</h2>

      <p>Use cases:</p>
      <ul>
        <li>You believe in a coin long-term</li>
        <li>You&apos;re a beginner</li>
        <li>You want zero liquidation risk</li>
        <li>You want to hold stocks on-chain</li>
      </ul>

      <p>
        <Link href="/buy" className="text-brand font-semibold hover:underline">
          Buy spot on Coincess →
        </Link>
      </p>

      <h2>When to Use Futures</h2>

      <p>Use cases:</p>
      <ul>
        <li>You want to profit from falling prices</li>
        <li>You want leverage</li>
        <li>You&apos;re hedging spot positions</li>
        <li>You understand risk management</li>
      </ul>

      <p>
        <Link href="/trade" className="text-brand font-semibold hover:underline">
          Trade futures on Coincess →
        </Link>
      </p>

      <h2>The Beginner&apos;s Path</h2>

      <p>Recommended progression:</p>

      <div className="not-prose border-none my-8 grid sm:grid-cols-3 gap-4">
        <div className="border-none bg-[#141620] rounded-xl p-6">
          <div className="w-12 h-12 rounded-full bg-brand text-white flex items-center justify-center mb-4 font-bold text-lg">
            1
          </div>
          <h4 className="font-bold text-white mb-2">Stage 1: Start with spot</h4>
          <p className="text-sm text-gray-300 mb-4">
            Buy BTC, ETH on <Link href="/buy" className="text-brand hover:underline">/buy</Link>. Hold.
            No leverage, no liquidation.
          </p>
          <Target className="h-5 w-5 text-brand" />
        </div>
        <div className="border-none bg-[#141620] rounded-xl p-6">
          <div className="w-12 h-12 rounded-full bg-brand text-white flex items-center justify-center mb-4 font-bold text-lg">
            2
          </div>
          <h4 className="font-bold text-white mb-2">Stage 2: Try small futures</h4>
          <p className="text-sm text-gray-300 mb-4">
            Use low leverage (2x–3x) on <Link href="/trade" className="text-brand hover:underline">/trade</Link>.
            Learn how liquidation works.
          </p>
          <Zap className="h-5 w-5 text-amber-400" />
        </div>
        <div className="border-none bg-[#141620] rounded-xl p-6">
          <div className="w-12 h-12 rounded-full bg-brand text-white flex items-center justify-center mb-4 font-bold text-lg">
            3
          </div>
          <h4 className="font-bold text-white mb-2">Stage 3: Graduate to advanced</h4>
          <p className="text-sm text-gray-300 mb-4">
            Once you understand risk, explore higher leverage and advanced
            strategies on /trade.
          </p>
          <TrendingUp className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      <h2>Frequently Asked Questions</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            Can I lose more than I invested with spot?
          </h4>
          <p className="text-sm text-gray-300">
            No. With spot, your max loss is exactly what you invested. You can
            never owe more than you put in.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            What leverage should beginners use?
          </h4>
          <p className="text-sm text-gray-300">
            Start with 2x–3x max. Higher leverage = faster liquidation. Build
            experience before going higher.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            Do I need different accounts for spot and futures?
          </h4>
          <p className="text-sm text-gray-300">
            No. On Coincess, the same wallet works for both. Buy spot on /buy,
            trade futures on /trade.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            Can I convert my spot holdings to a futures position?
          </h4>
          <p className="text-sm text-gray-300">
            Not directly. You can sell spot and open a futures position with the
            proceeds—but they&apos;re separate products.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose border-none mt-12">
        <div className="border-none bg-[#141620] rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-3 text-white">
            Ready to Start?
          </h3>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Choose your path: buy and hold spot, or trade with leverage on
            futures.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/buy"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-brand text-white font-semibold rounded-full hover:bg-brand-hover transition-colors"
            >
              Try Spot Trading
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/trade"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#1a1d26] text-gray-200 font-semibold rounded-full hover:bg-[#252830] transition-colors"
            >
              Try Futures Trading
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </BlogPostLayout>
  )
}
