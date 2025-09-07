"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from "lightweight-charts";

// make 200 seed bars on a 1m timeframe using a small random walk (demo only)
function makeSeedBars({ count = 200, tfSec = 60, startPrice = 1.1735 }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const endBucket = Math.floor(nowSec / tfSec) * tfSec;
  const bars = [];
  let price = startPrice;

  for (let i = count - 1; i >= 0; i--) {
    const t = endBucket - i * tfSec;
    const o = price;
    const drift = (Math.random() - 0.5) * (o * 0.0006);
    const c = Math.max(0.00001, o + drift);
    const h = Math.max(o, c) + Math.random() * (o * 0.0003);
    const l = Math.min(o, c) - Math.random() * (o * 0.0003);
    bars.push({ time: t, open: o, high: h, low: l, close: c });
    price = c;
  }
  return bars;
}

export default function RealtimeCanvas() {
  const boxRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastBarRef = useRef(null);
  const timerRef = useRef(null);
  const tfSec = 60; // 1m

  const [running, setRunning] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!boxRef.current) return;

    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#111827" },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // one-time historical seed
    const initial = makeSeedBars({ count: 200, tfSec });
    series.setData(initial);
    lastBarRef.current = initial[initial.length - 1];

    startLoop(); // start fake ticks

    return () => {
      stopLoop();
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      lastBarRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLoop = () => {
    if (timerRef.current) return;
    setRunning(true);
    timerRef.current = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const bucket = Math.floor(nowSec / tfSec) * tfSec;
      const last = lastBarRef.current;
      if (!last) return;

      // tiny random move
      const jitter = (Math.random() - 0.5) * (last.close * 0.0003);
      const px = Math.max(0.00001, last.close + jitter);

      if (last.time === bucket) {
        // same candle ⇒ mutate
        const updated = {
          time: last.time,
          open: last.open,
          high: Math.max(last.high, px),
          low: Math.min(last.low, px),
          close: px,
        };
        seriesRef.current.update(updated);
        lastBarRef.current = updated;
      } else if (bucket > last.time) {
        // new candle ⇒ append
        const fresh = {
          time: bucket,
          open: last.close,
          high: Math.max(last.close, px),
          low: Math.min(last.close, px),
          close: px,
        };
        seriesRef.current.update(fresh);
        lastBarRef.current = fresh;
      }

      setLastUpdate(new Date().toLocaleTimeString());
    }, 1000);
  };

  const stopLoop = () => {
    setRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <header className="flex items-center gap-3 p-3 border-b">
        <div className="text-sm font-semibold">Realtime Test (single setData + update)</div>
        <div className="text-xs text-gray-600">
          Last update: <span className="font-mono">{lastUpdate ?? "—"}</span>
        </div>
        <div className="ml-auto">
          {running ? (
            <button onClick={stopLoop} className="px-3 py-1 text-sm rounded bg-rose-600 text-white hover:bg-rose-700">
              Stop
            </button>
          ) : (
            <button onClick={startLoop} className="px-3 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700">
              Start
            </button>
          )}
        </div>
      </header>
      <main className="flex-1">
        <div ref={boxRef} className="w-full h-full bg-white" />
      </main>
    </div>
  );
}