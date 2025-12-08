"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, User, Menu, X } from "lucide-react"
import { Logo } from "./Logo"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="w-full border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>

          {/* Navigation Links - Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/coins" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              Coins
            </Link>
            <Link href="/swap-guide" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              Swap Guide
            </Link>
            <Link href="/crypto-leverage-calculator" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              Calculator
            </Link>
            <Link href="/blog" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              Blog
            </Link>
          </nav>

          {/* Right side - User greeting and icons */}
          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-600 hover:text-gray-900 transition-colors" aria-label="User menu">
              <User className="h-5 w-5" />
            </button>
            <button className="hidden sm:block p-2 text-gray-600 hover:text-gray-900 transition-colors" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <button
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-100 py-4 space-y-4">
            <Link
              href="/coins"
              className="block px-4 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Coins
            </Link>
            <Link
              href="/swap-guide"
              className="block px-4 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Swap Guide
            </Link>
            <Link
              href="/crypto-leverage-calculator"
              className="block px-4 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Calculator
            </Link>
            <Link
              href="/blog"
              className="block px-4 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Blog
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}

