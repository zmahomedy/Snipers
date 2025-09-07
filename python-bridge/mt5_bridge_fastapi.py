# mt5_bridge_fastapi.py
# FastAPI + Uvicorn bridge for MetaTrader 5 (Windows Python inside CrossOver)
# Endpoints: /health, /history, /tick, /stream-bars (SSE), /stream-ticks (SSE test), /sse-test (dummy SSE)

import time, json, asyncio
from typing import AsyncGenerator, Optional
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import MetaTrader5 as mt5

# ========= INLINE CONFIG (edit here) =========
TERMINAL_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"
ACCOUNT  = 1021189
PASSWORD = "S7hG?Va=4I"
SERVER   = "PXBTTrading-1"

# Protect all endpoints; match this in your Next.js proxy header X-Bridge-Token
AUTH_TOKEN = "supersecret123"

# Bind with uvicorn: --host 127.0.0.1 --port 5001
# =============================================

# Timeframe mapping and bucket seconds for SSE aggregation
TF_SECONDS = {
    "M1":60, "M5":300, "M15":900, "M30":1800,
    "H1":3600, "H4":14400, "D1":86400, "W1":604800, "MN1":2592000  # MN1 approximate
}

def tf_map():
    return {
        "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1, "W1": mt5.TIMEFRAME_W1, "MN1": mt5.TIMEFRAME_MN1,
    }

TF_MAP = None

app = FastAPI(title="MT5 Bridge", version="1.0.0")

# CORS: keep tight (we expect to run on localhost behind Next.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Auth ----------
def require_auth(req: Request):
    # Accept "Authorization: Bearer <token>" OR "X-Bridge-Token: <token>"
    if not AUTH_TOKEN:
        return
    auth = (req.headers.get("authorization") or "").strip()
    if auth.startswith("Bearer ") and auth[7:].strip() == AUTH_TOKEN:
        return
    if (req.headers.get("x-bridge-token") or "").strip() == AUTH_TOKEN:
        return
    raise HTTPException(status_code=401, detail="unauthorized")

# ---------- MT5 init/login ----------
def ensure_mt5():
    """Initialize MT5 and explicitly login. Logs loudly on errors."""
    global TF_MAP
    ti = mt5.terminal_info()
    ver = mt5.version()
    if not ti or not ver:
        print("[MT5] initialize()…")
        ok = mt5.initialize(path=TERMINAL_PATH) if TERMINAL_PATH else mt5.initialize()
        if not ok:
            err = mt5.last_error()
            print(f"[MT5] init failed: {err}")
            raise HTTPException(500, f"init failed: {err}")
        ti = mt5.terminal_info()
        ver = mt5.version()
        print(f"[MT5] initialized: connected={getattr(ti, 'connected', None)} version={ver}")

    ai = mt5.account_info()
    if (ai is None) or (int(ai.login) != int(ACCOUNT)):
        print(f"[MT5] login({ACCOUNT}, ****, {SERVER})…")
        if not mt5.login(int(ACCOUNT), PASSWORD, SERVER):
            err = mt5.last_error()
            print(f"[MT5] login failed: {err}")
            raise HTTPException(500, f"login failed: {err}")
        ai = mt5.account_info()
        print(f"[MT5] login OK: {ai.login} / {ai.server}")

    if TF_MAP is None:
        TF_MAP = tf_map()

def bars_json(r):
    return {
        "time": int(r["time"]),
        "open": float(r["open"]),
        "high": float(r["high"]),
        "low":  float(r["low"]),
        "close":float(r["close"]),
        "volume": int(r["tick_volume"]),
    }

# =========================================================
# >>> ADDED: SSE helper + defensive exception handling <<<
# =========================================================
async def sse_json(gen: AsyncGenerator[dict, None]):
    """
    Wrap an async generator yielding dicts into SSE 'data: ...\\n\\n' chunks.
    Send {} to emit a heartbeat (':hb').
    """
    try:
        async for item in gen:
            if item:
                yield f"data: {json.dumps(item, separators=(',',':'))}\n\n"
            else:
                yield ":hb\n\n"
    except asyncio.CancelledError:
        # client disconnected; normal
        pass
    except Exception as e:
        # last-ditch: surface error to client before closing
        try:
            yield f"data: {json.dumps({'type':'error','message':str(e)})}\n\n"
        except Exception:
            pass

