"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react"

interface Coin {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  fully_diluted_valuation: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number
  max_supply: number | null
  ath: number
  ath_change_percentage: number
  ath_date: string
  atl: number
  atl_change_percentage: number
  atl_date: string
  last_updated: string
}

type SortField = "market_cap_rank" | "current_price" | "price_change_percentage_24h" | "market_cap" | "total_volume"
type SortDirection = "asc" | "desc"

export function CoinsTable() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [filteredCoins, setFilteredCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("market_cap_rank")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  useEffect(() => {
    fetchCoins()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCoins, 30000)
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
      let aValue: number
      let bValue: number

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
      setCoins(data)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching coins:", error)
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value)
  }

  const formatLargeNumber = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <div className="text-gray-600">Loading cryptocurrency data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
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
            </tr>
          </thead>
          <tbody>
            {filteredCoins.map((coin) => (
              <tr
                key={coin.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 px-4 text-gray-600">{coin.market_cap_rank}</td>
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
                      coin.price_change_percentage_24h >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {coin.price_change_percentage_24h >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
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

