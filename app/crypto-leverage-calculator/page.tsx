import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { LeverageCalculator } from "@/components/LeverageCalculator"
import { Calculator, TrendingUp, Shield, Target, AlertTriangle } from "lucide-react"

export const metadata = {
  title: "Crypto Leverage Calculator - coincess",
  description: "Calculate potential profits and losses for leveraged cryptocurrency trades with our professional perpetual futures calculator",
}

export default function CryptoLeverageCalculatorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-purple-50 to-blue-50 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-6">
                <Calculator className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Crypto Perpetual Futures Calculator
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Strategically gauge the leverage potential of your position with our advanced calculator. Make informed trading decisions with real-time profit and loss calculations.
              </p>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
            <div className="grid lg:grid-cols-3 gap-8 mb-16">
              {/* Left Column - Content */}
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-purple-600" />
                    Understanding Leverage in Crypto Trading
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                    As the world of digital assets continues to evolve, cryptocurrency trading has emerged as a sophisticated investment avenue for modern investors. Among the various strategies available, <strong>leverage trading</strong> stands out as a powerful mechanism that can significantly amplify your trading potential.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                    Leverage in cryptocurrency trading refers to the practice of borrowing funds to increase the size of your trading position beyond your initial capital investment. This financial tool allows traders to control larger positions with a smaller amount of capital, potentially multiplying profits from successful trades. However, it's crucial to understand that while leverage can magnify gains, it equally amplifies losses—making risk management paramount.
                  </p>
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-yellow-900 mb-2">Important Risk Warning</h3>
                      <p className="text-yellow-800 text-sm leading-relaxed">
                        Leveraged trading involves substantial risk of loss. While it can amplify profits, losses can exceed your initial investment. Always trade responsibly and never invest more than you can afford to lose. Consider your risk tolerance and trading experience before engaging in leveraged positions.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <Shield className="w-8 h-8 text-purple-600" />
                    Navigating the Risks of Leverage Trading
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                    While the promise of amplified returns is undoubtedly alluring, leveraged trading is not without significant risks. The same mechanism that multiplies profits can equally magnify losses, sometimes beyond your initial investment. Understanding these risks and implementing effective risk management strategies is essential for any serious trader.
                  </p>
                  <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                    Key risks include <strong>liquidation risk</strong> (where positions are automatically closed if losses exceed margin requirements), <strong>volatility risk</strong> (crypto markets can experience extreme price swings), and <strong>leverage risk</strong> (higher leverage means higher risk of significant losses). Successful leveraged trading requires discipline, proper risk management, and a thorough understanding of market dynamics.
                  </p>
                </div>

                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <Target className="w-8 h-8 text-purple-600" />
                    Why Use Our Crypto Perpetual Futures Calculator?
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                    Our Crypto Perpetual Futures Calculator is designed to be your strategic partner in leveraged trading. This sophisticated tool helps you manage risk by calculating potential profit and loss scenarios before you open a position, enabling data-driven decision-making rather than relying solely on intuition.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">Real-Time Calculations</h3>
                      <p className="text-gray-600 text-sm">
                        Instantly calculate potential profits, losses, and return on equity based on your trading parameters.
                      </p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">Risk Assessment</h3>
                      <p className="text-gray-600 text-sm">
                        Understand liquidation prices and margin requirements before entering any position.
                      </p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">Bidirectional Analysis</h3>
                      <p className="text-gray-600 text-sm">
                        Calculate outcomes for both long and short positions with equal precision.
                      </p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">Strategic Planning</h3>
                      <p className="text-gray-600 text-sm">
                        Plan your trades with confidence using detailed profit and loss projections.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-100 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Key Features of Our Calculator</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>Calculate initial margin requirements based on leverage and position size</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>Determine profit and loss (PNL) for different exit price scenarios</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>Calculate return on equity (ROE) to evaluate trade efficiency</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>Identify liquidation prices to manage risk effectively</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>Support for both long and short position calculations</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column - Quick Tips */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg p-6 text-white sticky top-8">
                  <h3 className="text-xl font-bold mb-4">Trading Best Practices</h3>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>Start with lower leverage ratios to understand market dynamics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>Always set stop-loss orders to limit potential losses</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>Never invest more than you can afford to lose</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">4.</span>
                      <span>Use our calculator to plan trades before execution</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">5.</span>
                      <span>Monitor positions regularly and adjust as needed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">6.</span>
                      <span>Keep learning and stay updated on market trends</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Calculator Section */}
            <div className="mb-16">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Try Our Calculator</h2>
                <p className="text-gray-600 text-lg">
                  Input your trading parameters below to see potential outcomes
                </p>
              </div>
              <LeverageCalculator />
            </div>

            {/* Key Takeaways */}
            <div className="bg-gray-50 rounded-lg p-8 mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Takeaways</h2>
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                Leveraged trading in the cryptocurrency market offers significant profit potential for experienced traders. However, it's not a strategy to be used blindly or without proper preparation. Understanding the potential risks and rewards is fundamental to success, and our Crypto Perpetual Futures Calculator is designed to be your essential tool in this journey.
              </p>
              <p className="text-gray-700 leading-relaxed text-lg">
                By combining the right knowledge, strategic planning, and powerful analytical tools like our calculator, you can navigate the volatile crypto markets with greater confidence and precision. Remember: successful trading is not just about maximizing profits—it's about managing risk effectively while pursuing your investment goals.
              </p>
            </div>
          </div>
        </section>
      </main>
      <div className="flex-1"></div>
      <Footer />
    </div>
  )
}
