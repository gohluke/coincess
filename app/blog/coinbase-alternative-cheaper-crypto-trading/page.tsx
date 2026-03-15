import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  DollarSign,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Shield,
  Wallet,
  Zap,
  TrendingUp,
  Smartphone,
} from "lucide-react"

const post = getBlogPost("coinbase-alternative-cheaper-crypto-trading")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function CoinbaseAlternativePage() {
  return (
    <BlogPostLayout post={post}>
      {/* Opening */}
      <p className="text-xl leading-relaxed text-gray-200">
        Coinbase is the most popular way to buy crypto — but it&apos;s also one of the most
        expensive. At 1.5% per trade, you&apos;re paying $15 on every $1,000. Coincess offers the
        same simple buy/sell experience at 0.05% — that&apos;s 30x cheaper.
      </p>

      <h2>Coincess vs Coinbase: Side by Side</h2>

      <div className="not-prose border-none my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#141620]">
              <th className="text-left p-4 font-semibold text-white border-none">Feature</th>
              <th className="text-left p-4 font-semibold text-white border-none">Coinbase</th>
              <th className="text-left p-4 font-semibold text-white border-none">Coincess</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#141620]">
              <td className="p-4 border-none text-gray-200">Fees</td>
              <td className="p-4 border-none text-gray-300">1.5% ($15 per $1K)</td>
              <td className="p-4 border-none text-emerald-400 font-medium">0.05% ($0.50 per $1K)</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Account Required</td>
              <td className="p-4 border-none text-gray-300">Yes (email + password)</td>
              <td className="p-4 border-none text-emerald-400 font-medium">No (just connect wallet)</td>
            </tr>
            <tr className="bg-brand/10">
              <td className="p-4 border-none text-gray-200">KYC</td>
              <td className="p-4 border-none text-gray-300">Yes (ID + selfie)</td>
              <td className="p-4 border-none text-emerald-400 font-medium">No</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Time to Start</td>
              <td className="p-4 border-none text-gray-300">1-7 days</td>
              <td className="p-4 border-none text-emerald-400 font-medium">30 seconds</td>
            </tr>
            <tr className="bg-brand/10">
              <td className="p-4 border-none text-gray-200">Custody</td>
              <td className="p-4 border-none text-gray-300">Coinbase holds your crypto</td>
              <td className="p-4 border-none text-emerald-400 font-medium">You hold your crypto</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Markets</td>
              <td className="p-4 border-none text-gray-300">~250 tokens</td>
              <td className="p-4 border-none text-emerald-400 font-medium">279 perps + 50 spot + stocks</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Stocks</td>
              <td className="p-4 border-none text-gray-300">No</td>
              <td className="p-4 border-none text-emerald-400 font-medium">Yes (TSLA, AAPL, etc.)</td>
            </tr>
            <tr className="bg-brand/10">
              <td className="p-4 border-none text-gray-200">Leverage Trading</td>
              <td className="p-4 border-none text-gray-300">No</td>
              <td className="p-4 border-none text-emerald-400 font-medium">Up to 50x</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Network</td>
              <td className="p-4 border-none text-gray-300">Ethereum, various</td>
              <td className="p-4 border-none text-emerald-400 font-medium">Hyperliquid L1</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>The 30x Fee Advantage</h2>

      <p className="text-gray-200">
        Here&apos;s what the fee difference looks like in real numbers — and how much you save by
        switching.
      </p>

      <div className="not-prose border-none my-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141620] rounded-xl p-6 border border-[#1a1d26]">
          <p className="text-gray-400 text-sm mb-2">Buy $100 of BTC</p>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-gray-500" />
            <span className="text-gray-300">Coinbase: $1.50</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-white font-medium">Coincess: $0.05</span>
          </div>
          <p className="text-emerald-400 text-sm font-medium">Save $1.45</p>
        </div>
        <div className="bg-[#141620] rounded-xl p-6 border border-[#1a1d26]">
          <p className="text-gray-400 text-sm mb-2">Buy $1,000 of ETH</p>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-gray-500" />
            <span className="text-gray-300">Coinbase: $15</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-white font-medium">Coincess: $0.50</span>
          </div>
          <p className="text-emerald-400 text-sm font-medium">Save $14.50</p>
        </div>
        <div className="bg-[#141620] rounded-xl p-6 border border-[#1a1d26]">
          <p className="text-gray-400 text-sm mb-2">Monthly DCA $500</p>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-gray-500" />
            <span className="text-gray-300">Coinbase: $90/year</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-white font-medium">Coincess: $3/year</span>
          </div>
          <p className="text-emerald-400 text-sm font-medium">Save $87</p>
        </div>
        <div className="bg-[#141620] rounded-xl p-6 border border-[#1a1d26]">
          <p className="text-gray-400 text-sm mb-2">$50,000 portfolio</p>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-gray-500" />
            <span className="text-gray-300">Coinbase: $750</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-white font-medium">Coincess: $25</span>
          </div>
          <p className="text-emerald-400 text-sm font-medium">Save $725</p>
        </div>
      </div>

      <h2>Same Simple Interface, More Features</h2>

      <p className="text-gray-200">
        Coincess&apos;s <Link href="/buy" className="text-brand hover:underline">/buy</Link> page has
        the same Coinbase-like simplicity: pick a coin, enter an amount, click buy. No charts to
        decode, no order types to learn. If you can use Coinbase, you can use Coincess.
      </p>

      <p className="text-gray-200">
        But Coincess adds more under the hood. The <strong className="text-white">Convert</strong>{" "}
        feature lets you swap between any tokens instantly — BTC to ETH, SOL to HYPE, whatever you
        need. The <strong className="text-white">Stocks</strong> tab gives you access to Tesla,
        Apple, Amazon, and other tokenized equities. And if you want the full pro experience,{" "}
        <Link href="/trade/BTC" className="text-brand hover:underline">/trade</Link> has charts,
        leverage, and advanced order types.
      </p>

      <h2>Self-Custody: Why It Matters</h2>

      <p className="text-gray-200">
        When you buy crypto on Coinbase, Coinbase holds it. Your balance lives in their database.
        They can freeze it, delay withdrawals, or — in the worst case — lose it. The FTX collapse
        reminded everyone: <em>not your keys, not your coins.</em>
      </p>

      <p className="text-gray-200">
        On Coincess, you connect your own wallet. Every trade executes from your wallet to the
        Hyperliquid DEX. Your keys never leave your device. No custodian, no counterparty risk.
        You hold your crypto — and you can withdraw it anytime.
      </p>

      <h2>What Coinbase Does Better</h2>

      <p className="text-gray-200">
        We&apos;re not here to pretend Coincess is perfect for everyone. Coinbase has real
        advantages:
      </p>

      <ul className="text-gray-200">
        <li>
          <strong className="text-white">Fiat on-ramp</strong> — Buy with a bank account or credit
          card. Coincess requires USDC in your wallet first.
        </li>
        <li>
          <strong className="text-white">Earn rewards / staking</strong> — Coinbase offers staking
          and earn programs. Coincess is pure trading.
        </li>
        <li>
          <strong className="text-white">Customer support</strong> — Coinbase has a support team.
          Coincess is a frontend; you&apos;re on your own for help.
        </li>
        <li>
          <strong className="text-white">Insurance</strong> — FDIC for USD, crime insurance for
          custodial crypto. Coincess has none of that.
        </li>
        <li>
          <strong className="text-white">Easier for complete beginners</strong> — If you don&apos;t
          have a wallet yet, Coinbase is the simpler path. Create an account, add a card, buy.
        </li>
      </ul>

      <h2>How to Switch from Coinbase to Coincess</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            1
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Withdraw USDC from Coinbase to your wallet</h4>
            <p className="text-gray-300 text-sm">
              Send USDC to your MetaMask, Rabby, or any Web3 wallet. Choose the right network
              (Hyperliquid or Arbitrum).
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            2
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Bridge USDC to Hyperliquid (or use Arbitrum)</h4>
            <p className="text-gray-300 text-sm">
              If you&apos;re on another chain, bridge USDC to Hyperliquid. Or deposit on Arbitrum
              and bridge from there.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            3
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Go to coincess.com/buy and trade</h4>
            <p className="text-gray-300 text-sm">
              Connect your wallet, pick a coin, enter the amount, click Buy. Same flow as Coinbase —
              at 0.05% instead of 1.5%.
            </p>
          </div>
        </div>
      </div>

      <h2>Frequently Asked Questions</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            Is Coincess a company?
          </h4>
          <p className="text-gray-300 text-sm">
            Coincess is a trading interface built on Hyperliquid DEX. It&apos;s not a centralized
            exchange — it&apos;s a frontend that connects your wallet directly to Hyperliquid&apos;s
            on-chain order book.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-brand" />
            What if I need to cash out to my bank?
          </h4>
          <p className="text-gray-300 text-sm">
            Withdraw USDC from your wallet to Coinbase, then sell USDC for USD and withdraw to your
            bank. Coinbase remains the best fiat off-ramp for most users.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-brand" />
            Can I use Coincess on mobile?
          </h4>
          <p className="text-gray-300 text-sm">
            Yes. Coincess is a mobile-first PWA — add it to your home screen and use it like an app.
            Connect your mobile wallet (MetaMask mobile, Rabby, etc.) and trade on the go.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand" />
            Do I still need Coinbase?
          </h4>
          <p className="text-gray-300 text-sm">
            For fiat on/off-ramp, yes — Coinbase is still the easiest way to move between USD and
            crypto. For trading, no. Once you have USDC in your wallet, Coincess is 30x cheaper.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose border-none mt-12 flex flex-col sm:flex-row gap-4">
        <Link
          href="/buy"
          className="flex items-center justify-center gap-2 px-8 py-4 bg-brand text-white font-semibold rounded-full hover:opacity-90 transition-opacity"
        >
          <TrendingUp className="h-5 w-5" />
          Try Coincess Now — 0.05% Fees
        </Link>
        <Link
          href="/blog/cheapest-way-to-buy-bitcoin-2026"
          className="flex items-center justify-center gap-2 px-8 py-4 bg-[#141620] text-gray-200 font-semibold rounded-full hover:bg-[#1a1d26] transition-colors border border-[#1a1d26]"
        >
          <ArrowRight className="h-5 w-5" />
          Cheapest Way to Buy Bitcoin 2026
        </Link>
      </div>
    </BlogPostLayout>
  )
}
