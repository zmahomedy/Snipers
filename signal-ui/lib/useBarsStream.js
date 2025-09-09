// lib/useBarsStream.js
"use client";

import { useEffect, useRef } from "react";

export function useBarsStream({
  symbol,
  timeframe,
  bars = 300,
  onBootstrap,     // (bars[]) -> void
  onUpdate,        // (bar) -> void
  onStatus,        // "connecting" | "live" | "idle" | "error"
  idleMs = 20000,  // mark IDLE after this long with no *data* messages
}) {
  const esRef        = useRef(null);
  const reqIdRef     = useRef(0);

  // keep latest handlers in refs so effect deps don't cause resubscribe
  const hBootRef     = useRef(onBootstrap);
  const hUpdateRef   = useRef(onUpdate);
  const hStatusRef   = useRef(onStatus);
  useEffect(() => { hBootRef.current   = onBootstrap; }, [onBootstrap]);
  useEffect(() => { hUpdateRef.current = onUpdate;    }, [onUpdate]);
  useEffect(() => { hStatusRef.current = onStatus;    }, [onStatus]);

  const idleTimerRef = useRef(null);
  const clearIdle = () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  const armIdle = () => {
    clearIdle();
    if (idleMs > 0) idleTimerRef.current = setTimeout(() => {
      hStatusRef.current?.("idle");
    }, idleMs);
  };

  const liveOnceRef  = useRef(false); // mark "live" only once per connection
  const closedRef    = useRef(false);

  useEffect(() => {
    const req = ++reqIdRef.current;
    if (!symbol || !timeframe) return;

    liveOnceRef.current = false;
    closedRef.current   = false;
    hStatusRef.current?.("connecting");

    const url =
      `/api/market/stream?symbol=${encodeURIComponent(symbol)}` +
      `&timeframe=${encodeURIComponent(timeframe)}&bars=${bars}`;

    const es = new EventSource(url);
    esRef.current = es;

    // start idle timer immediately; any *data* message will reset it
    armIdle();

    es.onmessage = (ev) => {
      // any *data* message = activity; (SSE comments like ":hb" don't land here)
      armIdle();

      if (req !== reqIdRef.current) {
        try { es.close(); } catch {}
        return;
      }
      if (!ev.data) return;

      let msg = null;
      try { msg = JSON.parse(ev.data); } catch { return; }

      // IMPORTANT: only mark LIVE after real-time begins
      if ((msg.type === "bar-update" || msg.type === "bar-new") && msg.bar) {
        if (!liveOnceRef.current) {
          liveOnceRef.current = true;
          hStatusRef.current?.("live");
        }
        hUpdateRef.current?.(msg.bar);
        return;
      }

      // bootstrap does NOT imply live market
      if (msg.type === "bootstrap" && Array.isArray(msg.bars)) {
        hBootRef.current?.(msg.bars);
        return;
      }
    };

    es.onerror = () => {
      if (closedRef.current) return;
      hStatusRef.current?.("error");
      try { es.close(); } catch {}
    };

    return () => {
      if (req === reqIdRef.current) {
        closedRef.current = true;
        clearIdle();
        try { es.close(); } catch {}
        if (esRef.current === es) esRef.current = null;
      }
    };

    // DO NOT depend on handler props; we store them in refs above.
  }, [symbol, timeframe, bars, idleMs]);
}