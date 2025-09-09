// lib/store.js
import { create } from "zustand";

export const useStore = create((set) => ({
  // selection
  selectedSymbol: "EURUSD",
  timeframe: "H1",

  // last candle OHLC shown in InfoBar
  lastOHLC: null,

  // live stream connection status (Step 1)
  // state: "connecting" | "live" | "idle" | "error"
  connection: { state: "idle", lastMessageAt: null, lastError: null, seq: null },

  // setters
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setTimeframe: (tf) => set({ timeframe: tf }),
  setLastOHLC: (ohlc) => set({ lastOHLC: ohlc }),

  // Step 1: update stream connection snapshot
  setConnection: (update) =>
    set((s) => ({ connection: { ...s.connection, ...update } })),
}));