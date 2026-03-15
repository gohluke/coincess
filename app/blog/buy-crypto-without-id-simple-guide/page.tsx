import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { CoinLogo } from "@/components/CoinLogo"
import { getBlogPost } from "@/lib/blog-posts"
import {
  Wallet,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle2,
  UserX,
  Zap,
  Lock,
} from "lucide-react"

const post = getBlogPost("buy-crypto-without-id-simple-guide")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

const tokens = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "HYPE", name: "Hyperliquid" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "PURR", name: "PURR" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AAPL", name: "Apple" },
]

export default function BuyCryptoWithoutIdSimpleGuide() {
  return (
    <BlogPostLayout post={post}>
      {/* Opening */}
      <p className="text-xl leading-relaxed text-gray-200">
        You don&apos;t need to upload your passport to buy Bitcoin. On Coincess, you connect a
        wallet, pick a coin, click buy — and it&apos;s yours. No account, no email, no ID.
      </p>

      <h2>Why Most Exchanges Require Your ID</h2>

      <p>
        Centralized exchanges like Coinbase and Binance operate as money transmitters. Regulators
        require them to verify your identity — Know Your Customer (KYC) — to prevent money
        laundering and comply with financial laws. That means passport uploads, selfies, address
        verification, and sometimes multi-day waits. Decentralized exchanges (DEXs) work differently.
        There&apos;s no company holding your funds. You connect your wallet, trade peer-to-peer
        through smart contracts, and your keys never leave your device. No custodian, no KYC.
      </p>

      <h2>How to Buy Crypto Without ID on Coincess</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            1
          </span>
          <div>
            <h4 className="font-bold text-white mb-1 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand" />
              Get a Wallet
            </h4>
            <p className="text-gray-300 text-sm">
              MetaMask, Rabby, or any EVM wallet — takes 2 minutes. Download the extension or app,
              create a new wallet, and save your seed phrase somewhere safe. That&apos;s it.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            2
          </span>
          <div>
            <h4 className="font-bold text-white mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-brand" />
              Fund Your Wallet with USDC
            </h4>
            <p className="text-gray-300 text-sm">
              Bridge from Ethereum, buy from an on-ramp like MoonPay or Transak, or receive from a
              friend. Coincess swaps use USDC — get some in your wallet on Hyperliquid, Arbitrum,
              or the network Coincess supports.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            3
          </span>
          <div>
            <h4 className="font-bold text-white mb-1 flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand" />
              Go to coincess.com/buy
            </h4>
            <p className="text-gray-300 text-sm">
              The simple interface loads instantly. No signup form, no email capture — just connect
              your wallet and you&apos;re in.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 bg-[#141620] rounded-xl">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold">
            4
          </span>
          <div>
            <h4 className="font-bold text-white mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-brand" />
              Pick a Coin and Buy
            </h4>
            <p className="text-gray-300 text-sm">
              BTC, ETH, SOL, HYPE — plus 50 more. Select your token, enter the amount, click Buy.
              Crypto lands in your wallet. Done.
            </p>
          </div>
        </div>
      </div>

      <h2>What You Can Buy</h2>

      <div className="not-prose border-none my-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {tokens.map(({ symbol, name }) => (
            <div
              key={symbol}
              className="bg-[#141620] rounded-xl p-4 flex items-center gap-3 hover:bg-[#1a1d26] transition-colors"
            >
              <CoinLogo symbol={symbol} size={32} />
              <div>
                <p className="font-semibold text-white">{symbol}</p>
                <p className="text-sm text-gray-400">{name}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-gray-300 text-sm mt-4">
          Plus 50+ more crypto tokens and tokenized stocks — all without ID.
        </p>
      </div>

      <h2>Is It Legal?</h2>

      <p>
        DEX trading is legal in most jurisdictions. You&apos;re not breaking any laws by connecting
        a wallet and swapping tokens. That said, you&apos;re responsible for reporting taxes on your
        gains. Crypto transactions can be traced on public blockchains, and tax authorities are
        increasingly focused on crypto. This isn&apos;t financial or legal advice — when in doubt,
        consult a professional in your jurisdiction.
      </p>

      <h2>Coincess vs KYC Exchanges</h2>

      <div className="not-prose border-none my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="text-left p-4 font-semibold text-white border-none"></th>
              <th className="text-left p-4 font-semibold text-white border-none">Coincess</th>
              <th className="text-left p-4 font-semibold text-white border-none">Coinbase</th>
              <th className="text-left p-4 font-semibold text-white border-none">Binance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-4 border-none text-gray-300">Account</td>
              <td className="p-4 border-none text-gray-200">No</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-300">ID Required</td>
              <td className="p-4 border-none text-gray-200">No</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-300">Time to Start</td>
              <td className="p-4 border-none text-gray-200">30 seconds</td>
              <td className="p-4 border-none text-gray-300">1–7 days</td>
              <td className="p-4 border-none text-gray-300">1–3 days</td>
            </tr>
            <tr>
              <td className="p-4 border-none text-gray-300">Your Data Stored</td>
              <td className="p-4 border-none text-gray-200">No</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
              <td className="p-4 border-none text-gray-300">Yes</td>
            </tr>
            <tr className="bg-brand/10">
              <td className="p-4 border-none text-gray-200 font-medium">Fees</td>
              <td className="p-4 border-none text-brand font-medium">0.05%</td>
              <td className="p-4 border-none text-gray-300">1.5%</td>
              <td className="p-4 border-none text-gray-300">0.1%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Frequently Asked Questions</h2>

      <div className="not-prose border-none my-8 space-y-4">
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand" />
            Is my crypto safe without an exchange account?
          </h4>
          <p className="text-gray-300 text-sm">
            Safer! Self-custody means only you control your funds. No exchange can freeze your
            account, get hacked and lose your coins, or require you to prove your identity to
            withdraw. Your keys, your crypto.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Lock className="h-5 w-5 text-brand" />
            Can I buy with credit card?
          </h4>
          <p className="text-gray-300 text-sm">
            Not directly on Coincess. You need USDC in your wallet first. Use an on-ramp like
            MoonPay or Transak to buy USDC with a card, then send it to your wallet and swap on
            Coincess.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            How much can I buy?
          </h4>
          <p className="text-gray-300 text-sm">
            No limits. Buy as much as you have USDC for. There&apos;s no daily cap, no tier system,
            no verification to unlock higher limits.
          </p>
        </div>
        <div className="bg-[#141620] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <UserX className="h-5 w-5 text-brand" />
            What about selling?
          </h4>
          <p className="text-gray-300 text-sm">
            Same process in reverse. Click the Sell tab, pick your coin, enter the amount, confirm.
            USDC (or your chosen output) lands in your wallet.
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
          Buy Crypto on Coincess
        </Link>
        <Link
          href="/blog/cheapest-way-to-buy-bitcoin-2026"
          className="flex items-center justify-center gap-2 px-8 py-4 bg-[#141620] text-gray-200 font-semibold rounded-full hover:bg-[#1a1d26] transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          The Cheapest Way to Buy Bitcoin in 2026
        </Link>
      </div>
    </BlogPostLayout>
  )
}
