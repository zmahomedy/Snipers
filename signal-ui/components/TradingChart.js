"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { TF_TO_BRIDGE } from "@/utils/config";
import { createChartV5, mapBarsToSeries, fitAll } from "@/lib/chartSetup";
import { useBarsStream } from "@/lib/useBarsStream";

export default function TradingChart() {
  const containerRef = useRef(null);
  const apiRef = useRef(null);          // { chart, series }
  const abortRef = useRef(null);
  const reqIdRef = useRef(0);
  const lastBarRef = useRef(null);
  const mountedOnceRef = useRef(false);

  // throttle OHLC label updates to reduce React churn
  const ohlcRafRef = useRef(0);
  const ohlcPendingRef = useRef(null);

  const {
    selectedSymbol,
    timeframe,
    setLastOHLC,
    setConnection = () => {},
  } = useStore();

  // ---- mount chart once (Strict Mode safe)
  useEffect(() => {
    if (mountedOnceRef.current) return;
    mountedOnceRef.current = true;

    if (!containerRef.current) return;
    const { chart, series } = createChartV5(containerRef.current);
    apiRef.current = { chart, series };

    return () => {
      if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
      try { chart.remove(); } catch {}
      apiRef.current = null;
    };
  }, []);

  // ---- helper: set OHLC at most once per frame
  const setOHLCFrameSafe = (bar) => {
    if (!setLastOHLC) return;
    ohlcPendingRef.current = { o: bar.open, h: bar.high, l: bar.low, c: bar.close };
    if (ohlcRafRef.current) return;
    ohlcRafRef.current = requestAnimationFrame(() => {
      ohlcRafRef.current = 0;
      const v = ohlcPendingRef.current;
      ohlcPendingRef.current = null;
      if (v) setLastOHLC(v);
    });
  };

  // ---- load historical once per symbol/timeframe (single setData per load)
  useEffect(() => {
    if (!apiRef.current) return;

    const myReq = ++reqIdRef.current;

    // cancel previous fetch
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // reset tail state (no setData([]) to avoid flash)
    lastBarRef.current = null;
    setLastOHLC?.(null);
    setConnection?.({ state: "idle", lastMessageAt: null });

    if (!selectedSymbol) return;
    const tfBridge = TF_TO_BRIDGE[timeframe] || "H1";

    (async () => {
      try {
        const r = await fetch("/api/market", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
          body: JSON.stringify({
            type: "historical",
            symbol: selectedSymbol,
            timeframe: tfBridge,
            count: 1000,
          }),
          signal: ctrl.signal,
        });
        const data = await r.json().catch(() => ({}));
        if (myReq !== reqIdRef.current) return;
        if (!data?.ok || !Array.isArray(data.bars)) return;

        // sanitize & order
        const clean = data.bars
          .filter(b => b && b.time > 0 && b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0)
          .sort((a,b) => a.time - b.time);

        const seriesData = mapBarsToSeries(clean);
        apiRef.current.series.setData(seriesData);        // <-- the only setData
        if (seriesData.length) {
          const last = seriesData[seriesData.length - 1];
          lastBarRef.current = last;
          setOHLCFrameSafe(last);
        }
        fitAll(apiRef.current.chart);
      } catch {
        // ignore abort/network
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    })();

    return () => {
      if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
    };
  // IMPORTANT: only symbol & timeframe here to avoid unintended re-runs
  }, [selectedSymbol, timeframe]);

  // ---- LIVE tail via SSE (IGNORE BOOTSTRAP to avoid repaint)
  const bridgeTF = TF_TO_BRIDGE[timeframe] || "H1";

  useBarsStream({
    symbol: selectedSymbol,
    timeframe: bridgeTF,

    // Ignore bootstrap entirely; history already set above
    // onBootstrap: (bars) => {},

    onUpdate: (bar) => {
      if (!apiRef.current) return;

      // Deduplicate against the bar we already have
      const last = lastBarRef.current;
      if (
        last &&
        last.time === bar.time &&
        last.open === bar.open &&
        last.high === bar.high &&
        last.low === bar.low &&
        last.close === bar.close
      ) {
        return;
      }

      // Update tail only (same time = mutate, newer time = append)
      apiRef.current.series.update(bar);
      lastBarRef.current = bar;
      setOHLCFrameSafe(bar);
    },

    onStatus: (s) => {
      setConnection?.({ state: s, lastMessageAt: Date.now() });
    },
  });

  return (
    <div className="h-[calc(100vh-112px)] md:h-[calc(100vh-96px)]">
      {/* v5 autoSize handles layout changes without manual width/height writes */}
      <div ref={containerRef} className="w-full h-full bg-white" />
    </div>
  );
}