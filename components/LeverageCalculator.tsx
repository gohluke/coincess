"use client"

import { useState, useEffect, useCallback, useRef, ChangeEvent, KeyboardEvent } from "react"
import {
  ArrowUp, ArrowDown, Calculator, TrendingUp, TrendingDown,
  AlertCircle,
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
      <label htmlFor={id} className={`block font-medium text-[#848e9c] ${compact ? "text-xs" : "text-sm"}`}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555a66] text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          type="text" inputMode="decimal" id={id} value={value}
          onChange={handleChange} onKeyDown={handleKeyDown} onPaste={handlePaste}
          onFocus={onFocus} onBlur={onBlur}
          readOnly={readOnly} autoComplete="off"
          placeholder="–"
          className={`
            placeholder-[#555a66]
            w-full rounded-lg border bg-[#1a1d26] text-white transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50
            ${compact ? "h-10 text-sm" : "h-12"}
            ${prefix ? "pl-8" : "pl-4"}
            ${suffix ? "pr-16" : "pr-4"}
            ${readOnly ? "bg-[#141620] text-[#555a66] cursor-not-allowed" : ""}
            ${error ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500" : "border-[#2a2e3e]"}
          `}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555a66] text-xs pointer-events-none">{suffix}</span>
        )}
      </div>
      {hint && !error && <p className="text-[11px] text-[#555a66]">{hint}</p>}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color = "gray" }: { label: string; value: string; sub?: string; color?: "green" | "red" | "gray" | "brand" }) {
  const colors = {
    green: "bg-emerald-500/10 text-emerald-400",
    red: "bg-red-500/10 text-red-400",
    gray: "bg-[#1a1d26] text-white",
    brand: "bg-brand/10 text-brand",
  }
  return (
    <div className={`p-3 rounded-xl ${colors[color]}`}>
      <p className="text-[11px] text-[#555a66] mb-0.5">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-[#555a66] mt-0.5">{sub}</p>}
    </div>
  )
}

function ExitPriceSlider({ entryPrice, exitPrice, setExitPrice, parseNumber }: {
  entryPrice: string; exitPrice: string; setExitPrice: (v: string) => void; parseNumber: (v: string) => number;
}) {
  const entry = parseNumber(entryPrice)
  const exit = parseNumber(exitPrice)
  if (entry <= 0) return null

  const pctChange = ((exit - entry) / entry) * 100
  const pctDisplay = pctChange >= 0 ? `+${pctChange.toFixed(2)}%` : `${pctChange.toFixed(2)}%`
  const pctColor = pctChange > 0 ? "text-emerald-400" : pctChange < 0 ? "text-red-400" : "text-[#848e9c]"

  const sliderMin = -50
  const sliderMax = 100
  const sliderVal = Math.max(sliderMin, Math.min(sliderMax, pctChange))

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value)
    const newExit = entry * (1 + pct / 100)
    setExitPrice(parseFloat(newExit.toFixed(4)).toString())
  }

  const presets = [-25, -10, -5, -1, 0, 1, 5, 10, 25, 50]

  return (
    <div className="mb-4 col-span-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-[#555a66]">Exit vs Entry</span>
        <span className={`text-xs font-bold ${pctColor}`}>{pctDisplay}</span>
      </div>
      <input
        type="range"
        min={sliderMin} max={sliderMax} step="0.1"
        value={sliderVal}
        onChange={handleSlider}
        className="w-full h-1.5 rounded-full appearance-none bg-[#2a2e3e] accent-brand cursor-pointer"
      />
      <div className="flex gap-1 mt-1.5">
        {presets.map((p) => (
          <button
            key={p} type="button"
            onClick={() => {
              const newExit = entry * (1 + p / 100)
              setExitPrice(parseFloat(newExit.toFixed(4)).toString())
            }}
            className={`flex-1 py-0.5 rounded text-[9px] font-medium transition-colors ${
              Math.abs(pctChange - p) < 0.05
                ? "bg-brand text-white"
                : "bg-[#1a1d26] text-[#555a66] hover:text-[#848e9c]"
            }`}
          >
            {p > 0 ? "+" : ""}{p}%
          </button>
        ))}
      </div>
    </div>
  )
}

