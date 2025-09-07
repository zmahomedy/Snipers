// lib/quotes.js
export function createQuoteLoop({ symbols, intervalMs = 1000, onUpdate }) {
  let i = 0, timer = null, ctrl = null, stopped = true;

  async function cycle() {
    if (stopped || !symbols?.length) return;
    const sym = symbols[i % symbols.length]; i++;

    try {
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();

      const r = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify({ type: "tick", symbol: sym }),
        signal: ctrl.signal,
      });
      if (!r.ok) return;

      const d = await r.json().catch(() => ({}));
      const last = Number.isFinite(d.last) && d.last > 0 ? d.last : null;
      const bid  = Number.isFinite(d.bid)  && d.bid  > 0 ? d.bid  : null;
      const ask  = Number.isFinite(d.ask)  && d.ask  > 0 ? d.ask  : null;
      const time = Number.isFinite(d.time) && d.time > 0 ? d.time : null;

      const best = last ?? bid ?? ask ?? null;
      if (!time || !best) return;

      onUpdate?.(sym, { last: best, bid, ask, time });
    } catch {}
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    cycle();
    timer = setInterval(cycle, Math.max(300, intervalMs));
  }
  function stop() {
    stopped = true;
    if (timer) clearInterval(timer), (timer = null);
    if (ctrl) try { ctrl.abort(); } catch {}
    ctrl = null;
  }

  return { start, stop, setSymbols(next){ symbols = Array.isArray(next) ? next : []; i = 0; } };
}