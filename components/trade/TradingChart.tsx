"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
  type CandlestickSeriesOptions,
  type HistogramSeriesOptions,
  type SeriesMarker,
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

const TZ_OFFSET_SEC = -(new Date().getTimezoneOffset() * 60);
function toLocal(utcMs: number): UTCTimestamp {
  return (utcMs / 1000 + TZ_OFFSET_SEC) as UTCTimestamp;
}

interface FillMeta {
  time: Time;
  label: string;
  side: "B" | "A";
  px: string;
  sz: string;
  dir: string;
}

function formatFillLabel(f: Fill): string {
  const dir = f.dir.toLowerCase();
  const px = parseFloat(f.px);
  if (dir.includes("open") && dir.includes("long")) return `Open Long at ${px}`;
  if (dir.includes("open") && dir.includes("short")) return `Open Short at ${px}`;
  if (dir.includes("close") && dir.includes("long")) return `Close Long at ${px}`;
  if (dir.includes("close") && dir.includes("short")) return `Close Short at ${px}`;
  if (f.side === "B") return `Buy at ${px}`;
  return `Sell at ${px}`;
}

function buildFillMarkers(
  fills: Fill[],
  market: string,
  oldestMs: number,
): { markers: SeriesMarker<Time>[]; meta: Map<string, FillMeta[]> } {
  const coin = market.replace(/^.*:/, "").toUpperCase();
  const relevant = fills
    .filter((f) => f.coin.replace(/^.*:/, "").toUpperCase() === coin && f.time >= oldestMs)
    .sort((a, b) => a.time - b.time);

  const meta = new Map<string, FillMeta[]>();
  const markers: SeriesMarker<Time>[] = relevant.map((f) => {
    const time = toLocal(f.time) as Time;
    const key = String(time);
    const entry: FillMeta = {
      time,
      label: formatFillLabel(f),
      side: f.side,
      px: f.px,
      sz: f.sz,
      dir: f.dir,
    };
    const arr = meta.get(key);
    if (arr) arr.push(entry); else meta.set(key, [entry]);

    return {
      time,
      position: f.side === "B" ? ("belowBar" as const) : ("aboveBar" as const),
      color: f.side === "B" ? "#0ecb81" : "#f6465d",
      shape: "circle" as const,
      text: f.side === "B" ? "B" : "S",
    };
  });

  return { markers, meta };
}

export function TradingChart({ fills }: { fills?: Fill[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null);
  const fillMetaRef = useRef<Map<string, FillMeta[]>>(new Map());

  // Accumulated data for infinite scroll
  const candleDataRef = useRef<CandlestickData[]>([]);
  const volumeDataRef = useRef<HistogramData[]>([]);
  const oldestLoadedRef = useRef<number>(0);
  const fetchingRef = useRef(false);
  const noMoreDataRef = useRef(false);
  const fillsRef = useRef(fills);
  fillsRef.current = fills;

  // Keep stable refs to market/interval for the scroll handler
  const marketRef = useRef(useTradingStore.getState().selectedMarket);
  const intervalRef = useRef(useTradingStore.getState().selectedInterval);

  const selectedMarket = useTradingStore((s) => s.selectedMarket);
  const selectedInterval = useTradingStore((s) => s.selectedInterval);
  const setInterval = useTradingStore((s) => s.setInterval);

  marketRef.current = selectedMarket;
  intervalRef.current = selectedInterval;

  const refreshMarkers = useCallback(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (markersRef.current) {
      try { markersRef.current.detach(); } catch {}
      markersRef.current = null;
    }
    fillMetaRef.current = new Map();
    const f = fillsRef.current;
    if (f && f.length > 0) {
      const { markers, meta } = buildFillMarkers(f, marketRef.current, oldestLoadedRef.current);
      fillMetaRef.current = meta;
      if (markers.length > 0) {
        markersRef.current = createSeriesMarkers(series, markers);
      }
    }
  }, []);

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

      // Deduplicate by time and merge
      const existingTimes = new Set(candleDataRef.current.map((d) => d.time));
      const uniqueCandles = newCandle.filter((d) => !existingTimes.has(d.time));
      const uniqueVol = newVol.filter((d) => !existingTimes.has(d.time));

      candleDataRef.current = [...uniqueCandles, ...candleDataRef.current];
      volumeDataRef.current = [...uniqueVol, ...volumeDataRef.current];
      oldestLoadedRef.current = Math.min(oldestLoadedRef.current, candles[0].t);

      series.setData(candleDataRef.current);
      volume.setData(volumeDataRef.current);
      refreshMarkers();
    } catch {
      // network error — will retry next scroll
    } finally {
      fetchingRef.current = false;
    }
  }, [refreshMarkers]);

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

    // Infinite scroll: fetch older candles when user scrolls near left edge
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || fetchingRef.current || noMoreDataRef.current) return;
      if (range.from < SCROLL_TRIGGER) {
        loadOlderCandles();
      }
    });

    // Tooltip on crosshair hover near fill markers
    chart.subscribeCrosshairMove((param) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tip.style.display = "none";
        return;
      }
      const key = String(param.time);
      const entries = fillMetaRef.current.get(key);
      if (!entries || entries.length === 0) {
        tip.style.display = "none";
        return;
      }

      const lines = entries.map((e) => {
        const color = e.side === "B" ? "#0ecb81" : "#f6465d";
        const icon = e.side === "B" ? "B" : "S";
        return `<div style="display:flex;align-items:center;gap:6px"><span style="width:16px;height:16px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0">${icon}</span><span>${e.label}</span></div>`;
      });
      tip.innerHTML = lines.join("");
      tip.style.display = "block";

      const cRect = containerRef.current!.getBoundingClientRect();
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
    });
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [loadOlderCandles]);

  useEffect(() => {
    const cleanup = initChart();
    return () => cleanup?.();
  }, [initChart]);

  // Initial load + WebSocket subscription
  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current) return;

    const series = seriesRef.current;
    const volume = volumeRef.current;

    // Reset scroll state
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
        refreshMarkers();
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

        // Keep refs in sync for future prepend merges
        const last = candleDataRef.current[candleDataRef.current.length - 1];
        if (last && last.time === cd.time) {
          candleDataRef.current[candleDataRef.current.length - 1] = cd;
          volumeDataRef.current[volumeDataRef.current.length - 1] = vd;
        } else {
          candleDataRef.current.push(cd);
          volumeDataRef.current.push(vd);
        }
      }
    });

    return unsub;
  }, [selectedMarket, selectedInterval, fills, refreshMarkers]);

  // Re-apply markers when fills change (without re-fetching candles)
  useEffect(() => {
    refreshMarkers();
  }, [fills, refreshMarkers]);

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
            lineHeight: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        />
      </div>
    </div>
  );
}
