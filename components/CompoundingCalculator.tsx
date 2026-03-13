"use client"

import { useState, useMemo, useCallback, ChangeEvent, KeyboardEvent } from "react"
import {
  TrendingUp, TrendingDown, AlertCircle, Repeat, Crosshair, Zap, BarChart3, Activity,
} from "lucide-react"

/* ─── Seeded PRNG (Mulberry32) ─────────────────────── */

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashInputs(...args: (string | number)[]): number {
  let h = 0
  const s = args.join("|")
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

/* ─── Percentile helper ────────────────────────────── */

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

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
    const ok = ["Backspace", "Delete", "Tab", "Escape", "Enter", ".", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return
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

/* ─── Types ─────────────────────────────────────────── */

interface PercentileCurves {
  p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[]
}

interface MonthRow {
  month: number; balance: number; profit: number; deposits: number
  withdrawals: number; fees: number; cumProfit: number; drawdown: number
}

interface SimResults {
  percentiles: PercentileCurves
  linearData: number[]
  finalBalances: number[]
  drawdownP50: number[]
  monthlyRows: MonthRow[]
  metrics: {
    finalBalanceMedian: number; totalProfitMedian: number; totalROI: number
    monthlyAvgReturn: number; expectancy: number; kelly: number; halfKelly: number
    profitFactor: number; payoffRatio: number; sharpe: number; sortino: number
    riskOfRuin: number; expectedMaxDD: number; maxConsecLosses: number
    totalTrades: number; totalDeposited: number; totalWithdrawn: number; totalFees: number
  }
  milestones: { timeTo2x: number | null; timeTo5x: number | null; timeTo10x: number | null }
  streakProbs: { n: number; prob: number }[]
}

/* ─── Probability Cone Chart ───────────────────────── */

function ConeChart({ data, linearData }: { data: PercentileCurves; linearData: number[] }) {
  const len = data.p50.length
  if (len < 2) return null

  const W = 720, H = 280
  const PAD = { top: 20, right: 50, bottom: 32, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const allVals = [...data.p90, ...data.p10, ...linearData]
  const maxVal = Math.max(...allVals) * 1.05
  const minVal = Math.max(0, Math.min(...allVals) * 0.95)

  const toX = (i: number) => PAD.left + (i / (len - 1)) * chartW
  const toY = (v: number) => PAD.top + chartH - ((v - minVal) / (maxVal - minVal || 1)) * chartH

  const makePath = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ")

  const bandPath = (top: number[], bot: number[]) => {
    const fwd = top.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ")
    const bwd = [...bot].reverse().map((v, i) => `L${toX(bot.length - 1 - i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ")
    return fwd + " " + bwd + " Z"
  }

  const fmtAxis = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }

  const yTicks = 5
  const yStep = (maxVal - minVal) / yTicks

  const milestones: { label: string; value: number }[] = []
  const startVal = data.p50[0]
  for (const mult of [2, 5, 10, 25, 50, 100]) {
    const target = startVal * mult
    if (target <= maxVal && target > startVal) milestones.push({ label: `${mult}x`, value: target })
  }

  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0b0e11] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-white">Account Growth — 500 Simulations</p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-brand/10" /><span className="text-[10px] text-[#848e9c]">P10–P90</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-brand/25" /><span className="text-[10px] text-[#848e9c]">P25–P75</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded-full bg-brand" /><span className="text-[10px] text-[#848e9c]">Median</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded-full bg-[#555a66]" /><span className="text-[10px] text-[#848e9c]">Linear</span></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = minVal + yStep * i; const y = toY(val)
          return (<g key={i}><line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#1e2130" strokeWidth="1" /><text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#555a66" fontSize="10">{fmtAxis(val)}</text></g>)
        })}
        {data.p50.map((_, i) => {
          if (len <= 13 || i % Math.ceil(len / 12) === 0 || i === len - 1) {
            return <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fill="#555a66" fontSize="10">{i === 0 ? "Start" : `M${i}`}</text>
          }
          return null
        })}
        <path d={bandPath(data.p90, data.p10)} fill="var(--color-brand, #22c55e)" fillOpacity="0.06" />
        <path d={bandPath(data.p75, data.p25)} fill="var(--color-brand, #22c55e)" fillOpacity="0.10" />
        <path d={makePath(linearData)} fill="none" stroke="#555a66" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={makePath(data.p10)} fill="none" stroke="var(--color-brand, #22c55e)" strokeWidth="0.5" strokeOpacity="0.3" />
        <path d={makePath(data.p90)} fill="none" stroke="var(--color-brand, #22c55e)" strokeWidth="0.5" strokeOpacity="0.3" />
        <path d={makePath(data.p50)} fill="none" stroke="var(--color-brand, #22c55e)" strokeWidth="2" />
        {milestones.map((m) => {
          const y = toY(m.value)
          if (y < PAD.top || y > PAD.top + chartH) return null
          return (<g key={m.label}><line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#848e9c" strokeWidth="0.5" strokeDasharray="3 4" /><rect x={W - PAD.right + 2} y={y - 8} width="28" height="16" rx="4" fill="#1e2130" /><text x={W - PAD.right + 16} y={y + 4} textAnchor="middle" fill="#848e9c" fontSize="9" fontWeight="600">{m.label}</text></g>)
        })}
        <circle cx={toX(len - 1)} cy={toY(data.p50[len - 1])} r="4" fill="var(--color-brand, #22c55e)" />
        <circle cx={toX(len - 1)} cy={toY(data.p50[len - 1])} r="7" fill="var(--color-brand, #22c55e)" fillOpacity="0.2" />
      </svg>
    </div>
  )
}

/* ─── Drawdown Chart ───────────────────────────────── */

function DrawdownChart({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const W = 720, H = 160
  const PAD = { top: 10, right: 50, bottom: 28, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxDD = Math.max(...data.map(Math.abs), 5)
  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * chartW
  const toY = (v: number) => PAD.top + (Math.abs(v) / maxDD) * chartH

  const areaPath = data.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ") +
    ` L${toX(data.length - 1).toFixed(1)},${PAD.top.toFixed(1)} L${PAD.left},${PAD.top.toFixed(1)} Z`
  const linePath = data.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ")

  const yTicks = 4
  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0b0e11] p-4">
      <p className="text-xs font-medium text-white mb-3">Drawdown from Peak (Median Run)</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = (maxDD / yTicks) * i; const y = PAD.top + (val / maxDD) * chartH
          return (<g key={i}><line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#1e2130" strokeWidth="1" /><text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#555a66" fontSize="10">{i === 0 ? "0%" : `-${val.toFixed(0)}%`}</text></g>)
        })}
        {data.map((_, i) => {
          if (data.length <= 13 || i % Math.ceil(data.length / 12) === 0 || i === data.length - 1) {
            return <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fill="#555a66" fontSize="10">{i === 0 ? "Start" : `M${i}`}</text>
          }
          return null
        })}
        <path d={areaPath} fill="rgba(239, 68, 68, 0.12)" />
        <path d={linePath} fill="none" stroke="#ef4444" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

/* ─── Outcome Histogram ────────────────────────────── */

function OutcomeHistogram({ finalBalances, startingBalance }: { finalBalances: number[]; startingBalance: number }) {
  if (finalBalances.length < 10) return null

  const sorted = [...finalBalances].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const bucketCount = 30
  const range = max - min || 1
  const bucketWidth = range / bucketCount

  const buckets: { lo: number; hi: number; count: number }[] = []
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ lo: min + i * bucketWidth, hi: min + (i + 1) * bucketWidth, count: 0 })
  }
  for (const v of finalBalances) {
    const idx = Math.min(Math.floor((v - min) / bucketWidth), bucketCount - 1)
    buckets[idx].count++
  }

  const maxCount = Math.max(...buckets.map((b) => b.count))
  const medianVal = percentile(sorted, 50)
  const profitableRuns = finalBalances.filter((v) => v > startingBalance).length
  const profitPct = ((profitableRuns / finalBalances.length) * 100).toFixed(0)

  const W = 720, H = 200
  const PAD = { top: 10, right: 16, bottom: 28, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const barW = chartW / bucketCount

  const fmtAxis = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }

  const startX = PAD.left + ((startingBalance - min) / range) * chartW
  const medianX = PAD.left + ((medianVal - min) / range) * chartW

  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0b0e11] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-white">Outcome Distribution — {finalBalances.length} Runs</p>
        <span className="text-[10px] text-[#848e9c]">{profitPct}% profitable</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {buckets.map((b, i) => {
          const barH = maxCount > 0 ? (b.count / maxCount) * chartH : 0
          const x = PAD.left + i * barW
          const y = PAD.top + chartH - barH
          const isProfitable = b.lo >= startingBalance
          return (
            <rect key={i} x={x + 1} y={y} width={Math.max(barW - 2, 1)} height={barH}
              rx="1" fill={isProfitable ? "var(--color-brand, #22c55e)" : "#ef4444"} fillOpacity="0.5" />
          )
        })}
        {startX >= PAD.left && startX <= W - PAD.right && (
          <g>
            <line x1={startX} x2={startX} y1={PAD.top} y2={PAD.top + chartH} stroke="#848e9c" strokeWidth="1" strokeDasharray="3 3" />
            <text x={startX} y={PAD.top - 2} textAnchor="middle" fill="#848e9c" fontSize="9">Start</text>
          </g>
        )}
        {medianX >= PAD.left && medianX <= W - PAD.right && (
          <g>
            <line x1={medianX} x2={medianX} y1={PAD.top} y2={PAD.top + chartH} stroke="var(--color-brand, #22c55e)" strokeWidth="1.5" />
            <text x={medianX} y={H - 4} textAnchor="middle" fill="var(--color-brand, #22c55e)" fontSize="9" fontWeight="600">Median</text>
          </g>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const val = min + pct * range
          const x = PAD.left + pct * chartW
          return <text key={pct} x={x} y={H - 14} textAnchor="middle" fill="#555a66" fontSize="9">{fmtAxis(val)}</text>
        })}
      </svg>
    </div>
  )
}

/* ─── Streak Probability Table ─────────────────────── */

function StreakTable({ probs, maxConsecLosses }: { probs: { n: number; prob: number }[]; maxConsecLosses: number }) {
  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0b0e11] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-white">Consecutive Loss Probability</p>
        <span className="text-[10px] text-[#848e9c]">Expected max streak: <span className="text-red-400 font-semibold">{maxConsecLosses}</span></span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {probs.map(({ n, prob }) => (
          <div key={n} className={`rounded-lg p-2 text-center ${prob > 50 ? "bg-red-500/10" : prob > 10 ? "bg-amber-500/10" : "bg-[#1a1d26]"}`}>
            <p className="text-[10px] text-[#555a66]">{n} in a row</p>
            <p className={`text-sm font-bold ${prob > 50 ? "text-red-400" : prob > 10 ? "text-amber-400" : "text-[#848e9c]"}`}>
              {prob.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Monthly breakdown ─────────────────────────────── */

function MonthlyTable({ rows }: { rows: MonthRow[] }) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (rows.length === 0) return null

  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0b0e11]">
      <div className="px-4 py-3"><p className="text-xs font-medium text-white">Monthly Breakdown (Median Run)</p></div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0b0e11]">
            <tr className="text-[#555a66] border-b border-[#1e2130]">
              <th className="text-left py-2 px-3 font-medium">Month</th>
              <th className="text-right py-2 px-3 font-medium">Balance</th>
              <th className="text-right py-2 px-3 font-medium">P&L</th>
              <th className="text-right py-2 px-3 font-medium">Fees</th>
              <th className="text-right py-2 px-3 font-medium">Deposits</th>
              <th className="text-right py-2 px-3 font-medium">Withdrawn</th>
              <th className="text-right py-2 px-3 font-medium">Drawdown</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-[#1e2130]/50 hover:bg-[#141620] transition-colors">
                <td className="py-1.5 px-3 text-[#848e9c]">{r.month === 0 ? "Start" : `M${r.month}`}</td>
                <td className="py-1.5 px-3 text-right text-white font-medium">${fmt(r.balance)}</td>
                <td className={`py-1.5 px-3 text-right font-medium ${r.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.month === 0 ? "\u2014" : `${r.profit >= 0 ? "+" : ""}$${fmt(r.profit)}`}
                </td>
                <td className="py-1.5 px-3 text-right text-red-400/70">{r.month === 0 ? "\u2014" : `-$${fmt(r.fees)}`}</td>
                <td className="py-1.5 px-3 text-right text-[#848e9c]">{r.deposits > 0 ? `+$${fmt(r.deposits)}` : "\u2014"}</td>
                <td className="py-1.5 px-3 text-right text-amber-400/70">{r.withdrawals > 0 ? `-$${fmt(r.withdrawals)}` : "\u2014"}</td>
                <td className={`py-1.5 px-3 text-right ${r.drawdown > 10 ? "text-red-400" : r.drawdown > 5 ? "text-amber-400" : "text-[#555a66]"}`}>
                  {r.month === 0 ? "\u2014" : `-${r.drawdown.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Trader Presets ────────────────────────────────── */

const PRESETS = [
  { label: "Scalper", wr: "70", avgW: "0.5", avgL: "0.3", risk: "1", tpw: "20", fee: "0.035" },
  { label: "Day Trader", wr: "55", avgW: "2", avgL: "1", risk: "2", tpw: "5", fee: "0.035" },
  { label: "Swing", wr: "45", avgW: "5", avgL: "2", risk: "2", tpw: "2", fee: "0.02" },
  { label: "Position", wr: "40", avgW: "10", avgL: "3", risk: "3", tpw: "1", fee: "0.01" },
]

/* ─── Monte Carlo Engine ───────────────────────────── */

const NUM_SIMS = 500

function runSimulations(
  bal: number, dep: number, withdrawal: number, wr: number, wPct: number, lPct: number,
  risk: number, tpw: number, feePct: number, reinvestPct: number, m: number, seed: number,
): SimResults {
  const tradesPerMonth = Math.round(tpw * 4.33)
  const totalTradesPerSim = tradesPerMonth * m

  const expectancy = (wr * wPct) - ((1 - wr) * lPct)
  const payoffRatio = lPct > 0 ? wPct / lPct : Infinity
  const kelly = payoffRatio > 0 ? (wr * payoffRatio - (1 - wr)) / payoffRatio : 0
  const profitFactor = ((1 - wr) * lPct) > 0 ? (wr * wPct) / ((1 - wr) * lPct) : Infinity

  const allCurves: number[][] = []
  const allFinalBals: number[] = []
  const allMaxDDs: number[] = []
  const allMonthlyReturns: number[] = []
  const allMaxConsecLoss: number[] = []
  let totalGrossWins = 0, totalGrossLosses = 0

  for (let sim = 0; sim < NUM_SIMS; sim++) {
    const rng = mulberry32(seed + sim * 7919)
    let curBal = bal
    let peak = bal
    const curve: number[] = [bal]
    let maxDD = 0
    let consecLoss = 0, maxConsecL = 0

    for (let month = 1; month <= m; month++) {
      const startBal = curBal
      let monthFees = 0

      for (let t = 0; t < tradesPerMonth; t++) {
        const riskAmt = curBal * risk
        const notional = riskAmt / risk
        const tradeFee = notional * (feePct / 100)
        curBal -= tradeFee
        monthFees += tradeFee

        const isWin = rng() < wr
        if (isWin) {
          const gain = riskAmt * (wPct / risk)
          const reinvestedGain = gain * (reinvestPct / 100)
          curBal += reinvestedGain
          if (sim === 0) totalGrossWins += gain
          consecLoss = 0
        } else {
          const loss = riskAmt * (lPct / risk)
          curBal -= loss
          if (sim === 0) totalGrossLosses += loss
          consecLoss++
          if (consecLoss > maxConsecL) maxConsecL = consecLoss
        }
        if (curBal <= 0) { curBal = 0; break }
      }

      curBal += dep
      curBal = Math.max(0, curBal - withdrawal)

      if (curBal > peak) peak = curBal
      const dd = peak > 0 ? ((peak - curBal) / peak) * 100 : 0
      if (dd > maxDD) maxDD = dd

      const monthReturn = startBal > 0 ? ((curBal - startBal) / startBal) * 100 : 0
      allMonthlyReturns.push(monthReturn)

      curve.push(curBal)
    }

    allCurves.push(curve)
    allFinalBals.push(curBal)
    allMaxDDs.push(maxDD)
    allMaxConsecLoss.push(maxConsecL)
  }

  const pCurves: PercentileCurves = { p10: [], p25: [], p50: [], p75: [], p90: [] }
  for (let i = 0; i <= m; i++) {
    const vals = allCurves.map((c) => c[i]).sort((a, b) => a - b)
    pCurves.p10.push(percentile(vals, 10))
    pCurves.p25.push(percentile(vals, 25))
    pCurves.p50.push(percentile(vals, 50))
    pCurves.p75.push(percentile(vals, 75))
    pCurves.p90.push(percentile(vals, 90))
  }

  const linearData: number[] = [bal]
  let linBal = bal
  const linearMonthly = bal * expectancy * tradesPerMonth
  for (let i = 1; i <= m; i++) {
    linBal += linearMonthly + dep - withdrawal
    linearData.push(Math.max(0, linBal))
  }

  const medianIdx = allFinalBals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)[Math.floor(NUM_SIMS / 2)].i
  const medianCurve = allCurves[medianIdx]

  const drawdownP50: number[] = [0]
  let ddPeak = medianCurve[0]
  for (let i = 1; i < medianCurve.length; i++) {
    if (medianCurve[i] > ddPeak) ddPeak = medianCurve[i]
    drawdownP50.push(ddPeak > 0 ? ((ddPeak - medianCurve[i]) / ddPeak) * 100 : 0)
  }

  const monthlyRows: MonthRow[] = [{ month: 0, balance: bal, profit: 0, deposits: 0, withdrawals: 0, fees: 0, cumProfit: 0, drawdown: 0 }]
  {
    const rng = mulberry32(seed + medianIdx * 7919)
    let curBal = bal, peak2 = bal, cumProfit = 0
    for (let month = 1; month <= m; month++) {
      const startBal = curBal
      let monthFees = 0
      for (let t = 0; t < tradesPerMonth; t++) {
        const riskAmt = curBal * risk
        const notional = riskAmt / risk
        const tradeFee = notional * (feePct / 100)
        curBal -= tradeFee; monthFees += tradeFee
        if (rng() < wr) { curBal += riskAmt * (wPct / risk) * (reinvestPct / 100) }
        else { curBal -= riskAmt * (lPct / risk) }
        if (curBal <= 0) { curBal = 0; break }
      }
      const monthProfit = curBal - startBal + monthFees
      curBal += dep; curBal = Math.max(0, curBal - withdrawal)
      cumProfit += monthProfit
      if (curBal > peak2) peak2 = curBal
      const dd = peak2 > 0 ? ((peak2 - curBal) / peak2) * 100 : 0
      monthlyRows.push({ month, balance: curBal, profit: monthProfit, deposits: dep, withdrawals: withdrawal, fees: monthFees, cumProfit: cumProfit, drawdown: dd })
    }
  }

  const sortedFinals = [...allFinalBals].sort((a, b) => a - b)
  const medianFinal = percentile(sortedFinals, 50)
  const totalProfitMedian = medianFinal - bal - dep * m + withdrawal * m
  const totalROI = bal > 0 ? (totalProfitMedian / bal) * 100 : 0
  const monthlyAvgReturn = m > 0 ? totalROI / m : 0

  const meanMonthlyRet = allMonthlyReturns.length > 0 ? allMonthlyReturns.reduce((s, v) => s + v, 0) / allMonthlyReturns.length : 0
  const variance = allMonthlyReturns.length > 1
    ? allMonthlyReturns.reduce((s, v) => s + (v - meanMonthlyRet) ** 2, 0) / (allMonthlyReturns.length - 1) : 0
  const stdDev = Math.sqrt(variance)
  const sharpe = stdDev > 0 ? (meanMonthlyRet / stdDev) * Math.sqrt(12) : 0

  const downside = allMonthlyReturns.filter((r) => r < 0)
  const downsideVar = downside.length > 1
    ? downside.reduce((s, v) => s + v ** 2, 0) / (downside.length - 1) : 0
  const downsideStd = Math.sqrt(downsideVar)
  const sortino = downsideStd > 0 ? (meanMonthlyRet / downsideStd) * Math.sqrt(12) : 0

  const riskOfRuin = (allMaxDDs.filter((dd) => dd >= 50).length / NUM_SIMS) * 100
  const sortedMaxDDs = [...allMaxDDs].sort((a, b) => a - b)
  const expectedMaxDD = percentile(sortedMaxDDs, 50)

  const sortedConsec = [...allMaxConsecLoss].sort((a, b) => a - b)
  const maxConsecLosses = Math.round(percentile(sortedConsec, 50))

  const lossRate = 1 - wr
  const streakNs = [3, 5, 7, 10, 15, 20]
  const streakProbs = streakNs.map((n) => {
    const probPerWindow = lossRate ** n
    const windows = totalTradesPerSim - n + 1
    const prob = Math.min(100, (1 - (1 - probPerWindow) ** Math.max(1, windows)) * 100)
    return { n, prob }
  })

  const p50 = pCurves.p50
  const timeTo2x = p50.findIndex((v) => v >= bal * 2)
  const timeTo5x = p50.findIndex((v) => v >= bal * 5)
  const timeTo10x = p50.findIndex((v) => v >= bal * 10)

  return {
    percentiles: pCurves, linearData, finalBalances: allFinalBals, drawdownP50, monthlyRows,
    metrics: {
      finalBalanceMedian: medianFinal, totalProfitMedian, totalROI, monthlyAvgReturn,
      expectancy: expectancy * 100, kelly: Math.max(0, kelly) * 100, halfKelly: Math.max(0, kelly / 2) * 100,
      profitFactor: isFinite(profitFactor) ? profitFactor : 99, payoffRatio: isFinite(payoffRatio) ? payoffRatio : 99,
      sharpe, sortino, riskOfRuin, expectedMaxDD, maxConsecLosses,
      totalTrades: totalTradesPerSim, totalDeposited: dep * m, totalWithdrawn: withdrawal * m,
      totalFees: totalGrossWins > 0 ? (totalGrossWins + totalGrossLosses) * (feePct / 100) : 0,
    },
    milestones: {
      timeTo2x: timeTo2x > 0 ? timeTo2x : null,
      timeTo5x: timeTo5x > 0 ? timeTo5x : null,
      timeTo10x: timeTo10x > 0 ? timeTo10x : null,
    },
    streakProbs,
  }
}

/* ─── Main calculator ──────────────────────────────── */

export function CompoundingCalculator() {
  const [startingBalance, setStartingBalance] = useState("1000")
  const [monthlyDeposit, setMonthlyDeposit] = useState("0")
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState("0")
  const [winRate, setWinRate] = useState("55")
  const [avgWin, setAvgWin] = useState("2")
  const [avgLoss, setAvgLoss] = useState("1")
  const [riskPerTrade, setRiskPerTrade] = useState("2")
  const [tradesPerWeek, setTradesPerWeek] = useState("5")
  const [tradingFee, setTradingFee] = useState("0.035")
  const [reinvestPct, setReinvestPct] = useState("100")
  const [months, setMonths] = useState("12")

  const p = useCallback((s: string) => { const n = parseFloat(s.replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n }, [])

  const results = useMemo(() => {
    const bal = p(startingBalance)
    const dep = p(monthlyDeposit)
    const wd = p(monthlyWithdrawal)
    const wr = p(winRate) / 100
    const wPct = p(avgWin) / 100
    const lPct = p(avgLoss) / 100
    const risk = p(riskPerTrade) / 100
    const tpw = p(tradesPerWeek)
    const fee = p(tradingFee)
    const reinvest = Math.max(0, Math.min(100, p(reinvestPct)))
    const m = Math.max(1, Math.min(120, Math.round(p(months))))

    if (bal <= 0 || wr < 0 || wr > 1 || wPct <= 0 || lPct <= 0 || risk <= 0 || tpw <= 0) return null

    const seed = hashInputs(startingBalance, monthlyDeposit, monthlyWithdrawal, winRate, avgWin, avgLoss, riskPerTrade, tradesPerWeek, tradingFee, reinvestPct, months)
    return runSimulations(bal, dep, wd, wr, wPct, lPct, risk, tpw, fee, reinvest, m, seed)
  }, [startingBalance, monthlyDeposit, monthlyWithdrawal, winRate, avgWin, avgLoss, riskPerTrade, tradesPerWeek, tradingFee, reinvestPct, months, p])

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const monthPresets = [3, 6, 12, 24, 36, 60]

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setWinRate(preset.wr); setAvgWin(preset.avgW); setAvgLoss(preset.avgL)
    setRiskPerTrade(preset.risk); setTradesPerWeek(preset.tpw); setTradingFee(preset.fee)
  }

  return (
    <div className="w-full">
      <div className="bg-[#141620] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#2a2e3e]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg"><Repeat className="h-5 w-5 text-brand" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Compounding Calculator</h2>
              <p className="text-[#555a66] text-xs">Monte Carlo simulation with {NUM_SIMS} runs, percentile bands & risk metrics</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Trader Presets */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-[#848e9c] mb-2">Trader Profile</label>
            <div className="flex gap-2">
              {PRESETS.map((preset) => (
                <button key={preset.label} type="button" onClick={() => applyPreset(preset)}
                  className="flex-1 py-2 rounded-full text-xs font-medium bg-[#1a1d26] text-[#848e9c] hover:text-white hover:bg-[#252830] transition-colors">
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Capital Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <CInput id="startBal" label="Starting Balance" value={startingBalance} onChange={setStartingBalance} prefix="$" hint="Initial capital" />
            <CInput id="monthDep" label="Monthly Deposit" value={monthlyDeposit} onChange={setMonthlyDeposit} prefix="$" hint="Extra funds/month" />
            <CInput id="monthWd" label="Monthly Withdrawal" value={monthlyWithdrawal} onChange={setMonthlyWithdrawal} prefix="$" hint="Profit-taking" />
            <CInput id="reinvest" label="Reinvest %" value={reinvestPct} onChange={setReinvestPct} suffix="%" hint="% of wins reinvested" />
          </div>

          {/* Trade Parameters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <CInput id="winRate" label="Win Rate" value={winRate} onChange={setWinRate} suffix="%" hint="% of trades won" />
            <CInput id="avgWin" label="Avg Win" value={avgWin} onChange={setAvgWin} suffix="%" hint="Return per win" />
            <CInput id="avgLoss" label="Avg Loss" value={avgLoss} onChange={setAvgLoss} suffix="%" hint="Loss per losing trade" />
            <CInput id="riskPer" label="Risk per Trade" value={riskPerTrade} onChange={setRiskPerTrade} suffix="%" hint="% of account" />
          </div>

          {/* Frequency & Fees */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <CInput id="tpw" label="Trades per Week" value={tradesPerWeek} onChange={setTradesPerWeek} hint="Avg frequency" />
            <CInput id="fee" label="Trading Fee" value={tradingFee} onChange={setTradingFee} suffix="%" hint="Per trade (0.035% taker)" />
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

          <div className="border-t border-[#2a2e3e] my-5" />

          {results && (
            <>
              {/* Key Stats Row 1 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label="Final Balance (Median)" value={`$${fmt(results.metrics.finalBalanceMedian)}`} sub={`${results.metrics.totalROI >= 0 ? "+" : ""}${results.metrics.totalROI.toFixed(1)}% ROI`} color="brand" />
                <Stat label="Total Profit" value={`${results.metrics.totalProfitMedian >= 0 ? "+" : ""}$${fmt(results.metrics.totalProfitMedian)}`}
                  sub={results.metrics.totalDeposited > 0 ? `+$${fmt(results.metrics.totalDeposited)} deposited` : undefined}
                  color={results.metrics.totalProfitMedian >= 0 ? "green" : "red"} />
                <Stat label="Expectancy" value={`${results.metrics.expectancy >= 0 ? "+" : ""}${results.metrics.expectancy.toFixed(2)}%`} sub="Edge per trade" color={results.metrics.expectancy >= 0 ? "green" : "red"} />
                <Stat label="Profit Factor" value={results.metrics.profitFactor.toFixed(2)} sub={results.metrics.profitFactor >= 1.5 ? "Strong edge" : results.metrics.profitFactor >= 1 ? "Marginal" : "Losing"} color={results.metrics.profitFactor >= 1.5 ? "green" : results.metrics.profitFactor >= 1 ? "gray" : "red"} />
              </div>

              {/* Key Stats Row 2 — Risk Metrics */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                <Stat label="Kelly Criterion" value={`${results.metrics.kelly.toFixed(1)}%`} sub={`Half Kelly: ${results.metrics.halfKelly.toFixed(1)}%`} color={results.metrics.kelly > 0 ? "brand" : "red"} />
                <Stat label="Payoff Ratio" value={`${results.metrics.payoffRatio.toFixed(2)}:1`} sub="Avg win / avg loss" color={results.metrics.payoffRatio >= 1.5 ? "green" : "gray"} />
                <Stat label="Sharpe Ratio" value={results.metrics.sharpe.toFixed(2)} sub={results.metrics.sharpe >= 2 ? "Excellent" : results.metrics.sharpe >= 1 ? "Good" : "Below avg"} color={results.metrics.sharpe >= 1 ? "green" : "gray"} />
                <Stat label="Sortino Ratio" value={results.metrics.sortino.toFixed(2)} sub="Downside-adjusted" color={results.metrics.sortino >= 2 ? "green" : "gray"} />
                <Stat label="Risk of Ruin" value={`${results.metrics.riskOfRuin.toFixed(1)}%`} sub="P(50% drawdown)" color={results.metrics.riskOfRuin > 10 ? "red" : results.metrics.riskOfRuin > 2 ? "gray" : "green"} />
                <Stat label="Expected Max DD" value={`-${results.metrics.expectedMaxDD.toFixed(1)}%`} sub="Median worst" color={results.metrics.expectedMaxDD > 30 ? "red" : results.metrics.expectedMaxDD > 15 ? "gray" : "green"} />
              </div>

              {/* Milestones Row */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
                <Stat label="Avg Monthly" value={`${results.metrics.monthlyAvgReturn >= 0 ? "+" : ""}${results.metrics.monthlyAvgReturn.toFixed(1)}%`} color={results.metrics.monthlyAvgReturn >= 0 ? "green" : "red"} />
                <Stat label="Total Trades" value={results.metrics.totalTrades.toLocaleString()} sub={`${p(tradesPerWeek)}/week`} color="gray" />
                <Stat label="2x Capital" value={results.milestones.timeTo2x ? `Month ${results.milestones.timeTo2x}` : "\u2014"} sub={results.milestones.timeTo2x ? "Doubled" : `Not in ${months}m`} color={results.milestones.timeTo2x ? "green" : "gray"} />
                <Stat label="5x Capital" value={results.milestones.timeTo5x ? `Month ${results.milestones.timeTo5x}` : "\u2014"} sub={results.milestones.timeTo5x ? "5x reached" : `Not in ${months}m`} color={results.milestones.timeTo5x ? "green" : "gray"} />
                <Stat label="10x Capital" value={results.milestones.timeTo10x ? `Month ${results.milestones.timeTo10x}` : "\u2014"} sub={results.milestones.timeTo10x ? "10x reached" : `Not in ${months}m`} color={results.milestones.timeTo10x ? "brand" : "gray"} />
                <Stat label="Max Losing Streak" value={`${results.metrics.maxConsecLosses}`} sub="Expected median" color={results.metrics.maxConsecLosses > 10 ? "red" : "gray"} />
              </div>

              {/* Growth Chart */}
              <div className="mb-4">
                <ConeChart data={results.percentiles} linearData={results.linearData} />
              </div>

              {/* Drawdown Chart */}
              <div className="mb-4">
                <DrawdownChart data={results.drawdownP50} />
              </div>

              {/* Histogram */}
              <div className="mb-4">
                <OutcomeHistogram finalBalances={results.finalBalances} startingBalance={p(startingBalance)} />
              </div>

              {/* Streak Analysis */}
              <div className="mb-4">
                <StreakTable probs={results.streakProbs} maxConsecLosses={results.metrics.maxConsecLosses} />
              </div>

              {/* Net Result Banner */}
              <div className={`p-4 rounded-xl mb-4 ${results.metrics.totalProfitMedian >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <div className="flex items-center gap-3">
                  {results.metrics.totalProfitMedian >= 0 ? (
                    <div className="p-2 rounded-full bg-emerald-500/20"><TrendingUp className="h-6 w-6 text-emerald-400" /></div>
                  ) : (
                    <div className="p-2 rounded-full bg-red-500/20"><TrendingDown className="h-6 w-6 text-red-400" /></div>
                  )}
                  <div className="flex-1">
                    <p className={`text-xl font-bold ${results.metrics.totalProfitMedian >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${fmt(results.metrics.finalBalanceMedian)}
                    </p>
                    <p className="text-sm text-[#848e9c]">
                      Median outcome after {months} months across {NUM_SIMS} simulations
                      <span className="text-[#555a66]"> \u2014 {results.metrics.totalTrades.toLocaleString()} trades, Sharpe {results.metrics.sharpe.toFixed(2)}</span>
                    </p>
                  </div>
                  {results.milestones.timeTo2x && (
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-[#555a66]">First 2x</p>
                      <p className="text-sm font-semibold text-white">Month {results.milestones.timeTo2x}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Breakdown */}
              <MonthlyTable rows={results.monthlyRows} />
            </>
          )}

          <p className="mt-5 text-[11px] text-[#555a66] leading-relaxed">
            Results use {NUM_SIMS} Monte Carlo simulations with a deterministic seed (same inputs = same output).
            Charts show percentile bands (P10\u2013P90) representing the range of likely outcomes.
            Kelly Criterion shows theoretical optimal bet size — most traders use half-Kelly for safety.
            Past performance does not guarantee future results.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-[#2a2e3e]">
          <a href="/trade/BTC" className="block w-full text-center py-3 px-6 bg-brand hover:bg-brand-hover text-white font-medium rounded-full transition-colors">
            Start Trading on Coincess
          </a>
        </div>
      </div>
    </div>
  )
}
