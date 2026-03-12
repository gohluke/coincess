"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
  type Time,
} from "lightweight-charts";
import { BRAND } from "@/lib/brand";
import { fetchCandles } from "@/lib/hyperliquid/api";
import { getWs } from "@/lib/hyperliquid/websocket";
import { useTradingStore } from "@/lib/hyperliquid/store";
import type { CandleInterval, Fill } from "@/lib/hyperliquid/types";

const INTERVALS: { label: string; value: CandleInterval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
  "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
  "8h": 28_800_000, "12h": 43_200_000, "1d": 86_400_000, "3d": 259_200_000,
  "1w": 604_800_000, "1M": 2_592_000_000,
};

const BATCH_SIZE = 1500;
const SCROLL_TRIGGER = 20;
const MARKER_MIN = 14;
const MARKER_MAX = 28;

const TZ_OFFSET_SEC = -(new Date().getTimezoneOffset() * 60);
function toLocal(utcMs: number): UTCTimestamp {
  return (utcMs / 1000 + TZ_OFFSET_SEC) as UTCTimestamp;
}

function snapToCandleTime(localTime: UTCTimestamp, candles: CandlestickData[]): UTCTimestamp | null {
  if (candles.length === 0) return null;
  let lo = 0;
  let hi = candles.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((candles[mid].time as number) <= (localTime as number)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best >= 0 ? (candles[best].time as UTCTimestamp) : null;
}

function buildFillTooltip(f: Fill): string {
  const dir = f.dir.toLowerCase();
  const px = parseFloat(f.px);
  let action: string;
  if (dir.includes("open") && dir.includes("long")) action = "Open Long";
  else if (dir.includes("open") && dir.includes("short")) action = "Open Short";
  else if (dir.includes("close") && dir.includes("long")) action = "Close Long";
  else if (dir.includes("close") && dir.includes("short")) action = "Close Short";
  else action = f.side === "B" ? "Buy" : "Sell";

  const pnl = parseFloat(f.closedPnl);
  const sz = parseFloat(f.sz);
  let line1 = `${action} at ${px}`;
  const parts: string[] = [];
  if (sz) parts.push(`Size: ${sz}`);
  if (pnl !== 0) {
    const sign = pnl > 0 ? "+" : "";
    const color = pnl > 0 ? "#0ecb81" : "#f6465d";
    parts.push(`PnL: <span style="color:${color}">${sign}$${pnl.toFixed(2)}</span>`);
  }
  if (parts.length > 0) {
    line1 += `<br/><span style="color:#848e9c;font-size:10px">${parts.join(" · ")}</span>`;
  }
  return line1;
}

interface FillOverlayItem {
  snappedTime: UTCTimestamp;
  price: number;
  side: "B" | "A";
  el: HTMLDivElement;
}

interface FillTooltipEntry {
  html: string;
}

export function TradingChart({ fills }: { fills?: Fill[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeRef = useRef<ISeriesApi<any> | null>(null);
  const fillOverlaysRef = useRef<FillOverlayItem[]>([]);
  const fillTooltipMapRef = useRef<Map<string, FillTooltipEntry[]>>(new Map());

  const candleDataRef = useRef<CandlestickData[]>([]);
  const volumeDataRef = useRef<HistogramData[]>([]);
  const oldestLoadedRef = useRef<number>(0);
  const fetchingRef = useRef(false);
  const noMoreDataRef = useRef(false);
  const fillsRef = useRef(fills);
  fillsRef.current = fills;

  const marketRef = useRef(useTradingStore.getState().selectedMarket);
  const intervalRef = useRef(useTradingStore.getState().selectedInterval);

  const selectedMarket = useTradingStore((s) => s.selectedMarket);
  const selectedInterval = useTradingStore((s) => s.selectedInterval);
  const setInterval = useTradingStore((s) => s.setInterval);

  marketRef.current = selectedMarket;
  intervalRef.current = selectedInterval;

  /* ── Overlay marker positioning ─────────────────────────── */

  const repositionOverlays = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const ts = chart.timeScale();
    const bw = ts.options().barSpacing ?? 6;
    const sz = Math.round(Math.min(MARKER_MAX, Math.max(MARKER_MIN, bw * 0.85)));
    const half = sz / 2;
    const fontSize = `${Math.max(7, Math.round(sz * 0.5))}px`;

    for (const fo of fillOverlaysRef.current) {
      const x = ts.timeToCoordinate(fo.snappedTime as Time);
      const y = series.priceToCoordinate(fo.price);
      if (x === null || y === null) {
        fo.el.style.display = "none";
      } else {
        fo.el.style.display = "flex";
        fo.el.style.width = `${sz}px`;
        fo.el.style.height = `${sz}px`;
        fo.el.style.fontSize = fontSize;
        fo.el.style.transform = `translate(${x - half}px, ${y - half}px)`;
      }
    }
  }, []);

  const refreshOverlays = useCallback(() => {
    for (const fo of fillOverlaysRef.current) fo.el.remove();
    fillOverlaysRef.current = [];
    fillTooltipMapRef.current = new Map();

    const overlay = overlayRef.current;
    const f = fillsRef.current;
    if (!overlay || !f || f.length === 0) return;

    const coin = marketRef.current.replace(/^.*:/, "").toUpperCase();
    const seen = new Set<number>();
    const relevant = f.filter((fi) => {
      if (fi.coin.replace(/^.*:/, "").toUpperCase() !== coin) return false;
      if (fi.time < oldestLoadedRef.current) return false;
      if (seen.has(fi.tid)) return false;
      seen.add(fi.tid);
      return true;
    });

    const candles = candleDataRef.current;
    for (const fi of relevant) {
      const rawLocal = toLocal(fi.time);
      const snapped = snapToCandleTime(rawLocal, candles);
      if (snapped === null) continue;

      const isBuy = fi.side === "B";
      const color = isBuy ? "#0ecb81" : "#f6465d";
      const letter = isBuy ? "B" : "S";

      // Build tooltip map keyed by snapped candle time
      const key = String(snapped);
      const tooltipEntry: FillTooltipEntry = { html: buildFillTooltip(fi) };
      const arr = fillTooltipMapRef.current.get(key);
      if (arr) arr.push(tooltipEntry);
      else fillTooltipMapRef.current.set(key, [tooltipEntry]);

      const el = document.createElement("div");
      el.textContent = letter;
      Object.assign(el.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: `${MARKER_MIN}px`,
        height: `${MARKER_MIN}px`,
        borderRadius: "50%",
        background: color,
        display: "none",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "8px",
        fontWeight: "700",
        color: "#fff",
        pointerEvents: "auto",
        cursor: "pointer",
        zIndex: "5",
        lineHeight: "1",
        userSelect: "none",
        boxShadow: `0 0 4px ${color}88`,
        transition: "width 0.1s, height 0.1s, font-size 0.1s",
      });

      el.addEventListener("mouseenter", () => {
        const tip = tooltipRef.current;
        if (!tip) return;
        const entries = fillTooltipMapRef.current.get(key);
        if (!entries || entries.length === 0) return;
        tip.innerHTML = entries.map((e) => e.html).join("<hr style='border:none;border-top:1px solid #2a2e39;margin:4px 0'/>");
        tip.style.display = "block";
        const rect = el.getBoundingClientRect();
        const cRect = containerRef.current?.getBoundingClientRect();
        if (!cRect) return;
        let left = rect.right - cRect.left + 8;
        let top = rect.top - cRect.top - 4;
        if (left + 200 > cRect.width) left = rect.left - cRect.left - 210;
        if (top < 0) top = 4;
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
      });
      el.addEventListener("mouseleave", () => {
        const tip = tooltipRef.current;
        if (tip) tip.style.display = "none";
      });

      overlay.appendChild(el);
      fillOverlaysRef.current.push({
        snappedTime: snapped,
        price: parseFloat(fi.px),
        side: fi.side,
        el,
      });
    }

    requestAnimationFrame(() => repositionOverlays());
  }, [repositionOverlays]);

  /* ── Infinite scroll ────────────────────────────────────── */

  const loadOlderCandles = useCallback(async () => {
    if (fetchingRef.current || noMoreDataRef.current) return;
    const series = seriesRef.current;
    const volume = volumeRef.current;
    if (!series || !volume) return;

    fetchingRef.current = true;
    const ivMs = INTERVAL_MS[intervalRef.current] ?? 900_000;
    const endTime = oldestLoadedRef.current;
    const startTime = endTime - ivMs * BATCH_SIZE;

    try {
      const candles = await fetchCandles(marketRef.current, intervalRef.current, startTime, endTime - 1);
      if (candles.length === 0) {
        noMoreDataRef.current = true;
        return;
      }

      const newCandle: CandlestickData[] = candles.map((c) => ({
        time: toLocal(c.t),
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
      }));
      const newVol: HistogramData[] = candles.map((c) => ({
        time: toLocal(c.t),
        value: parseFloat(c.v) * parseFloat(c.c),
        color: parseFloat(c.c) >= parseFloat(c.o) ? "#0ecb8133" : "#f6465d33",
      }));

      const existingTimes = new Set(candleDataRef.current.map((d) => d.time));
      const uniqueCandles = newCandle.filter((d) => !existingTimes.has(d.time));
      const uniqueVol = newVol.filter((d) => !existingTimes.has(d.time));

      candleDataRef.current = [...uniqueCandles, ...candleDataRef.current];
      volumeDataRef.current = [...uniqueVol, ...volumeDataRef.current];
      oldestLoadedRef.current = Math.min(oldestLoadedRef.current, candles[0].t);

      series.setData(candleDataRef.current);
      volume.setData(volumeDataRef.current);
      refreshOverlays();
    } catch {
      // network error — will retry next scroll
    } finally {
      fetchingRef.current = false;
    }
  }, [refreshOverlays]);

  /* ── Chart init ─────────────────────────────────────────── */

  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e11" },
        textColor: "#848e9c",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#1a1d26" },
        horzLines: { color: "#1a1d26" },
      },
      crosshair: {
        vertLine: { color: BRAND.hex, width: 1, style: 3 },
        horzLine: { color: BRAND.hex, width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d",
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    // Infinite scroll + reposition overlays on range change
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      repositionOverlays();
      if (!range || fetchingRef.current || noMoreDataRef.current) return;
      if (range.from < SCROLL_TRIGGER) {
        loadOlderCandles();
      }
    });

    // Reposition overlays + show tooltip near fill markers
    chart.subscribeCrosshairMove((param) => {
      repositionOverlays();

      const tip = tooltipRef.current;
      if (!tip) return;

      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tip.style.display = "none";
        return;
      }

      const key = String(param.time);
      const entries = fillTooltipMapRef.current.get(key);
      if (!entries || entries.length === 0) {
        tip.style.display = "none";
        return;
      }

      tip.innerHTML = entries.map((e) => e.html).join("<hr style='border:none;border-top:1px solid #2a2e39;margin:4px 0'/>");
      tip.style.display = "block";

      const cRect = containerRef.current?.getBoundingClientRect();
      if (!cRect) return;
      let left = param.point.x + 16;
      let top = param.point.y - 12;
      if (left + 200 > cRect.width) left = param.point.x - 210;
      if (top < 0) top = 4;
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      repositionOverlays();
    });
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [loadOlderCandles, repositionOverlays]);

  useEffect(() => {
    const cleanup = initChart();
    return () => cleanup?.();
  }, [initChart]);

  /* ── Initial load + WebSocket subscription ──────────────── */

  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current) return;

    const series = seriesRef.current;
    const volume = volumeRef.current;

    candleDataRef.current = [];
    volumeDataRef.current = [];
    fetchingRef.current = false;
    noMoreDataRef.current = false;

    const now = Date.now();
    const ivMs = INTERVAL_MS[selectedInterval] ?? 900_000;
    const lookback = ivMs * BATCH_SIZE;
    const startTime = now - lookback;

    fetchCandles(selectedMarket, selectedInterval, startTime, now)
      .then((candles) => {
        const candleData: CandlestickData[] = candles.map((c) => ({
          time: toLocal(c.t),
          open: parseFloat(c.o),
          high: parseFloat(c.h),
          low: parseFloat(c.l),
          close: parseFloat(c.c),
        }));
        const volumeData: HistogramData[] = candles.map((c) => ({
          time: toLocal(c.t),
          value: parseFloat(c.v) * parseFloat(c.c),
          color: parseFloat(c.c) >= parseFloat(c.o) ? "#0ecb8133" : "#f6465d33",
        }));

        candleDataRef.current = candleData;
        volumeDataRef.current = volumeData;
        oldestLoadedRef.current = candles.length > 0 ? candles[0].t : startTime;

        series.setData(candleData);
        volume.setData(volumeData);
        refreshOverlays();
        chartRef.current?.timeScale().fitContent();
      })
      .catch(console.error);

    const ws = getWs();
    const unsub = ws.subscribeCandle(selectedMarket, selectedInterval, (data) => {
      const candles = Array.isArray(data) ? data : [data];
      for (const c of candles) {
        const cd: CandlestickData = {
          time: toLocal(c.t),
          open: parseFloat(c.o),
          high: parseFloat(c.h),
          low: parseFloat(c.l),
          close: parseFloat(c.c),
        };
        const vd: HistogramData = {
          time: toLocal(c.t),
          value: parseFloat(c.v) * parseFloat(c.c),
          color: parseFloat(c.c) >= parseFloat(c.o) ? "#0ecb8133" : "#f6465d33",
        };
        series.update(cd);
        volume.update(vd);

        const last = candleDataRef.current[candleDataRef.current.length - 1];
        if (last && last.time === cd.time) {
          candleDataRef.current[candleDataRef.current.length - 1] = cd;
          volumeDataRef.current[volumeDataRef.current.length - 1] = vd;
        } else {
          candleDataRef.current.push(cd);
          volumeDataRef.current.push(vd);
        }
      }
      repositionOverlays();
    });

    return unsub;
  }, [selectedMarket, selectedInterval, fills, refreshOverlays, repositionOverlays]);

  useEffect(() => {
    refreshOverlays();
  }, [fills, refreshOverlays]);

  useEffect(() => {
    return () => {
      for (const fo of fillOverlaysRef.current) fo.el.remove();
      fillOverlaysRef.current = [];
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2a2e39]">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              selectedInterval === iv.value
                ? "bg-brand text-white"
                : "text-[#848e9c] hover:text-white hover:bg-[#1a1d26]"
            }`}
          >
            {iv.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0" />
        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
            zIndex: 4,
          }}
        />
        <div
          ref={tooltipRef}
          style={{
            display: "none",
            position: "absolute",
            zIndex: 10,
            pointerEvents: "none",
            background: "rgba(19,21,28,0.95)",
            border: "1px solid #2a2e39",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 11,
            color: "#e0e0e0",
            whiteSpace: "nowrap",
            lineHeight: "18px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        />
      </div>
    </div>
  );
}