# ---------- Routes ----------
@app.get("/health")
async def health():
    try:
        ensure_mt5()
        ti = mt5.terminal_info()
        return {"ok": True, "connected": bool(ti and ti.connected)}
    except Exception as e:
        print("[/health] ERROR:", e)
        return JSONResponse({"ok": False, "err": str(e)}, status_code=500, headers={"Cache-Control":"no-store"})

@app.get("/history")
async def history(
    symbol: str,
    timeframe: str,
    count: int = 1000,
    request: Request = None,
    _auth: None = Depends(require_auth)
):
    ensure_mt5()
    timeframe = timeframe.upper()
    if timeframe not in TF_MAP:
        raise HTTPException(400, f"unsupported timeframe {timeframe}")
    count = max(1, min(5000, int(count)))

    print(f"[/history] {symbol} {timeframe} count={count}")
    mt5.symbol_select(symbol, True)
    rates = mt5.copy_rates_from_pos(symbol, TF_MAP[timeframe], 0, count)
    if rates is None:
        err = mt5.last_error()
        print("[/history] copy_rates failed:", err)
        raise HTTPException(500, f"copy_rates failed: {err}")

    bars = [bars_json(r) for r in rates]
    return JSONResponse(
        {"symbol": symbol, "timeframe": timeframe, "bars": bars},
        headers={"Cache-Control":"no-store"}
    )

@app.get("/symbols")
async def symbols(
    request: Request,
    _auth: None = Depends(require_auth)
):
    ensure_mt5()
    symbols = mt5.symbols_get()
    if symbols is None:
        err = mt5.last_error()
        print("[/symbols] symbols_get failed:", err)
        raise HTTPException(500, f"symbols_get failed: {err}")
    out = []
    for s in symbols:
        out.append({
            "name": s.name,
            "path": s.path,        # e.g. Forex\Majors\XAUUSD
            "description": s.description,
            "visible": s.visible,  # in Market Watch
            "select": s.select,    # is selected
            "trade_mode": s.trade_mode,
            "digits": s.digits,
        })
    return {"symbols": out}

@app.get("/tick")
async def tick(
    symbol: str,
    request: Request = None,
    _auth: None = Depends(require_auth)
):
    ensure_mt5()
    mt5.symbol_select(symbol, True)
    t = mt5.symbol_info_tick(symbol)

    last = float(getattr(t, "last", 0.0)) if t else 0.0
    bid  = float(getattr(t, "bid",  0.0)) if t else 0.0
    ask  = float(getattr(t, "ask",  0.0)) if t else 0.0
    tv   = int(getattr(t, "volume", 0))   if t else 0
    ts   = int(getattr(t, "time",   0))   if t else 0

    best = last if last > 0 else (bid if bid > 0 else 0.0)

    if best <= 0.0:
        mt5.symbol_select(symbol, True)
        bars = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 1)
        if bars is not None and len(bars) >= 1:
            close = float(bars[0]["close"])
            if close > 0.0:
                best = close
                if ts <= 0:
                    ts = int(bars[0]["time"])

    if best <= 0.0:
        raise HTTPException(404, f"no tick for {symbol}")

    return JSONResponse(
        {
            "time": ts,
            "bid": bid if bid > 0 else None,
            "ask": ask if ask > 0 else None,
            "last": best,
            "volume": tv,
        },
        headers={"Cache-Control": "no-store"}
    )

# ---------------------------------------
# >>> ADDED: simple dummy SSE for testing
# ---------------------------------------
@app.get("/sse-test")
async def sse_test(_auth: None = Depends(require_auth)):
    async def gen():
        i = 0
        while i < 5:
            i += 1
            yield {"type": "ping", "i": i, "t": int(time.time())}
            await asyncio.sleep(1.0)
        # then idle heartbeats for a bit
        for _ in range(5):
            yield {}
            await asyncio.sleep(1.0)
    return StreamingResponse(
        sse_json(gen()),
        media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","Connection":"keep-alive","X-Accel-Buffering":"no"},
    )

