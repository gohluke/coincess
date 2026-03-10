"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { ArrowUpDown, TrendingUp, TrendingDown, ShoppingCart, Sparkles, Megaphone, ExternalLink } from "lucide-react"

// Sponsored coin configuration - appears as first row in table
const SPONSORED_COIN = {
  name: "BOOF",
  symbol: "BOOF",
  website: "https://boof.gg",
  contractAddress: "73xkaJou2EzfNxh2Q14Mw61emuVZjX6xHHv75aD8GqN",
  blockchain: "solana",
}

interface SponsoredCoinData {
  current_price: number | null
  price_change_percentage_24h: number | null
  market_cap: number | null
  total_volume: number | null
  image: string | null
}

interface Coin {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number | null
  market_cap: number | null
  market_cap_rank: number | null
  fully_diluted_valuation: number | null
  total_volume: number | null
  high_24h: number | null
  low_24h: number | null
  price_change_24h: number | null
  price_change_percentage_24h: number | null
  market_cap_change_24h: number | null
  market_cap_change_percentage_24h: number | null
  circulating_supply: number | null
  total_supply: number | null
  max_supply: number | null
  ath: number | null
  ath_change_percentage: number | null
  ath_date: string | null
  atl: number | null
  atl_change_percentage: number | null
  atl_date: string | null
  last_updated: string
}

type SortField = "market_cap_rank" | "current_price" | "price_change_percentage_24h" | "market_cap" | "total_volume"
type SortDirection = "asc" | "desc"

