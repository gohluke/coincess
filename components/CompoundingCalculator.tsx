"use client"

import { useState, useMemo, useCallback, ChangeEvent, KeyboardEvent } from "react"
import {
  Calculator, TrendingUp, TrendingDown, AlertCircle,
  ArrowUp, Repeat, DollarSign, Target, Trophy,
} from "lucide-react"

/* ─── Shared input ──────────────────────────────────── */

interface InputProps {
  id: string; label: string; value: string; onChange: (v: string) => void
  prefix?: string; suffix?: string; hint?: string; error?: string
  allowNegative?: boolean
}

function CInput({ id, label, value, onChange, prefix, suffix, hint, error, allowNegative }: InputProps) {
  const sanitize = (s: string) => {
    let v = allowNegative ? s.replace(/[^\d.-]/g, "") : s.replace(/[^\d.]/g, "")
    const parts = v.split(".")
    if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("")
    return v
  }
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onChange(sanitize(e.target.value))
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const ok = ["Backspace","Delete","Tab","Escape","Enter",".","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"]
    if ((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key.toLowerCase())) return
    if (ok.includes(e.key)) { if (e.key === "." && value.includes(".")) e.preventDefault(); return }
    if (e.key === "-" && allowNegative && e.currentTarget.selectionStart === 0 && !value.includes("-")) return
    if (/^\d$/.test(e.key)) return
    e.preventDefault()
  }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-[#848e9c]">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555a66] text-sm pointer-events-none">{prefix}</span>}
        <input type="text" inputMode="decimal" id={id} value={value}
          onChange={handleChange} onKeyDown={handleKey} autoComplete="off"
          className={`w-full h-10 rounded-lg border bg-[#1a1d26] text-white text-sm transition-all
            focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50
            ${prefix ? "pl-8" : "pl-4"} ${suffix ? "pr-16" : "pr-4"}
            ${error ? "border-red-500/50" : "border-[#2a2e3e]"}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555a66] text-xs pointer-events-none">{suffix}</span>}
      </div>
      {hint && !error && <p className="text-[11px] text-[#555a66]">{hint}</p>}
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  )
}

/* ─── Stat card ─────────────────────────────────────── */

function Stat({ label, value, sub, color = "gray" }: { label: string; value: string; sub?: string; color?: "green" | "red" | "gray" | "brand" }) {
  const c = { green: "bg-emerald-500/10 text-emerald-400", red: "bg-red-500/10 text-red-400", gray: "bg-[#1a1d26] text-white", brand: "bg-brand/10 text-brand" }
  return (
    <div className={`p-3 rounded-xl ${c[color]}`}>
      <p className="text-[11px] text-[#555a66] mb-0.5">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-[#555a66] mt-0.5">{sub}</p>}
    </div>
  )
}

/* ─── SVG Chart ─────────────────────────────────────── */

function GrowthChart({ data, linearData }: { data: number[]; linearData: number[] }) {
  if (data.length < 2) return null

  const W = 720
  const H = 280
  const PAD = { top: 20, right: 16, bottom: 32, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(...data, ...linearData) * 1.05
  const minVal = 0

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * chartW
  const toY = (v: number) => PAD.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH

  const compoundPath = data.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ")
  const linearPath = linearData.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ")
  const areaPath = `${compoundPath} L${toX(data.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left},${(PAD.top + chartH).toFixed(1)} Z`

  const fmtAxis = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }

  const yTicks = 5
  const yStep = (maxVal - minVal) / yTicks

  const milestones: { label: string; value: number }[] = []
  const startVal = data[0]
  for (const mult of [2, 5, 10, 25, 50, 100]) {
    const target = startVal * mult
    if (target <= maxVal && target > startVal) {
      milestones.push({ label: `${mult}x`, value: target })
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0b0e11] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-white">Account Growth</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-brand" />
            <span className="text-[10px] text-[#848e9c]">Compounding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-[#555a66]" />
            <span className="text-[10px] text-[#848e9c]">Linear</span>
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand, #22c55e)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-brand, #22c55e)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = minVal + yStep * i
          const y = toY(val)
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#1e2130" strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#555a66" fontSize="10">{fmtAxis(val)}</text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {data.map((_, i) => {
          if (data.length <= 13 || i % Math.ceil(data.length / 12) === 0 || i === data.length - 1) {
            return (
              <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fill="#555a66" fontSize="10">
                {i === 0 ? "Start" : `M${i}`}
              </text>
            )
          }
          return null
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Linear line */}
        <path d={linearPath} fill="none" stroke="#555a66" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* Compound line */}
        <path d={compoundPath} fill="none" stroke="var(--color-brand, #22c55e)" strokeWidth="2" />

        {/* Milestone dashed lines */}
        {milestones.map((m) => {
          const y = toY(m.value)
          if (y < PAD.top || y > PAD.top + chartH) return null
          return (
            <g key={m.label}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#848e9c" strokeWidth="0.5" strokeDasharray="3 4" />
              <rect x={W - PAD.right + 2} y={y - 8} width="28" height="16" rx="4" fill="#1e2130" />
              <text x={W - PAD.right + 16} y={y + 4} textAnchor="middle" fill="#848e9c" fontSize="9" fontWeight="600">{m.label}</text>
            </g>
          )
        })}

        {/* End dot */}
        <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1])} r="4" fill="var(--color-brand, #22c55e)" />
        <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1])} r="7" fill="var(--color-brand, #22c55e)" fillOpacity="0.2" />
      </svg>
    </div>
  )
}

/* ─── Monthly breakdown ─────────────────────────────── */

function MonthlyTable({ rows }: { rows: { month: number; balance: number; profit: number; deposits: number; cumProfit: number }[] }) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (rows.length === 0) return null

  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0b0e11]">
      <div className="px-4 py-3">
        <p className="text-xs font-medium text-white">Monthly Breakdown</p>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0b0e11]">
            <tr className="text-[#555a66] border-b border-[#1e2130]">
              <th className="text-left py-2 px-4 font-medium">Month</th>
              <th className="text-right py-2 px-4 font-medium">Balance</th>
              <th className="text-right py-2 px-4 font-medium">Monthly P&L</th>
              <th className="text-right py-2 px-4 font-medium">Deposits</th>
              <th className="text-right py-2 px-4 font-medium">Cum. Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-[#1e2130]/50 hover:bg-[#141620] transition-colors">
                <td className="py-2 px-4 text-[#848e9c]">{r.month === 0 ? "Start" : `Month ${r.month}`}</td>
                <td className="py-2 px-4 text-right text-white font-medium">${fmt(r.balance)}</td>
                <td className={`py-2 px-4 text-right font-medium ${r.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.month === 0 ? "—" : `${r.profit >= 0 ? "+" : ""}$${fmt(r.profit)}`}
                </td>
                <td className="py-2 px-4 text-right text-[#848e9c]">{r.deposits > 0 ? `+$${fmt(r.deposits)}` : "—"}</td>
                <td className={`py-2 px-4 text-right font-medium ${r.cumProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.month === 0 ? "—" : `${r.cumProfit >= 0 ? "+" : ""}$${fmt(r.cumProfit)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main calculator ──────────────────────────────── */

export function CompoundingCalculator() {
  const [startingBalance, setStartingBalance] = useState("1000")
  const [monthlyDeposit, setMonthlyDeposit] = useState("0")
  const [winRate, setWinRate] = useState("55")
  const [avgWin, setAvgWin] = useState("2")
  const [avgLoss, setAvgLoss] = useState("1")
  const [riskPerTrade, setRiskPerTrade] = useState("2")
  const [tradesPerWeek, setTradesPerWeek] = useState("5")
  const [months, setMonths] = useState("12")

  const p = useCallback((s: string) => { const n = parseFloat(s.replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n }, [])

  const results = useMemo(() => {
    const bal = p(startingBalance)
    const dep = p(monthlyDeposit)
    const wr = p(winRate) / 100
    const wPct = p(avgWin) / 100
    const lPct = p(avgLoss) / 100
    const risk = p(riskPerTrade) / 100
    const tpw = p(tradesPerWeek)
    const m = Math.max(1, Math.min(120, Math.round(p(months))))

    if (bal <= 0 || wr < 0 || wr > 1 || wPct <= 0 || lPct <= 0 || risk <= 0 || tpw <= 0) {
      return null
    }

    const tradesPerMonth = tpw * 4.33
    const expectancy = (wr * wPct) - ((1 - wr) * lPct)
    const perTradeReturn = expectancy * risk / (risk > 0 ? risk : 1)
    const effectivePerTrade = expectancy

    const chartData: number[] = [bal]
    const linearData: number[] = [bal]
    const monthlyRows: { month: number; balance: number; profit: number; deposits: number; cumProfit: number }[] = [
      { month: 0, balance: bal, profit: 0, deposits: 0, cumProfit: 0 },
    ]

    let currentBal = bal
    let linearBal = bal
    let totalDeposited = 0
    let cumulativeProfit = 0
    const totalTrades = Math.round(tradesPerMonth * m)

    for (let month = 1; month <= m; month++) {
      const trades = Math.round(tradesPerMonth)
      let monthProfit = 0

      for (let t = 0; t < trades; t++) {
        const riskAmt = currentBal * risk
        const isWin = Math.random() < wr
        if (isWin) {
          const gain = riskAmt * (wPct / risk)
          currentBal += gain
          monthProfit += gain
        } else {
          const loss = riskAmt * (lPct / risk)
          currentBal -= loss
          monthProfit -= loss
        }
        if (currentBal <= 0) { currentBal = 0; break }
      }

      currentBal += dep
      totalDeposited += dep
      cumulativeProfit += monthProfit

      const linearMonthlyGain = bal * effectivePerTrade * Math.round(tradesPerMonth)
      linearBal += linearMonthlyGain + dep

      chartData.push(Math.max(0, currentBal))
      linearData.push(Math.max(0, linearBal))
      monthlyRows.push({
        month,
        balance: Math.max(0, currentBal),
        profit: monthProfit,
        deposits: dep,
        cumProfit: cumulativeProfit,
      })
    }

    const finalBalance = currentBal
    const totalProfit = finalBalance - bal - totalDeposited
    const totalROI = bal > 0 ? ((finalBalance - bal - totalDeposited) / bal) * 100 : 0
    const monthlyAvgReturn = m > 0 ? totalROI / m : 0

    const maxDrawdown = (() => {
      let peak = chartData[0]
      let maxDd = 0
      for (const v of chartData) {
        if (v > peak) peak = v
        const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0
        if (dd > maxDd) maxDd = dd
      }
      return maxDd
    })()

    const timeTo2x = chartData.findIndex((v) => v >= bal * 2)
    const timeTo5x = chartData.findIndex((v) => v >= bal * 5)
    const timeTo10x = chartData.findIndex((v) => v >= bal * 10)

    return {
      finalBalance, totalProfit, totalROI, monthlyAvgReturn,
      totalTrades, expectancy: expectancy * 100, maxDrawdown,
      totalDeposited,
      timeTo2x: timeTo2x > 0 ? timeTo2x : null,
      timeTo5x: timeTo5x > 0 ? timeTo5x : null,
      timeTo10x: timeTo10x > 0 ? timeTo10x : null,
      chartData, linearData, monthlyRows,
    }
  }, [startingBalance, monthlyDeposit, winRate, avgWin, avgLoss, riskPerTrade, tradesPerWeek, months, p])

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const monthPresets = [3, 6, 12, 24, 36, 60]

  return (
    <div className="w-full">
      <div className="bg-[#141620] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#2a2e3e]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Repeat className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Compounding Calculator</h2>
              <p className="text-[#555a66] text-xs">See how consistent trading compounds your account over time</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Capital Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <CInput id="startBal" label="Starting Balance" value={startingBalance} onChange={setStartingBalance} prefix="$" hint="Initial capital" />
            <CInput id="monthDep" label="Monthly Deposit" value={monthlyDeposit} onChange={setMonthlyDeposit} prefix="$" hint="Extra funds/month" />
            <CInput id="riskPer" label="Risk per Trade" value={riskPerTrade} onChange={setRiskPerTrade} suffix="%" hint="% of account" />
            <CInput id="tpw" label="Trades per Week" value={tradesPerWeek} onChange={setTradesPerWeek} hint="Avg frequency" />
          </div>

          {/* Win/Loss Parameters */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <CInput id="winRate" label="Win Rate" value={winRate} onChange={setWinRate} suffix="%" hint="% of trades won" />
            <CInput id="avgWin" label="Avg Win" value={avgWin} onChange={setAvgWin} suffix="%" hint="Return per win" />
            <CInput id="avgLoss" label="Avg Loss" value={avgLoss} onChange={setAvgLoss} suffix="%" hint="Loss per losing trade" />
          </div>

          {/* Time Horizon */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#848e9c]">Time Horizon</label>
              <div className="flex items-center gap-2">
                <input type="text" inputMode="numeric" value={months}
                  onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ""); if (v === "" || parseInt(v) <= 120) setMonths(v) }}
                  className="w-12 text-right text-sm font-bold text-white bg-transparent border-b border-[#2a2e3e] focus:border-brand focus:outline-none transition-colors"
                />
                <span className="text-sm font-bold text-[#555a66]">months</span>
              </div>
            </div>
            <input type="range" min="1" max="120" value={p(months) || 1}
              onChange={(e) => setMonths(e.target.value)}
              className="w-full h-1.5 rounded-full appearance-none bg-[#2a2e3e] accent-brand cursor-pointer"
            />
            <div className="flex gap-1 mt-2">
              {monthPresets.map((m) => (
                <button key={m} type="button" onClick={() => setMonths(String(m))}
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                    p(months) === m ? "bg-brand text-white" : "bg-[#1a1d26] text-[#555a66] hover:text-[#848e9c]"
                  }`}>
                  {m >= 12 ? `${m / 12}y` : `${m}m`}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#2a2e3e] my-5" />

          {results && (
            <>
              {/* Key Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Final Balance" value={`$${fmt(results.finalBalance)}`} sub={`${results.totalROI >= 0 ? "+" : ""}${results.totalROI.toFixed(1)}% ROI`} color="brand" />
                <Stat label="Total Profit"
                  value={`${results.totalProfit >= 0 ? "+" : ""}$${fmt(results.totalProfit)}`}
                  sub={results.totalDeposited > 0 ? `+ $${fmt(results.totalDeposited)} deposited` : undefined}
                  color={results.totalProfit >= 0 ? "green" : "red"} />
                <Stat label="Expectancy" value={`${results.expectancy >= 0 ? "+" : ""}${results.expectancy.toFixed(2)}%`}
                  sub="Per trade edge" color={results.expectancy >= 0 ? "green" : "red"} />
                <Stat label="Max Drawdown" value={`-${results.maxDrawdown.toFixed(1)}%`}
                  sub={results.maxDrawdown > 30 ? "High risk" : results.maxDrawdown > 15 ? "Moderate" : "Manageable"}
                  color={results.maxDrawdown > 30 ? "red" : "gray"} />
              </div>

              {/* Milestones + Extra Stats */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
                <Stat label="Avg Monthly" value={`${results.monthlyAvgReturn >= 0 ? "+" : ""}${results.monthlyAvgReturn.toFixed(1)}%`}
                  color={results.monthlyAvgReturn >= 0 ? "green" : "red"} />
                <Stat label="Total Trades" value={results.totalTrades.toLocaleString()} sub={`${p(tradesPerWeek)}/week`} color="gray" />
                <Stat label="2x Capital"
                  value={results.timeTo2x ? `Month ${results.timeTo2x}` : "—"}
                  sub={results.timeTo2x ? "Doubled" : `Not in ${months}m`}
                  color={results.timeTo2x ? "green" : "gray"} />
                <Stat label="5x Capital"
                  value={results.timeTo5x ? `Month ${results.timeTo5x}` : "—"}
                  sub={results.timeTo5x ? "5x reached" : `Not in ${months}m`}
                  color={results.timeTo5x ? "green" : "gray"} />
                <Stat label="10x Capital"
                  value={results.timeTo10x ? `Month ${results.timeTo10x}` : "—"}
                  sub={results.timeTo10x ? "10x reached" : `Not in ${months}m`}
                  color={results.timeTo10x ? "brand" : "gray"} />
                <Stat label="Compound Effect"
                  value={`${((results.finalBalance / (results.linearData[results.linearData.length - 1] || 1) - 1) * 100).toFixed(0)}%`}
                  sub="vs linear growth" color="brand" />
              </div>

              {/* Chart */}
              <div className="mb-5">
                <GrowthChart data={results.chartData} linearData={results.linearData} />
              </div>

              {/* Net Result Banner */}
              <div className={`p-4 rounded-xl mb-5 ${results.totalProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <div className="flex items-center gap-3">
                  {results.totalProfit >= 0 ? (
                    <div className="p-2 rounded-full bg-emerald-500/20">
                      <TrendingUp className="h-6 w-6 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-full bg-red-500/20">
                      <TrendingDown className="h-6 w-6 text-red-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className={`text-xl font-bold ${results.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${fmt(results.finalBalance)}
                    </p>
                    <p className="text-sm text-[#848e9c]">
                      After {months} months with {winRate}% win rate and {riskPerTrade}% risk per trade
                      <span className="text-[#555a66]"> — {results.totalTrades.toLocaleString()} trades total</span>
                    </p>
                  </div>
                  {results.timeTo2x && (
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-[#555a66]">First 2x</p>
                      <p className="text-sm font-semibold text-white">Month {results.timeTo2x}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Breakdown */}
              <MonthlyTable rows={results.monthlyRows} />
            </>
          )}

          {/* Disclaimer */}
          <p className="mt-5 text-[11px] text-[#555a66] leading-relaxed">
            Results use a Monte Carlo simulation with random trade outcomes based on your parameters.
            Past performance does not guarantee future results. Actual returns will vary due to market conditions,
            slippage, fees, and psychology. Refresh to see a different simulation run.
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 py-4 border-t border-[#2a2e3e]">
          <a href="/trade/BTC"
            className="block w-full text-center py-3 px-6 bg-brand hover:bg-brand-hover text-white font-medium rounded-full transition-colors">
            Start Trading on Coincess
          </a>
        </div>
      </div>
    </div>
  )
}
