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
  type CandlestickSeriesOptions,
  type HistogramSeriesOptions,
} from "lightweight-charts";
import { BRAND } from "@/lib/brand";
import { fetchCandles } from "@/lib/hyperliquid/api";
import { getWs } from "@/lib/hyperliquid/websocket";
import { useTradingStore } from "@/lib/hyperliquid/store";
import type { CandleInterval } from "@/lib/hyperliquid/types";

const INTERVALS: { label: string; value: CandleInterval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

// Shift UTC epoch seconds → local epoch seconds so the chart axis shows local time
const TZ_OFFSET_SEC = -(new Date().getTimezoneOffset() * 60);
function toLocal(utcMs: number): UTCTimestamp {
  return (utcMs / 1000 + TZ_OFFSET_SEC) as UTCTimestamp;
}

export function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeRef = useRef<ISeriesApi<any> | null>(null);

  const selectedMarket = useTradingStore((s) => s.selectedMarket);
  const selectedInterval = useTradingStore((s) => s.selectedInterval);
  const setInterval = useTradingStore((s) => s.setInterval);

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

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const cleanup = initChart();
    return () => cleanup?.();
  }, [initChart]);

  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current) return;

    const series = seriesRef.current;
    const volume = volumeRef.current;

    const now = Date.now();
    const intervalMs: Record<string, number> = {
      "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
      "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
      "8h": 28_800_000, "12h": 43_200_000, "1d": 86_400_000, "3d": 259_200_000,
      "1w": 604_800_000, "1M": 2_592_000_000,
    };
    const lookback = (intervalMs[selectedInterval] ?? 900_000) * 300;
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
        series.setData(candleData);
        volume.setData(volumeData);
        chartRef.current?.timeScale().fitContent();
      })
      .catch(console.error);

    const ws = getWs();
    const unsub = ws.subscribeCandle(selectedMarket, selectedInterval, (data) => {
      const candles = Array.isArray(data) ? data : [data];
      for (const c of candles) {
        series.update({
          time: toLocal(c.t),
          open: parseFloat(c.o),
          high: parseFloat(c.h),
          low: parseFloat(c.l),
          close: parseFloat(c.c),
        });
        volume.update({
          time: toLocal(c.t),
          value: parseFloat(c.v) * parseFloat(c.c),
          color: parseFloat(c.c) >= parseFloat(c.o) ? "#0ecb8133" : "#f6465d33",
        });
      }
    });

    return unsub;
  }, [selectedMarket, selectedInterval]);

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
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
