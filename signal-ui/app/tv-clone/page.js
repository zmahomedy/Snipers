// app/tv-clone/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createChartV5, mapBarsToSeries, fitAll, scrollToNow } from "@/lib/chartSetup";
import { useBarsStream } from "@/lib/useBarsStream";
import { INSTRUMENTS } from "@/utils/instruments"; // { Forex, Indices, Crypto }

function useDefaults() {
  const sp = useSearchParams();
  const symbol = (sp.get("symbol") || "ETHUSDT").trim();
  const tf     = (sp.get("tf") || "M1").toUpperCase();
  const bars   = Number(sp.get("bars") || 10);
  return { symbol, tf, bars };
}

function StatusBar({ symbol, tf, status, lastAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const last = lastAt ? new Date(lastAt).toLocaleTimeString() : "—";
  const nowStr = new Date(now).toLocaleTimeString();
  const color =
    status === "live" ? "bg-emerald-500" :
    status === "error" ? "bg-red-500" : "bg-amber-500";
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs border-b border-neutral-200 bg-white">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
        <span className="font-medium">{symbol}</span>
        <span className="text-neutral-500">· {tf}</span>
        <span className="ml-3 text-neutral-500">Last update: {last}</span>
      </div>
      <div className="text-neutral-500">Local: {nowStr}</div>
    </div>
  );
}

function Timeframes({ value, onChange }) {
  const tfs = ["1m","5m","15m","30m","1h","2h","4h","8h","12h","1D","1W","1M"];
  return (
    <div className="flex gap-1 px-3 py-2 border-b border-neutral-200 bg-white">
      {tfs.map(tf => {
        const v = tf.toUpperCase();
        const active = v === value;
        return (
          <button
            key={tf}
            className={`px-2 py-1 rounded text-xs ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            onClick={() => onChange(v)}
          >
            {tf}
          </button>
        );
      })}
    </div>
  );
}

// ---- Simple, built-in watchlist poller (no external helper) ----
function MarketWatch({ symbols, onPick, periodMs = 1000 }) {
  const [quotes, setQuotes] = useState({});
  const idxRef = useRef(0); // poll one symbol per tick to keep it light

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();

    const tick = async () => {
      if (!alive || !symbols.length) return;
      const i = idxRef.current % symbols.length;
      idxRef.current += 1;
      const sym = symbols[i];

      try {
        const r = await fetch("/api/market", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
          body: JSON.stringify({ type: "tick", symbol: sym }),
          signal: ctrl.signal,
        });
        const data = await r.json().catch(() => null);
        if (!alive) return;
        const val = data?.last ?? data?.bid ?? null;
        if (val != null) {
          setQuotes(prev => (prev[sym] === val ? prev : { ...prev, [sym]: val }));
        }
      } catch (_) {
        /* ignore abort/network */
      }
    };

    const id = setInterval(tick, periodMs);
    // kick immediately so the list isn't blank
    tick();

    return () => {
      alive = false;
      try { ctrl.abort(); } catch {}
      clearInterval(id);
    };
  }, [symbols, periodMs]);

  return (
    <div className="w-64 border-l border-neutral-200 bg-white overflow-auto">
      <div className="px-3 py-2 text-xs text-neutral-500 border-b">WATCHLIST</div>
      {symbols.map(sym => {
        const v = quotes[sym];
        return (
          <button
            key={sym}
            onClick={() => onPick(sym)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <span className="font-medium">{sym}</span>
            <span className="tabular-nums text-neutral-600">{v != null ? v : "—"}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Page() {
  const { symbol: initSym, tf: initTf, bars } = useDefaults();
  const [symbol, setSymbol] = useState(initSym);
  const [tf, setTf] = useState(initTf);
  const [status, setStatus] = useState("idle");
  const [lastAt, setLastAt] = useState(null);

  const boxRef = useRef(null);
  const apiRef = useRef(null);

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
      try { apiRef.current?.chart.remove(); } catch {}
      apiRef.current = null;
    };
  }, []);

  // stream: bootstrap -> setData; then update tail
  useBarsStream({
    symbol, timeframe: tf, bars,
    onBootstrap: (arr) => {
      if (!apiRef.current) return;
      const clean = (arr || []).filter(b => b && b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0);
      apiRef.current.series.setData(mapBarsToSeries(clean));
      fitAll(apiRef.current.chart);
      setLastAt(Date.now());
    },
    onUpdate: (bar) => {
      if (!apiRef.current) return;
      apiRef.current.series.update({
        time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
      });
      scrollToNow(apiRef.current.chart);
      setLastAt(Date.now());
    },
    onStatus: setStatus,
  });

  // Build watchlist from your INSTRUMENTS export (capitalized keys)
  const pick = (list) =>
    (list || [])
      .map(x => (typeof x === "string" ? x : (x.symbol || x.name || "")))
      .filter(Boolean);

  const watchSymbols = useMemo(() => {
    const fx  = pick(INSTRUMENTS?.Forex).slice(0, 4);
    const idx = pick(INSTRUMENTS?.Indices).slice(0, 2);
    const cry = pick(INSTRUMENTS?.Crypto).slice(0, 4);
    return [...fx, ...idx, ...cry];
  }, []);

  return (
    <div className="h-screen w-screen grid grid-cols-[1fr_256px] grid-rows-[auto_auto_1fr] bg-neutral-50">
      <StatusBar symbol={symbol} tf={tf} status={status} lastAt={lastAt} />
      <Timeframes value={tf} onChange={setTf} />
      <div className="border-b border-neutral-200 bg-white" />
      <div className="col-start-1 row-start-3">
        <div ref={boxRef} className="w-full h-full" />
      </div>
      <div className="col-start-2 row-span-3">
        <MarketWatch symbols={watchSymbols} onPick={setSymbol} />
      </div>
    </div>
  );
}