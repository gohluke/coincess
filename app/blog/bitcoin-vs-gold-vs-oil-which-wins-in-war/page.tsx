import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { LiveTicker } from "@/components/blog/LiveTicker"
import { getBlogPost } from "@/lib/blog-posts"
import {
  Flame,
  Bitcoin,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  Coins,
  Activity,
} from "lucide-react"

const post = getBlogPost("bitcoin-vs-gold-vs-oil-which-wins-in-war")!

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

export default function BitcoinVsGoldVsOilArticle() {
  return (
    <BlogPostLayout post={post}>
      <div className="not-prose mb-8">
        <LiveTicker coins={["BTC", "XAU", "BRENTOIL"]} />
      </div>

      {/* Lead */}
      <p className="text-xl leading-relaxed">
        With U.S.-Israeli strikes on Iran entering their third week, three assets
        are dominating trader attention: <strong>Bitcoin</strong>,{" "}
        <strong>Gold</strong>, and <strong>Oil</strong>. But which one is the best
        trade right now?
      </p>

      <p>
        In this Coincess Intelligence analysis, we break down the performance
        scoreboard, explain why each asset behaves differently during war, and
        show you how to trade all three—or diversify across them—on the one
        platform that offers BTC, XAU, and oil perpetuals under one roof.
      </p>

      {/* Performance Scoreboard */}
      <h2>Performance Scoreboard: March 2026</h2>

      <div className="not-prose my-10">
        <div className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                Live Performance — March 2026
              </span>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* #1 Oil */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-950/500 flex items-center justify-center text-xs font-bold text-slate-900">
                    1
                  </span>
                  <span className="font-bold">Oil (Brent)</span>
                </div>
                <span className="text-emerald-400 font-bold">+35%</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                <span>~$98/bbl</span>
                <span>•</span>
                <span>One week</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* #2 Gold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#1a1d26]0 flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span className="font-bold">Gold (XAU)</span>
                </div>
                <span className="text-emerald-400 font-bold">+8%</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                <span>Near all-time highs</span>
                <span>•</span>
                <span>One month</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-yellow-500 rounded-full"
                  style={{ width: "23%" }}
                />
              </div>
            </div>

            {/* #3 Bitcoin */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span className="font-bold">Bitcoin</span>
                </div>
                <span className="text-slate-300 font-medium">~$71K</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                <span>Dropped to $65K on shock, recovered</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                  style={{ width: "20%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2>Oil: The Direct War Play</h2>

      <p>
        Oil spikes during Middle East conflict for a simple reason:{" "}
        <strong>supply disruption</strong>. The Strait of Hormuz—the chokepoint
        for 20% of global oil flows—is in the crosshairs. When Iran threatens to
        close it, tankers stop moving, refineries run short, and prices explode.
      </p>

      <p>
        Oil is the <strong>#1 performer</strong> during this crisis—up 35% in
        one week—but it&apos;s also the <strong>most volatile</strong>. The
        biggest risk: a ceasefire or peace deal could trigger an instant 30%
        crash as the geopolitical premium unwinds. If you&apos;re long oil,
        you&apos;re betting the conflict continues. If you&apos;re short, you&apos;re
        betting on diplomacy.
      </p>

      <h2>Gold: The Eternal Safe Haven</h2>

      <p>
        Gold has a 5,000-year track record during wars. When uncertainty spikes,
        capital flows into the metal that can&apos;t be printed, hacked, or
        sanctioned. Central banks are buying record amounts. Retail investors
        are piling in. Gold is up 8% this month and trading near all-time highs.
      </p>

      <p>
        The appeal: <strong>steady appreciation without the liquidation risk</strong>{" "}
        of leveraged oil or crypto. Gold doesn&apos;t crash 30% on a ceasefire
        headline. It dips, maybe 5–10%, then grinds higher as long as
        uncertainty persists. Best for <strong>capital preservation</strong> and
        portfolio hedging.
      </p>

      <h2>Bitcoin: The Digital Wild Card</h2>

      <p>
        Bitcoin initially <strong>dumped on war news</strong>—classic risk-off
        behavior. It dropped to $65K during the initial shock. Then it
        recovered to $71K as institutional buying resumed. ETF inflows are
        running at $568M per week. The long-term thesis: digital gold, inflation
        hedge, uncorrelated asset.
      </p>

      <p>
        But short-term, Bitcoin trades as a <strong>risk asset</strong>, not a
        safe haven. When fear spikes, money flees crypto first. When calm
        returns, it flows back. If you&apos;re trading BTC during war, you&apos;re
        betting on the recovery—or shorting the initial dump. It&apos;s the most
        unpredictable of the three.
      </p>

      <h2>Head-to-Head Comparison</h2>

      <div className="not-prose my-8">
        <div className="border border-[#2a2e39] rounded-2xl overflow-hidden ">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                Factor Comparison
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-[#1a1d26]">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-gray-200">
                    Factor
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-200">
                    Oil
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-200">
                    Gold
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-200">
                    Bitcoin
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#2a2e39]">
                  <td className="px-6 py-4 font-medium text-white">
                    War sensitivity
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-medium">
                      Extreme
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded text-xs font-medium">
                      High
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-[#1a1d26] text-gray-200 rounded text-xs font-medium">
                      Moderate
                    </span>
                  </td>
                </tr>
                <tr className="border-t border-[#2a2e39] bg-[#1a1d26]/30">
                  <td className="px-6 py-4 font-medium text-white">
                    Volatility
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-medium">
                      Very High
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-xs font-medium">
                      Low
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded text-xs font-medium">
                      High
                    </span>
                  </td>
                </tr>
                <tr className="border-t border-[#2a2e39]">
                  <td className="px-6 py-4 font-medium text-white">
                    Safe haven
                  </td>
                  <td className="px-6 py-4 text-gray-300">No</td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 font-medium">Yes</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-amber-600 font-medium">Debatable</span>
                  </td>
                </tr>
                <tr className="border-t border-[#2a2e39] bg-[#1a1d26]/30">
                  <td className="px-6 py-4 font-medium text-white">
                    24/7 trading
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 font-medium">
                      Yes (on Coincess)
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 font-medium">Yes</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 font-medium">Yes</span>
                  </td>
                </tr>
                <tr className="border-t border-[#2a2e39]">
                  <td className="px-6 py-4 font-medium text-white">
                    Leverage available
                  </td>
                  <td className="px-6 py-4 text-gray-300">Up to 50x</td>
                  <td className="px-6 py-4 text-gray-300">Up to 50x</td>
                  <td className="px-6 py-4 text-gray-300">Up to 50x</td>
                </tr>
                <tr className="border-t border-[#2a2e39] bg-[#1a1d26]/30">
                  <td className="px-6 py-4 font-medium text-white">
                    Liquidation risk
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-red-600 font-medium">High</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 font-medium">Low</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-amber-600 font-medium">Medium</span>
                  </td>
                </tr>
                <tr className="border-t border-[#2a2e39]">
                  <td className="px-6 py-4 font-medium text-white">
                    Ceasefire risk
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-red-600 font-medium">Crashes</span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">Dips</td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 font-medium">Pumps</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>The Smart Play: Trade All Three</h2>

      <p>
        The smart play isn&apos;t picking one winner—it&apos;s{" "}
        <strong>diversification</strong>. Long gold for safety, long oil for
        upside, hedge with BTC. Or trade the relative value: the oil/gold ratio
        tells you whether the market is pricing in more supply shock (oil
        outperforms) or more risk-off (gold outperforms).
      </p>

      <p>
        All three are available on <strong>Coincess</strong>—the one platform
        where you can trade BTC, XAU (gold), and CL/BRENTOIL (oil) perpetuals
        from a single wallet. No brokerage, no KYC, 24/7.
      </p>

      <h2>How to Trade All Three on Coincess</h2>

      <p>
        Connect your wallet, pick your market, and go long or short. It&apos;s
        that simple:
      </p>

      <div className="not-prose my-8">
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/trade/BTC"
            className="flex items-center gap-4 p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-900/30 flex items-center justify-center">
              <Bitcoin className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h4 className="font-bold text-white group-hover:text-brand">
                Trade Bitcoin
              </h4>
              <p className="text-sm text-gray-300">/trade/BTC</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand ml-auto" />
          </Link>
          <Link
            href="/trade/XAU"
            className="flex items-center gap-4 p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-900/30 flex items-center justify-center">
              <Coins className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-bold text-white group-hover:text-brand">
                Trade Gold
              </h4>
              <p className="text-sm text-gray-300">/trade/XAU</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand ml-auto" />
          </Link>
          <Link
            href="/trade/CL"
            className="flex items-center gap-4 p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-red-900/30 flex items-center justify-center">
              <Flame className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h4 className="font-bold text-white group-hover:text-brand">
                Trade Oil
              </h4>
              <p className="text-sm text-gray-300">/trade/CL</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand ml-auto" />
          </Link>
        </div>
      </div>

      {/* Risk Disclosure */}
      <div className="not-prose my-10 bg-amber-950/50 rounded-xl p-6">
        <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Risk Disclosure
        </h4>
        <p className="text-amber-400 text-sm">
          Leveraged trading amplifies both gains and losses. Oil, gold, and
          Bitcoin are volatile assets—geopolitical events can cause 10%+ moves
          in a single day. Never trade with more than you can afford to lose.
          This article is not financial advice. Past performance does not
          guarantee future results.
        </p>
      </div>

      {/* CTA */}
      <div className="not-prose mt-12">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-900 rounded-2xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-3">
            Trade Bitcoin, Gold &amp; Oil on Coincess
          </h3>
          <p className="text-slate-300 mb-6 max-w-lg mx-auto">
            The one platform where you can trade all three—24/7, no KYC, up to
            50x leverage. Start with $10.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <Link
              href="/trade/BTC"
              className="inline-flex items-center gap-2 px-8 py-3 bg-orange-950/500 text-white font-semibold rounded-lg hover:bg-orange-400 transition-colors"
            >
              Trade Bitcoin
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/trade/XAU"
              className="inline-flex items-center gap-2 px-8 py-3 bg-amber-950/500 text-white font-semibold rounded-lg hover:bg-amber-400 transition-colors"
            >
              Trade Gold
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/trade/CL"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#141620]/10 text-white font-semibold rounded-lg hover:bg-[#141620]/20 transition-colors border border-white/20"
            >
              Trade Oil
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Related articles */}
      <div className="not-prose mt-12 space-y-4">
        <h3 className="font-bold text-white">Related Articles</h3>

        <Link
          href="/blog/oil-prices-iran-war-how-to-trade-crude-oil-2026"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              Oil Prices Are Surging: How the Iran War Is Driving Crude to $120
            </h4>
            <p className="text-gray-300 text-sm">
              Full breakdown of why oil is spiking and how to trade it
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>

        <Link
          href="/blog/trade-gold-oil-commodities-on-chain-2026"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              How to Trade Gold, Oil, and Commodities On-Chain
            </h4>
            <p className="text-gray-300 text-sm">
              The 2026 guide to DeFi commodity trading on Coincess
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>
      </div>
    </BlogPostLayout>
  )
}
