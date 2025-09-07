// app/api/market/symbols/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const BRIDGE = process.env.MT5_BRIDGE_URL || "http://127.0.0.1:5001";
const TOKEN  = process.env.MT5_BRIDGE_TOKEN || "";

export async function GET() {
  try {
    const r = await fetch(`${BRIDGE}/symbols`, {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "X-Bridge-Token": TOKEN,
      },
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: r.ok ? 200 : r.status || 502,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e) }, { status: 502 });
  }
}