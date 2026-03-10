"use client"

import { useState, useEffect, useCallback, useRef, ChangeEvent, KeyboardEvent } from "react"
import {
  ArrowUp, ArrowDown, Calculator, TrendingUp, TrendingDown,
  AlertCircle, DollarSign, Percent, Clock, Shield, BarChart3, Target,
} from "lucide-react"

type Direction = "long" | "short"
type FeeType = "maker" | "taker"

interface CalculatorInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  prefix?: string
  suffix?: string
  readOnly?: boolean
  allowNegative?: boolean
  hint?: string
  error?: string
  compact?: boolean
}

function CalculatorInput({
  id, label, value, onChange, onFocus, onBlur,
  prefix, suffix, readOnly = false, allowNegative = false,
  hint, error, compact = false,
}: CalculatorInputProps) {
  const sanitizeInput = (input: string): string => {
    let sanitized = input
    if (allowNegative) {
      sanitized = sanitized.replace(/[^\d.-]/g, "")
      const firstChar = sanitized.charAt(0)
      const rest = sanitized.slice(1).replace(/-/g, "")
      sanitized = firstChar + rest
    } else {
      sanitized = sanitized.replace(/[^\d.]/g, "")
    }
    const parts = sanitized.split(".")
    if (parts.length > 2) sanitized = parts[0] + "." + parts.slice(1).join("")
    return sanitized
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onChange(sanitizeInput(e.target.value))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", ".", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return
    if (allowedKeys.includes(e.key)) {
      if (e.key === "." && value.includes(".")) e.preventDefault()
      return
    }
    if (e.key === "-" && allowNegative) {
      const input = e.currentTarget
      if (input.selectionStart === 0 && !value.includes("-")) return
      e.preventDefault()
      return
    }
    if (/^\d$/.test(e.key)) return
    e.preventDefault()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const sanitized = sanitizeInput(e.clipboardData.getData("text"))
    const input = e.currentTarget
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    onChange(sanitizeInput(value.slice(0, start) + sanitized + value.slice(end)))
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <label htmlFor={id} className={`block font-medium text-gray-700 ${compact ? "text-xs" : "text-sm"}`}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          type="text" inputMode="decimal" id={id} value={value}
          onChange={handleChange} onKeyDown={handleKeyDown} onPaste={handlePaste}
          onFocus={onFocus} onBlur={onBlur}
          readOnly={readOnly} autoComplete="off"
          className={`
            w-full rounded-lg border bg-white text-gray-900 transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand
            ${compact ? "h-10 text-sm" : "h-12"}
            ${prefix ? "pl-8" : "pl-4"}
            ${suffix ? "pr-16" : "pr-4"}
            ${readOnly ? "bg-gray-50 text-gray-600 cursor-not-allowed" : ""}
            ${error ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-gray-200"}
          `}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">{suffix}</span>
        )}
      </div>
      {hint && !error && <p className="text-[11px] text-gray-400">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color = "gray" }: { label: string; value: string; sub?: string; color?: "green" | "red" | "gray" | "brand" }) {
  const colors = {
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    brand: "bg-brand/5 border-brand/20 text-brand",
  }
  return (
    <div className={`p-3 rounded-lg border ${colors[color]}`}>
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function LeverageCalculator() {
  const [leverage, setLeverage] = useState("10")
  const [quantity, setQuantity] = useState("1000")
  const [entryPrice, setEntryPrice] = useState("10")
  const [exitPrice, setExitPrice] = useState("20")
  const [direction, setDirection] = useState<Direction>("long")
  const [feeType, setFeeType] = useState<FeeType>("taker")
  const [entryFeeRate, setEntryFeeRate] = useState("0.035")
  const [exitFeeRate, setExitFeeRate] = useState("0.035")
  const [fundingRate, setFundingRate] = useState("0.01")
  const [durationHours, setDurationHours] = useState("24")

  // Derived state
  const [initialMargin, setInitialMargin] = useState("")
  const [pnl, setPnl] = useState("")
  const [roe, setRoe] = useState("")
  const [liquidationPrice, setLiquidationPrice] = useState("")
  const [totalFunding, setTotalFunding] = useState("")
  const [netPnl, setNetPnl] = useState("")
  const [netRoe, setNetRoe] = useState("")
  const [entryFee, setEntryFee] = useState("")
  const [exitFee, setExitFee] = useState("")
  const [totalFees, setTotalFees] = useState("")
  const [breakEvenPrice, setBreakEvenPrice] = useState("")
  const [positionNotional, setPositionNotional] = useState("")
  const [marginRatio, setMarginRatio] = useState("")

  const [activeField, setActiveField] = useState<"margin" | "pnl" | "roe" | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const parseNumber = (value: string): number => {
    const num = parseFloat(value.replace(/[^\d.-]/g, ""))
    return isNaN(num) ? 0 : num
  }

  const fmt = (num: number, decimals = 6): string => {
    if (!isFinite(num) || isNaN(num)) return "0"
    return parseFloat(num.toFixed(decimals)).toString()
  }

  const fmtUsd = (num: number): string => {
    if (!isFinite(num) || isNaN(num)) return "$0.00"
    const abs = Math.abs(num)
    const formatted = abs >= 1_000_000
      ? (abs / 1_000_000).toFixed(2) + "M"
      : abs >= 1_000
      ? (abs / 1_000).toFixed(2) + "K"
      : abs.toFixed(2)
    return (num < 0 ? "-$" : "$") + formatted
  }

  // Sync fee rates when fee type toggle changes
  const prevFeeType = useRef(feeType)
  useEffect(() => {
    if (prevFeeType.current !== feeType) {
      prevFeeType.current = feeType
      if (feeType === "maker") {
        setEntryFeeRate("0.01")
        setExitFeeRate("0.01")
      } else {
        setEntryFeeRate("0.035")
        setExitFeeRate("0.035")
      }
    }
  }, [feeType])

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}
    const lev = parseNumber(leverage)
    const entry = parseNumber(entryPrice)
    const exit = parseNumber(exitPrice)
    const qty = parseNumber(quantity)
    if (lev <= 0) newErrors.leverage = "Must be > 0"
    if (lev > 200) newErrors.leverage = "Max 200x"
    if (entry <= 0) newErrors.entryPrice = "Must be > 0"
    if (exit <= 0 && activeField !== "pnl" && activeField !== "roe") newErrors.exitPrice = "Must be > 0"
    if (qty <= 0 && activeField !== "margin") newErrors.quantity = "Must be > 0"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [leverage, entryPrice, exitPrice, quantity, activeField])

  const calculate = useCallback((type?: "margin" | "pnl" | "roe") => {
    const lev = parseNumber(leverage)
    const qty = parseNumber(quantity)
    const entry = parseNumber(entryPrice)
    const exit = parseNumber(exitPrice)
    if (lev <= 0 || entry <= 0) return

    let calcMargin: number
    let calcQty = qty
    let calcExit = exit

    // Margin ↔ Quantity
    if (type === "margin") {
      const margin = parseNumber(initialMargin)
      if (margin <= 0) return
      calcMargin = margin
      calcQty = (margin * lev) / entry
      setQuantity(fmt(calcQty))
    } else {
      if (qty <= 0) return
      calcMargin = (qty * entry) / lev
      setInitialMargin(fmt(calcMargin, 2))
    }

    const notional = calcQty * entry
    setPositionNotional(fmt(notional, 2))

    // Trading fees
    const entryFeeVal = notional * (parseNumber(entryFeeRate) / 100)
    const exitNotional = calcQty * (calcExit > 0 ? calcExit : entry)
    const exitFeeVal = exitNotional * (parseNumber(exitFeeRate) / 100)
    const totalFeesVal = entryFeeVal + exitFeeVal
    setEntryFee(fmt(entryFeeVal, 2))
    setExitFee(fmt(exitFeeVal, 2))
    setTotalFees(fmt(totalFeesVal, 2))

    // Gross PNL
    let calcPnl: number
    if (type === "pnl") {
      const pnlValue = parseNumber(pnl)
      calcPnl = pnlValue
      calcExit = direction === "long"
        ? (calcQty > 0 ? pnlValue / calcQty + entry : entry)
        : (calcQty > 0 ? entry - pnlValue / calcQty : entry)
      setExitPrice(fmt(calcExit, 4))
    } else {
      if (calcExit <= 0) return
      calcPnl = direction === "long"
        ? (calcExit - entry) * calcQty
        : (entry - calcExit) * calcQty
      setPnl(fmt(calcPnl, 2))
    }

    // Gross ROE
    if (type === "roe") {
      const roeValue = parseNumber(roe)
      calcPnl = (roeValue / 100) * calcMargin
      calcExit = direction === "long"
        ? (calcQty > 0 ? calcPnl / calcQty + entry : entry)
        : (calcQty > 0 ? entry - calcPnl / calcQty : entry)
      setExitPrice(fmt(calcExit, 4))
      setPnl(fmt(calcPnl, 2))
    } else {
      const calcRoe = calcMargin > 0 ? (calcPnl / calcMargin) * 100 : 0
      setRoe(fmt(calcRoe, 2))
    }

    // Liquidation price (simplified: entry ± entry/leverage)
    const liq = direction === "long"
      ? entry - entry / lev
      : entry + entry / lev
    setLiquidationPrice(fmt(Math.max(0, liq), 4))

    // Margin ratio: how close current unrealized loss is to margin
    const unrealizedLoss = Math.max(0, -calcPnl)
    const mRatio = calcMargin > 0 ? (unrealizedLoss / calcMargin) * 100 : 0
    setMarginRatio(fmt(Math.min(mRatio, 100), 1))

    // Funding
    const rate = parseNumber(fundingRate) / 100
    const hours = parseNumber(durationHours)
    const fundingCost = notional * rate * hours
    const directedFunding = direction === "long" ? fundingCost : -fundingCost
    setTotalFunding(fmt(directedFunding, 2))

    // Net PNL = gross - fees - funding
    const net = calcPnl - totalFeesVal - directedFunding
    setNetPnl(fmt(net, 2))
    const netRoeVal = calcMargin > 0 ? (net / calcMargin) * 100 : 0
    setNetRoe(fmt(netRoeVal, 2))

    // Break-even price: price where net PNL = 0 (after fees + funding)
    const totalCosts = totalFeesVal + directedFunding
    let be: number
    if (direction === "long") {
      be = calcQty > 0 ? entry + totalCosts / calcQty : entry
    } else {
      be = calcQty > 0 ? entry - totalCosts / calcQty : entry
    }
    setBreakEvenPrice(fmt(Math.max(0, be), 4))
  }, [leverage, quantity, entryPrice, exitPrice, direction, initialMargin, pnl, roe, entryFeeRate, exitFeeRate, fundingRate, durationHours])

  useEffect(() => {
    validate()
    if (activeField === "margin" && initialMargin) calculate("margin")
    else if (activeField === "pnl" && pnl) calculate("pnl")
    else if (activeField === "roe" && roe) calculate("roe")
    else if (leverage && quantity && entryPrice && exitPrice) calculate()
  }, [leverage, quantity, entryPrice, exitPrice, direction, fundingRate, durationHours, initialMargin, pnl, roe, activeField, entryFeeRate, exitFeeRate, validate, calculate])

  const netPnlNum = parseNumber(netPnl)
  const netRoeNum = parseNumber(netRoe)
  const totalFundingNum = parseNumber(totalFunding)
  const marginRatioNum = parseNumber(marginRatio)

  return (
    <div className="w-full">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand to-brand-hover px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Perpetual Futures Calculator</h2>
              <p className="text-white/80 text-sm">Industry-grade position planner with fees, funding & break-even</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Direction + Fee Type */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDirection("long")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    direction === "long" ? "bg-green-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  <ArrowUp className="h-4 w-4" /> Long
                </button>
                <button type="button" onClick={() => setDirection("short")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    direction === "short" ? "bg-red-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  <ArrowDown className="h-4 w-4" /> Short
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFeeType("maker")}
                  className={`py-2.5 rounded-lg font-medium text-sm transition-all ${
                    feeType === "maker" ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  Maker
                </button>
                <button type="button" onClick={() => setFeeType("taker")}
                  className={`py-2.5 rounded-lg font-medium text-sm transition-all ${
                    feeType === "taker" ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  Taker
                </button>
              </div>
            </div>
          </div>

          {/* Core Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <CalculatorInput id="leverage" label="Leverage" value={leverage} onChange={setLeverage}
              suffix="x" hint="1–200x" error={errors.leverage} compact />
            <CalculatorInput id="quantity" label="Quantity (contracts)" value={quantity} onChange={setQuantity}
              hint="Position size" error={errors.quantity} compact />
            <CalculatorInput id="entryPrice" label="Entry Price" value={entryPrice} onChange={setEntryPrice}
              prefix="$" error={errors.entryPrice} compact />
            <CalculatorInput id="exitPrice" label="Exit Price" value={exitPrice} onChange={setExitPrice}
              prefix="$" error={errors.exitPrice} compact />
          </div>

          {/* Fee & Funding Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <CalculatorInput id="entryFeeRate" label="Entry Fee" value={entryFeeRate} onChange={setEntryFeeRate}
              suffix="%" hint={feeType === "maker" ? "Maker: 0.01%" : "Taker: 0.035%"} compact />
            <CalculatorInput id="exitFeeRate" label="Exit Fee" value={exitFeeRate} onChange={setExitFeeRate}
              suffix="%" hint="Applied on close" compact />
            <CalculatorInput id="fundingRate" label="Funding Rate" value={fundingRate} onChange={setFundingRate}
              suffix="%/hr" allowNegative hint="Hourly rate" compact />
            <CalculatorInput id="durationHours" label="Duration" value={durationHours} onChange={setDurationHours}
              suffix="hours" hint="Hold time" compact />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-5" />

          {/* Interactive Results */}
          <div className="grid md:grid-cols-3 gap-3 mb-5">
            <CalculatorInput id="initialMargin" label="Initial Margin" value={initialMargin}
              onChange={setInitialMargin} onFocus={() => setActiveField("margin")} onBlur={() => setActiveField(null)}
              suffix="USDC" hint="Type to set budget" compact />
            <CalculatorInput id="pnl" label="Target PNL" value={pnl}
              onChange={setPnl} onFocus={() => setActiveField("pnl")} onBlur={() => setActiveField(null)}
              suffix="USDC" allowNegative hint="Type to solve exit price" compact />
            <CalculatorInput id="roe" label="Target ROE" value={roe}
              onChange={setRoe} onFocus={() => setActiveField("roe")} onBlur={() => setActiveField(null)}
              suffix="%" allowNegative hint="Type to solve exit price" compact />
          </div>

          {/* Results Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard label="Position Notional" value={fmtUsd(parseNumber(positionNotional))} sub={`${leverage}x leveraged`} color="brand" />
            <StatCard label="Liquidation Price" value={`$${liquidationPrice}`}
              sub={`${fmt(100 - marginRatioNum, 1)}% margin remaining`}
              color={marginRatioNum > 80 ? "red" : marginRatioNum > 50 ? "gray" : "green"} />
            <StatCard label="Break-Even Price" value={`$${breakEvenPrice}`} sub="After fees + funding" color="gray" />
            <StatCard label="Margin Ratio"
              value={`${marginRatio}%`}
              sub={marginRatioNum > 80 ? "Danger zone" : marginRatioNum > 50 ? "Caution" : "Healthy"}
              color={marginRatioNum > 80 ? "red" : marginRatioNum > 50 ? "gray" : "green"} />
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
            <StatCard label="Entry Fee" value={`-$${entryFee}`} sub={`${entryFeeRate}%`} color="red" />
            <StatCard label="Exit Fee" value={`-$${exitFee}`} sub={`${exitFeeRate}%`} color="red" />
            <StatCard label="Total Fees" value={`-$${totalFees}`} color="red" />
            <StatCard label={`Funding (${durationHours}h)`}
              value={`${totalFundingNum > 0 ? "-" : totalFundingNum < 0 ? "+" : ""}$${Math.abs(totalFundingNum).toFixed(2)}`}
              sub={totalFundingNum > 0 ? "You pay" : totalFundingNum < 0 ? "You earn" : "Neutral"}
              color={totalFundingNum > 0 ? "red" : totalFundingNum < 0 ? "green" : "gray"} />
            <StatCard label="Gross PNL" value={`${parseNumber(pnl) >= 0 ? "+" : ""}$${pnl}`}
              sub="Before costs" color={parseNumber(pnl) >= 0 ? "green" : "red"} />
            <StatCard label="Gross ROE" value={`${parseNumber(roe) >= 0 ? "+" : ""}${roe}%`}
              sub="Before costs" color={parseNumber(roe) >= 0 ? "green" : "red"} />
          </div>

          {/* Net Result Banner */}
          {netPnl && netRoe && (
            <div className={`p-4 rounded-xl border-2 ${netPnlNum >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              <div className="flex items-center gap-3">
                {netPnlNum >= 0 ? (
                  <div className="p-2 rounded-full bg-green-100">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-red-100">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                )}
                <div className="flex-1">
                  <p className={`text-xl font-bold ${netPnlNum >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {netPnlNum >= 0 ? "+" : ""}{fmtUsd(netPnlNum)} ({netPnlNum >= 0 ? "+" : ""}{netRoe}%)
                  </p>
                  <p className="text-sm text-gray-600">
                    Net {netPnlNum >= 0 ? "profit" : "loss"} at ${exitPrice} after {durationHours}h
                    <span className="text-gray-400"> — fees: ${totalFees}, funding: ${Math.abs(totalFundingNum).toFixed(2)}</span>
                  </p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs text-gray-500">Break-even</p>
                  <p className="text-sm font-semibold text-gray-700">${breakEvenPrice}</p>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-5 text-[11px] text-gray-400 leading-relaxed">
            Calculations are estimates. Actual margin = initial margin + open loss (difference between order price and mark price).
            Liquidation price is simplified and may vary with cross-margin, insurance fund, and maintenance margin requirements.
            Fee rates shown are Hyperliquid defaults — adjust for your VIP tier. Funding rate compounds each hour and may fluctuate.
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <a href="https://dydx.exchange/r/SABZRJKF" target="_blank" rel="noopener noreferrer"
            className="block w-full text-center py-3 px-6 bg-brand hover:bg-brand-hover text-white font-medium rounded-lg transition-colors">
            Trade @ dYdX — Get 5% Off Fees
          </a>
        </div>
      </div>
    </div>
  )
}
