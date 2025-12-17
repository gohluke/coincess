"use client"

import { useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from "react"
import { ArrowUp, ArrowDown, Calculator, TrendingUp, TrendingDown, AlertCircle } from "lucide-react"

type Direction = "long" | "short"

interface CalculatorInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  prefix?: string
  suffix?: string
  readOnly?: boolean
  allowNegative?: boolean
  hint?: string
  error?: string
}

function CalculatorInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  prefix,
  suffix,
  readOnly = false,
  allowNegative = false,
  hint,
  error,
}: CalculatorInputProps) {
  // Sanitize input to only allow valid numeric characters
  const sanitizeInput = (input: string): string => {
    // Allow: digits, one decimal point, and optionally one minus sign at start
    let sanitized = input

    // Remove any character that's not a digit, decimal point, or minus
    if (allowNegative) {
      // Allow minus only at the beginning
      sanitized = sanitized.replace(/[^\d.-]/g, "")
      // Remove any minus signs that aren't at the start
      const firstChar = sanitized.charAt(0)
      const rest = sanitized.slice(1).replace(/-/g, "")
      sanitized = firstChar + rest
    } else {
      sanitized = sanitized.replace(/[^\d.]/g, "")
    }

    // Ensure only one decimal point
    const parts = sanitized.split(".")
    if (parts.length > 2) {
      sanitized = parts[0] + "." + parts.slice(1).join("")
    }

    return sanitized
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeInput(e.target.value)
    onChange(sanitized)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, decimal point
    const allowedKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", ".", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
    
    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) {
      return
    }

    if (allowedKeys.includes(e.key)) {
      // Prevent multiple decimal points
      if (e.key === "." && value.includes(".")) {
        e.preventDefault()
      }
      return
    }

    // Allow minus sign only at the beginning if allowNegative
    if (e.key === "-" && allowNegative) {
      const input = e.currentTarget
      if (input.selectionStart === 0 && !value.includes("-")) {
        return
      }
      e.preventDefault()
      return
    }

    // Allow digits
    if (/^\d$/.test(e.key)) {
      return
    }

    // Prevent all other keys
    e.preventDefault()
  }

  // Handle paste to sanitize pasted content
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    const sanitized = sanitizeInput(pastedText)
    
    const input = e.currentTarget
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const newValue = value.slice(0, start) + sanitized + value.slice(end)
    
    onChange(sanitizeInput(newValue))
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          id={id}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={onBlur}
          readOnly={readOnly}
          autoComplete="off"
          className={`
            w-full h-12 rounded-lg border bg-white text-gray-900
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]
            ${prefix ? "pl-8" : "pl-4"}
            ${suffix ? "pr-16" : "pr-4"}
            ${readOnly ? "bg-gray-50 text-gray-600 cursor-not-allowed" : ""}
            ${error ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-gray-200"}
          `}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

