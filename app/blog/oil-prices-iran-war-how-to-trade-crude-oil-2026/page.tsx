import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { LiveTicker } from "@/components/blog/LiveTicker"
import { getBlogPost } from "@/lib/blog-posts"
import {
  TrendingUp,
  Flame,
  Shield,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  Globe,
  Zap,
  Target,
  DollarSign,
} from "lucide-react"

const post = getBlogPost("oil-prices-iran-war-how-to-trade-crude-oil-2026")!

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

export default function OilPricesWarArticle() {
  return (
    <BlogPostLayout post={post}>
      <div className="not-prose mb-8">
        <LiveTicker coins={["BRENTOIL", "CL", "XAU"]} />
      </div>

      {/* SEO-optimized lead */}
      <p className="text-xl leading-relaxed">
        <strong>
          Oil prices have surged over 35% in a single week as U.S.-Israeli
          strikes on Iran threaten to close the Strait of Hormuz—the chokepoint
          for 20% of global oil supply.
        </strong>{" "}
        Brent crude briefly touched $119.50/barrel on March 9, 2026, levels not
        seen since 2022. This is the biggest oil supply disruption in recorded
        history, and it&apos;s far from over.
      </p>

      <p>
        In this Coincess Intelligence report, we break down exactly{" "}
        <strong>why oil prices are spiking</strong>, what drives crude oil
        markets, and{" "}
        <strong>
          how you can trade oil directly on-chain using Coincess
        </strong>
        .
      </p>

      {/* Key stats banner */}
      <div className="not-prose my-10">
        <div className="bg-gradient-to-r from-amber-950/50 to-orange-950/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
              Live Market Snapshot — March 2026
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold text-white">$98.96</div>
              <div className="text-sm text-gray-300">Brent Crude (bbl)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">$94.77</div>
              <div className="text-sm text-gray-300">WTI Crude (bbl)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">+35.6%</div>
              <div className="text-sm text-gray-300">WTI Weekly Gain</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">16M bpd</div>
              <div className="text-sm text-gray-300">Supply Disrupted</div>
            </div>
          </div>
        </div>
      </div>

      <h2>How Do Oil Prices Go Up?</h2>

      <p>
        Oil prices are governed by <strong>supply and demand</strong>—but the
        forces behind each side are more complex than most people realize. Here
        are the key drivers:
      </p>

      {/* Supply/Demand explainer cards */}
      <div className="not-prose my-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-red-950/50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-bold text-white">
                Supply Shocks (Prices Rise)
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-200">
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">1.</span>
                <span>
                  <strong>War & Geopolitics</strong> — Military conflict near
                  oil-producing regions (Iran, Iraq, Libya) disrupts extraction
                  and shipping
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">2.</span>
                <span>
                  <strong>Chokepoint Blockages</strong> — The Strait of Hormuz,
                  Suez Canal, and Bab el-Mandeb control global oil shipping
                  routes
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">3.</span>
                <span>
                  <strong>OPEC+ Production Cuts</strong> — When OPEC nations
                  agree to pump less oil, prices rise
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">4.</span>
                <span>
                  <strong>Sanctions</strong> — Embargoes on Iran, Russia, or
                  Venezuela remove millions of barrels from the market
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 font-bold">5.</span>
                <span>
                  <strong>Natural Disasters</strong> — Hurricanes in the Gulf of
                  Mexico shut down rigs and refineries
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-emerald-950/50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-bold text-white">
                Demand Surges (Prices Rise)
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-200">
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">1.</span>
                <span>
                  <strong>Economic Growth</strong> — Booming economies
                  (especially China, India) consume more oil for manufacturing
                  and transport
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">2.</span>
                <span>
                  <strong>Seasonal Demand</strong> — Summer driving season and
                  winter heating increase consumption
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">3.</span>
                <span>
                  <strong>Strategic Reserves</strong> — Government stockpiling
                  (e.g. China, U.S.) absorbs supply from the open market
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">4.</span>
                <span>
                  <strong>Weak Dollar</strong> — Oil is priced in USD; a weaker
                  dollar makes oil cheaper for foreign buyers, boosting demand
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">5.</span>
                <span>
                  <strong>Speculation</strong> — Futures traders and hedge funds
                  bidding up contracts in anticipation of tightening
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <p>
        Right now, <strong>supply shock is the dominant force</strong>. The
        Iran-U.S. conflict has triggered the single largest supply disruption in
        history—nearly double what happened during the 1956 Suez Crisis.
      </p>

      <h2>What&apos;s Happening Right Now: The Iran-Oil Crisis Explained</h2>

      <p>
        In early March 2026, U.S. and Israeli forces launched coordinated
        strikes on Iranian military and nuclear facilities. Iran retaliated by
        threatening to close the <strong>Strait of Hormuz</strong>—a narrow
        waterway between Iran and the Arabian Peninsula.
      </p>

      {/* Hormuz explainer */}
      <div className="not-prose my-8 bg-gray-900 text-white rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-bold">
            Why the Strait of Hormuz Matters
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-3xl font-bold text-amber-400 mb-1">20%</div>
            <p className="text-gray-200">
              of all global oil flows through this 21-mile-wide chokepoint every
              day
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold text-amber-400 mb-1">
              16M bpd
            </div>
            <p className="text-gray-200">
              barrels per day of crude, refined products, and LPG disrupted
              since the blockage
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold text-amber-400 mb-1">
              $150/bbl
            </div>
            <p className="text-gray-200">
              price target warned by Qatar&apos;s energy minister if Gulf
              exports remain blocked for weeks
            </p>
          </div>
        </div>
        <p className="text-gray-300 text-sm mt-4">
          Saudi Arabia and the UAE—which hold the world&apos;s spare production
          capacity—are themselves cut off from global markets. Bypass pipelines
          can move only 7-8M bpd, less than half of normal flows.
        </p>
      </div>

      <p>Here&apos;s the timeline of key events:</p>

      <div className="not-prose my-8">
        <div className="space-y-4">
          {[
            {
              date: "Mar 4",
              event:
                "U.S.-Israeli strikes on Iran begin. Oil jumps 5% in a single session. Iraq cuts 1.5M bpd of exports.",
            },
            {
              date: "Mar 5",
              event:
                "Iran threatens Hormuz closure. Brent settles at highest in over a year for second straight day.",
            },
            {
              date: "Mar 6",
              event:
                "Hundreds of tankers stranded. WTI surges 12% in one day. 140 million barrels cut off from markets.",
            },
            {
              date: "Mar 8",
              event:
                "Brent and WTI both briefly touch $119+/barrel—comparable to 2008 highs. Biggest weekly gains since COVID.",
            },
            {
              date: "Mar 9",
              event:
                "IEA announces 400M-barrel strategic reserve release. Prices pull back but remain elevated near $95-99.",
            },
          ].map((item) => (
            <div key={item.date} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-16 text-right">
                <span className="text-sm font-bold text-amber-600 bg-amber-950/50 px-2 py-1 rounded">
                  {item.date}
                </span>
              </div>
              <div className="flex-1 text-sm text-gray-200 border-l-2 border-amber-800/50 pl-4">
                {item.event}
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2>Why Oil Could Go Even Higher</h2>

      <p>
        The conflict is ongoing, and several factors could push prices toward
        $120-150/barrel:
      </p>

      <ul>
        <li>
          <strong>Prolonged Hormuz closure</strong> — Every week the strait
          stays blocked removes ~112M barrels from global supply. Strategic
          reserves can&apos;t keep pace.
        </li>
        <li>
          <strong>No spare capacity accessible</strong> — Saudi Arabia and UAE
          can pump more, but they can&apos;t ship it if the strait is blocked.
        </li>
        <li>
          <strong>Cascading effects</strong> — Jet fuel is up 140%, fertilizer
          up 43%, aluminum rising. These feed into broader inflation that
          further destabilizes markets.
        </li>
        <li>
          <strong>Russian sanctions uncertainty</strong> — Reports suggest the
          U.S. may ease Russian oil sanctions to offset the Iran disruption—but
          this is politically complex and unreliable.
        </li>
        <li>
          <strong>Summer driving season approaching</strong> — Seasonal demand
          is about to increase just as supply is constrained.
        </li>
      </ul>

      <h2>Why Oil Could Pull Back</h2>

      <p>
        No trade is risk-free. Here&apos;s the bear case:
      </p>

      <ul>
        <li>
          <strong>Ceasefire or peace talks</strong> — Any diplomatic resolution
          could rapidly unwind the geopolitical premium. CIA-Iran back-channels
          have already been reported.
        </li>
        <li>
          <strong>Strategic reserve releases</strong> — The IEA&apos;s 400M
          barrel release is the largest coordinated intervention ever. This adds
          significant supply.
        </li>
        <li>
          <strong>Structural oversupply</strong> — Before the war, analysts
          projected a 2026 surplus of 0.8-3.5M bpd. If the conflict resolves
          quickly, oil could give back all gains.
        </li>
        <li>
          <strong>Demand destruction</strong> — At $100+/barrel, consumers and
          businesses reduce consumption. Airlines cut routes, factories slow
          down.
        </li>
      </ul>

      {/* Risk callout */}
      <div className="not-prose my-8 bg-amber-950/50 rounded-xl p-6">
        <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Trading Risk Disclosure
        </h4>
        <p className="text-amber-400 text-sm">
          Oil is one of the most volatile commodities in the world. Leveraged
          trading amplifies both gains and losses. Never trade with more than
          you can afford to lose. Past performance and geopolitical analysis do
          not guarantee future results.
        </p>
      </div>

      <h2>How to Trade Crude Oil on Coincess</h2>

      <p>
        Traditionally, trading oil required a brokerage account, large minimum
        deposits, and dealing with complex futures contracts. With{" "}
        <strong>Coincess</strong>, you can trade crude oil perpetual contracts
        directly from your crypto wallet—24/7, with no KYC, and starting from
        as little as $10.
      </p>

      {/* How it works */}
      <div className="not-prose my-10">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-950/500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-amber-600 mb-2">
              Step 1
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Connect Wallet
            </h3>
            <p className="text-sm text-gray-300">
              Connect your crypto wallet to Coincess. No account signup or KYC
              verification needed.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-950/500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-amber-600 mb-2">
              Step 2
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Pick Your Oil Market
            </h3>
            <p className="text-sm text-gray-300">
              Search for <strong>Crude Oil (CL)</strong> or{" "}
              <strong>Brent Oil (BRENTOIL)</strong> in the trading interface.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-950/500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-amber-600 mb-2">
              Step 3
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Go Long or Short
            </h3>
            <p className="text-sm text-gray-300">
              Open a position with up to 50x leverage. Profit whether oil goes
              up <em>or</em> down.
            </p>
          </div>
        </div>
      </div>

      <h3>Available Oil Markets on Coincess</h3>

      <div className="not-prose my-8">
        <div className="border border-[#2a2e39] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1d26]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-200">
                  Market
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-200">
                  Symbol
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-200">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-200">
                  Max Leverage
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#2a2e39]">
                <td className="px-4 py-3 font-medium text-white">
                  WTI Crude Oil
                </td>
                <td className="px-4 py-3 text-gray-300">CL</td>
                <td className="px-4 py-3 text-gray-300">Perpetual</td>
                <td className="px-4 py-3 text-gray-300">50x</td>
              </tr>
              <tr className="border-t border-[#2a2e39] bg-[#141620]/50">
                <td className="px-4 py-3 font-medium text-white">
                  Brent Crude Oil
                </td>
                <td className="px-4 py-3 text-gray-300">BRENTOIL</td>
                <td className="px-4 py-3 text-gray-300">Perpetual</td>
                <td className="px-4 py-3 text-gray-300">50x</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h3>Why Trade Oil on Coincess?</h3>

      <ul>
        <li>
          <strong>24/7 Trading</strong> — Unlike traditional futures markets
          that close overnight and on weekends, crypto-native oil perps trade
          around the clock
        </li>
        <li>
          <strong>No KYC Required</strong> — Connect your wallet and start
          trading immediately. No ID uploads, no waiting periods
        </li>
        <li>
          <strong>Low Minimums</strong> — Trade oil exposure from as little as
          $10 in margin
        </li>
        <li>
          <strong>Up to 50x Leverage</strong> — Amplify your exposure to oil
          price movements (use responsibly)
        </li>
        <li>
          <strong>Funding Rate Income</strong> — When markets are in contango
          (common during supply crises), short-side holders earn hourly funding
          payments
        </li>
        <li>
          <strong>On-Chain Transparency</strong> — Every trade settles on-chain.
          No counterparty risk from opaque brokerages
        </li>
      </ul>

      <h2>Trading Strategies for the Oil Crisis</h2>

      <p>
        Here are three approaches traders are using during this crisis, ranging
        from conservative to aggressive:
      </p>

      <div className="not-prose my-8 space-y-4">
        <div className="bg-emerald-950/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-green-600" />
            <h4 className="font-bold text-white">
              Conservative: Funding Rate Harvest
            </h4>
          </div>
          <p className="text-sm text-gray-200 mb-3">
            When oil is in high demand, the funding rate on perpetual contracts
            often turns highly positive—meaning <strong>long holders pay</strong>{" "}
            short holders every hour. By going long on physical oil exposure
            elsewhere and shorting the perp, you can collect funding without
            directional risk.
          </p>
          <p className="text-xs text-gray-500">
            Risk Level: Low | Ideal for: Yield seekers | Leverage: 1-3x
          </p>
        </div>

        <div className="bg-amber-950/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            <h4 className="font-bold text-white">
              Moderate: Momentum Long
            </h4>
          </div>
          <p className="text-sm text-gray-200 mb-3">
            The trend is clearly bullish. Going long with a trailing stop-loss
            lets you ride the momentum while protecting against sudden
            reversals. Set your stop below the last significant support level
            ($88-90 for Brent).
          </p>
          <p className="text-xs text-gray-500">
            Risk Level: Medium | Ideal for: Swing traders | Leverage: 3-10x
          </p>
        </div>

        <div className="bg-red-950/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-5 w-5 text-red-600" />
            <h4 className="font-bold text-white">
              Aggressive: Breakout Play to $120+
            </h4>
          </div>
          <p className="text-sm text-gray-200 mb-3">
            If you believe the Hormuz closure will persist and no ceasefire is
            imminent, oil could retest the $119 intraday high and push toward
            $150. This is a high-conviction, high-risk play with tight risk
            management—set hard stop-losses and size your position to survive a
            20-30% drawdown.
          </p>
          <p className="text-xs text-gray-500">
            Risk Level: High | Ideal for: Experienced traders | Leverage:
            10-20x
          </p>
        </div>
      </div>

      <h2>The Bigger Picture: Oil in a Changing World</h2>

      <p>
        The 2026 Iran oil crisis is a stark reminder that despite the push
        toward renewable energy, the global economy remains{" "}
        <strong>deeply dependent on fossil fuels</strong>. A single chokepoint
        closure has cascaded through supply chains—from jet fuel (+140%) to
        fertilizers (+43%) to aluminum and beyond.
      </p>

      <p>
        For traders, this creates opportunity. Oil is one of the most liquid and
        information-rich markets on the planet. Every headline about Iran, OPEC,
        or the Strait of Hormuz moves the price. If you can stay informed and
        manage risk, oil trading during geopolitical crises can be highly
        profitable.
      </p>

      <p>
        <strong>Coincess Intelligence</strong> will continue to cover the
        Iran-Oil crisis with real-time analysis and trading signals. Follow our
        blog and join the community to stay ahead of the market.
      </p>

      {/* Primary CTA */}
      <div className="not-prose mt-12">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-3">
            Trade Oil Now on Coincess
          </h3>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            Go long or short on Crude Oil and Brent Oil with up to 50x
            leverage. No KYC, 24/7, starting from $10.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trade/CL"
              className="inline-block px-8 py-3 bg-[#141620] text-amber-400 font-semibold rounded-lg hover:bg-[#1a1d26] transition-colors"
            >
              Trade Crude Oil (CL)
            </Link>
            <Link
              href="/trade/BRENTOIL"
              className="inline-block px-8 py-3 bg-[#141620]/20 text-white font-semibold rounded-lg hover:bg-[#141620]/30 transition-colors border border-white/30"
            >
              Trade Brent Oil
            </Link>
          </div>
        </div>
      </div>

      {/* Related articles */}
      <div className="not-prose mt-12 space-y-4">
        <h3 className="font-bold text-white">Keep Learning</h3>

        <Link
          href="/blog/crypto-101-first-coin-5-minutes"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              Crypto 101: Get Your First Coin
            </h4>
            <p className="text-gray-300 text-sm">
              New to crypto? Get set up in under 5 minutes
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>

        <Link
          href="/blog/exchange-vs-swap-aggregator"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              Exchange vs. Swap Aggregator
            </h4>
            <p className="text-gray-300 text-sm">
              Find the cheapest way to fund your trading account
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>
      </div>
    </BlogPostLayout>
  )
}
