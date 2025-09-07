// test-ticks.js
// quick tester: calls your Next.js /api/market route with type:"tick"

import fetch from "node-fetch";   // install if needed: npm i node-fetch

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"];

async function main() {
  for (const sym of SYMBOLS) {
    try {
      const r = await fetch("http://localhost:3000/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tick", symbol: sym }),
      });
      const d = await r.json();
      console.log(sym, d);
    } catch (e) {
      console.error(sym, "ERR", e.message);
    }
  }
}

main();