import { Metadata } from "next"
import Link from "next/link"
import { BlogPostLayout } from "@/components/BlogPostLayout"
import { LiveTicker } from "@/components/blog/LiveTicker"
import { getBlogPost } from "@/lib/blog-posts"
import {
  TrendingUp,
  Flame,
  Shield,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  Skull,
  Eye,
  Users,
  DollarSign,
  Target,
  Zap,
} from "lucide-react"

const post = getBlogPost("hyperliquid-oil-whales-biggest-traders-2026")!

export const metadata: Metadata = {
  title: `${post.title} | Coincess Team`,
  description: post.description,
  keywords: post.keywords.join(", "),
  openGraph: {
    title: post.title,
    description: post.description,
    type: "article",
    publishedTime: post.publishedAt,
    authors: ["Coincess Team"],
    tags: post.keywords,
  },
}

export default function OilWhalesArticle() {
  return (
    <BlogPostLayout post={post}>
      <div className="not-prose border-none mb-8">
        <LiveTicker coins={["BRENTOIL", "CL"]} />
      </div>

      <p className="text-xl leading-relaxed">
        <strong>
          Over $1 billion in open interest. $720 million in single-day volume.
          $40 million liquidated in 24 hours.
        </strong>{" "}
        The Iran-oil crisis has turned Hyperliquid&apos;s crude oil perpetual
        contracts into one of the most actively traded markets in all of DeFi—and
        a handful of whale traders are making (and losing) fortunes in the
        process.
      </p>

      <p>
        In this Coincess Team deep dive, we identify{" "}
        <strong>the biggest players</strong> in the Hyperliquid oil market, break
        down their positions, and analyze what their moves tell us about where
        crude is headed next.
      </p>

      {/* Market stats banner */}
      <div className="not-prose border-none my-10">
        <div className="border-none bg-[#141620] rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
              Hyperliquid Oil Market Stats — March 2026
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold text-white">$1.02B</div>
              <div className="text-sm text-slate-400">24h Volume (CL)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">$195M</div>
              <div className="text-sm text-slate-400">Open Interest</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">$40M+</div>
              <div className="text-sm text-slate-400">Liquidations (24h)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">18x</div>
              <div className="text-sm text-slate-400">Volume Surge (1 week)</div>
            </div>
          </div>
        </div>
      </div>

      <h2>Why Hyperliquid Became the Oil Trading Arena</h2>

      <p>
        Traditional oil futures on the CME and ICE trade Monday through Friday
        with overnight closures. When Iran escalated strikes over the weekend of
        March 8-9, traditional markets were <strong>closed</strong>. Traders with
        conviction — or desperation — had one place to go:{" "}
        <strong>Hyperliquid&apos;s 24/7 oil perpetual contracts</strong>.
      </p>

      <p>
        On Sunday, March 9 alone, HIP-3 oil contracts recorded{" "}
        <strong>$720 million in volume</strong>, shattering all previous records.
        Polymarket and Hyperliquid became the weekend barometers for the
        Iran-driven oil shock, with crypto-native traders and macro funds alike
        piling in.
      </p>

      <h2>The Whales: Who&apos;s Moving the Market</h2>

      {/* Whale #1 */}
      <div className="not-prose border-none my-8">
        <div className="bg-red-950 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-800 flex items-center justify-center">
              <Skull className="h-5 w-5 text-red-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">&quot;2 frères 2 fauves&quot;</h3>
              <span className="text-red-400 text-sm font-mono">Largest Oil Short on Hyperliquid</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-red-300">Position</div>
              <div className="font-bold">Short CL</div>
            </div>
            <div>
              <div className="text-sm text-red-300">Size</div>
              <div className="font-bold">12,717 contracts ($13.37M)</div>
            </div>
            <div>
              <div className="text-sm text-red-300">Entry Price</div>
              <div className="font-bold">$78.36</div>
            </div>
            <div>
              <div className="text-sm text-red-300">Liquidation</div>
              <div className="font-bold text-red-400">$120.76</div>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            The biggest single crude oil position on Hyperliquid — and it&apos;s a{" "}
            <strong className="text-red-400">short</strong> entered at $78. With
            oil now trading near $98, this position carries a{" "}
            <strong>$3.4 million floating loss</strong>. The trader needs oil to
            crash 20%+ just to break even. If Brent touches $120, this entire
            $13.37M position gets liquidated — and on Hyperliquid&apos;s thin
            order book, that forced buying could create a massive squeeze that
            sends prices even higher.
          </p>
        </div>
      </div>

      {/* Whale #2 */}
      <div className="not-prose border-none my-8">
        <div className="bg-emerald-950merald-800 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Rune Christensen</h3>
              <span className="text-emerald-400 text-sm">Co-Founder, Sky (formerly MakerDAO)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-emerald-300">Position</div>
              <div className="font-bold">Long CL + BRENTOIL</div>
            </div>
            <div>
              <div className="text-sm text-emerald-300">Size</div>
              <div className="font-bold">$5.7M CL + $292K BRENTOIL</div>
            </div>
            <div>
              <div className="text-sm text-emerald-300">Deposited</div>
              <div className="font-bold">4.01M USDC</div>
            </div>
            <div>
              <div className="text-sm text-emerald-300">P&L</div>
              <div className="font-bold text-emerald-400">+$688K profit</div>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            One of DeFi&apos;s most recognizable names is betting big on oil.
            Rune deposited 4.01M USDC into a fresh Hyperliquid wallet and went
            long on both WTI and Brent. His combined unrealized profit stands at{" "}
            <strong>$688K</strong> ($605K on CL, $83K on BRENTOIL). The move
            signals that serious DeFi money sees the oil trade as a{" "}
            <strong>macro conviction play</strong> — not just crypto degen
            speculation.
          </p>
        </div>
      </div>

      {/* Whale #3 */}
      <div className="not-prose border-none my-8">
        <div className="bg-blue-950 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono">0xefe2...</h3>
              <span className="text-blue-400 text-sm">The Rune Copytrader</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-blue-300">Position</div>
              <div className="font-bold">Long CL + BRENTOIL</div>
            </div>
            <div>
              <div className="text-sm text-blue-300">Size</div>
              <div className="font-bold">$4.06M CL + $3.67M BRENTOIL</div>
            </div>
            <div>
              <div className="text-sm text-blue-300">Strategy</div>
              <div className="font-bold">Mirror Trading</div>
            </div>
            <div>
              <div className="text-sm text-blue-300">P&L</div>
              <div className="font-bold text-emerald-400">+$1.5M profit</div>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Shortly after Rune&apos;s positions appeared on-chain, this address
            mirrored the exact same trades with even larger BRENTOIL exposure.
            The result: <strong>+$1.5M in unrealized profit</strong> — actually
            outperforming Rune himself by leaning harder into Brent. On-chain
            copytrading at its finest.
          </p>
        </div>
      </div>

      {/* Whale #4 */}
      <div className="not-prose border-none my-8">
        <div className="bg-purple-950 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-800 flex items-center justify-center">
              <Eye className="h-5 w-5 text-purple-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono">0xf4b8...</h3>
              <span className="text-purple-400 text-sm">The Mystery Whale — 20x Short</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-purple-300">Position</div>
              <div className="font-bold">Short CL (20x leverage)</div>
            </div>
            <div>
              <div className="text-sm text-purple-300">Size</div>
              <div className="font-bold">~100K contracts ($7.28M)</div>
            </div>
            <div>
              <div className="text-sm text-purple-300">Entry</div>
              <div className="font-bold">$75.34</div>
            </div>
            <div>
              <div className="text-sm text-purple-300">Liquidation</div>
              <div className="font-bold text-red-400">$76.50</div>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Perhaps the most reckless position in the entire market. This trader
            opened a <strong>20x leveraged short</strong> on oil at $75.34 —
            during the middle of the Iran crisis — with a liquidation price just{" "}
            <strong>1.5% above entry</strong>. They even placed limit orders for
            another 30,000 contracts at $73. This was either extreme conviction
            that the war would de-escalate, insider knowledge, or pure
            recklessness. With oil at $98, this position was almost certainly
            liquidated.
          </p>
        </div>
      </div>

      {/* Whale #5 */}
      <div className="not-prose border-none my-8">
        <div className="bg-slate-800 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
              <Target className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono">0xab961...</h3>
              <span className="text-slate-400 text-sm">The Counter-Trend Sniper</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-slate-400">Position</div>
              <div className="font-bold">Short CL</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Size</div>
              <div className="font-bold">$9M</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Entry</div>
              <div className="font-bold">$111.36</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">P&L</div>
              <div className="font-bold text-emerald-400">+~$1M profit</div>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            While everyone was panic-buying oil at $110+, this trader opened a{" "}
            <strong>$9 million short at $111.36</strong> — right at the local
            top. As oil pulled back toward $95-98 after the IEA reserve release,
            the position netted roughly <strong>$1M in profit</strong>. This is
            the kind of counter-trend trading that separates professionals from
            the crowd.
          </p>
        </div>
      </div>

      {/* Whale #6 - Suspected insiders */}
      <div className="not-prose border-none my-8">
        <div className="bg-amber-950mber-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-800 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono">0x1de &amp; 0xb58</h3>
              <span className="text-amber-400 text-sm">Suspected Insider Traders</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-amber-300">Position</div>
              <div className="font-bold">Long CL</div>
            </div>
            <div>
              <div className="text-sm text-amber-300">Size</div>
              <div className="font-bold">$1.83M + $1.34M</div>
            </div>
            <div>
              <div className="text-sm text-amber-300">Entry</div>
              <div className="font-bold">~$70</div>
            </div>
            <div>
              <div className="text-sm text-amber-300">Exit</div>
              <div className="font-bold text-emerald-400">~$74 (+12%)</div>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Two wallets with nearly identical transaction histories opened long
            positions at ~$70 on March 2 —{" "}
            <strong>
              hours before Iran&apos;s retaliatory strikes on Saudi Aramco and
              the Strait of Hormuz closure announcement
            </strong>
            . Both closed at ~$74 for a clean 12% return using 2-3x leverage.
            The timing and wallet similarity raised immediate{" "}
            <strong>insider trading suspicions</strong> across the DeFi
            community.
          </p>
        </div>
      </div>

      <h2>The Liquidation Cascade: What Happens When Whales Get Wiped</h2>

      <p>
        On March 9, oil shorts on Hyperliquid experienced a{" "}
        <strong>$36.9 million liquidation event</strong> in just 24 hours —
        nearly all from the CL-USDC contract. Here&apos;s how it works:
      </p>

      <div className="not-prose border-none my-8">
        <div className="space-y-3">
          {[
            {
              step: "1",
              title: "Geopolitical catalyst hits",
              desc: "Iran strikes ships, oil spikes on the news. Price pushes above key levels.",
            },
            {
              step: "2",
              title: "Margin calls trigger",
              desc: "Leveraged shorts go underwater. Hyperliquid's engine starts issuing margin calls.",
            },
            {
              step: "3",
              title: "Forced buybacks begin",
              desc: "Liquidated shorts become market buy orders, eating through the thin ask side of the order book.",
            },
            {
              step: "4",
              title: "Cascade accelerates",
              desc: "Each liquidation pushes price higher, triggering the next round of liquidations. Price spikes violently.",
            },
            {
              step: "5",
              title: "The wick",
              desc: "Price overshoots by 2-5% in seconds. Sharp traders (and bots) sell into the spike. Price retraces within minutes.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {item.step}
              </div>
              <div className="flex-1 pl-4 pb-2">
                <div className="font-bold text-white">{item.title}</div>
                <div className="text-sm text-gray-300">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p>
        This is exactly what creates those violent{" "}
        <strong>liquidation wicks</strong> visible on the chart — sharp vertical
        spikes that retrace almost immediately. If you&apos;re positioned
        correctly and watching the order book, selling into a liquidation wick is
        one of the highest-edge trades available in DeFi.
      </p>

      <h2>What the Whales Tell Us About Market Direction</h2>

      <div className="not-prose border-none my-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border-none bg-[#141620] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Bull Signals</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-200">
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                <span>
                  DeFi blue-chip money (Rune) is long with real size ($6M+)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                <span>
                  Copytraders are amplifying the long signal with $7.7M in mirror positions
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                <span>
                  Massive short (13.37M) sitting at $120 liq — if oil approaches
                  that level, forced buying could cascade price to $130+
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                <span>
                  Strait of Hormuz still effectively closed with no ceasefire in sight
                </span>
              </li>
            </ul>
          </div>

          <div className="border-none bg-[#141620] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-bold text-white">Bear Signals</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-200">
              <li className="flex gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>
                  Smart money (0xab961) profited from shorting the $111 top — suggests a local ceiling
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>
                  IEA releasing 400M barrels — largest emergency reserve release
                  in history
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>
                  Suspected insiders closed early at $74 — didn&apos;t ride the full move to $100+
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>
                  Demand destruction kicking in: airlines cutting routes, factories slowing
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <h2>How to Use Whale Watching in Your Trading</h2>

      <p>
        On-chain oil trading on Hyperliquid has a unique advantage over
        traditional futures: <strong>every position is transparent</strong>. You
        can see exactly who&apos;s long, who&apos;s short, their entry price,
        their liquidation price, and their P&L — in real time.
      </p>

      <p>Here&apos;s how to use this information:</p>

      <ul>
        <li>
          <strong>Track liquidation levels</strong> — When a massive short has a
          known liquidation price (like $120.76), that level becomes a magnet.
          If price approaches it, the forced buying can create a self-fulfilling
          prophecy.
        </li>
        <li>
          <strong>Follow smart money</strong> — When DeFi founders deposit
          millions into fresh wallets for oil trades, that&apos;s a high-signal
          conviction indicator.
        </li>
        <li>
          <strong>Fade the crowd</strong> — When funding rates are extremely
          positive (longs paying shorts), the market is overcrowded on one side.
          Counter-trend trades from the short side become attractive.
        </li>
        <li>
          <strong>Sell into liquidation wicks</strong> — If you&apos;re long and
          see a sudden vertical spike, consider taking profit immediately. The
          spike is likely a liquidation cascade that will retrace.
        </li>
      </ul>

      {/* Risk callout */}
      <div className="not-prose border-none my-8 bg-[#141620] rounded-xl p-6">
        <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Trading Risk Disclosure
        </h4>
        <p className="text-amber-400 text-sm">
          The whale positions described in this article can change at any time.
          On-chain data provides transparency but not certainty. Leveraged
          trading amplifies both gains and losses. Never trade with more than you
          can afford to lose.
        </p>
      </div>

      {/* Primary CTA */}
      <div className="not-prose border-none mt-12">
        <div className="border-none bg-[#141620] rounded-2xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-3">
            Trade Oil on Coincess
          </h3>
          <p className="text-slate-300 mb-6 max-w-lg mx-auto">
            Join the whales. Go long or short on Crude Oil and Brent Oil with up
            to 50x leverage. 24/7, no KYC, starting from $10.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trade/CL"
              className="inline-block px-8 py-3 bg-[#141620] text-white font-semibold rounded-full hover:bg-amber-400 transition-colors"
            >
              Trade Crude Oil (CL)
            </Link>
            <Link
              href="/trade/BRENTOIL"
              className="inline-block px-8 py-3 bg-[#1a1d26] text-gray-200 font-semibold rounded-full hover:bg-[#252830] transition-colors"
            >
              Trade Brent Oil
            </Link>
          </div>
        </div>
      </div>

      {/* Related articles */}
      <div className="not-prose border-none mt-12 space-y-4">
        <h3 className="font-bold text-white">Related Intelligence</h3>

        <Link
          href="/blog/oil-prices-iran-war-how-to-trade-crude-oil-2026"
          className="flex items-center justify-between p-4 bg-[#1a1d26] rounded-xl hover:bg-brand/5 transition-colors group"
        >
          <div>
            <h4 className="font-bold text-white group-hover:text-brand">
              Oil Prices Are Surging: How the Iran War Is Driving Crude to $120
            </h4>
            <p className="text-gray-300 text-sm">
              Full breakdown of why oil is spiking and how to trade it
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
              Crypto 101: Get Your First Coin in 5 Minutes
            </h4>
            <p className="text-gray-300 text-sm">
              New to crypto? Get set up to start trading
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-brand" />
        </Link>
      </div>
    </BlogPostLayout>
  )
}
