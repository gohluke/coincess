import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { getBlogPost } from "@/lib/blog-posts"
import {
  Calculator,
  Shield,
  AlertTriangle,
  ArrowRight,
  Zap,
  Target,
  XCircle,
  Wallet,
} from "lucide-react"

const post = getBlogPost("crypto-leverage-trading-beginners-guide")!

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

export default function CryptoLeverageTradingBeginnersGuidePage() {
  return (
    <BlogPostLayout post={post}>
      {/* Lead */}
      <p className="text-xl leading-relaxed">
        Leverage is the most powerful — and dangerous — tool in a trader&apos;s
        arsenal. Used right, it multiplies your profits. Used wrong, it wipes
        you out in seconds.
      </p>

      <h2>What Is Leverage Trading?</h2>

      <p>
        In plain English: <strong>leverage</strong> lets you borrow funds to
        increase your position size. You put up a small amount of capital
        (margin) and control a much larger position. With <strong>10x
        leverage</strong>, $100 of margin controls a $1,000 position. Your gains
        and losses are calculated on the full position size—so a 5% move in your
        favor becomes a 50% return on your margin.
      </p>

      <div className="not-prose my-8 bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-400" />
          Visual Example: $100 Margin, 10x Leverage
        </h4>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-gray-400">Margin</p>
            <p className="text-2xl font-bold text-white">$100</p>
            <p className="text-gray-400">Your collateral</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-gray-400">Leverage</p>
            <p className="text-2xl font-bold text-amber-400">10x</p>
            <p className="text-gray-400">Position multiplier</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-gray-400">Position Size</p>
            <p className="text-2xl font-bold text-white">$1,000</p>
            <p className="text-gray-400">What you control</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-gray-400">5% Price Move</p>
            <p className="text-2xl font-bold text-emerald-400">$50 profit</p>
            <p className="text-gray-400">= 50% ROI on margin</p>
          </div>
        </div>
        <p className="text-amber-400 text-xs mt-4">
          Same 5% move against you = $50 loss (50% of your margin gone).
        </p>
      </div>

      <h2>Leverage Levels Explained</h2>

      <p>
        Not all leverage is equal. Higher leverage means bigger swings—and
        liquidation gets closer. Here&apos;s how the tiers break down:
      </p>

      <div className="not-prose my-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-950/50 border border-emerald-200 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center mb-3">
            <Shield className="h-5 w-5 text-emerald-600" />
          </div>
          <h4 className="font-bold text-white mb-2">2–3x: Conservative</h4>
          <p className="text-sm text-gray-400 mb-2">
            For swing trades. Liquidation ~33–50% away.
          </p>
          <p className="text-xs font-mono text-emerald-400">Safest tier</p>
        </div>
        <div className="bg-blue-950/50 border border-blue-200 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center mb-3">
            <Target className="h-5 w-5 text-blue-600" />
          </div>
          <h4 className="font-bold text-white mb-2">5–10x: Moderate</h4>
          <p className="text-sm text-gray-600 mb-2">
            Day trading. Liquidation ~10–20% away.
          </p>
          <p className="text-xs font-mono text-blue-700">Most common</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            <Zap className="h-5 w-5 text-amber-600" />
          </div>
          <h4 className="font-bold text-gray-900 mb-2">10–25x: Aggressive</h4>
          <p className="text-sm text-gray-600 mb-2">
            Experienced traders. Liquidation ~4–10% away.
          </p>
          <p className="text-xs font-mono text-amber-700">High risk</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h4 className="font-bold text-gray-900 mb-2">25–50x: Ultra-High Risk</h4>
          <p className="text-sm text-gray-600 mb-2">
            Scalpers only. Liquidation ~2–4% away.
          </p>
          <p className="text-xs font-mono text-red-700">Extreme danger</p>
        </div>
      </div>

      <h2>Isolated vs Cross Margin</h2>

      <p>
        Margin mode determines what&apos;s at risk when a trade goes against you.
      </p>

      <div className="not-prose my-8 grid sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Isolated Margin</h3>
          </div>
          <p className="text-sm text-gray-700 mb-2">
            Only the margin allocated to that position is at risk. If you get
            liquidated, you lose that margin—not your entire account.
          </p>
          <p className="text-emerald-700 text-sm font-medium">
            ✓ Safer. Recommended for beginners.
          </p>
        </div>
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-bold text-gray-900">Cross Margin</h3>
          </div>
          <p className="text-sm text-gray-700 mb-2">
            Your entire account balance acts as margin. More capital-efficient
            (fewer liquidations from a single bad trade), but one blow-up can
            wipe everything.
          </p>
          <p className="text-amber-400 text-sm font-medium">
            ⚠ More efficient but riskier. For experienced traders.
          </p>
        </div>
      </div>

      <h2>Understanding Liquidation</h2>

      <p>
        <strong>Liquidation</strong> happens when your losses exceed your
        margin. The exchange force-closes your position to prevent you from
        owing more than you have. The higher your leverage, the smaller the
        adverse move needed to get liquidated.
      </p>

      <div className="not-prose my-8 bg-slate-900 text-white rounded-2xl p-6">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          Liquidation Distance (Long Position)
        </h4>
        <div className="space-y-3 text-sm">
          <p className="text-gray-300">
            At <span className="text-amber-400 font-mono">10x leverage</span>:
            a <span className="text-red-400 font-bold">~10%</span> adverse move
            = liquidation.
          </p>
          <p className="text-gray-300">
            At <span className="text-amber-400 font-mono">50x leverage</span>:
            a <span className="text-red-400 font-bold">~2%</span> adverse move
            = liquidation.
          </p>
          <p className="text-amber-400 text-xs mt-2">
            That&apos;s why 50x is so dangerous—a normal market wiggle can end
            your position.
          </p>
        </div>
      </div>

      <p>
        How to avoid liquidation: use lower leverage, set stop-losses, and
        never risk more than you can afford to lose. Always know your
        liquidation price before you enter.
      </p>

      <h2>Risk Management: The #1 Skill</h2>

      <p>
        Surviving leverage trading comes down to one thing:{" "}
        <strong>risk management</strong>. Here are the rules that separate
        profitable traders from blown accounts:
      </p>

      <ul>
        <li>
          <strong>Never risk more than 1–2% of your portfolio per trade.</strong>{" "}
          If you have $1,000, that&apos;s $10–20 max loss per trade.
        </li>
        <li>
          <strong>Always use stop-losses.</strong> Decide your exit before you
          enter. No exceptions.
        </li>
        <li>
          <strong>Start with low leverage.</strong> 2–5x until you understand
          the math and your emotions.
        </li>
        <li>
          <strong>Size positions based on stop-loss distance.</strong> If your
          stop is 5% away, size so that a 5% move = 1–2% portfolio loss.
        </li>
      </ul>

      <div className="not-prose my-8 bg-brand/10 border border-brand/30 rounded-xl p-6">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-brand" />
          Position Sizing Formula
        </h4>
        <p className="text-sm text-gray-300 mb-2">
          Position size = (Portfolio × Risk %) ÷ (Stop-loss %)
        </p>
        <p className="text-sm text-gray-400">
          Example: $1,000 portfolio, 1% risk ($10), 5% stop-loss. Position size =
          $10 ÷ 0.05 = <strong>$200 notional</strong>. With 10x leverage, that&apos;s
          $20 margin.
        </p>
      </div>

      <h2>Use the Coincess Leverage Calculator</h2>

      <p>
        Before every leveraged trade, run the numbers. Coincess has a free{" "}
        <Link
          href="/crypto-leverage-calculator"
          className="text-brand font-semibold hover:underline"
        >
          Leverage Calculator
        </Link>{" "}
        at <code className="bg-gray-100 px-1.5 py-0.5 rounded">/crypto-leverage-calculator</code>.
      </p>

      <p>
        It calculates: <strong>liquidation price</strong>, margin required,
        P&amp;L at your target price, and position size recommendations. Enter
        your entry price, leverage, and margin—and see exactly where you get
        liquidated. No surprises.
      </p>

      <p>
        <Link
          href="/crypto-leverage-calculator"
          className="inline-flex items-center gap-2 text-brand font-semibold hover:underline"
        >
          <Calculator className="h-5 w-5" />
          Try the Coincess Leverage Calculator →
        </Link>
      </p>

      <h2>Your First Leveraged Trade on Coincess</h2>

      <p>
        Ready to put it into practice? Here&apos;s the 4-step path to your first
        leveraged trade on Coincess—no KYC, no account signup.
      </p>

      <div className="not-prose my-8 space-y-4">
        {[
          {
            step: 1,
            title: "Connect your wallet",
            desc: "MetaMask, Rabby, or any Web3 wallet. No KYC, no email.",
            icon: Wallet,
          },
          {
            step: 2,
            title: "Deposit USDC to Hyperliquid",
            desc: "Bridge or swap USDC. Coincess supports instant deposits.",
            icon: Target,
          },
          {
            step: 3,
            title: "Choose your market and leverage",
            desc: "Pick BTC, ETH, oil, gold—start with 2–5x leverage.",
            icon: Zap,
          },
          {
            step: 4,
            title: "Place your order with a stop-loss",
            desc: "Enter size, set your stop, and execute. Know your exit before you enter.",
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
              <h4 className="font-bold text-gray-900 mb-1">{title}</h4>
              <p className="text-sm text-gray-600">{desc}</p>
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

      <h2>Leverage Trading Mistakes That Will Blow Your Account</h2>

      <div className="not-prose my-8 space-y-4">
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50 border-2 border-red-200">
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">Using 50x because it&apos;s available</h4>
            <p className="text-sm text-red-800">
              A 2% move wipes you out. Unless you&apos;re a scalper with a
              proven edge, stay under 10x.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50 border-2 border-red-200">
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">No stop-loss</h4>
            <p className="text-sm text-red-800">
              &quot;It&apos;ll come back&quot; is how people get liquidated.
              Always set a stop before you enter.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50 border-2 border-red-200">
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">Revenge trading after a loss</h4>
            <p className="text-sm text-red-800">
              One bad trade doesn&apos;t justify a bigger, riskier one. Step
              away. Come back with a clear head.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50 border-2 border-red-200">
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">Overleveraging on a &quot;sure thing&quot;</h4>
            <p className="text-sm text-red-800">
              There are no sure things. Markets can gap, flash crash, or reverse
              in seconds.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl bg-red-950/50 border-2 border-red-200">
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-red-400">Trading with money you can&apos;t afford to lose</h4>
            <p className="text-sm text-red-800">
              Rent, bills, savings—never use them for leverage. Only risk
              capital you can lose without affecting your life.
            </p>
          </div>
        </div>
      </div>

      <h2>Risk Disclosure</h2>

      <div className="not-prose my-8 bg-amber-950/50 border-2 border-amber-300 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-2">Risk Disclosure</h4>
            <p className="text-amber-800 text-sm">
              Leverage trading involves significant risk. You can lose your
              entire margin or more. Leverage amplifies both gains and
              losses—a small adverse move can liquidate your position. Past
              performance does not guarantee future results. Never trade with
              money you cannot afford to lose. This article is for educational
              purposes only and does not constitute financial, investment, or
              trading advice. Do your own research and consider consulting a
              professional before trading.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="not-prose mt-12">
        <div className="bg-gradient-to-r from-brand to-brand-hover rounded-2xl p-8 text-white text-center shadow-lg">
          <h3 className="text-2xl font-bold mb-3">
            Ready to Trade with Leverage on Coincess?
          </h3>
          <p className="text-white/90 mb-6 max-w-lg mx-auto">
            No KYC. Up to 50x leverage. BTC, ETH, oil, gold—24/7. Use the
            leverage calculator first, then connect and trade.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trade/BTC"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white text-brand font-semibold rounded-lg hover:bg-[#1a1d26] transition-colors"
            >
              Trade BTC
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/crypto-leverage-calculator"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors border border-white/30"
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
          href="/blog/what-are-perpetual-futures-complete-guide"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl border border-[#2a2e39] hover:border-brand/50 hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              What Are Perpetual Futures? The Complete Beginner&apos;s Guide
            </h4>
            <p className="text-gray-600 text-sm">
              Learn how perps work, funding rates, and leverage—before you trade
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-brand" />
        </Link>

        <Link
          href="/blog/crypto-funding-rates-explained-earn-passive-income"
          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-brand/50 hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-gray-900 group-hover:text-brand">
              Crypto Funding Rates Explained: Earn Passive Income from Perps
            </h4>
            <p className="text-gray-400 text-sm">
              How funding rates work and how to harvest them on Coincess
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-brand" />
        </Link>
      </div>
    </BlogPostLayout>
  )
}
