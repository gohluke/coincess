"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Fill } from "@/lib/hyperliquid/types";
import { BRAND } from "@/lib/brand.config";

function formatUsd(val: number): string {
  return "$" + Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ChartMode = "accountValue" | "pnl";

interface PortfolioChartProps {
  fills: Fill[];
  currentAccountValue: number;
}

interface DataPoint {
  time: number;
  value: number;
}

function buildPnlSeries(fills: Fill[]): DataPoint[] {
  if (fills.length === 0) return [];
  const sorted = [...fills].sort((a, b) => a.time - b.time);
  let cumPnl = 0;
  const points: DataPoint[] = [];
  for (const f of sorted) {
    cumPnl += parseFloat(f.closedPnl) - parseFloat(f.fee);
    points.push({ time: f.time, value: cumPnl });
  }
  return points;
}

function buildAccountValueSeries(
  fills: Fill[],
  currentAccountValue: number
): DataPoint[] {
  if (fills.length === 0) return [];
  const sorted = [...fills].sort((a, b) => a.time - b.time);

  let cumPnl = 0;
  const pnlAtTime: DataPoint[] = [];
  for (const f of sorted) {
    cumPnl += parseFloat(f.closedPnl) - parseFloat(f.fee);
    pnlAtTime.push({ time: f.time, value: cumPnl });
  }

  const finalPnl = cumPnl;
  const baseValue = currentAccountValue - finalPnl;
  return pnlAtTime.map((p) => ({ time: p.time, value: baseValue + p.value }));
}

export default function PortfolioChart({
  fills,
  currentAccountValue,
}: PortfolioChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ChartMode>("accountValue");
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  const pnlSeries = useMemo(() => buildPnlSeries(fills), [fills]);
  const avSeries = useMemo(
    () => buildAccountValueSeries(fills, currentAccountValue),
    [fills, currentAccountValue]
  );

  const series = mode === "pnl" ? pnlSeries : avSeries;

  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      hoverIdx: number | null
    ) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, width * dpr, height * dpr);

      if (series.length < 2) {
        ctx.fillStyle = "#848e9c";
        ctx.font = `${13 * dpr}px -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("Not enough data yet", (width * dpr) / 2, (height * dpr) / 2);
        return;
      }

      const padding = { top: 20 * dpr, right: 16 * dpr, bottom: 30 * dpr, left: 60 * dpr };
      const chartW = width * dpr - padding.left - padding.right;
      const chartH = height * dpr - padding.top - padding.bottom;

      const values = series.map((p) => p.value);
      let minV = Math.min(...values);
      let maxV = Math.max(...values);
      if (minV === maxV) {
        minV -= 1;
        maxV += 1;
      }
      const range = maxV - minV;
      const minTime = series[0].time;
      const maxTime = series[series.length - 1].time;
      const timeRange = maxTime - minTime || 1;

      const toX = (t: number) => padding.left + ((t - minTime) / timeRange) * chartW;
      const toY = (v: number) => padding.top + chartH - ((v - minV) / range) * chartH;

      // Grid lines
      ctx.strokeStyle = "#1e2230";
      ctx.lineWidth = dpr;
      const gridLines = 4;
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartH / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();

        const val = maxV - (range / gridLines) * i;
        ctx.fillStyle = "#848e9c";
        ctx.font = `${10 * dpr}px -apple-system, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText(
          `$${val >= 1000 ? (val / 1000).toFixed(1) + "K" : val.toFixed(0)}`,
          padding.left - 8 * dpr,
          y + 3 * dpr
        );
      }

      // Determine line color based on mode and trend
      const isPositive = series[series.length - 1].value >= series[0].value;
      const lineColor =
        mode === "pnl"
          ? isPositive
            ? "#0ecb81"
            : "#f6465d"
          : BRAND.hex;

      // Area fill
      ctx.beginPath();
      ctx.moveTo(toX(series[0].time), toY(series[0].value));
      for (let i = 1; i < series.length; i++) {
        ctx.lineTo(toX(series[i].time), toY(series[i].value));
      }
      ctx.lineTo(toX(series[series.length - 1].time), padding.top + chartH);
      ctx.lineTo(toX(series[0].time), padding.top + chartH);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, lineColor + "30");
      gradient.addColorStop(1, lineColor + "00");
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2 * dpr;
      ctx.lineJoin = "round";
      ctx.moveTo(toX(series[0].time), toY(series[0].value));
      for (let i = 1; i < series.length; i++) {
        ctx.lineTo(toX(series[i].time), toY(series[i].value));
      }
      ctx.stroke();

      // X-axis date labels
      const labelCount = Math.min(5, series.length);
      const step = Math.max(1, Math.floor(series.length / labelCount));
      ctx.fillStyle = "#848e9c";
      ctx.font = `${10 * dpr}px -apple-system, sans-serif`;
      ctx.textAlign = "center";
      for (let i = 0; i < series.length; i += step) {
        const d = new Date(series[i].time);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        ctx.fillText(label, toX(series[i].time), padding.top + chartH + 18 * dpr);
      }

      // Hover crosshair
      if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < series.length) {
        const pt = series[hoverIdx];
        const hx = toX(pt.time);
        const hy = toY(pt.value);

        ctx.strokeStyle = "#848e9c40";
        ctx.lineWidth = dpr;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(hx, padding.top);
        ctx.lineTo(hx, padding.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(hx, hy, 4 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.strokeStyle = "#0b0e11";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }
    },
    [series, mode]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    draw(ctx, rect.width, rect.height, null);
  }, [draw]);

  const handleMouse = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || series.length < 2) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
      const dpr = window.devicePixelRatio || 1;

      const padding = { left: 60, right: 16 };
      const chartW = w - padding.left - padding.right;
      const relX = (x - padding.left) / chartW;
      const idx = Math.round(relX * (series.length - 1));
      const clamped = Math.max(0, Math.min(series.length - 1, idx));

      setHoveredPoint(series[clamped]);

      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, rect.width, rect.height, clamped);
    },
    [series, draw]
  );

  const handleLeave = useCallback(() => {
    setHoveredPoint(null);
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    const rect = container.getBoundingClientRect();
    if (ctx) draw(ctx, rect.width, rect.height, null);
  }, [draw]);

  const displayValue = hoveredPoint
    ? hoveredPoint.value
    : series.length > 0
      ? series[series.length - 1].value
      : mode === "accountValue"
        ? currentAccountValue
        : 0;

  const displayDate = hoveredPoint
    ? new Date(hoveredPoint.time).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Current";

  return (
    <div className="bg-[#141620] border border-[#2a2e3e] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => setMode("accountValue")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === "accountValue"
                ? "bg-brand/15 text-brand"
                : "text-[#848e9c] hover:text-white"
            }`}
          >
            Account Value
          </button>
          <button
            onClick={() => setMode("pnl")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === "pnl"
                ? "bg-brand/15 text-brand"
                : "text-[#848e9c] hover:text-white"
            }`}
          >
            PNL
          </button>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">
            {mode === "pnl" && displayValue >= 0 ? "+" : ""}
            {formatUsd(displayValue)}
          </p>
          <p className="text-[10px] text-[#848e9c]">{displayDate}</p>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[200px]">
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
