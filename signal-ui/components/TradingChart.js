// components/TradingChart.js
"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { TF_TO_BRIDGE } from "@/utils/config";
import { createChartV5, mapBarsToSeries, fitAll } from "@/lib/chartSetup";
import { useBarsStream } from "@/lib/useBarsStream";

export default function TradingChart() {
  const containerRef = useRef(null);
  const apiRef       = useRef(null);   // { chart, series }
  const abortRef     = useRef(null);
  const reqIdRef     = useRef(0);

  const { selectedSymbol, timeframe, setLastOHLC, setConnection } = useStore();

  // mount chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const { chart, series } = createChartV5(containerRef.current);
    apiRef.current = { chart, series };

    const ro = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el || !apiRef.current) return;
      apiRef.current.chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(containerRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      apiRef.current = null;
    };
  }, []);

  // load historical once per symbol/timeframe
  useEffect(() => {
    if (!apiRef.current || !selectedSymbol || !timeframe) return;

    const myReq = ++reqIdRef.current;

    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // show we're about to connect (SSE will confirm real-time later)
    setLastOHLC?.(null);
    setConnection?.({ state: "connecting", lastError: null });

    const tf = TF_TO_BRIDGE[timeframe] || "H1";

    (async () => {
      try {
        const r = await fetch("/api/market", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "historical",
            symbol: selectedSymbol,
            timeframe: tf,
            count: 1000,
          }),
          signal: ctrl.signal,
        });
        const data = await r.json().catch(() => ({}));
        if (myReq !== reqIdRef.current) return;
        if (!data?.ok || !Array.isArray(data.bars)) return;

        const clean = data.bars.filter(
          (b) => b && b.time > 0 && b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0
        );
        const seriesData = mapBarsToSeries(clean);
        apiRef.current.series.setData(seriesData);

        if (seriesData.length) {
          const last = seriesData[seriesData.length - 1];
          setLastOHLC?.({ o: last.open, h: last.high, l: last.low, c: last.close });
          // Note: do NOT mark LIVE here; SSE will do that on first real-time tick.
        }

        fitAll(apiRef.current.chart);
      } catch {
        // ignore (aborts/network)
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    })();

    return () => {
      if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
    };
  }, [selectedSymbol, timeframe, setLastOHLC, setConnection]);

  // live stream (only active instrument)
  const bridgeTF = TF_TO_BRIDGE[timeframe] || "H1";

  useBarsStream({
    symbol: selectedSymbol,
    timeframe: bridgeTF,
    bars: 300,

    // ignore 'bootstrap' here (we already set history above)

    onUpdate: (bar) => {
      if (!apiRef.current) return;
      apiRef.current.series.update(bar);
      setLastOHLC?.({ o: bar.open, h: bar.high, l: bar.low, c: bar.close });
      // update freshness *every* data message
      setConnection?.({ lastMessageAt: Date.now() });
    },

    onStatus: (state) => {
      // just record the state; freshness is handled in onUpdate
      setConnection?.({ state });
    },

    idleMs: 20000,
  });

  return (
    <div className="h-[calc(100vh-112px)] md:h-[calc(100vh-96px)]">
      <div ref={containerRef} className="w-full h-full bg-white" />
    </div>
  );
}