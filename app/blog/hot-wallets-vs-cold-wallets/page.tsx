import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import { AlertTriangle, CheckCircle2, XCircle, Shield, Smartphone, HardDrive, ExternalLink } from "lucide-react"

const post = getBlogPost("hot-wallets-vs-cold-wallets")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess`,
  description: post.description,
  keywords: post.keywords.join(", "),
}

export default function HotWalletsVsColdWallets() {
  return (
    <BlogPostLayout post={post}>
      {/* SEO-optimized first paragraph */}
      <p className="text-xl leading-relaxed">
        <strong>A hot wallet is a crypto wallet connected to the internet (like an app on your phone), while a cold wallet is a physical device that stores your crypto offline.</strong> For maximum security, you should use a hot wallet for daily transactions and a cold wallet for long-term storage of significant amounts.
      </p>

      <p>
        In 2024 alone, over $2 billion in cryptocurrency was stolen from hacks targeting hot wallets and exchanges. Understanding the difference between hot and cold storage could save you from becoming a victim.
      </p>

      {/* Comparison Table */}
      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#1a1d26]">
              <th className="text-left p-4 font-semibold text-white border-b">Feature</th>
              <th className="text-left p-4 font-semibold text-white border-b">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-orange-500" />
                  Hot Wallet
                </div>
              </th>
              <th className="text-left p-4 font-semibold text-white border-b">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-500" />
                  Cold Wallet
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-4 border-b text-gray-200">Internet Connection</td>
              <td className="p-4 border-b text-gray-200">Always connected</td>
              <td className="p-4 border-b text-gray-200">Offline (air-gapped)</td>
            </tr>
            <tr className="bg-[#1a1d26]">
              <td className="p-4 border-b text-gray-200">Security Level</td>
              <td className="p-4 border-b text-orange-600 font-medium">Medium</td>
              <td className="p-4 border-b text-green-600 font-medium">Very High</td>
            </tr>
            <tr>
              <td className="p-4 border-b text-gray-200">Convenience</td>
              <td className="p-4 border-b text-green-600 font-medium">Very High</td>
              <td className="p-4 border-b text-orange-600 font-medium">Lower</td>
            </tr>
            <tr className="bg-[#1a1d26]">
              <td className="p-4 border-b text-gray-200">Cost</td>
              <td className="p-4 border-b text-gray-200">Free</td>
              <td className="p-4 border-b text-gray-200">$50-$200+</td>
            </tr>
            <tr>
              <td className="p-4 border-b text-gray-200">Best For</td>
              <td className="p-4 border-b text-gray-200">Daily transactions, small amounts</td>
              <td className="p-4 border-b text-gray-200">Long-term storage, large amounts</td>
            </tr>
            <tr className="bg-[#1a1d26]">
              <td className="p-4 text-gray-200">Hack Risk</td>
              <td className="p-4 text-red-600 font-medium">Vulnerable to online attacks</td>
              <td className="p-4 text-green-600 font-medium">Nearly impossible remotely</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>What is a Hot Wallet?</h2>

      <p>
        A hot wallet is any cryptocurrency wallet that's connected to the internet. This includes:
      </p>

      <ul>
        <li><strong>Mobile apps</strong> (Cake Wallet, Trust Wallet, MetaMask mobile)</li>
        <li><strong>Desktop applications</strong> (Exodus, Electrum, Feather Wallet)</li>
        <li><strong>Browser extensions</strong> (MetaMask, Phantom)</li>
        <li><strong>Exchange wallets</strong> (Coinbase, Binance—though you don't own the keys)</li>
      </ul>

      <div className="not-prose my-8 grid md:grid-cols-2 gap-4">
        <div className="bg-emerald-950/50 rounded-xl p-5">
          <h4 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Hot Wallet Pros
          </h4>
            <ul className="space-y-2 text-emerald-400 text-sm">
            <li>• Free to use</li>
            <li>• Instant access anytime</li>
            <li>• Easy to set up in minutes</li>
            <li>• Great for daily trading/swapping</li>
            <li>• Works on any device</li>
          </ul>
        </div>
        <div className="bg-red-950/50 rounded-xl p-5">
          <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Hot Wallet Cons
          </h4>
            <ul className="space-y-2 text-red-400 text-sm">
            <li>• Vulnerable to malware/viruses</li>
            <li>• Can be hacked remotely</li>
            <li>• Phishing attacks target users</li>
            <li>• Device theft = potential fund loss</li>
            <li>• Not ideal for large amounts</li>
          </ul>
        </div>
      </div>

      <h3>Recommended Hot Wallets</h3>

      <ul>
        <li><strong><a href="https://cakewallet.com" target="_blank" rel="noopener noreferrer">Cake Wallet</a></strong> – Best for Monero (XMR), Bitcoin, and swapping</li>
        <li><strong><a href="https://trustwallet.com" target="_blank" rel="noopener noreferrer">Trust Wallet</a></strong> – Multi-chain support, user-friendly</li>
        <li><strong><a href="https://featherwallet.org" target="_blank" rel="noopener noreferrer">Feather Wallet</a></strong> – Desktop Monero wallet, open source</li>
      </ul>

      <h2>What is a Cold Wallet?</h2>

      <p>
        A cold wallet (also called hardware wallet or cold storage) is a physical device that stores your private keys completely offline. Your crypto never touches the internet, making remote hacking virtually impossible.
      </p>

      <p>
        Think of it like a super-secure USB drive that only signs transactions when you physically press a button.
      </p>

      <div className="not-prose my-8 grid md:grid-cols-2 gap-4">
        <div className="bg-emerald-950/50 rounded-xl p-5">
          <h4 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Cold Wallet Pros
          </h4>
            <ul className="space-y-2 text-emerald-400 text-sm">
            <li>• Maximum security (offline storage)</li>
            <li>• Immune to remote hacking</li>
            <li>• Protected even if computer has malware</li>
            <li>• Physical confirmation required</li>
            <li>• Ideal for long-term holdings</li>
          </ul>
        </div>
        <div className="bg-red-950/50 rounded-xl p-5">
          <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Cold Wallet Cons
          </h4>
            <ul className="space-y-2 text-red-400 text-sm">
            <li>• Costs $50-$200+</li>
            <li>• Less convenient for frequent use</li>
            <li>• Can be lost or damaged</li>
            <li>• Slight learning curve</li>
            <li>• Need to keep it physically safe</li>
          </ul>
        </div>
      </div>

      <h3>Recommended Hardware Wallets</h3>

      <div className="not-prose my-6 space-y-4">
        <a
          href="https://shop.ledger.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">Ledger Nano X / Nano S Plus</h4>
            <p className="text-gray-300 text-sm">Most popular choice. Supports 5,500+ coins including Bitcoin, Ethereum, and Monero.</p>
            <p className="text-brand text-sm font-medium mt-1">From $79</p>
          </div>
          <ExternalLink className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </a>
        
        <a
          href="https://trezor.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">Trezor Model T / Safe 3</h4>
            <p className="text-gray-300 text-sm">Open-source firmware. Touchscreen interface. Great for Bitcoin maximalists.</p>
            <p className="text-brand text-sm font-medium mt-1">From $69</p>
          </div>
          <ExternalLink className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </a>
      </div>

      <h2>The Smart Strategy: Use Both</h2>

      <p>
        Most experienced crypto users follow this approach:
      </p>

      <div className="not-prose my-8 bg-brand/5 border border-brand/20 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand" />
          Recommended Setup
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-white mb-2">Hot Wallet (Daily Use)</h4>
            <ul className="space-y-1 text-gray-200 text-sm">
              <li>• Keep small amounts for trading/swapping</li>
              <li>• Use for DeFi interactions</li>
              <li>• Maximum: What you'd carry in a physical wallet</li>
              <li>• Example: $100-$500 worth</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">Cold Wallet (Savings)</h4>
            <ul className="space-y-1 text-gray-200 text-sm">
              <li>• Store long-term investments</li>
              <li>• Keep majority of holdings offline</li>
              <li>• Only connect when necessary</li>
              <li>• Treat like a savings account</li>
            </ul>
          </div>
        </div>
      </div>

      <h2>How to Secure Your Wallet (Any Type)</h2>

      <ol>
        <li>
          <strong>Write down your seed phrase on paper</strong><br />
          Never store it digitally (no photos, no notes app, no cloud). Anyone with this phrase can steal all your funds.
        </li>
        <li>
          <strong>Store the seed phrase in multiple secure locations</strong><br />
          Consider a fireproof safe, safety deposit box, or metal backup plate.
        </li>
        <li>
          <strong>Enable all security features</strong><br />
          Use PIN codes, biometrics, and 2FA wherever available.
        </li>
        <li>
          <strong>Verify addresses carefully</strong><br />
          Always double-check wallet addresses before sending. Malware can swap addresses in your clipboard.
        </li>
        <li>
          <strong>Keep software updated</strong><br />
          Wallet apps release security patches regularly. Don't ignore updates.
        </li>
      </ol>

      {/* Warning Box */}
      <div className="not-prose my-8 bg-amber-950/50 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-400 mb-2">Critical Security Rules</h4>
            <ul className="space-y-1 text-amber-400 text-sm">
              <li>• <strong>NEVER share your seed phrase</strong> – No legitimate service will ever ask for it</li>
              <li>• <strong>Don't store crypto on exchanges</strong> – "Not your keys, not your coins"</li>
              <li>• <strong>Buy hardware wallets only from official sources</strong> – Never second-hand or Amazon</li>
              <li>• <strong>Be skeptical of "support" DMs</strong> – Scammers impersonate wallet support teams</li>
            </ul>
          </div>
        </div>
      </div>

      <h2>When to Move to Cold Storage</h2>

      <p>
        Consider getting a hardware wallet when:
      </p>

      <ul>
        <li>Your portfolio exceeds $1,000</li>
        <li>You're planning to hold for months/years</li>
        <li>You've experienced a security scare</li>
        <li>You want peace of mind</li>
      </ul>

      <p>
        The cost of a $79 Ledger is nothing compared to losing thousands in a hack.
      </p>

      <h2>The Workflow: Swap → Cold Storage</h2>

      <p>
        Here's the smart way to accumulate and secure crypto:
      </p>

      <ol>
        <li>Use a hot wallet (like Cake Wallet) to swap fiat or other crypto</li>
        <li>Once you've accumulated a meaningful amount, transfer to your hardware wallet</li>
        <li>Only keep small amounts in your hot wallet for active use</li>
        <li>Repeat the cycle as you accumulate more</li>
      </ol>

      <p>
        This way, you get the convenience of hot wallets for transactions while keeping your main holdings secure offline.
      </p>

      <h2>Summary</h2>

      <ul>
        <li><strong>Hot wallets</strong> = Connected to internet, convenient, higher risk</li>
        <li><strong>Cold wallets</strong> = Offline storage, maximum security, less convenient</li>
        <li><strong>Best practice</strong> = Use both: hot for spending, cold for saving</li>
        <li><strong>Golden rule</strong> = Never share your seed phrase with anyone, ever</li>
      </ul>

      <p>
        Start with a free hot wallet like Cake Wallet to learn the basics. Once you have meaningful holdings, invest in a Ledger or Trezor to sleep soundly knowing your crypto is truly secure.
      </p>
    </BlogPostLayout>
  )
}
