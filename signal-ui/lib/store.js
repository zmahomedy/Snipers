"use client";
import { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [timeframe, setTimeframe] = useState("1h"); // UI label
  const [lastOHLC, setLastOHLC] = useState(null);

  const value = useMemo(() => ({
    selectedSymbol, setSelectedSymbol,
    timeframe, setTimeframe,
    lastOHLC, setLastOHLC,
  }), [selectedSymbol, timeframe, lastOHLC]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}