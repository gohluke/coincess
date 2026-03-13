import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Target,
  BarChart3,
  Shield,
  Calculator,
  Coins,
} from "lucide-react"

const post = getBlogPost("what-are-perpetual-futures-complete-guide")!

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

export default function WhatArePerpetualFuturesGuide() {
  return (
    <BlogPostLayout post={post}>
      {/* Lead */}
      <p className="text-xl leading-relaxed">
        <strong>
          Perpetual futures account for 80%+ of all crypto trading volume.
        </strong>{" "}
        If you&apos;re trading crypto and not using perps, you&apos;re leaving
        money on the table. This guide will teach you everything you need to
        know—from the basics to your first trade on Coincess.
      </p>

      <h2>What Is a Perpetual Future?</h2>

      <p>
        A <strong>perpetual future</strong> (or &quot;perp&quot;) is a
        derivative contract that lets you bet on an asset&apos;s price—up or
        down—without ever owning it. Unlike traditional futures, perps have{" "}
        <strong>no expiry date</strong>. You can hold your position forever (or
        until you close it).
      </p>

      <p>
        Think of it like this: <em>Traditional futures</em> are like a bet with
        an expiration—&quot;I bet BTC will be $100K by March 31.&quot;{" "}
        <em>Perpetual futures</em> are like a bet on price that never expires—you
        can stay in the trade as long as you want, and you profit (or lose) based
        on how the price moves while you&apos;re in it.
      </p>

      <p>
        Perps were invented by BitMEX in 2016 and have since become the dominant
        product in crypto. They&apos;re simpler than traditional futures (no
        rolling contracts), more capital-efficient (leverage), and trade 24/7.
      </p>

      <h2>How Perpetual Futures Work</h2>

      <div className="not-prose my-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-emerald-950/50 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center mb-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <h4 className="font-bold text-white mb-2">Going Long</h4>
          <p className="text-sm text-gray-300">
            You profit when the price goes <strong>up</strong>. Buy low, sell
            high. You&apos;re betting the asset will appreciate.
          </p>
        </div>
        <div className="bg-red-950/50 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center mb-3">
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <h4 className="font-bold text-white mb-2">Going Short</h4>
          <p className="text-sm text-gray-300">
            You profit when the price goes <strong>down</strong>. Sell high, buy
            low. You&apos;re betting the asset will depreciate.
          </p>
        </div>
        <div className="bg-blue-950/50 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center mb-3">
            <Zap className="h-5 w-5 text-blue-600" />
          </div>
          <h4 className="font-bold text-white mb-2">Leverage</h4>
          <p className="text-sm text-gray-300">
            Control a $10K position with just $100. Leverage amplifies both gains
            and losses—use responsibly.
          </p>
        </div>
        <div className="bg-[#1a1d26] rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center mb-3">
            <Wallet className="h-5 w-5 text-slate-600" />
          </div>
          <h4 className="font-bold text-white mb-2">Margin</h4>
          <p className="text-sm text-gray-300">
            Your collateral. The amount you deposit to open and maintain your
            position. More margin = more safety.
          </p>
        </div>
        <div className="bg-amber-950/50 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-amber-900/30 flex items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h4 className="font-bold text-white mb-2">Liquidation</h4>
          <p className="text-sm text-gray-300">
            When your losses exceed your margin, your position is force-closed.
            Higher leverage = closer liquidation.
          </p>
        </div>
        <div className="bg-brand/10 border border-brand/30 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center mb-3">
            <BarChart3 className="h-5 w-5 text-brand" />
          </div>
          <h4 className="font-bold text-white mb-2">No Expiry</h4>
          <p className="text-sm text-gray-300">
            Hold as long as you want. No contract rollover, no settlement dates.
            Trade forever.
          </p>
        </div>
      </div>

      <h2>Funding Rates: The Secret Mechanic</h2>

      <p>
        Perpetual futures don&apos;t expire, so how does the perp price stay
        aligned with the spot price? The answer is{" "}
        <strong>funding rates</strong>—periodic payments between long and short
        holders that nudge the perp price toward spot.
      </p>

      <p>
        When the perp trades <strong>above</strong> spot (market is bullish),
        longs pay shorts. When the perp trades <strong>below</strong> spot
        (market is bearish), shorts pay longs. Funding typically settles every 1–8
        hours depending on the exchange.
      </p>

      <div className="not-prose my-8 bg-slate-900 text-white rounded-2xl p-6">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-400" />
          Funding Rate Example
        </h4>
        <div className="space-y-3 text-sm">
          <p className="text-gray-200">
            BTC perp: $100,000 | Spot: $99,500 | Funding: +0.01% (longs pay)
          </p>
          <p className="text-gray-200">
            Your position: $10,000 notional (0.1 BTC) | You&apos;re long
          </p>
          <p className="text-amber-400 font-mono">
            Payment = $10,000 × 0.0001 = $1 per funding period
          </p>
          <p className="text-gray-300 text-xs">
            If funding runs 3× per day: ~$3/day to hold. Shorts receive this.
          </p>
        </div>
      </div>

      <p>
        Funding rates matter for two reasons: (1) they add to or subtract from
        your P&amp;L when holding overnight, and (2) extreme funding can signal
        crowded trades—when everyone&apos;s long and funding is sky-high, a
        reversal may be near.
      </p>

      <h2>Perps vs Spot Trading</h2>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="text-left p-3 font-semibold text-white border-b">
                Feature
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Perpetual Futures
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Spot Trading
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium text-gray-200">Leverage</td>
              <td className="p-3 text-emerald-600">Up to 50x on Coincess</td>
              <td className="p-3 text-gray-500">1x only</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-[#141620]/50">
              <td className="p-3 font-medium text-gray-200">Short selling</td>
              <td className="p-3 text-emerald-600">Yes—profit when price falls</td>
              <td className="p-3 text-gray-500">No (or complex)</td>
            </tr>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium text-gray-200">Asset custody</td>
              <td className="p-3 text-emerald-600">No—you never hold the asset</td>
              <td className="p-3 text-gray-500">Yes—you own the coins</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-[#141620]/50">
              <td className="p-3 font-medium text-gray-200">Trading hours</td>
              <td className="p-3 text-emerald-600">24/7</td>
              <td className="p-3 text-emerald-600">24/7 (crypto)</td>
            </tr>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium text-gray-200">Complexity</td>
              <td className="p-3 text-amber-600">Higher—leverage, funding, liquidation</td>
              <td className="p-3 text-emerald-600">Simpler—buy and hold</td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-gray-200">Liquidation risk</td>
              <td className="p-3 text-amber-600">Yes—can lose entire margin</td>
              <td className="p-3 text-emerald-600">No—you own the asset</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Your First Perpetual Trade on Coincess</h2>

      <p>
        Ready to try? Here&apos;s the step-by-step to place your first perp trade
        on Coincess—no KYC, no account signup, just connect and go.
      </p>

      <div className="not-prose my-8 space-y-4">
        {[
          {
            step: 1,
            title: "Connect wallet",
            desc: "Connect MetaMask, Rabby, or any Web3 wallet. No KYC, no email.",
            icon: Wallet,
          },
          {
            step: 2,
            title: "Deposit USDC",
            desc: "Bridge or swap USDC to Hyperliquid. Coincess supports instant deposits.",
            icon: Coins,
          },
          {
            step: 3,
            title: "Pick a market",
            desc: "Choose BTC, ETH, SOL, HYPE, oil (CL), gold (XAU), or any listed market.",
            icon: Target,
          },
          {
            step: 4,
            title: "Choose Long or Short",
            desc: "Long = bet price goes up. Short = bet price goes down.",
            icon: BarChart3,
          },
          {
            step: 5,
            title: "Set leverage (start low)",
            desc: "Begin with 2–5x. Higher leverage = bigger moves, faster liquidation.",
            icon: Zap,
          },
          {
            step: 6,
            title: "Place your order",
            desc: "Enter size, set a stop-loss if you can, and execute.",
            icon: Shield,
          },
        ].map(({ step, title, desc, icon: Icon }) => (
          <div
            key={step}
            className="flex gap-4 items-start p-4 rounded-xl border-2 border-brand/20 bg-brand/5 hover:border-brand/40 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-brand text-white flex items-center justify-center flex-shrink-0 font-bold">
              {step}
            </div>
            <div>
              <h4 className="font-bold text-white mb-1">{title}</h4>
              <p className="text-sm text-gray-300">{desc}</p>
            </div>
            <Icon className="h-5 w-5 text-brand flex-shrink-0 mt-1" />
          </div>
        ))}
      </div>

      <p>
        <Link href="/trade/BTC" className="text-brand font-semibold hover:underline">
          Trade BTC on Coincess →
        </Link>
      </p>

      <h2>Common Mistakes Beginners Make</h2>

      <div className="not-prose my-8 space-y-4">
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">Using too much leverage</h4>
            <p className="text-sm text-red-400">
              50x sounds exciting until a 2% move wipes you out. Start with 2–5x
              and scale up only when you understand the math.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-amber-950/50">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-amber-400">No stop-loss</h4>
            <p className="text-sm text-amber-400">
              &quot;It&apos;ll come back&quot; is how people get liquidated. Always
              set a stop-loss before you enter—or at least know your exit.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-amber-950/50">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-amber-400">Ignoring funding rates</h4>
            <p className="text-sm text-amber-400">
              Holding a long through extreme positive funding can cost you 1%+ per
              day. Check funding before you hold overnight.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-[#1a1d26]">
          <AlertTriangle className="h-6 w-6 text-slate-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-white">Trading without a plan</h4>
            <p className="text-sm text-gray-200">
              Know your entry, target, and stop before you click. Random trades =
              random results.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">Revenge trading after a loss</h4>
            <p className="text-sm text-red-400">
              One bad trade doesn&apos;t justify a bigger, riskier one. Step
              away. Come back with a clear head.
            </p>
          </div>
        </div>
      </div>

      <h2>Available Perpetual Markets on Coincess</h2>

      <p>
        Coincess, built on Hyperliquid, offers perpetual futures on crypto and
        commodities. Here&apos;s a sample of what you can trade:
      </p>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="text-left p-3 font-semibold text-white border-b">
                Market
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Symbol
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Max Leverage
              </th>
              <th className="text-left p-3 font-semibold text-white border-b">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#2a2e39] bg-brand/5">
              <td className="p-3 font-semibold text-white">Bitcoin</td>
              <td className="p-3">BTC</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-gray-300">Crypto</td>
            </tr>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium">Ethereum</td>
              <td className="p-3">ETH</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-gray-300">Crypto</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-[#141620]/50">
              <td className="p-3 font-medium">Solana</td>
              <td className="p-3">SOL</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-gray-300">Crypto</td>
            </tr>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium">Hyperliquid</td>
              <td className="p-3">HYPE</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-gray-300">Crypto</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-amber-950/50/50">
              <td className="p-3 font-medium">Crude Oil (WTI)</td>
              <td className="p-3">CL</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-amber-400">Commodity</td>
            </tr>
            <tr className="border-b border-[#2a2e39]">
              <td className="p-3 font-medium">Brent Crude Oil</td>
              <td className="p-3">BRENTOIL</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-amber-400">Commodity</td>
            </tr>
            <tr className="border-b border-[#2a2e39] bg-[#141620]/50">
              <td className="p-3 font-medium">Gold</td>
              <td className="p-3">XAU</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-amber-400">Commodity</td>
            </tr>
            <tr>
              <td className="p-3 font-medium">Silver</td>
              <td className="p-3">XAG</td>
              <td className="p-3">50x</td>
              <td className="p-3 text-amber-400">Commodity</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Plus dozens more crypto pairs. All trade 24/7, no KYC, with deep
        liquidity on Hyperliquid.
      </p>

      <h2>Risk Disclosure</h2>

      <div className="not-prose my-8 bg-amber-950/50 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-400 mb-2">Risk Disclosure</h4>
            <p className="text-amber-400 text-sm">
              Trading perpetual futures involves significant risk. Leverage
              amplifies both gains and losses—you can lose your entire margin or
              more. Past performance does not guarantee future results. Never
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
        <div className="bg-gradient-to-r from-brand to-brand-hover rounded-2xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-3">
            Ready to Trade Perps on Coincess?
          </h3>
          <p className="text-white/90 mb-6 max-w-lg mx-auto">
            No KYC. Up to 50x leverage. BTC, ETH, oil, gold—24/7. Connect your
            wallet and start in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trade/BTC"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#141620] text-brand font-semibold rounded-full hover:bg-[#1a1d26] transition-colors"
            >
              Trade BTC
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/crypto-leverage-calculator"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#141620]/10 text-white font-semibold rounded-full hover:bg-[#141620]/20 transition-colors border border-white/30"
            >
              <Calculator className="h-5 w-5" />
              Leverage Calculator
            </Link>
          </div>
        </div>
      </div>

      {/* Related articles */}
      <div className="not-prose mt-12 space-y-4">
        <h3 className="font-bold text-white">Related Articles</h3>

        <Link
          href="/blog/best-no-kyc-crypto-exchanges-2026"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              Best No-KYC Crypto Exchanges in 2026
            </h4>
            <p className="text-gray-300 text-sm">
              Trade swaps, perpetuals, and commodities privately—no ID required
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
              Geopolitics, supply shocks, and trading oil perps on Coincess
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>

        <Link
          href="/blog/crypto-101-first-coin-5-minutes"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              Crypto 101: Get Your First Coin in Under 5 Minutes
            </h4>
            <p className="text-gray-300 text-sm">
              New to crypto? Get set up before you trade perps
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>
      </div>
    </BlogPostLayout>
  )
}
