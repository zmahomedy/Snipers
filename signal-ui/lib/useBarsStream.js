// lib/useBarsStream.js
"use client";

import { useEffect, useRef } from "react";

export function useBarsStream({ symbol, timeframe = "M1", bars = 10, onBootstrap, onUpdate, onStatus }) {
  const esRef = useRef(null);
  const reqIdRef = useRef(0);
  const pendingRef = useRef(null);
  const rafRef = useRef(0);

  const flush = () => {
    rafRef.current = 0;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    onUpdate?.(p);
  };

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    if (!symbol) return;

    const url = `/api/market/stream?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&bars=${encodeURIComponent(String(bars))}`;
    const es = new EventSource(url);
    esRef.current = es;
    onStatus?.("live");

    es.onmessage = (ev) => {
      if (reqId !== reqIdRef.current) return es.close();
      if (!ev.data) return; // comment heartbeat
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.type === "bootstrap" && Array.isArray(msg.bars)) {
        onBootstrap?.(msg.bars);
        return;
      }
      if ((msg.type === "bar-update" || msg.type === "bar-new") && msg.bar) {
        pendingRef.current = msg.bar;
        if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
      }
    };

    es.onerror = () => {
      onStatus?.("error");
      try { es.close(); } catch {}
    };

    return () => {
      reqIdRef.current++;
      try { es.close(); } catch {}
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      pendingRef.current = null;
      rafRef.current = 0;
    };
  }, [symbol, timeframe, bars, onBootstrap, onUpdate, onStatus]);
}