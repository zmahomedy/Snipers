// app/api/market/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE = process.env.MT5_BRIDGE_URL || "http://127.0.0.1:5001";
const TOKEN  = process.env.MT5_BRIDGE_TOKEN || "";

export async function POST(req) {
  let payload = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid json" }), { status: 400 });
  }

  const { type } = payload || {};
  if (!type) {
    return new Response(JSON.stringify({ ok: false, error: "type is required" }), { status: 400 });
  }

  const headers = {
    "Content-Type": "application/json",
    ...(TOKEN ? { "X-Bridge-Token": TOKEN } : {}),
  };

  try {
    if (type === "historical") {
      const { symbol, timeframe = "M1", count = 1000 } = payload;
      const qp = new URLSearchParams({ symbol, timeframe: timeframe.toUpperCase(), count: String(count) });
      const r = await fetch(`${BRIDGE}/history?${qp.toString()}`, { headers, cache: "no-store" });
      const body = await r.json();
      return new Response(JSON.stringify({ ok: r.ok, ...body }), { status: r.ok ? 200 : r.status });
    }

    if (type === "tick") {
      const { symbol } = payload;
      const qp = new URLSearchParams({ symbol });
      const r = await fetch(`${BRIDGE}/tick?${qp.toString()}`, { headers, cache: "no-store" });
      const body = await r.json();
      return new Response(JSON.stringify({ ok: r.ok, ...body }), { status: r.ok ? 200 : r.status });
    }

    return new Response(JSON.stringify({ ok: false, error: `unknown type ${type}` }), { status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 502 });
  }
}