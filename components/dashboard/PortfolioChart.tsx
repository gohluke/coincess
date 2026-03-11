"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Fill } from "@/lib/hyperliquid/types";
import type { LedgerUpdate } from "@/lib/hyperliquid/api";
import { BRAND } from "@/lib/brand.config";

type ChartMode = "accountValue" | "pnl";

interface PortfolioChartProps {
  fills: Fill[];
  ledger: LedgerUpdate[];
  currentAccountValue: number;
}

interface DataPoint {
  time: number;
  value: number;
}

function parseLedgerAmount(entry: LedgerUpdate): number {
  const d = entry.delta;
  if (d.type === "deposit") return parseFloat(d.usdc ?? "0");
  if (d.type === "withdraw") return -(parseFloat(d.usdc ?? "0") + parseFloat(d.fee ?? "0"));
  if (d.type === "send") {
    return parseFloat(d.amount ?? "0");
  }
  if (d.type === "internalTransfer" || d.type === "spotTransfer") {
    return parseFloat(d.usdc ?? d.amount ?? "0");
  }
  return 0;
}

function buildSeries(
  fills: Fill[],
  ledger: LedgerUpdate[],
  currentAccountValue: number
): { av: DataPoint[]; pnl: DataPoint[] } {
  type Event = { time: number; deposit: number; pnl: number };
  const events: Event[] = [];

  for (const l of ledger) {
    const amt = parseLedgerAmount(l);
    if (amt !== 0) events.push({ time: l.time, deposit: amt, pnl: 0 });
  }
  for (const f of fills) {
    events.push({ time: f.time, deposit: 0, pnl: parseFloat(f.closedPnl) - parseFloat(f.fee) });
  }

  events.sort((a, b) => a.time - b.time);
  if (events.length === 0) return { av: [], pnl: [] };

  let cumDeposit = 0;
  let cumPnl = 0;
  const avPoints: DataPoint[] = [];
  const pnlPoints: DataPoint[] = [];

  for (const ev of events) {
    cumDeposit += ev.deposit;
    cumPnl += ev.pnl;
    avPoints.push({ time: ev.time, value: cumDeposit + cumPnl });
    pnlPoints.push({ time: ev.time, value: cumPnl });
  }

  avPoints.push({ time: Date.now(), value: currentAccountValue });
  pnlPoints.push({ time: Date.now(), value: cumPnl });

  return { av: avPoints, pnl: pnlPoints };
}

