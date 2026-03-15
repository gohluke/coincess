import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  Wallet,
  Clock,
  Shield,
  Globe,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Building2,
} from "lucide-react"

const post = getBlogPost("how-to-buy-tesla-apple-stock-with-crypto")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function HowToBuyTeslaAppleStockWithCrypto() {
  return (
    <BlogPostLayout post={post}>
      <p className="text-xl leading-relaxed">
        <strong>
          You can now buy Tesla, Apple, Amazon, and Microsoft stock directly from
          your crypto wallet — no brokerage account, no identity verification,
          no waiting.
        </strong>{" "}
        This is possible through tokenized stocks on Hyperliquid, the dominant
        decentralized exchange for perpetual trading. Coincess gives you a
        simple interface to buy and sell these synthetic stock tokens from the
        /buy page — no broker, no KYC, 24/7.
      </p>

      <h2>What Are Tokenized Stocks?</h2>

      <p>
        Tokenized stocks are synthetic tokens that track real stock prices
        on-chain. On Hyperliquid, they&apos;re powered by the{" "}
        <strong>HIP-3 protocol</strong> — oracle feeds from trusted off-chain
        sources keep the on-chain price aligned with the real-world benchmark.
        When Tesla trades at $392 on the NYSE, the TSLA token on Hyperliquid
        tracks that price in real time.
      </p>

      <p>
        These are <strong>spot tokens</strong>, not derivatives with leverage.
        You buy the token and hold it — your exposure moves 1:1 with the
        underlying stock. No funding rates, no liquidation risk from leverage.
        Just straightforward price exposure to some of the world&apos;s largest
        companies.
      </p>

      <h2>Which Stocks Can You Buy?</h2>

      <div className="not-prose border-none my-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="p-4 text-left font-semibold text-gray-200">
                Stock
              </th>
              <th className="p-4 text-left font-semibold text-gray-200">
                Symbol
              </th>
              <th className="p-4 text-left font-semibold text-gray-200">
                ~Price
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Tesla</td>
              <td className="p-4 text-gray-300 font-mono">TSLA</td>
              <td className="p-4 text-emerald-400">~$392</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Apple</td>
              <td className="p-4 text-gray-300 font-mono">AAPL</td>
              <td className="p-4 text-emerald-400">~$252</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Alphabet / Google</td>
              <td className="p-4 text-gray-300 font-mono">GOOGL</td>
              <td className="p-4 text-emerald-400">~$303</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Amazon</td>
              <td className="p-4 text-gray-300 font-mono">AMZN</td>
              <td className="p-4 text-emerald-400">~$208</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Meta</td>
              <td className="p-4 text-gray-300 font-mono">META</td>
              <td className="p-4 text-emerald-400">~$659</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Microsoft</td>
              <td className="p-4 text-gray-300 font-mono">MSFT</td>
              <td className="p-4 text-emerald-400">~$399</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Robinhood</td>
              <td className="p-4 text-gray-300 font-mono">HOOD</td>
              <td className="p-4 text-emerald-400">~$75</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">S&P 500 ETF</td>
              <td className="p-4 text-gray-300 font-mono">SPY</td>
              <td className="p-4 text-emerald-400">~$647</td>
            </tr>
            <tr className="border-t border-[#1a1d26]">
              <td className="p-4 font-medium text-white">Nasdaq 100 ETF</td>
              <td className="p-4 text-gray-300 font-mono">QQQ</td>
              <td className="p-4 text-emerald-400">~$596</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>How to Buy Stock Tokens on Coincess</h2>

      <p>
        Buying Tesla, Apple, or any of the stocks above takes three steps. No
        signup, no verification — just connect your wallet and go.
      </p>

      <div className="not-prose border-none my-10">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#141620] rounded-xl p-6">
            <div className="w-14 h-14 bg-brand rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-white">1</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-sm text-gray-300">
              Connect MetaMask or any EVM-compatible wallet to Coincess. No
              account creation, no email, no ID.
            </p>
          </div>
          <div className="bg-[#141620] rounded-xl p-6">
            <div className="w-14 h-14 bg-brand rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-white">2</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Switch to the Stocks Tab
            </h3>
            <p className="text-sm text-gray-300">
              Go to{" "}
              <Link href="/buy" className="text-brand hover:underline">
                coincess.com/buy
              </Link>
              , then click the &quot;Stocks&quot; tab to see TSLA, AAPL, AMZN,
              and the rest.
            </p>
          </div>
          <div className="bg-[#141620] rounded-xl p-6">
            <div className="w-14 h-14 bg-brand rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-white">3</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Buy</h3>
            <p className="text-sm text-gray-300">
              Enter the USD amount you want to spend, pick your stock, and click
              Buy. Tokens land in your wallet instantly.
            </p>
          </div>
        </div>
      </div>

      <h2>Why Buy Stocks On-Chain?</h2>

      <div className="not-prose border-none my-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#141620] rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-3">
              <Clock className="h-5 w-5 text-brand" />
            </div>
            <h4 className="font-bold text-white mb-2">24/7 Trading</h4>
            <p className="text-sm text-gray-300">
              Stock markets close at 4pm ET. Crypto doesn&apos;t. React to
              earnings, news, or macro events anytime — weekends, holidays,
              3am.
            </p>
          </div>
          <div className="bg-[#141620] rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-3">
              <Shield className="h-5 w-5 text-brand" />
            </div>
            <h4 className="font-bold text-white mb-2">No Broker Required</h4>
            <p className="text-sm text-gray-300">
              No Robinhood, no Schwab, no Interactive Brokers. No account
              approval, no margin agreements, no waiting.
            </p>
          </div>
          <div className="bg-[#141620] rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-3">
              <Globe className="h-5 w-5 text-brand" />
            </div>
            <h4 className="font-bold text-white mb-2">Global Access</h4>
            <p className="text-sm text-gray-300">
              Anyone with a wallet, anywhere in the world. No residency
              restrictions, no &quot;not available in your country&quot;.
            </p>
          </div>
          <div className="bg-[#141620] rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-3">
              <Wallet className="h-5 w-5 text-brand" />
            </div>
            <h4 className="font-bold text-white mb-2">Self-Custody</h4>
            <p className="text-sm text-gray-300">
              Your tokens, your wallet. No custodian can freeze your account or
              restrict your access.
            </p>
          </div>
        </div>
      </div>

      <h2>Fees Comparison</h2>

      <p>
        How does Coincess stack up against traditional brokers and crypto
        exchanges?
      </p>

      <div className="not-prose border-none my-8">
        <div className="bg-[#141620] rounded-xl p-6">
          <ul className="space-y-3 text-gray-200">
            <li className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Robinhood:</strong> Commission-free
                on paper, but payment for order flow and hidden spreads eat into
                your fills. You&apos;re the product.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Coinbase:</strong> Up to 1.5% per
                trade for retail. Adds up fast on larger orders.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-400">Coincess:</strong> 0.05%
                builder fee. No account, no KYC, no hidden costs. This is the
                cheapest way to get stock exposure with crypto.
              </div>
            </li>
          </ul>
        </div>
      </div>

      <h2>Frequently Asked Questions</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            Are these real stocks?
          </h4>
          <p className="text-sm text-gray-300">
            They&apos;re synthetic tokens that track real stock prices via
            oracle feeds. You get the same price exposure as the underlying
            equity, but you hold a token in your wallet — not a share in a
            brokerage account.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">Can I trade 24/7?</h4>
          <p className="text-sm text-gray-300">
            Yes. Unlike traditional markets that close at 4pm ET, these tokens
            trade around the clock. React to weekend news, earnings, or macro
            events whenever they happen.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">Do I need KYC?</h4>
          <p className="text-sm text-gray-300">
            No. Just a crypto wallet. No ID upload, no address verification, no
            waiting for approval. Connect and trade.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">
            What if I want to sell?
          </h4>
          <p className="text-sm text-gray-300">
            Same process in reverse. Go to coincess.com/buy, switch to the Sell
            tab, select your stock token, enter the amount, and click Sell. You
            get USDC (or your chosen output) back into your wallet.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose border-none mt-12">
        <div className="bg-[#141620] rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">
            Start Trading Stocks
          </h3>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Buy Tesla, Apple, and more — no broker needed.
          </p>
          <Link
            href="/buy"
            className="inline-flex items-center gap-2 px-8 py-3 bg-brand text-white font-semibold rounded-full hover:bg-brand-hover transition-colors"
          >
            Start Trading Stocks
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </BlogPostLayout>
  )
}
