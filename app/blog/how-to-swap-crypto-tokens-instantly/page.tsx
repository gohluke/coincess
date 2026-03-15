import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  ArrowUpDown,
  ArrowRight,
  CheckCircle2,
  Zap,
  DollarSign,
  Repeat,
  Wallet,
} from "lucide-react"

const post = getBlogPost("how-to-swap-crypto-tokens-instantly")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function HowToSwapCryptoTokensInstantlyPage() {
  return (
    <BlogPostLayout post={post}>
      {/* Opening */}
      <p className="text-xl leading-relaxed text-gray-200">
        Want to convert your Bitcoin into Ethereum? Or swap SOL for HYPE? On Coincess, token swaps
        take seconds — no centralized exchange, no withdrawal delays, no KYC.
      </p>

      <h2>How Token Swaps Work on Coincess</h2>

      <p className="text-gray-200">
        The <strong className="text-white">Convert</strong> feature on{" "}
        <Link href="/buy" className="text-brand hover:underline">coincess.com/buy</Link> lets you
        swap between any supported tokens in a few clicks. Here&apos;s the flow:
      </p>

      <ul className="text-gray-200">
        <li>Go to coincess.com/buy and click the &quot;Convert&quot; tab</li>
        <li>Select the token you have (From) and the token you want (To)</li>
        <li>Enter the amount, then click Convert</li>
      </ul>

      <p className="text-gray-200">
        Behind the scenes, Coincess executes two market orders routed through USDC on Hyperliquid.
        All Hyperliquid spot pairs are quoted in USDC, so your swap is really: sell Token A for
        USDC, then buy Token B with USDC. It happens in one atomic flow — you see the result
        instantly.
      </p>

      {/* Flow diagram */}
      <div className="not-prose border-none my-8 p-6 bg-[#141620] rounded-xl">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          <span className="px-4 py-2 bg-[#1a1d26] rounded-lg text-white font-medium">Token A</span>
          <ArrowRight className="h-5 w-5 text-brand flex-shrink-0" />
          <span className="px-4 py-2 bg-brand/20 rounded-lg text-brand font-medium">USDC</span>
          <ArrowRight className="h-5 w-5 text-brand flex-shrink-0" />
          <span className="px-4 py-2 bg-[#1a1d26] rounded-lg text-white font-medium">Token B</span>
        </div>
        <p className="text-center text-gray-400 text-sm mt-3">
          Two market orders: sell → USDC → buy
        </p>
      </div>

      <h2>Step-by-Step: Swap BTC for ETH</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            1
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Go to coincess.com/buy and select the Convert tab</h4>
            <p className="text-gray-300 text-sm">
              Open the Buy page and switch from &quot;Buy&quot; or &quot;Sell&quot; to the
              &quot;Convert&quot; tab. This is where you swap between tokens.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            2
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Set &quot;From&quot; to BTC and &quot;To&quot; to ETH</h4>
            <p className="text-gray-300 text-sm">
              Use the dropdowns to choose Bitcoin as the source token and Ethereum as the
              destination. You can swap any supported pair.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            3
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Enter the amount of BTC to swap</h4>
            <p className="text-gray-300 text-sm">
              Type the amount you want to convert. Use the percentage presets (25%, 50%, 75%, 100%)
              to quickly select a portion of your balance.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            4
          </span>
          <div>
            <h4 className="font-bold text-white mb-1">Review the rate and click Convert</h4>
            <p className="text-gray-300 text-sm">
              The live conversion rate is shown on screen. Check how much ETH you&apos;ll receive,
              then confirm. The swap executes in seconds.
            </p>
          </div>
        </div>
      </div>

      <h2>Supported Tokens</h2>

      <p className="text-gray-200">
        You can swap any token available on the <Link href="/buy" className="text-brand hover:underline">/buy</Link> page.
        That includes major crypto: <strong className="text-white">BTC</strong>,{" "}
        <strong className="text-white">ETH</strong>, <strong className="text-white">SOL</strong>,{" "}
        <strong className="text-white">HYPE</strong>, <strong className="text-white">PURR</strong>,{" "}
        <strong className="text-white">LINK</strong>, and dozens more. Plus tokenized stocks like{" "}
        <strong className="text-white">TSLA</strong>, <strong className="text-white">AAPL</strong>,{" "}
        <strong className="text-white">AMZN</strong>, and <strong className="text-white">MSFT</strong>.
      </p>

      <p className="text-gray-200">
        The best part: you can swap crypto for stocks and vice versa. Convert TSLA to BTC, or ETH
        to AAPL. No separate brokerage, no KYC — just one interface for 50+ spot assets.
      </p>

      <h2>Coincess Convert vs Other Swap Options</h2>

      <div className="not-prose border-none my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#141620]">
              <th className="text-left p-4 font-semibold text-white border-none"></th>
              <th className="text-left p-4 font-semibold text-white border-none">Coincess Convert</th>
              <th className="text-left p-4 font-semibold text-white border-none">Uniswap</th>
              <th className="text-left p-4 font-semibold text-white border-none">1inch</th>
              <th className="text-left p-4 font-semibold text-white border-none">Coinbase</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#141620]">
              <td className="p-4 border-none text-gray-200">Speed</td>
              <td className="p-4 border-none text-emerald-400 font-medium">Seconds</td>
              <td className="p-4 border-none text-gray-300">15–30 sec</td>
              <td className="p-4 border-none text-gray-300">15–30 sec</td>
              <td className="p-4 border-none text-gray-300">Instant</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Fees</td>
              <td className="p-4 border-none text-emerald-400 font-medium">0.05%</td>
              <td className="p-4 border-none text-gray-300">0.3%+ gas</td>
              <td className="p-4 border-none text-gray-300">0%+ gas</td>
              <td className="p-4 border-none text-gray-300">1.5%</td>
            </tr>
            <tr className="bg-[#141620]">
              <td className="p-4 border-none text-gray-200">Gas Fees</td>
              <td className="p-4 border-none text-emerald-400 font-medium">None (Hyperliquid)</td>
              <td className="p-4 border-none text-gray-300">$5–50 (ETH)</td>
              <td className="p-4 border-none text-gray-300">$5–50</td>
              <td className="p-4 border-none text-gray-300">None</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">KYC</td>
              <td className="p-4 border-none text-emerald-400 font-medium">No</td>
              <td className="p-4 border-none text-gray-300">No</td>
              <td className="p-4 border-none text-gray-300">No</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr className="bg-[#141620]">
              <td className="p-4 border-none text-gray-200">Token Variety</td>
              <td className="p-4 border-none text-emerald-400 font-medium">50+ spot</td>
              <td className="p-4 border-none text-gray-300">Thousands</td>
              <td className="p-4 border-none text-gray-300">Thousands</td>
              <td className="p-4 border-none text-gray-300">~250</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-200">Stocks</td>
              <td className="p-4 border-none text-emerald-400 font-medium">Yes</td>
              <td className="p-4 border-none text-gray-300">No</td>
              <td className="p-4 border-none text-gray-300">No</td>
              <td className="p-4 border-none text-gray-300">No</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Tips for Better Swaps</h2>

      <div className="not-prose border-none my-8 space-y-3">
        <div className="flex items-start gap-3 p-4 bg-[#141620] rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-200 font-medium">Swap during high-volume hours</p>
            <p className="text-gray-400 text-sm">Better liquidity means tighter spreads and better fills.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-[#141620] rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-200 font-medium">Use percentage presets (25%, 50%, 75%, 100%)</p>
            <p className="text-gray-400 text-sm">Quick way to swap a portion of your balance without typing.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-[#141620] rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-200 font-medium">Check the conversion rate before confirming</p>
            <p className="text-gray-400 text-sm">The live rate is displayed — make sure it looks right before you click.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-[#141620] rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-200 font-medium">Remember: two trades happen (sell → USDC → buy)</p>
            <p className="text-gray-400 text-sm">Fees apply twice at 0.05% each — still just 0.1% total.</p>
          </div>
        </div>
      </div>

      <h2>Frequently Asked Questions</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Repeat className="h-5 w-5 text-brand" />
            Why does it route through USDC?
          </h4>
          <p className="text-gray-300 text-sm">
            All Hyperliquid spot pairs are quoted in USDC. There&apos;s no direct BTC/ETH pair on
            Hyperliquid spot — so the swap executes as sell → USDC → buy. It&apos;s atomic and
            instant from your perspective.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            Is there slippage?
          </h4>
          <p className="text-gray-300 text-sm">
            Market orders have minimal slippage on liquid pairs like BTC, ETH, and SOL. For smaller
            or less liquid tokens, you might see slightly more. The conversion rate shown is based
            on current order book depth.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-brand" />
            Can I swap stocks for crypto?
          </h4>
          <p className="text-gray-300 text-sm">
            Yes! Convert TSLA to BTC, AAPL to ETH, or any combination. The Convert tab supports all
            assets on the /buy page — crypto and tokenized stocks alike.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-brand" />
            What&apos;s the minimum swap amount?
          </h4>
          <p className="text-gray-300 text-sm">
            It depends on the token. For most pairs, a few dollars is enough. Very small amounts
            might not fill well — check the order book or try a slightly larger amount.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose border-none mt-12 flex flex-col sm:flex-row gap-4">
        <Link
          href="/buy"
          className="flex items-center justify-center gap-2 px-8 py-4 bg-brand text-white font-semibold rounded-full hover:opacity-90 transition-opacity"
        >
          <Wallet className="h-5 w-5" />
          Start Swapping Tokens
        </Link>
        <Link
          href="/blog/spot-trading-vs-futures-which-is-better-beginners"
          className="flex items-center justify-center gap-2 px-8 py-4 bg-[#141620] text-gray-200 font-semibold rounded-full hover:bg-[#1a1d26] transition-colors border border-[#1a1d26]"
        >
          <ArrowRight className="h-5 w-5" />
          Spot Trading vs Futures: Which Is Better for Beginners
        </Link>
      </div>
    </BlogPostLayout>
  )
}
