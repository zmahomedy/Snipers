// app/realtime-crypto/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createChartV5, mapBarsToSeries, fitAll } from "@/lib/chartSetup";
import { useBarsStream } from "@/lib/useBarsStream";

function useDefaults() {
  const sp = useSearchParams();
  const symbol = (sp.get("symbol") || "ETHUSDT").trim();
  const timeframe = (sp.get("tf") || "M1").toUpperCase();
  const bars = Number(sp.get("bars") || 10);
  return { symbol, timeframe, bars };
}

export default function Page() {
  const { symbol, timeframe, bars } = useDefaults();

  const boxRef = useRef(null);
  const apiRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [lastUpdateAt, setLastUpdateAt] = useState(null);

  // mount chart once
  useEffect(() => {
    if (!boxRef.current) return;
    const { chart, series } = createChartV5(boxRef.current);
    apiRef.current = { chart, series };

    const ro = new ResizeObserver(() => {
      const el = boxRef.current;
      if (!el || !apiRef.current) return;
      apiRef.current.chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(boxRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      apiRef.current = null;
    };
  }, []);

  // stream: bootstrap -> setData; then series.update for every bar
  useBarsStream({
    symbol, timeframe, bars,
    onBootstrap: (arr) => {
      if (!apiRef.current) return;
      const clean = (arr || []).filter(b => b && b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0);
      apiRef.current.series.setData(mapBarsToSeries(clean));
      fitAll(apiRef.current.chart);
      setLastUpdateAt(Date.now());
    },
    onUpdate: (bar) => {
      if (!apiRef.current) return;
      apiRef.current.series.update({
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low:  bar.low,
        close:bar.close,
      });
      setLastUpdateAt(Date.now());
    },
    onStatus: (s) => setStatus(s),
  });

  const subtitle = useMemo(() => {
    const dt = lastUpdateAt ? new Date(lastUpdateAt).toLocaleTimeString() : "—";
    return `Live: ${symbol} · ${timeframe}   Status: ${status}   Last update: ${dt}`;
  }, [symbol, timeframe, status, lastUpdateAt]);

  return (
    <div className="h-[calc(100vh-56px)] w-full">
      <div className="px-3 py-2 text-sm text-neutral-600 border-b">{subtitle}</div>
      <div ref={boxRef} className="w-full h-full bg-white" />
    </div>
  );
}