// components/InfoBar.js
"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";

export default function InfoBar() {
  const { selectedSymbol, timeframe, lastOHLC, connection } = useStore();

  const pill = useMemo(() => {
    const s = connection?.state || "idle";
    const map = {
      connecting: { cls: "bg-neutral-400", label: "Connecting" },
      live:       { cls: "bg-emerald-500", label: "Live" },
      idle:       { cls: "bg-amber-500", label: "Idle" },
      error:      { cls: "bg-red-500", label: "Error" },
    };
    return map[s] || map.idle;
  }, [connection?.state]);

  const staleFor = useMemo(() => {
    const ts = connection?.lastMessageAt;
    if (!ts) return null;
    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    return sec;
  }, [connection?.lastMessageAt]);

  const fmt = (v, d = 2) =>
    v == null ? "—" : Number(v).toFixed(d);

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b bg-white text-sm">
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white ${pill.cls}`}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/90" />
          {pill.label}
        </span>
        {connection?.state === "idle" && staleFor != null ? (
          <span className="text-xs text-neutral-500">stale {staleFor}s</span>
        ) : null}
        {connection?.state === "error" && connection?.lastError ? (
          <span className="text-xs text-red-600">({connection.lastError})</span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <span className="font-medium">{selectedSymbol}</span>
        <span className="text-neutral-500">{timeframe}</span>
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          <span>O {fmt(lastOHLC?.o, 5)}</span>
          <span>H {fmt(lastOHLC?.h, 5)}</span>
          <span>L {fmt(lastOHLC?.l, 5)}</span>
          <span>C {fmt(lastOHLC?.c, 5)}</span>
        </div>
      </div>
    </div>
  );
}