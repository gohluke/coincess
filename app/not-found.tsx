import Link from "next/link"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Home, Coins, Calculator, FileText, MoveLeft, HelpCircle } from "lucide-react"

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Header />

            <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl w-full text-center">
                    {/* Error Code & Icon */}
                    <div className="mb-8 flex justify-center">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-[#7C3AED]/10 rounded-full blur-2xl animate-pulse"></div>
                            <div className="relative bg-white border border-[#7C3AED]/20 rounded-2xl p-6 shadow-sm">
                                <HelpCircle className="h-12 w-12 text-[#7C3AED]" />
                            </div>
                        </div>
                    </div>

                    <h1 className="text-8xl font-black text-[#7C3AED] mb-4">404</h1>
                    <h2 className="text-3xl font-bold text-gray-900 mb-6">Page Not Found</h2>

                    <p className="text-lg text-gray-600 mb-10 max-w-lg mx-auto">
                        Sorry, we couldn't find the page you're looking for. The link might be broken or the page may have been moved.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                        <Button asChild size="lg" className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 rounded-full transition-all hover:scale-105 active:scale-95">
                            <Link href="/" className="flex items-center gap-2">
                                <Home className="h-4 w-4" />
                                Back to Home
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="border-gray-200 hover:border-[#7C3AED] hover:text-[#7C3AED] px-8 rounded-full transition-all">
                            <Link href="/coins" className="flex items-center gap-2">
                                <Coins className="h-4 w-4" />
                                Browse Coins
                            </Link>
                        </Button>
                    </div>

                    {/* Quick Links Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-12 border-t border-gray-100">
                        <Link href="/swap-guide" className="p-4 rounded-xl hover:bg-gray-50 transition-colors flex flex-col items-center gap-2 group">
                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-[#7C3AED]/10 group-hover:text-[#7C3AED] transition-colors">
                                <FileText className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Swap Guide</span>
                        </Link>

                        <Link href="/crypto-leverage-calculator" className="p-4 rounded-xl hover:bg-gray-50 transition-colors flex flex-col items-center gap-2 group">
                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-[#7C3AED]/10 group-hover:text-[#7C3AED] transition-colors">
                                <Calculator className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Calculator</span>
                        </Link>

                        <Link href="/blog" className="p-4 rounded-xl hover:bg-gray-50 transition-colors flex flex-col items-center gap-2 group">
                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-[#7C3AED]/10 group-hover:text-[#7C3AED] transition-colors">
                                <FileText className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Blog</span>
                        </Link>

                        <Link href="/coins" className="p-4 rounded-xl hover:bg-gray-50 transition-colors flex flex-col items-center gap-2 group">
                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-[#7C3AED]/10 group-hover:text-[#7C3AED] transition-colors">
                                <MoveLeft className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">All Coins</span>
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    )
}
