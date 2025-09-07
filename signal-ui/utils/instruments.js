// utils/instruments.js
export const INSTRUMENTS = {
  Forex: [
    { label: "EUR/USD", symbol: "EURUSD", digits: 5 },
    { label: "GBP/USD", symbol: "GBPUSD", digits: 5 },
    { label: "USD/JPY", symbol: "USDJPY", digits: 3 },
    { label: "USD/CHF", symbol: "USDCHF", digits: 5 },
    { label: "AUD/USD", symbol: "AUDUSD", digits: 5 },
    { label: "USD/CAD", symbol: "USDCAD", digits: 5 },
    { label: "XAU/USD", symbol: "XAUUSD", digits: 2 },
  ],
  Indices: [
    { label: "US500", symbol: "US500", digits: 1 },
    { label: "NAS100", symbol: "NAS100", digits: 1 },
  ],
  Crypto: [
    { label: "BTC/USD", symbol: "BTCUSDT", digits: 2 },
    { label: "ETH/USD", symbol: "ETHUSDT", digits: 2 },
  ],
};

// flat list if you need it elsewhere
export const WATCHLIST = Object.values(INSTRUMENTS).flat().map(x => x.symbol);