export function LeverageCalculator() {
  const [leverage, setLeverage] = useState("10")
  const [quantity, setQuantity] = useState("1")
  const [entryPrice, setEntryPrice] = useState("84250")
  const [exitPrice, setExitPrice] = useState("86500")
  const [direction, setDirection] = useState<Direction>("long")
  const [feeType, setFeeType] = useState<FeeType>("taker")
  const [entryFeeRate, setEntryFeeRate] = useState("0.035")
  const [exitFeeRate, setExitFeeRate] = useState("0.035")
  const [fundingRate, setFundingRate] = useState("0.0031")
  const [durationHours, setDurationHours] = useState("24")

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
  const marginLocked = useRef(false)

  const parseNumber = (value: string): number => {
    const num = parseFloat(value.replace(/[^\d.-]/g, ""))
    return isNaN(num) ? 0 : num
  }

  const fmt = (num: number, decimals = 6): string => {
    if (!isFinite(num) || isNaN(num)) return ""
    return parseFloat(num.toFixed(decimals)).toString()
  }

  const fmtUsdFull = (num: number): string => {
    if (!isFinite(num) || isNaN(num)) return "–"
    const abs = Math.abs(num)
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (num < 0 ? "-$" : "$") + formatted
  }

  const dash = (v: string, prefix = "", suffix = "") => v ? `${prefix}${v}${suffix}` : "–"

  const prevFeeType = useRef(feeType)
  useEffect(() => {
    if (prevFeeType.current !== feeType) {
      prevFeeType.current = feeType
      if (feeType === "maker") {
        setEntryFeeRate("0.010")
        setExitFeeRate("0.010")
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
    if (lev > 1000) newErrors.leverage = "Max 1000x"
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

    const existingMargin = parseNumber(initialMargin)
    if (type === "margin" || (marginLocked.current && existingMargin > 0 && type !== "pnl" && type !== "roe")) {
      if (existingMargin <= 0) return
      calcMargin = existingMargin
      calcQty = (calcMargin * lev) / entry
      setQuantity(fmt(calcQty))
    } else {
      if (qty <= 0) return
      calcMargin = (qty * entry) / lev
      setInitialMargin(fmt(calcMargin, 2))
      marginLocked.current = true
    }

    const notional = calcQty * entry
    setPositionNotional(fmt(notional, 2))

    const entryFeeVal = notional * (parseNumber(entryFeeRate) / 100)
    const exitNotional = calcQty * (calcExit > 0 ? calcExit : entry)
    const exitFeeVal = exitNotional * (parseNumber(exitFeeRate) / 100)
    const totalFeesVal = entryFeeVal + exitFeeVal
    setEntryFee(fmt(entryFeeVal, 2))
    setExitFee(fmt(exitFeeVal, 2))
    setTotalFees(fmt(totalFeesVal, 2))

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

    const liq = direction === "long"
      ? entry - entry / lev
      : entry + entry / lev
    setLiquidationPrice(fmt(Math.max(0, liq), 4))

    const unrealizedLoss = Math.max(0, -calcPnl)
    const mRatio = calcMargin > 0 ? (unrealizedLoss / calcMargin) * 100 : 0
    setMarginRatio(fmt(Math.min(mRatio, 100), 1))

    const rate = parseNumber(fundingRate) / 100
    const hours = parseNumber(durationHours)
    const fundingCost = notional * rate * hours
    const directedFunding = direction === "long" ? fundingCost : -fundingCost
    setTotalFunding(fmt(directedFunding, 2))

    const net = calcPnl - totalFeesVal - directedFunding
    setNetPnl(fmt(net, 2))
    const netRoeVal = calcMargin > 0 ? (net / calcMargin) * 100 : 0
    setNetRoe(fmt(netRoeVal, 2))

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
    if (activeField === "margin") {
      if (initialMargin) calculate("margin")
      return
    }
    if (activeField === "pnl") {
      if (pnl) calculate("pnl")
      return
    }
    if (activeField === "roe") {
      if (roe) calculate("roe")
      return
    }
    if (leverage && quantity && entryPrice && exitPrice) {
      calculate()
    }
  }, [leverage, quantity, entryPrice, exitPrice, direction, fundingRate, durationHours, initialMargin, pnl, roe, activeField, entryFeeRate, exitFeeRate, validate, calculate])

  const netPnlNum = parseNumber(netPnl)
  const netRoeNum = parseNumber(netRoe)
  const totalFundingNum = parseNumber(totalFunding)
  const marginRatioNum = parseNumber(marginRatio)

  const leveragePresets = [1, 2, 5, 10, 25, 50, 100, 500, 1000]

  return (
    <div className="w-full">
      <div className="bg-[#141620] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#2a2e3e]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Calculator className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Perpetual Futures Calculator</h2>
              <p className="text-[#555a66] text-xs">Position planner with fees, funding & break-even</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Direction + Fee Type */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-[#848e9c] mb-2">Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDirection("long")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-full font-medium text-sm transition-all ${
                    direction === "long" ? "bg-emerald-500 text-white" : "bg-[#1a1d26] text-[#848e9c] hover:text-white"
                  }`}>
                  <ArrowUp className="h-4 w-4" /> Long
                </button>
                <button type="button" onClick={() => setDirection("short")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-full font-medium text-sm transition-all ${
                    direction === "short" ? "bg-red-500 text-white" : "bg-[#1a1d26] text-[#848e9c] hover:text-white"
                  }`}>
                  <ArrowDown className="h-4 w-4" /> Short
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#848e9c] mb-2">Order Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFeeType("maker")}
                  className={`py-2.5 rounded-full font-medium text-sm transition-all ${
                    feeType === "maker" ? "bg-brand text-white" : "bg-[#1a1d26] text-[#848e9c] hover:text-white"
                  }`}>
                  Maker
                </button>
                <button type="button" onClick={() => setFeeType("taker")}
                  className={`py-2.5 rounded-full font-medium text-sm transition-all ${
                    feeType === "taker" ? "bg-brand text-white" : "bg-[#1a1d26] text-[#848e9c] hover:text-white"
                  }`}>
                  Taker
                </button>
              </div>
            </div>
          </div>

          {/* Leverage slider / presets */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#848e9c]">Leverage</label>
              <div className="flex items-center gap-2">
                <input
                  type="text" inputMode="decimal" value={leverage}
                  placeholder="–"
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "")
                    const n = parseInt(v, 10)
                    if (v === "" || (n >= 0 && n <= 1000)) setLeverage(v)
                  }}
                  className="w-16 text-right text-sm font-bold text-white bg-transparent border-b border-[#2a2e3e] focus:border-brand focus:outline-none transition-colors placeholder-[#555a66]"
                />
                <span className="text-sm font-bold text-[#555a66]">x</span>
              </div>
            </div>
            <input
              type="range" min="0" max="100"
              value={Math.round(Math.log(Math.max(1, parseNumber(leverage))) / Math.log(1000) * 100)}
              onChange={(e) => {
                const pct = parseInt(e.target.value, 10)
                const val = Math.round(Math.pow(1000, pct / 100))
                setLeverage(String(Math.max(1, Math.min(1000, val))))
              }}
              className="w-full h-1.5 rounded-full appearance-none bg-[#2a2e3e] accent-brand cursor-pointer"
            />
            <div className="flex gap-1 mt-2">
              {leveragePresets.map((l) => (
                <button key={l} type="button" onClick={() => setLeverage(String(l))}
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                    parseNumber(leverage) === l ? "bg-brand text-white" : "bg-[#1a1d26] text-[#555a66] hover:text-[#848e9c]"
                  }`}>
                  {l}x
                </button>
              ))}
            </div>
          </div>

          {/* Core Inputs */}
          <div className="grid grid-cols-3 gap-3 mb-2">
            <CalculatorInput id="quantity" label="Quantity" value={quantity}
              onChange={(v) => { marginLocked.current = false; setQuantity(v) }}
              hint="Size in contracts" error={errors.quantity} compact />
            <CalculatorInput id="entryPrice" label="Entry Price" value={entryPrice} onChange={setEntryPrice}
              prefix="$" error={errors.entryPrice} compact />
            <CalculatorInput id="exitPrice" label="Exit Price" value={exitPrice} onChange={setExitPrice}
              prefix="$" error={errors.exitPrice} compact />
          </div>

          {/* Exit Price slider + % change */}
          <ExitPriceSlider entryPrice={entryPrice} exitPrice={exitPrice} setExitPrice={setExitPrice} parseNumber={parseNumber} />

          {/* Fee & Funding Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <CalculatorInput id="entryFeeRate" label="Entry Fee" value={entryFeeRate} onChange={setEntryFeeRate}
              suffix="%" hint={feeType === "maker" ? "Maker 0.010%" : "Taker 0.035%"} compact />
            <CalculatorInput id="exitFeeRate" label="Exit Fee" value={exitFeeRate} onChange={setExitFeeRate}
              suffix="%" hint="Applied on close" compact />
            <CalculatorInput id="fundingRate" label="Funding Rate" value={fundingRate} onChange={setFundingRate}
              suffix="%/hr" allowNegative hint="~0.003% typical" compact />
            <CalculatorInput id="durationHours" label="Duration" value={durationHours} onChange={setDurationHours}
              suffix="hours" hint="Hold time" compact />
          </div>

          {/* Divider */}
          <div className="border-t border-[#2a2e3e] my-5" />

          {/* Interactive Results */}
          <div className="grid md:grid-cols-3 gap-3 mb-5">
            <CalculatorInput id="initialMargin" label="Initial Margin" value={initialMargin}
              onChange={(v) => { marginLocked.current = true; setInitialMargin(v) }}
              onFocus={() => setActiveField("margin")} onBlur={() => setActiveField(null)}
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
            <StatCard label="Position Notional" value={positionNotional ? fmtUsdFull(parseNumber(positionNotional)) : "–"} sub={leverage ? `${leverage}x leveraged` : ""} color="brand" />
            <StatCard label="Liquidation Price" value={dash(liquidationPrice, "$")}
              sub={marginRatio ? `${fmt(100 - marginRatioNum, 1)}% margin left` : ""}
              color={marginRatioNum > 80 ? "red" : marginRatioNum > 50 ? "gray" : "green"} />
            <StatCard label="Break-Even Price" value={dash(breakEvenPrice, "$")} sub="After fees + funding" color="gray" />
            <StatCard label="Margin Ratio"
              value={dash(marginRatio, "", "%")}
              sub={marginRatio ? (marginRatioNum > 80 ? "Danger zone" : marginRatioNum > 50 ? "Caution" : "Healthy") : ""}
              color={marginRatioNum > 80 ? "red" : marginRatioNum > 50 ? "gray" : "green"} />
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
            <StatCard label="Entry Fee" value={entryFee ? `-$${entryFee}` : "–"} sub={`${entryFeeRate}%`} color="red" />
            <StatCard label="Exit Fee" value={exitFee ? `-$${exitFee}` : "–"} sub={`${exitFeeRate}%`} color="red" />
            <StatCard label="Total Fees" value={totalFees ? `-$${totalFees}` : "–"} color="red" />
            <StatCard label={`Funding (${durationHours || "–"}h)`}
              value={totalFunding ? `${totalFundingNum > 0 ? "-" : totalFundingNum < 0 ? "+" : ""}$${Math.abs(totalFundingNum).toFixed(2)}` : "–"}
              sub={totalFunding ? (totalFundingNum > 0 ? "You pay" : totalFundingNum < 0 ? "You earn" : "Neutral") : ""}
              color={totalFundingNum > 0 ? "red" : totalFundingNum < 0 ? "green" : "gray"} />
            <StatCard label="Gross PNL" value={pnl ? `${parseNumber(pnl) >= 0 ? "+" : ""}$${pnl}` : "–"}
              sub="Before costs" color={parseNumber(pnl) >= 0 ? "green" : "red"} />
            <StatCard label="Gross ROE" value={roe ? `${parseNumber(roe) >= 0 ? "+" : ""}${roe}%` : "–"}
              sub="Before costs" color={parseNumber(roe) >= 0 ? "green" : "red"} />
          </div>

          {/* Net Result Banner */}
          {netPnl && netRoe && (
            <div className={`p-4 rounded-xl ${netPnlNum >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <div className="flex items-center gap-3">
                {netPnlNum >= 0 ? (
                  <div className="p-2 rounded-full bg-emerald-500/20">
                    <TrendingUp className="h-6 w-6 text-emerald-400" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-red-500/20">
                    <TrendingDown className="h-6 w-6 text-red-400" />
                  </div>
                )}
                <div className="flex-1">
                  <p className={`text-xl font-bold ${netPnlNum >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {netPnlNum >= 0 ? "+" : ""}{fmtUsdFull(netPnlNum)} ({netPnlNum >= 0 ? "+" : ""}{netRoe}%)
                  </p>
                  <p className="text-sm text-[#848e9c]">
                    Net {netPnlNum >= 0 ? "profit" : "loss"} at {dash(exitPrice, "$")} after {durationHours || "–"}h
                    <span className="text-[#555a66]"> — fees: {totalFees ? fmtUsdFull(parseNumber(totalFees)) : "–"}, funding: {totalFunding ? fmtUsdFull(Math.abs(totalFundingNum)) : "–"}</span>
                  </p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs text-[#555a66]">Break-even</p>
                  <p className="text-sm font-semibold text-white">{dash(breakEvenPrice, "$")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-5 text-[11px] text-[#555a66] leading-relaxed">
            Calculations are estimates. Actual margin = initial margin + open loss (difference between order price and mark price).
            Liquidation price is simplified and may vary with cross-margin, insurance fund, and maintenance margin requirements.
            Fee rates shown are Hyperliquid defaults — adjust for your VIP tier. Funding rate compounds each hour and may fluctuate.
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 py-4 border-t border-[#2a2e3e]">
          <a href="/trade/BTC" rel="noopener noreferrer"
            className="block w-full text-center py-3 px-6 bg-brand hover:bg-brand-hover text-white font-medium rounded-full transition-colors">
            Start Trading on Coincess
          </a>
        </div>
      </div>
    </div>
  )
}
