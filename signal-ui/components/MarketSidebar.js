"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { INSTRUMENTS } from "@/utils/instruments";
import { useStore } from "@/lib/store";
import { createQuoteLoop } from "@/lib/quotes";

function flatSymbols() {
  return Object.values(INSTRUMENTS).flat().map(it => ({ ...it }));
}

export default function MarketSidebar({ open, onClose }) {
  const { selectedSymbol, setSelectedSymbol } = useStore();

  const [q, setQ] = useState("");
  const [quotes, setQuotes] = useState({});     // { [symbol]: { last, prev, bid, ask, time, flash } }
  const quotesRef = useRef({});

  // build list once; auto-select first if none
  const all = useMemo(() => flatSymbols(), []);
  useEffect(() => {
    if (!selectedSymbol && all[0]) setSelectedSymbol(all[0].symbol);
  }, [all, selectedSymbol, setSelectedSymbol]);

  const filteredGroups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const entries = Object.entries(INSTRUMENTS).map(([group, items]) => [
      group,
      term
        ? items.filter(
            (it) =>
              it.symbol.toLowerCase().includes(term) ||
              (it.label || "").toLowerCase().includes(term)
          )
        : items,
    ]);
    return entries.filter(([, items]) => items.length);
  }, [q]);

  // start the quote loop over the CURRENT filtered symbols
  useEffect(() => {
    const syms = filteredGroups.flatMap(([, items]) => items.map(i => i.symbol));
    const loop = createQuoteLoop({
      symbols: syms,
      intervalMs: 1000,
      onUpdate: (sym, tick) => {
        const prevLast = quotesRef.current[sym]?.last ?? null;
        const flash = prevLast != null
          ? (tick.last > prevLast ? "up" : tick.last < prevLast ? "down" : null)
          : null;

        const next = { ...tick, prev: prevLast, flash };
        // IMPORTANT: create a new object so React re-renders
        quotesRef.current = { ...quotesRef.current, [sym]: next };
        setQuotes(quotesRef.current);

        // dev debug (remove later)
        if (sym === "EURUSD") {
          // eslint-disable-next-line no-console
          console.log("EURUSD tick", next);
        }
      },
    });
    loop.start();
    return () => loop.stop();
  }, [filteredGroups]);

  // helpers
  const fmt = (v, digits) =>
    v != null && isFinite(v) && v > 0 ? Number(v).toFixed(digits ?? 2) : null;

  // LOOKUP IS INTERNAL HERE (no prop mismatch)
  const PriceCell = ({ it }) => {
    const qd = quotes[it.symbol];
    if (!qd) return <span className="text-gray-400">—</span>;

    const last = qd.last ?? qd.bid ?? qd.ask ?? null;
    if (!(last > 0)) return <span className="text-gray-400">—</span>;

    const prev = qd.prev ?? null;
    const cls =
      prev != null && last > prev ? "text-emerald-600" :
      prev != null && last < prev ? "text-rose-600"    :
      "text-gray-700";
    const flash =
      prev != null && last > prev ? "flash-up" :
      prev != null && last < prev ? "flash-down" : "";

    const pct = prev != null && prev > 0 ? ((last - prev) / prev) * 100 : null;

    return (
      <span className={`tabular-nums px-1 rounded ${flash} ${cls}`}>
        {fmt(last, it.digits) ?? "—"}{" "}
        <span className="text-[10px]">
          {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : ""}
        </span>
      </span>
    );
  };

  const width = 264;
  const onPick = (sym) => { if (sym !== selectedSymbol) setSelectedSymbol(sym); onClose?.(); };

  return (
    <>
      {/* overlay (mobile) */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity md:hidden ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <aside
        className={`fixed md:static top-0 right-0 h-full md:h-[calc(100vh-96px)] bg-white border-l transform transition-transform md:translate-x-0 md:shadow-none shadow-lg ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width }}
      >
        {/* header (mobile) */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-medium">Market Watch</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* search */}
        <div className="p-2 border-b">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol or name…"
            className="w-full text-sm px-2 py-1 border rounded outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>

        {/* list */}
        <div className="h-[calc(100%-80px)] md:h-full overflow-auto">
          {filteredGroups.map(([group, items]) => (
            <div key={group} className="p-3 border-b">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{group}</div>
              <ul className="space-y-1">
                {items.map((it) => {
                  const active = selectedSymbol === it.symbol;
                  return (
                    <li key={it.symbol}>
                      <button
                        onClick={() => onPick(it.symbol)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-sm hover:bg-gray-100 ${active ? "bg-gray-200" : ""}`}
                        title={it.label || it.symbol}
                      >
                        <span className="truncate">{it.label || it.symbol}</span>
                        <PriceCell it={it} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!filteredGroups.length && <div className="p-3 text-sm text-gray-500">No matches.</div>}
        </div>
      </aside>
    </>
  );
}