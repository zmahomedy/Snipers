// lib/sse.js
export function openBarsStream(symbol, timeframe) {
  // timeframe here is the MT5/bridge code (e.g., "H1", "M5", ...), not UI label
  const url = `/api/market?kind=bars&symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;
  return new EventSource(url, { withCredentials: false });
}