import { createChart, CandlestickSeries, CrosshairMode } from "lightweight-charts";

export function createChartV5(container) {
  const chart = createChart(container, {
    autoSize: true,
    layout: { background: { color: "#fff" }, textColor: "#111" },
    grid: {
      vertLines: { color: "#eef2f7", visible: true },
      horzLines: { color: "#eef2f7", visible: true },
    },
    rightPriceScale: {
      borderVisible: true,
      borderColor: "#e5e7eb",
      scaleMargins: { top: 0.15, bottom: 0.2 }, // breathing room
    },
    timeScale: {
      borderVisible: true,
      borderColor: "#e5e7eb",
      rightOffset: 8,
      barSpacing: 6,
      secondsVisible: true,
    },
    crosshair: { mode: CrosshairMode.Normal },
  });

  const series = chart.addSeries(CandlestickSeries);
  series.applyOptions({
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderUpColor: "#26a69a",
    borderDownColor: "#ef5350",
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
    lastValueVisible: true,
    priceLineVisible: true,
  });

  return { chart, series };
}

export function mapBarsToSeries(bars) {
  return bars.map(b => ({
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
  }));
}

export function fitAll(chart) {
  try { chart.timeScale().fitContent(); } catch {}
}

export function scrollToNow(chart) {
  try { chart.timeScale().scrollToRealTime(); } catch {}
}