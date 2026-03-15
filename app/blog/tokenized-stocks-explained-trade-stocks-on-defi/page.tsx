import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  Clock,
  Shield,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Zap,
} from "lucide-react"

const post = getBlogPost("tokenized-stocks-explained-trade-stocks-on-defi")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function TokenizedStocksExplained() {
  return (
    <BlogPostLayout post={post}>
      {/* Opening */}
      <p className="text-xl leading-relaxed text-gray-200">
        Tokenized stocks are digital tokens that track the price of real-world
        stocks — and you can trade them 24 hours a day, 7 days a week, directly
        from your crypto wallet. No brokerage account. No market hours. No
        waiting for settlement. For traders who want exposure to Tesla, Apple,
        or Amazon without the friction of traditional finance, this is a
        game-changer.
      </p>

      <h2>What Are Tokenized Stocks?</h2>

      <p className="text-gray-200">
        A tokenized stock is a crypto token whose price is pegged to a real
        stock via oracle price feeds. When Tesla stock moves on the NYSE, the
        TSLA token moves with it. When Apple hits a new high, the AAPL token
        reflects that in real time. These tokens trade on decentralized
        exchanges just like any other crypto — you swap USDC for TSLA, hold it
        in your wallet, and sell whenever you want.
      </p>

      <p className="text-gray-200">
        Unlike traditional stock ownership, you don&apos;t hold shares in a
        brokerage. You hold a synthetic token that tracks the price. No
        dividends (typically), no voting rights — pure price exposure. For many
        traders, that&apos;s exactly what they want: the ability to go long or
        short on big-name stocks without the paperwork.
      </p>

      <h2>How HIP-3 Works on Hyperliquid</h2>

      <p className="text-gray-200">
        Hyperliquid&apos;s HIP-3 protocol creates spot tokens for stocks. These
        aren&apos;t perpetual futures — they&apos;re actual spot assets you can
        buy and hold. Here&apos;s how it works:
      </p>

      <div className="not-prose border-none my-8 bg-brand/5 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-brand" />
          <h3 className="text-lg font-bold text-white">HIP-3 Spot Stock Tokens</h3>
        </div>
        <ul className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Tokens are backed by oracle price feeds</strong>{" "}
              from real markets — trusted off-chain sources keep on-chain prices
              aligned with NYSE, NASDAQ, and other exchanges.
            </span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Trade on Hyperliquid&apos;s spot DEX</strong>{" "}
              — the same infrastructure as crypto. No separate app, no different
              UI. It&apos;s all one ecosystem.
            </span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">No leverage, no funding rates</strong>{" "}
              — pure spot ownership. Buy and hold. Your exposure moves 1:1 with
              the underlying stock.
            </span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Settlement is instant</strong> — not
              T+2 like traditional stocks. Your tokens land in your wallet the
              moment the trade executes.
            </span>
          </li>
        </ul>
      </div>

      <h2>Why Trade Stocks 24/7?</h2>

      <p className="text-gray-200">
        Traditional stock markets have a fundamental limitation: they&apos;re
        only open when the exchange is open. If news breaks at 10pm on a
        Saturday, you wait until Monday. With tokenized stocks, that constraint
        disappears.
      </p>

      <div className="not-prose border-none my-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#141620] rounded-xl p-5">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-400" />
              Traditional Markets
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2 text-red-300/90">
                <span className="text-red-400">•</span>
                Open 9:30 AM - 4 PM ET only
              </li>
              <li className="flex gap-2 text-red-300/90">
                <span className="text-red-400">•</span>
                Closed weekends and holidays
              </li>
              <li className="flex gap-2 text-red-300/90">
                <span className="text-red-400">•</span>
                T+2 settlement (2 business days)
              </li>
              <li className="flex gap-2 text-red-300/90">
                <span className="text-red-400">•</span>
                Requires brokerage account + KYC
              </li>
            </ul>
          </div>
          <div className="bg-[#141620] rounded-xl p-5">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-400" />
              On-Chain Stocks
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2 text-emerald-300/90">
                <span className="text-emerald-400">•</span>
                Open 24/7/365
              </li>
              <li className="flex gap-2 text-emerald-300/90">
                <span className="text-emerald-400">•</span>
                Trade on weekends, holidays, after-hours
              </li>
              <li className="flex gap-2 text-emerald-300/90">
                <span className="text-emerald-400">•</span>
                Instant settlement
              </li>
              <li className="flex gap-2 text-emerald-300/90">
                <span className="text-emerald-400">•</span>
                Just need a crypto wallet
              </li>
            </ul>
          </div>
        </div>
      </div>

      <h2>Available Stocks on Coincess</h2>

      <p className="text-gray-200">
        Coincess gives you access to tokenized stocks via the /buy page. Here&apos;s
        what&apos;s available:
      </p>

      <div className="not-prose border-none my-8">
        <div className="bg-[#141620] rounded-xl p-6">
          <h4 className="font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand" />
            Stocks &amp; ETFs
          </h4>
          <ul className="space-y-2 text-gray-300">
            <li>
              <strong className="text-white">TSLA</strong> — Tesla. Electric
              vehicles, energy, autonomy.
            </li>
            <li>
              <strong className="text-white">AAPL</strong> — Apple. Tech giant,
              iPhone, services.
            </li>
            <li>
              <strong className="text-white">GOOGL</strong> — Alphabet/Google.
              Search, cloud, AI.
            </li>
            <li>
              <strong className="text-white">AMZN</strong> — Amazon. E-commerce,
              AWS, logistics.
            </li>
            <li>
              <strong className="text-white">META</strong> — Meta. Social media,
              VR, AI.
            </li>
            <li>
              <strong className="text-white">MSFT</strong> — Microsoft. Software,
              cloud, gaming.
            </li>
            <li>
              <strong className="text-white">HOOD</strong> — Robinhood. Fintech,
              retail investing.
            </li>
            <li>
              <strong className="text-white">SPY</strong> — S&amp;P 500 ETF. Broad
              market exposure.
            </li>
            <li>
              <strong className="text-white">QQQ</strong> — Nasdaq-100 ETF. Tech-heavy
              index.
            </li>
            <li>
              <strong className="text-white">GLD</strong> — Gold ETF. Precious
              metals exposure.
            </li>
            <li>
              <strong className="text-white">SLV</strong> — Silver ETF. Industrial
              and precious metal.
            </li>
          </ul>
        </div>
      </div>

      <h2>Risks to Consider</h2>

      <p className="text-gray-200">
        Tokenized stocks are powerful, but they come with trade-offs. Here&apos;s
        what to keep in mind:
      </p>

      <div className="not-prose border-none my-8 bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h4 className="font-bold text-amber-400">Important Risks</h4>
        </div>
        <ul className="space-y-2 text-amber-200/90 text-sm">
          <li>
            <strong className="text-amber-300">Liquidity may be lower</strong>{" "}
            than traditional markets — especially for less popular tickers.
            Slippage can be higher on large orders.
          </li>
          <li>
            <strong className="text-amber-300">Oracle price feeds have slight
            delays</strong> — prices track real markets but aren&apos;t always
            perfectly synced. During volatile periods, brief divergences can
            occur.
          </li>
          <li>
            <strong className="text-amber-300">Smart contract risk</strong> —
            though Hyperliquid is battle-tested with billions in volume, any
            on-chain system carries technical risk. Audits and track record
            matter.
          </li>
          <li>
            <strong className="text-amber-300">Regulatory uncertainty</strong> —
            tokenized stocks exist in a gray area. Rules vary by jurisdiction.
            This is not securities advice — do your own research.
          </li>
        </ul>
      </div>

      <h2>How to Get Started</h2>

      <p className="text-gray-200">
        Getting started with tokenized stocks on Coincess takes three steps:
      </p>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-brand">1</span>
          </div>
          <div>
            <h4 className="font-bold text-white">Connect your wallet</h4>
            <p className="text-gray-300 text-sm">
              MetaMask, Rabby, or any Web3 wallet. No signup, no KYC.
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-brand">2</span>
          </div>
          <div>
            <h4 className="font-bold text-white">Go to /buy</h4>
            <p className="text-gray-300 text-sm">
              Select the stock token you want (TSLA, AAPL, etc.) and the amount.
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-brand">3</span>
          </div>
          <div>
            <h4 className="font-bold text-white">Execute the trade</h4>
            <p className="text-gray-300 text-sm">
              Confirm the swap. Tokens land in your wallet instantly.
            </p>
          </div>
        </div>
      </div>

      <h2>Frequently Asked Questions</h2>

      <div className="not-prose border-none my-8 space-y-6">
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            Do tokenized stocks pay dividends?
          </h4>
          <p className="text-gray-300 text-sm">
            Generally no. Tokenized stocks track price only. They don&apos;t
            typically distribute dividends. If you want dividend exposure, you
            may need to use traditional brokers or specialized products.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            Are tokenized stocks legal?
          </h4>
          <p className="text-gray-300 text-sm">
            It varies by jurisdiction. Some countries treat them as securities;
            others don&apos;t. This article is not legal or securities advice.
            Consult a professional in your region before trading.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            What happens during market hours vs after-hours?
          </h4>
          <p className="text-gray-300 text-sm">
            Prices still move based on global markets and oracle feeds. When
            traditional markets are closed, prices may be less volatile or
            reflect international trading. Oracle feeds typically update based on
            the primary exchange for each stock.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            Can I short tokenized stocks?
          </h4>
          <p className="text-gray-300 text-sm">
            On the spot market, no — you can only buy. But you can short them as
            perpetuals on the /trade page. Hyperliquid offers TSLA, AAPL, and
            other stock perps with leverage. Spot = long only. Perps = long or
            short.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose border-none mt-12">
        <div className="bg-[#141620] rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">
            Trade Tokenized Stocks Now
          </h3>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Buy TSLA, AAPL, AMZN, and more — 24/7, no broker, no KYC. Connect
            your wallet and start trading.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <Link
              href="/buy"
              className="inline-flex items-center gap-2 px-8 py-3 bg-brand text-white font-semibold rounded-full hover:bg-brand-hover transition-colors"
            >
              Trade Tokenized Stocks
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/blog/how-to-buy-tesla-apple-stock-with-crypto"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#1a1d26] text-gray-200 font-semibold rounded-full hover:bg-[#252830] transition-colors"
            >
              How to Buy Tesla &amp; Apple with Crypto
            </Link>
          </div>
        </div>
      </div>
    </BlogPostLayout>
  )
}