export function CoinsTable() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [filteredCoins, setFilteredCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("market_cap_rank")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [sponsoredCoinData, setSponsoredCoinData] = useState<SponsoredCoinData>({
    current_price: null,
    price_change_percentage_24h: null,
    market_cap: null,
    total_volume: null,
    image: null,
  })

  // Fetch sponsored coin data from GeckoTerminal
  const fetchSponsoredCoin = async () => {
    try {
      // First get token info for the image
      const tokenResponse = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${SPONSORED_COIN.contractAddress}`
      )
      const tokenData = await tokenResponse.json()
      const imageUrl = tokenData?.data?.attributes?.image_url || null

      // Then get pool data for price info
      const poolsResponse = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${SPONSORED_COIN.contractAddress}/pools`
      )
      const poolsData = await poolsResponse.json()
      
      if (poolsData.data && poolsData.data.length > 0) {
        // Get the pool with highest reserve (liquidity)
        const mainPool = poolsData.data.reduce((best: typeof poolsData.data[0], current: typeof poolsData.data[0]) => 
          parseFloat(current.attributes?.reserve_in_usd || "0") > parseFloat(best.attributes?.reserve_in_usd || "0") ? current : best
        , poolsData.data[0])
        
        const attrs = mainPool.attributes
        setSponsoredCoinData({
          current_price: parseFloat(attrs.base_token_price_usd) || null,
          price_change_percentage_24h: parseFloat(attrs.price_change_percentage?.h24) || null,
          market_cap: attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : (attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : null),
          total_volume: parseFloat(attrs.volume_usd?.h24) || null,
          image: imageUrl,
        })
      }
    } catch (error) {
      console.error("Error fetching sponsored coin data:", error)
    }
  }

  useEffect(() => {
    fetchCoins()
    fetchSponsoredCoin()
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchCoins()
      fetchSponsoredCoin()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let filtered = [...coins]
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (coin) =>
          coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number | null
      let bValue: number | null

      switch (sortField) {
        case "market_cap_rank":
          aValue = a.market_cap_rank
          bValue = b.market_cap_rank
          break
        case "current_price":
          aValue = a.current_price
          bValue = b.current_price
          break
        case "price_change_percentage_24h":
          aValue = a.price_change_percentage_24h
          bValue = b.price_change_percentage_24h
          break
        case "market_cap":
          aValue = a.market_cap
          bValue = b.market_cap
          break
        case "total_volume":
          aValue = a.total_volume
          bValue = b.total_volume
          break
        default:
          return 0
      }

      // Handle null values - push them to the end
      if (aValue === null && bValue === null) return 0
      if (aValue === null) return 1
      if (bValue === null) return -1

      if (sortDirection === "asc") {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    setFilteredCoins(filtered)
  }, [coins, searchQuery, sortField, sortDirection])

  const fetchCoins = async () => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h"
      )
      const data = await response.json()
      
      // Validate that we got an array response (API might return error object when rate limited)
      if (Array.isArray(data)) {
        setCoins(data)
        setError(null)
      } else {
        console.error("API returned invalid data:", data)
        // Check if it's a rate limit error or other API error
        const errorMsg = data?.status?.error_message || data?.error || "Failed to fetch cryptocurrency data"
        setError(errorMsg)
        // Keep existing coins if we already have data
        if (coins.length === 0) {
          setCoins([])
        }
      }
      setLoading(false)
    } catch (error) {
      console.error("Error fetching coins:", error)
      setError("Failed to connect to the API. Please try again later.")
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "N/A"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value)
  }

  const formatLargeNumber = (value: number | null) => {
    if (value === null || value === undefined) return "N/A"
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return "N/A"
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
          <div className="text-gray-600">Loading cryptocurrency data...</div>
        </div>
      </div>
    )
  }

  if (error && coins.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-red-500 text-lg font-medium">Unable to load data</div>
          <div className="text-gray-600 max-w-md">{error}</div>
          <button
            onClick={fetchCoins}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Advertise Your Coin CTA */}
      <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Want to feature your coin here?</h3>
              <p className="text-rose-100 text-sm">Get your project in front of thousands of crypto enthusiasts</p>
            </div>
          </div>
          <a
            href="mailto:advertise@coincess.com?subject=Coin%20Sponsorship%20Inquiry&body=Hi%2C%0A%0AI%27d%20like%20to%20advertise%20my%20coin%20on%20Coincess.%0A%0ACoin%20Name%3A%0AWebsite%3A%0ABlockchain%3A%0ADescription%3A%0A%0AThank%20you!"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-rose-600 font-semibold rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap"
          >
            <Megaphone className="h-4 w-4" />
            Advertise Your Coin
          </a>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search by name or symbol (e.g., Bitcoin, BTC)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse bg-white">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                <button
                  onClick={() => handleSort("market_cap_rank")}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  #
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Coin</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">
                <button
                  onClick={() => handleSort("current_price")}
                  className="flex items-center gap-1 ml-auto hover:text-gray-900"
                >
                  Price
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">
                <button
                  onClick={() => handleSort("price_change_percentage_24h")}
                  className="flex items-center gap-1 ml-auto hover:text-gray-900"
                >
                  24h
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700 hidden md:table-cell">
                <button
                  onClick={() => handleSort("market_cap")}
                  className="flex items-center gap-1 ml-auto hover:text-gray-900"
                >
                  Market Cap
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700 hidden lg:table-cell">
                <button
                  onClick={() => handleSort("total_volume")}
                  className="flex items-center gap-1 ml-auto hover:text-gray-900"
                >
                  Volume (24h)
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Sponsored Coin Row - Always at top */}
            <tr className="border-b border-yellow-200 bg-gradient-to-r from-yellow-50/50 via-orange-50/30 to-yellow-50/50 hover:from-yellow-50 hover:via-orange-50/50 hover:to-yellow-50 transition-colors">
              <td className="py-4 px-4">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">
                  <Sparkles className="h-3 w-3" />
                  AD
                </span>
              </td>
              <td className="py-4 px-4">
                <a href={SPONSORED_COIN.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  {sponsoredCoinData.image ? (
                    <img
                      src={sponsoredCoinData.image}
                      alt={SPONSORED_COIN.name}
                      className="w-8 h-8 rounded-full group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow group-hover:scale-110 transition-transform">
                      B
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-[#FF455B] transition-colors">{SPONSORED_COIN.name}</div>
                    <div className="text-sm text-gray-500 uppercase">{SPONSORED_COIN.symbol}</div>
                  </div>
                </a>
              </td>
              <td className="py-4 px-4 text-right font-semibold text-gray-900">
                {sponsoredCoinData.current_price ? formatCurrency(sponsoredCoinData.current_price) : "-"}
              </td>
              <td className="py-4 px-4 text-right">
                <div
                  className={`flex items-center justify-end gap-1 ${
                    sponsoredCoinData.price_change_percentage_24h === null
                      ? "text-gray-500"
                      : sponsoredCoinData.price_change_percentage_24h >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {sponsoredCoinData.price_change_percentage_24h !== null && (
                    sponsoredCoinData.price_change_percentage_24h >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )
                  )}
                  {sponsoredCoinData.price_change_percentage_24h !== null 
                    ? formatPercentage(sponsoredCoinData.price_change_percentage_24h) 
                    : "-"}
                </div>
              </td>
              <td className="py-4 px-4 text-right text-gray-700 hidden md:table-cell">
                {sponsoredCoinData.market_cap ? formatLargeNumber(sponsoredCoinData.market_cap) : "-"}
              </td>
              <td className="py-4 px-4 text-right text-gray-700 hidden lg:table-cell">
                {sponsoredCoinData.total_volume ? formatLargeNumber(sponsoredCoinData.total_volume) : "-"}
              </td>
              <td className="py-4 px-4 text-center">
                <a
                  href={SPONSORED_COIN.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Visit
                </a>
              </td>
            </tr>

            {filteredCoins.map((coin) => (
              <tr
                key={coin.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 px-4 text-gray-600">{coin.market_cap_rank ?? "-"}</td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={coin.image}
                      alt={coin.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">{coin.name}</div>
                      <div className="text-sm text-gray-500 uppercase">{coin.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-right font-semibold text-gray-900">
                  {formatCurrency(coin.current_price)}
                </td>
                <td className="py-4 px-4 text-right">
                  <div
                    className={`flex items-center justify-end gap-1 ${
                      coin.price_change_percentage_24h === null
                        ? "text-gray-500"
                        : coin.price_change_percentage_24h >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {coin.price_change_percentage_24h !== null && (
                      coin.price_change_percentage_24h >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )
                    )}
                    {formatPercentage(coin.price_change_percentage_24h)}
                  </div>
                </td>
                <td className="py-4 px-4 text-right text-gray-700 hidden md:table-cell">
                  {formatLargeNumber(coin.market_cap)}
                </td>
                <td className="py-4 px-4 text-right text-gray-700 hidden lg:table-cell">
                  {formatLargeNumber(coin.total_volume)}
                </td>
                <td className="py-4 px-4 text-center">
                  <a
                    href={`https://trocador.app/?ticker_to=${coin.symbol.toLowerCase()}&ref=2dzDcvfQJY`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF455B] text-white text-sm font-medium rounded-lg hover:bg-[#E63B50] transition-colors"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Buy
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredCoins.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          No coins found matching your search.
        </div>
      )}
    </div>
  )
}