export function LeverageCalculator() {
  const [leverage, setLeverage] = useState("10")
  const [quantity, setQuantity] = useState("1000")
  const [entryPrice, setEntryPrice] = useState("10")
  const [exitPrice, setExitPrice] = useState("20")
  const [liquidationPrice, setLiquidationPrice] = useState("")
  const [direction, setDirection] = useState<Direction>("long")
  const [initialMargin, setInitialMargin] = useState("")
  const [pnl, setPnl] = useState("")
  const [roe, setRoe] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const parseNumber = (value: string): number => {
    const cleaned = value.replace(/[^\d.-]/g, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  const formatNumber = (num: number, decimals: number = 6): string => {
    if (!isFinite(num) || isNaN(num)) return "0"
    // Remove trailing zeros
    return parseFloat(num.toFixed(decimals)).toString()
  }

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}
    
    const lev = parseNumber(leverage)
    const entry = parseNumber(entryPrice)
    const exit = parseNumber(exitPrice)
    const qty = parseNumber(quantity)

    if (lev <= 0) {
      newErrors.leverage = "Leverage must be greater than 0"
    }
    if (lev > 200) {
      newErrors.leverage = "Leverage cannot exceed 200x"
    }
    if (entry <= 0) {
      newErrors.entryPrice = "Entry price must be greater than 0"
    }
    if (exit <= 0) {
      newErrors.exitPrice = "Exit price must be greater than 0"
    }
    if (qty <= 0) {
      newErrors.quantity = "Quantity must be greater than 0"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [leverage, entryPrice, exitPrice, quantity])

  const calculate = useCallback((type?: "margin" | "pnl" | "roe") => {
    const lev = parseNumber(leverage)
    const qty = parseNumber(quantity)
    const entry = parseNumber(entryPrice)
    const exit = parseNumber(exitPrice)

    // Skip calculation if essential values are missing or invalid
    if (lev <= 0 || entry <= 0) return

    let calcInitialMargin: number
    let calcQuantity = qty
    let calcExitPrice = exit

    // Calculate initial margin
    if (type === "margin") {
      const margin = parseNumber(initialMargin)
      if (margin <= 0) return
      calcInitialMargin = margin
      calcQuantity = (margin * lev) / entry
      setQuantity(formatNumber(calcQuantity))
    } else {
      if (qty <= 0) return
      calcInitialMargin = (qty * entry) / lev
      setInitialMargin(formatNumber(calcInitialMargin, 2))
    }

    // Calculate PNL
    let calcPnl: number
    if (type === "pnl") {
      const pnlValue = parseNumber(pnl)
      calcPnl = pnlValue
      if (direction === "long") {
        calcExitPrice = calcQuantity > 0 ? pnlValue / calcQuantity + entry : entry
      } else {
        calcExitPrice = calcQuantity > 0 ? entry - pnlValue / calcQuantity : entry
      }
      setExitPrice(formatNumber(calcExitPrice, 4))
    } else {
      if (calcExitPrice <= 0) return
      if (direction === "long") {
        calcPnl = (calcExitPrice - entry) * calcQuantity
      } else {
        calcPnl = (entry - calcExitPrice) * calcQuantity
      }
      setPnl(formatNumber(calcPnl, 2))
    }

    // Calculate ROE
    let calcRoe: number
    if (type === "roe") {
      const roeValue = parseNumber(roe)
      calcRoe = roeValue
      calcPnl = (roeValue / 100) * calcInitialMargin
      if (direction === "long") {
        calcExitPrice = calcQuantity > 0 ? calcPnl / calcQuantity + entry : entry
      } else {
        calcExitPrice = calcQuantity > 0 ? entry - calcPnl / calcQuantity : entry
      }
      setExitPrice(formatNumber(calcExitPrice, 4))
      setPnl(formatNumber(calcPnl, 2))
    } else {
      calcRoe = calcInitialMargin > 0 ? (calcPnl / calcInitialMargin) * 100 : 0
      setRoe(formatNumber(calcRoe, 2))
    }

    // Calculate liquidation price
    let liquidation: number
    if (direction === "long") {
      liquidation = entry - entry / lev
    } else {
      liquidation = entry + entry / lev
    }
    setLiquidationPrice(formatNumber(Math.max(0, liquidation), 4))
  }, [leverage, quantity, entryPrice, exitPrice, direction, initialMargin, pnl, roe])

  useEffect(() => {
    if (leverage && quantity && entryPrice && exitPrice) {
      validate()
      calculate()
    }
  }, [leverage, quantity, entryPrice, exitPrice, direction, validate, calculate])

  const handleMarginBlur = () => {
    if (initialMargin) calculate("margin")
  }

  const handlePnlBlur = () => {
    if (pnl) calculate("pnl")
  }

  const handleRoeBlur = () => {
    if (roe) calculate("roe")
  }

  const isProfitable = parseNumber(pnl) >= 0
  const roeValue = parseNumber(roe)

  return (
    <div className="w-full">
      {/* Calculator Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Perpetual Futures Calculator</h2>
              <p className="text-white/80 text-sm">Calculate your position's potential outcomes</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Direction Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Position Direction</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDirection("long")}
                className={`
                  flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all
                  ${direction === "long"
                    ? "bg-green-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }
                `}
              >
                <ArrowUp className="h-5 w-5" />
                Long
              </button>
              <button
                type="button"
                onClick={() => setDirection("short")}
                className={`
                  flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all
                  ${direction === "short"
                    ? "bg-red-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }
                `}
              >
                <ArrowDown className="h-5 w-5" />
                Short
              </button>
            </div>
          </div>

          {/* Input Fields */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <CalculatorInput
              id="leverage"
              label="Leverage"
              value={leverage}
              onChange={setLeverage}
              suffix="x"
              hint="1-200x leverage multiplier"
              error={errors.leverage}
            />
            <CalculatorInput
              id="quantity"
              label="Quantity"
              value={quantity}
              onChange={setQuantity}
              hint="Number of contracts/units"
              error={errors.quantity}
            />
            <CalculatorInput
              id="entryPrice"
              label="Entry Price"
              value={entryPrice}
              onChange={setEntryPrice}
              prefix="$"
              hint="Your position's entry price"
              error={errors.entryPrice}
            />
            <CalculatorInput
              id="exitPrice"
              label="Exit Price"
              value={exitPrice}
              onChange={setExitPrice}
              prefix="$"
              hint="Target or stop-loss price"
              error={errors.exitPrice}
            />
          </div>

          {/* Liquidation Price (Read-only) */}
          <div className="mb-6">
            <CalculatorInput
              id="liquidationPrice"
              label="Liquidation Price"
              value={liquidationPrice}
              onChange={() => {}}
              prefix="$"
              readOnly
              hint="Price at which your position gets liquidated"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-6" />

          {/* Results Section */}
          <div className="grid md:grid-cols-3 gap-4">
            <CalculatorInput
              id="initialMargin"
              label="Initial Margin"
              value={initialMargin}
              onChange={setInitialMargin}
              onBlur={handleMarginBlur}
              suffix="USDC"
              hint="Edit to calculate quantity"
            />
            <CalculatorInput
              id="pnl"
              label="PNL (Profit/Loss)"
              value={pnl}
              onChange={setPnl}
              onBlur={handlePnlBlur}
              suffix="USDC"
              allowNegative
              hint="Edit to calculate exit price"
            />
            <CalculatorInput
              id="roe"
              label="ROE (Return on Equity)"
              value={roe}
              onChange={setRoe}
              onBlur={handleRoeBlur}
              suffix="%"
              allowNegative
              hint="Edit to calculate exit price"
            />
          </div>

          {/* Results Summary */}
          {pnl && roe && (
            <div className={`mt-6 p-4 rounded-xl ${isProfitable ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-3">
                {isProfitable ? (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-600" />
                )}
                <div>
                  <p className={`text-lg font-bold ${isProfitable ? "text-green-700" : "text-red-700"}`}>
                    {isProfitable ? "+" : ""}{pnl} USDC ({isProfitable ? "+" : ""}{roe}%)
                  </p>
                  <p className={`text-sm ${isProfitable ? "text-green-600" : "text-red-600"}`}>
                    {isProfitable ? "Potential Profit" : "Potential Loss"} at ${exitPrice}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-6 text-xs text-gray-500 leading-relaxed">
            Initial margin may not be equal to the actual margin required to place an order. 
            Actual margin required = initial margin + open loss, where open loss reflects 
            the additional cost due to the difference between order price and mark price.
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <a
            href="https://dydx.exchange/r/SABZRJKF"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium rounded-lg transition-colors"
          >
            Trade @ dYdX — Get 5% Off Fees
          </a>
        </div>
      </div>
    </div>
  )
}