function fmtUsd(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return (val / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return (val / 1_000).toFixed(1) + "K";
  return val.toFixed(2);
}

export default function PortfolioChart({ fills, ledger, currentAccountValue }: PortfolioChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ChartMode>("accountValue");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { av, pnl } = useMemo(() => buildSeries(fills, ledger, currentAccountValue), [fills, ledger, currentAccountValue]);
  const series = mode === "pnl" ? pnl : av;

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, hi: number | null) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (series.length < 2) {
        ctx.fillStyle = "#4a4e59";
        ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Not enough trade history yet", width / 2, height / 2);
        return;
      }

      const pad = { top: 16, right: 12, bottom: 24, left: 52 };
      const cw = width - pad.left - pad.right;
      const ch = height - pad.top - pad.bottom;

      const vals = series.map((p) => p.value);
      let mn = Math.min(...vals);
      let mx = Math.max(...vals);
      if (mn === mx) { mn -= 1; mx += 1; }
      const range = mx - mn;
      const t0 = series[0].time;
      const t1 = series[series.length - 1].time;
      const tRange = t1 - t0 || 1;

      const x = (t: number) => pad.left + ((t - t0) / tRange) * cw;
      const y = (v: number) => pad.top + ch - ((v - mn) / range) * ch;

      // Grid
      ctx.strokeStyle = "#1e2230";
      ctx.lineWidth = 0.5;
      const rows = 4;
      for (let i = 0; i <= rows; i++) {
        const gy = pad.top + (ch / rows) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(pad.left + cw, gy);
        ctx.stroke();
        const val = mx - (range / rows) * i;
        ctx.fillStyle = "#5e6673";
        ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("$" + fmtUsd(val), pad.left - 6, gy + 3.5);
      }

      const isPositive = series[series.length - 1].value >= series[0].value;
      const lineColor = mode === "pnl" ? (isPositive ? "#0ecb81" : "#f6465d") : BRAND.hex;

      // Gradient fill
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
      grad.addColorStop(0, lineColor + "20");
      grad.addColorStop(1, lineColor + "02");
      ctx.beginPath();
      ctx.moveTo(x(series[0].time), y(series[0].value));
      for (let i = 1; i < series.length; i++) ctx.lineTo(x(series[i].time), y(series[i].value));
      ctx.lineTo(x(series[series.length - 1].time), pad.top + ch);
      ctx.lineTo(x(series[0].time), pad.top + ch);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.moveTo(x(series[0].time), y(series[0].value));
      for (let i = 1; i < series.length; i++) ctx.lineTo(x(series[i].time), y(series[i].value));
      ctx.stroke();

      // X-axis dates
      const labelCt = Math.min(5, series.length);
      const step = Math.max(1, Math.floor((series.length - 1) / (labelCt - 1)));
      ctx.fillStyle = "#5e6673";
      ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      const shown = new Set<string>();
      for (let i = 0; i < series.length; i += step) {
        const d = new Date(series[i].time);
        const lbl = `${d.getMonth() + 1}/${d.getDate()}`;
        if (shown.has(lbl)) continue;
        shown.add(lbl);
        ctx.fillText(lbl, x(series[i].time), pad.top + ch + 16);
      }

      // Hover
      if (hi !== null && hi >= 0 && hi < series.length) {
        const pt = series[hi];
        const hx = x(pt.time);
        const hy = y(pt.value);

        ctx.strokeStyle = "#5e667340";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, pad.top);
        ctx.lineTo(hx, pad.top + ch);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.strokeStyle = "#0b0e11";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    [series, mode]
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    draw(ctx, rect.width, rect.height, hoverIdx);
  }, [draw, hoverIdx]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [redraw]);

  const handleMouse = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (series.length < 2) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const pad = { left: 52, right: 12 };
      const cw = rect.width - pad.left - pad.right;
      const rel = Math.max(0, Math.min(1, (px - pad.left) / cw));

      const t0 = series[0].time;
      const t1 = series[series.length - 1].time;
      const hoverTime = t0 + rel * (t1 - t0);

      let closest = 0;
      let minDist = Math.abs(series[0].time - hoverTime);
      for (let i = 1; i < series.length; i++) {
        const dist = Math.abs(series[i].time - hoverTime);
        if (dist < minDist) { minDist = dist; closest = i; }
      }
      setHoverIdx(closest);
    },
    [series]
  );

  const handleLeave = useCallback(() => setHoverIdx(null), []);

  const displayVal = hoverIdx !== null && hoverIdx < series.length
    ? series[hoverIdx].value
    : series.length > 0
      ? series[series.length - 1].value
      : mode === "accountValue" ? currentAccountValue : 0;

  const displayDate = hoverIdx !== null && hoverIdx < series.length
    ? new Date(series[hoverIdx].time).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Current";

  return (
    <div className="bg-[#141620] rounded-xl p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-0.5 bg-[#0b0e11] rounded-lg p-0.5">
          {(["accountValue", "pnl"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === m
                  ? "bg-brand text-white shadow-sm"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              {m === "accountValue" ? "Account Value" : "PNL"}
            </button>
          ))}
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold tabular-nums ${
            mode === "pnl" ? (displayVal >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]") : "text-white"
          }`}>
            {mode === "pnl" && displayVal >= 0 ? "+" : mode === "pnl" && displayVal < 0 ? "-" : ""}
            ${fmtUsd(Math.abs(displayVal))}
          </p>
          <p className="text-[10px] text-[#5e6673]">{displayDate}</p>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[180px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouse}
          onMouseLeave={handleLeave}
        />
      </div>
    </div>
  );
}
