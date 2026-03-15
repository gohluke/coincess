import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  DollarSign,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Calculator,
  Zap,
  Shield,
} from "lucide-react"

const post = getBlogPost("cheapest-way-to-buy-bitcoin-2026")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function CheapestWayToBuyBitcoin() {
  return (
    <BlogPostLayout post={post}>
      {/* Opening */}
      <p className="text-xl leading-relaxed">
        Coinbase charges up to 1.5% per trade — that's $15 on every $1,000. On Coincess, the same
        trade costs $0.50. Here's how to stop overpaying for Bitcoin.
      </p>

      <h2>What You're Really Paying on Coinbase</h2>

      <p>
        Coinbase offers two main experiences: Simple (beginner-friendly) and Advanced (for active
        traders). Both charge more than you might expect.
      </p>

      <div className="not-prose border-none my-8 grid md:grid-cols-2 gap-4">
        <div className="border-none bg-[#141620] rounded-xl p-6">
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-brand" />
            Coinbase Simple
          </h4>
          <p className="text-gray-300 text-sm mb-4">
            ~1.5% spread + fee built into the price. No separate fee line item — it's baked into the
            quote.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">$1,000 BTC purchase</span>
              <span className="text-white font-medium">~$15 fee</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#1a1d26]">
              <span className="text-gray-300">You receive</span>
              <span className="text-white font-medium">~$985 worth of BTC</span>
            </div>
          </div>
        </div>
        <div className="border-none bg-[#141620] rounded-xl p-6">
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand" />
            Coinbase Advanced
          </h4>
          <p className="text-gray-300 text-sm mb-4">
            0.4% maker / 0.6% taker. Network fees (gas) on top when you withdraw.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">$1,000 BTC purchase (taker)</span>
              <span className="text-white font-medium">~$6 fee</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Network withdrawal</span>
              <span className="text-gray-300">~$2–5</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#1a1d26]">
              <span className="text-gray-300">Total cost</span>
              <span className="text-white font-medium">~$8–11</span>
            </div>
          </div>
        </div>
      </div>

      <h2>Fee Comparison: Every Major Exchange</h2>

      <div className="not-prose border-none my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="text-left p-4 font-semibold text-white border-none">Exchange</th>
              <th className="text-left p-4 font-semibold text-white border-none">Fee for $1,000 BTC</th>
              <th className="text-left p-4 font-semibold text-white border-none">Account Required</th>
              <th className="text-left p-4 font-semibold text-white border-none">KYC Required</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-4 border-none text-gray-200">Coinbase</td>
              <td className="p-4 border-none text-gray-300">$15.00 (1.5%)</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Binance</td>
              <td className="p-4 border-none text-gray-300">$1.00 (0.1%)</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Kraken</td>
              <td className="p-4 border-none text-gray-300">$2.60 (0.26%)</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Robinhood</td>
              <td className="p-4 border-none text-gray-300">$0 (PFOF)</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr className="bg-brand/10">
              <td className="p-4 border-none text-white font-medium">Coincess</td>
              <td className="p-4 border-none text-brand font-medium">$0.50 (0.05%)</td>
              <td className="p-4 border-none text-gray-200">No</td>
              <td className="p-4 border-none text-gray-200">No</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>How Coincess Keeps Fees at 0.05%</h2>

      <p>
        Coincess isn't a company with an office and a compliance department. It's a frontend built
        on Hyperliquid — a decentralized exchange (DEX) with minimal overhead.
      </p>

      <ul>
        <li>
          <strong>Built on Hyperliquid DEX</strong> — Decentralized infrastructure means no
          centralized servers, custody, or middlemen to fund.
        </li>
        <li>
          <strong>No company, no office, no compliance department</strong> — Traditional exchanges
          pass KYC, legal, and operational costs to you. Coincess has none of that.
        </li>
        <li>
          <strong>Builder fee model</strong> — A flat 5 basis points (0.05%) goes to the protocol.
          That's it.
        </li>
        <li>
          <strong>Self-custody</strong> — Your keys, your coins. No custodial infrastructure, no
          insurance premiums, no withdrawal delays.
        </li>
      </ul>

      <h2>How to Buy Bitcoin on Coincess</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            1
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Go to coincess.com/buy and connect your wallet</h4>
            <p className="text-gray-300 text-sm">
              No signup. Connect MetaMask, Rabby, or any Web3 wallet. Your keys stay with you.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            2
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Select BTC (it's the default)</h4>
            <p className="text-gray-300 text-sm">
              BTC is preselected. You can also buy ETH, SOL, HYPE, and 50+ other tokens.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            3
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Enter amount, click Buy</h4>
            <p className="text-gray-300 text-sm">
              Type how much USDC you want to spend. Confirm the swap. BTC lands in your wallet.
            </p>
          </div>
        </div>
      </div>

      <h2>How Much Can You Save?</h2>

      <div className="not-prose border-none my-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141620] rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">$100/month DCA</p>
          <p className="text-2xl font-bold text-white">$18/year</p>
          <p className="text-gray-300 text-sm mt-1">saved vs Coinbase</p>
        </div>
        <div className="bg-[#141620] rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">$1,000 purchase</p>
          <p className="text-2xl font-bold text-white">$14.50</p>
          <p className="text-gray-300 text-sm mt-1">saved</p>
        </div>
        <div className="bg-[#141620] rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">$10,000 purchase</p>
          <p className="text-2xl font-bold text-white">$145</p>
          <p className="text-gray-300 text-sm mt-1">saved</p>
        </div>
        <div className="bg-[#141620] rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">$100,000 portfolio</p>
          <p className="text-2xl font-bold text-white">$1,450</p>
          <p className="text-gray-300 text-sm mt-1">saved</p>
        </div>
      </div>

      <h2>The Catch: You Need USDC First</h2>

      <p>
        Coincess is a DEX. You swap from your wallet — there's no "deposit USD" button. That means
        you need USDC (or another stablecoin) in your wallet before you can buy Bitcoin.
      </p>

      <p>
        How do you get USDC? Three options:
      </p>

      <ul>
        <li>
          <strong>Bridge from Ethereum</strong> — If you have USDC on Ethereum mainnet, bridge it to
          Hyperliquid (or Arbitrum, then bridge). Takes a few minutes.
        </li>
        <li>
          <strong>Buy on Coinbase or Binance, then withdraw</strong> — Buy USDC with fiat, withdraw
          to your wallet on the right network. You'll pay one CEX fee, but future trades are 0.05%.
        </li>
        <li>
          <strong>Use a fiat on-ramp</strong> — Services like MoonPay or Transak let you buy USDC
          with a card and send it directly to your wallet. Higher fees, but no CEX account.
        </li>
      </ul>

      <p>
        This is the one extra step vs Coinbase. But once you have USDC, every trade after that costs
        a fraction of what centralized exchanges charge.
      </p>

      <h2>Frequently Asked Questions</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand" />
            Is Coincess safe?
          </h4>
          <p className="text-gray-300 text-sm">
            Self-custody means you hold your keys. Coincess never holds your funds. Trades execute
            on Hyperliquid's L1 — your keys, your coins. No counterparty risk beyond the protocol.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            Why is it so much cheaper?
          </h4>
          <p className="text-gray-300 text-sm">
            No KYC overhead, no compliance team, no custodial infrastructure. DEX architecture means
            minimal operational cost — and those savings pass to you.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand" />
            Can I buy other coins too?
          </h4>
          <p className="text-gray-300 text-sm">
            Yes. 50+ tokens including ETH, SOL, HYPE, and many more. Same 0.05% fee across the board.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-brand" />
            What about recurring buys?
          </h4>
          <p className="text-gray-300 text-sm">
            Use the Automate tab for DCA bots. Set a schedule, connect your wallet, and let the bot
            buy Bitcoin (or any token) on autopilot at 0.05% per trade.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose border-none mt-12 flex flex-col sm:flex-row gap-4">
        <Link
          href="/buy"
          className="flex items-center justify-center gap-2 px-8 py-4 bg-brand text-white font-semibold rounded-full hover:opacity-90 transition-opacity"
        >
          <DollarSign className="h-5 w-5" />
          Buy Bitcoin at 0.05%
        </Link>
        <Link
          href="/blog/coinbase-alternative-cheaper-crypto-trading"
          className="flex items-center justify-center gap-2 px-8 py-4 bg-[#141620] text-gray-200 font-semibold rounded-full hover:bg-[#1a1d26] transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          Coinbase Alternative: Trade 30x Cheaper
        </Link>
      </div>
    </BlogPostLayout>
  )
}