# --------------------------------------------
# >>> ADDED: tick-level SSE (sanity diagnostic)
# --------------------------------------------
@app.get("/stream-ticks")
async def stream_ticks(symbol: str, request: Request, _auth: None = Depends(require_auth)):
    ensure_mt5()
    mt5.symbol_select(symbol, True)

    async def gen():
        last_t = 0
        hb_at = time.time() + 10
        idle = 0.05
        while True:
            if await request.is_disconnected():
                print("[/stream-ticks] client disconnected")
                break

            t = mt5.symbol_info_tick(symbol)
            if t:
                ts = int(getattr(t, "time", 0))
                if ts and ts != last_t:
                    last_t = ts
                    yield {
                        "type":"tick",
                        "time": ts,
                        "bid": float(getattr(t, "bid", 0) or 0),
                        "ask": float(getattr(t, "ask", 0) or 0),
                        "last": float(getattr(t, "last", 0) or 0),
                        "volume": int(getattr(t, "volume", 0) or 0),
                    }
                    idle = 0.05
                else:
                    idle = min(idle + 0.02, 0.3)

            if time.time() >= hb_at:
                yield {}
                hb_at = time.time() + 10

            await asyncio.sleep(idle)

    return StreamingResponse(
        sse_json(gen()),
        media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","Connection":"keep-alive","X-Accel-Buffering":"no"},
    )

# BEFORE
# @app.get("/stream-bars")
# async def stream_bars(symbol: str, timeframe: str, request: Request, _auth: None = Depends(require_auth)):

# AFTER — add bars:int with a default
@app.get("/stream-bars")
async def stream_bars(
    symbol: str,
    timeframe: str,
    request: Request,
    bars: int = 300,                     # <-- NEW: how many history bars to bootstrap with
    _auth: None = Depends(require_auth),
):
    ensure_mt5()
    timeframe = timeframe.upper()
    if timeframe not in TF_MAP:
        raise HTTPException(400, f"unsupported timeframe {timeframe}")

    # sanitize bars count
    try:
        bootstrap_n = max(1, min(2000, int(bars)))   # cap for safety
    except Exception:
        bootstrap_n = 300

    bucket = TF_SECONDS.get(timeframe, 60)
    mt5.symbol_select(symbol, True)

    async def generator():
        # --- Bootstrap: use requested number of bars instead of hardcoded 300
        hist = mt5.copy_rates_from_pos(symbol, TF_MAP[timeframe], 0, bootstrap_n)
        bars_list = [bars_json(r) for r in hist] if hist is not None else []
        seq = 0
        yield {
            "type": "bootstrap",
            "symbol": symbol,
            "timeframe": timeframe,
            "bars": bars_list,
            "bootstrap": bootstrap_n,     # <-- helpful for debugging
            "_seq": seq
        }

        current_bar = bars_list[-1] if bars_list else None
        current_bucket = (current_bar["time"] // bucket) if current_bar else None
        last_tick = 0
        idle = 0.05
        hb_at = time.time() + 10

        while True:
            if await request.is_disconnected():
                break

            t = mt5.symbol_info_tick(symbol)
            if t and int(t.time) != last_tick:
                last_tick = int(t.time)
                price = float(getattr(t, "last", 0) or getattr(t, "bid", 0) or 0)
                bidx = last_tick // bucket

                if (current_bucket is None) or (bidx != current_bucket):
                    current_bucket = bidx
                    current_bar = {
                        "time": bidx * bucket,
                        "open": price, "high": price, "low": price, "close": price,
                        "volume": int(getattr(t, "volume", 0) or 0),
                    }
                    seq += 1
                    yield {"type": "bar-new", "bar": current_bar, "_seq": seq}
                    idle = 0.05
                else:
                    if price > current_bar["high"]: current_bar["high"] = price
                    if price < current_bar["low"]:  current_bar["low"]  = price
                    current_bar["close"] = price
                    current_bar["volume"] += int(getattr(t, "volume", 0) or 0)
                    seq += 1
                    yield {"type": "bar-update", "bar": current_bar, "_seq": seq}
                    idle = 0.05
            else:
                idle = min(idle + 0.02, 0.3)

            if time.time() >= hb_at:
                yield {}  # heartbeat
                hb_at = time.time() + 10

            await asyncio.sleep(idle)

    return StreamingResponse(
        sse_json(generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

# ---------- Lifespan / shutdown ----------
@app.on_event("shutdown")
def on_shutdown():
    # Ensure MT5 closes cleanly
    try:
        print("[MT5] shutdown()")
        mt5.shutdown()
    except Exception as e:
        print("[MT5] shutdown error:", e)