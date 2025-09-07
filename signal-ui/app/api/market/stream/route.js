// app/api/market/stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE = process.env.MT5_BRIDGE_URL || "http://127.0.0.1:5001";
const TOKEN  = process.env.MT5_BRIDGE_TOKEN || "";

// Map UI TF → bridge TF (case-sensitive where it matters)
// Minutes: use lowercase (1m, 5m, 15m, 30m)
// Hours/Days/Weeks/Months: uppercase (1H, 4H, 1D, 1W, 1M)
function normalizeTF(tfRaw) {
  const s = String(tfRaw || "").trim();
  const t = s.toUpperCase();

  // minutes (prefer lowercase in URLs; handle common variants)
  if (s === "1m")  return "M1";
  if (s === "5m")  return "M5";
  if (s === "15m") return "M15";
  if (s === "30m") return "M30";

  // hours (bridge only has H1, H4 – map others to nearest)
  if (t === "1H")  return "H1";
  if (t === "2H")  return "H1";
  if (t === "4H")  return "H4";
  if (t === "8H")  return "H4";
  if (t === "12H") return "H4";

  // days / weeks / months
  if (t === "1D" || t === "D1")  return "D1";
  if (t === "1W" || t === "W1")  return "W1";
  if (t === "1M" || t === "MN1" || t === "1MON") return "MN1"; // month

  // already bridge-style?
  if (["M1","M5","M15","M30","H1","H4","D1","W1","MN1"].includes(t)) return t;

  return "H1";
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const tfUI   = searchParams.get("timeframe") || "H1";
  const bars   = Math.max(1, Math.min(5000, Number(searchParams.get("bars") || "300")));

  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol is required" }), { status: 400 });
  }

  const tf = normalizeTF(tfUI);

  // Bridge streams SSE at /stream-bars; it ignores bars (bootstraps ~300),
  // but we pass it now for future compatibility.
  const upstream =
    `${BRIDGE}/stream-bars?symbol=${encodeURIComponent(symbol)}` +
    `&timeframe=${encodeURIComponent(tf)}&bars=${bars}`;

  const resp = await fetch(upstream, {
    headers: TOKEN ? { "X-Bridge-Token": TOKEN } : {},
  });

  if (!resp.ok || !resp.body) {
    const body = await resp.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "bridge_error", status: resp.status, body: body.slice(0, 1000) }),
      { status: 502 }
    );
  }

  // Pipe SSE through
  return new Response(resp.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}