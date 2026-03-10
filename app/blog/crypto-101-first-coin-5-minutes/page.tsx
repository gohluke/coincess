import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import { Wallet, ArrowRightLeft, PartyPopper, ArrowRight, CheckCircle2, ExternalLink, Sparkles } from "lucide-react"

const post = getBlogPost("crypto-101-first-coin-5-minutes")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function Crypto101() {
  return (
    <BlogPostLayout post={post}>
      {/* SEO-optimized first paragraph */}
      <p className="text-xl leading-relaxed">
        <strong>Getting your first cryptocurrency takes just 3 steps: download a wallet, get some crypto, and you're done.</strong> No complicated exchanges, no week-long verification processes, no financial jargon. This guide will get you from zero to holding real crypto in under 5 minutes of active time.
      </p>

      <p>
        Welcome to the world of digital money. Let's make this as simple as possible.
      </p>

      {/* Big 3 Steps Visual */}
      <div className="not-prose my-10">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-brand mb-2">Step 1</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Get a Wallet</h3>
            <p className="text-sm text-gray-600">Download an app to store your crypto</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ArrowRightLeft className="h-8 w-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-brand mb-2">Step 2</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Get Crypto</h3>
            <p className="text-sm text-gray-600">Buy, receive, or swap for your first coins</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="h-8 w-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-brand mb-2">Step 3</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">You're Done!</h3>
            <p className="text-sm text-gray-600">You now own cryptocurrency</p>
          </div>
        </div>
      </div>

      <h2>What Even Is Cryptocurrency?</h2>

      <p>
        Think of cryptocurrency as <strong>digital cash that doesn't need a bank</strong>. Just like you can hand someone a $20 bill without asking permission from Visa or your bank, crypto lets you send money directly to anyone, anywhere in the world.
      </p>

      <p>
        The most famous cryptocurrency is <strong>Bitcoin (BTC)</strong>—often called "digital gold." But there are thousands of others, each with different purposes. For your first coin, we'll keep it simple.
      </p>

      <h2>Step 1: Get a Wallet (2 minutes)</h2>

      <p>
        A crypto wallet is like a digital pocket for your coins. It's an app on your phone that lets you:
      </p>

      <ul>
        <li>Receive crypto from others</li>
        <li>Send crypto to anyone</li>
        <li>Check your balance</li>
        <li>Swap between different cryptocurrencies</li>
      </ul>

      <div className="not-prose my-8 bg-brand/5 border border-brand/20 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" />
          Our Recommendation: Cake Wallet
        </h3>
        <p className="text-gray-700 mb-4">
          Cake Wallet is free, beginner-friendly, and lets you hold multiple cryptocurrencies including Bitcoin and Monero. It also has built-in swapping.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://apps.apple.com/app/cake-wallet/id1334702542"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Download for iPhone
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.cakewallet.cake_wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Download for Android
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <h3>Setting Up Your Wallet</h3>

      <ol>
        <li>
          <strong>Download Cake Wallet</strong> from the App Store or Play Store
        </li>
        <li>
          <strong>Open the app</strong> and tap "Create new wallet"
        </li>
        <li>
          <strong>Choose Bitcoin</strong> (or whichever crypto you want to start with)
        </li>
        <li>
          <strong>Write down your seed phrase</strong>—this is CRITICAL
        </li>
      </ol>

      <div className="not-prose my-8 bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h4 className="font-semibold text-amber-900 mb-2">⚠️ IMPORTANT: Your Seed Phrase</h4>
        <p className="text-amber-800 text-sm mb-3">
          Your wallet will show you 12-25 random words. This is your "seed phrase"—it's the master key to your money.
        </p>
        <ul className="space-y-1 text-amber-800 text-sm">
          <li>• <strong>Write it down on paper</strong> (not digitally)</li>
          <li>• <strong>Store it somewhere safe</strong> (like with important documents)</li>
          <li>• <strong>NEVER share it with anyone</strong>—not even "support" teams</li>
          <li>• If you lose it and your phone breaks, your crypto is gone forever</li>
        </ul>
      </div>

      <p>
        Once your wallet is set up, you'll see a "Receive" button. Tap it to see your wallet address—a long string of letters and numbers. This is like your account number that people can send crypto to.
      </p>

      <h2>Step 2: Get Your First Crypto</h2>

      <p>
        Now you have a wallet. Time to fill it! Here are your options, from easiest to most private:
      </p>

      <h3>Option A: Ask a Friend (Easiest)</h3>

      <p>
        Know someone with crypto? Ask them to send you a small amount to practice. Give them your wallet address, and within minutes you'll have your first crypto. Many crypto enthusiasts are happy to help newbies get started.
      </p>

      <h3>Option B: Buy with Card (Quick but needs ID)</h3>

      <p>
        Cake Wallet has built-in options to buy crypto with a debit card. You'll need to verify your identity (KYC), but it's straightforward:
      </p>

      <ol>
        <li>Open Cake Wallet</li>
        <li>Tap "Buy"</li>
        <li>Choose your amount and follow the prompts</li>
        <li>Crypto arrives in your wallet</li>
      </ol>

      <h3>Option C: Swap from Another Crypto (No ID)</h3>

      <p>
        If you already have some cryptocurrency somewhere (maybe from a game, airdrop, or previous purchase), you can swap it into your wallet using Cake Wallet's built-in exchange or a service like <a href="https://trocador.app/?ref=2dzDcvfQJY" target="_blank" rel="noopener noreferrer">Trocador</a>.
      </p>

      <h3>Option D: Earn It</h3>

      <p>
        Some ways to earn small amounts of crypto:
      </p>

      <ul>
        <li>Complete tasks on sites like Coinbase Earn (requires account)</li>
        <li>Participate in airdrops</li>
        <li>Get paid in crypto for freelance work</li>
        <li>Bitcoin/crypto faucets (very small amounts)</li>
      </ul>

      <h2>Step 3: You're Done! 🎉</h2>

      <p>
        Once your wallet shows a balance, congratulations—you officially own cryptocurrency! You're now part of a global financial system that works 24/7, has no borders, and doesn't require anyone's permission.
      </p>

      <div className="not-prose my-8 bg-green-50 border border-green-200 rounded-xl p-6">
        <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          What You Can Now Do
        </h4>
        <ul className="space-y-2 text-green-800 text-sm">
          <li>• <strong>HODL</strong> – Just hold and watch it (hopefully) grow</li>
          <li>• <strong>Send</strong> – Pay friends or buy things from merchants who accept crypto</li>
          <li>• <strong>Swap</strong> – Exchange for different cryptocurrencies</li>
          <li>• <strong>Learn</strong> – Explore DeFi, NFTs, and more (when you're ready)</li>
        </ul>
      </div>

      <h2>What's Next? (Optional Reading)</h2>

      <p>
        Now that you have your first crypto, here are some things to explore when you're ready:
      </p>

      <h3>Learn About Different Coins</h3>

      <ul>
        <li><strong>Bitcoin (BTC)</strong> – Digital gold, store of value</li>
        <li><strong>Ethereum (ETH)</strong> – Smart contracts, DeFi, NFTs</li>
        <li><strong>Monero (XMR)</strong> – Private transactions</li>
        <li><strong>Stablecoins (USDC, USDT)</strong> – Pegged to $1, less volatile</li>
      </ul>

      <h3>Security Best Practices</h3>

      <ul>
        <li>Keep your seed phrase offline and secure</li>
        <li>Use strong passwords and 2FA where possible</li>
        <li>Don't click suspicious links or connect to random sites</li>
        <li>For large amounts, consider a hardware wallet</li>
      </ul>

      <h3>Avoid Common Beginner Mistakes</h3>

      <ul>
        <li><strong>Don't invest more than you can afford to lose</strong> – Crypto is volatile</li>
        <li><strong>Don't share your seed phrase</strong> – Ever. With anyone. For any reason.</li>
        <li><strong>Don't panic sell</strong> – Prices go up and down; that's normal</li>
        <li><strong>Don't fall for "double your crypto" scams</strong> – If it sounds too good, it is</li>
      </ul>

      <h2>Glossary for Beginners</h2>

      <div className="not-prose my-8 space-y-3">
        <div className="border-b border-gray-200 pb-3">
          <strong className="text-gray-900">Wallet</strong>
          <p className="text-sm text-gray-600">An app or device that stores your cryptocurrency</p>
        </div>
        <div className="border-b border-gray-200 pb-3">
          <strong className="text-gray-900">Seed Phrase</strong>
          <p className="text-sm text-gray-600">12-25 words that are the master key to your wallet</p>
        </div>
        <div className="border-b border-gray-200 pb-3">
          <strong className="text-gray-900">Address</strong>
          <p className="text-sm text-gray-600">Your "account number" that people send crypto to</p>
        </div>
        <div className="border-b border-gray-200 pb-3">
          <strong className="text-gray-900">HODL</strong>
          <p className="text-sm text-gray-600">"Hold On for Dear Life" – slang for holding long-term</p>
        </div>
        <div className="border-b border-gray-200 pb-3">
          <strong className="text-gray-900">Swap</strong>
          <p className="text-sm text-gray-600">Exchanging one cryptocurrency for another</p>
        </div>
        <div className="border-b border-gray-200 pb-3">
          <strong className="text-gray-900">KYC</strong>
          <p className="text-sm text-gray-600">"Know Your Customer" – ID verification required by some services</p>
        </div>
        <div className="pb-3">
          <strong className="text-gray-900">Gas Fee</strong>
          <p className="text-sm text-gray-600">A small fee paid to process transactions on the network</p>
        </div>
      </div>

      <h2>Summary</h2>

      <p>
        Getting started with crypto doesn't have to be complicated:
      </p>

      <ol>
        <li><strong>Download Cake Wallet</strong> (or any beginner-friendly wallet)</li>
        <li><strong>Secure your seed phrase</strong> (write it down, store safely, never share)</li>
        <li><strong>Get some crypto</strong> (buy, receive from a friend, or swap)</li>
        <li><strong>Explore at your own pace</strong></li>
      </ol>

      <p>
        That's it. You don't need to understand blockchain technology to use crypto, just like you don't need to understand how the internet works to send an email.
      </p>

      <p>
        Welcome to the future of money. 🚀
      </p>

      {/* Related Articles CTA */}
      <div className="not-prose mt-12 space-y-4">
        <h3 className="font-bold text-gray-900">Keep Learning</h3>
        
        <Link
          href="/blog/hot-wallets-vs-cold-wallets"
          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-brand/50 hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-gray-900 group-hover:text-brand">Hot vs Cold Wallets</h4>
            <p className="text-gray-600 text-sm">Learn about wallet security for when your holdings grow</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-brand" />
        </Link>

        <Link
          href="/blog/why-privacy-matters-anonymous-crypto"
          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-brand/50 hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-gray-900 group-hover:text-brand">Why Privacy Matters</h4>
            <p className="text-gray-600 text-sm">Understand why some people prefer private cryptocurrencies</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-brand" />
        </Link>
      </div>
    </BlogPostLayout>
  )
}
