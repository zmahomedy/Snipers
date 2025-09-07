"use client";
import { useStore } from "@/lib/store";

export default function InfoBar({ onToggleSidebar }) {
  const { selectedSymbol, timeframe, lastOHLC, connection } = useStore();
  const state = connection?.state || "idle";

  const pillColor = {
    live:  "bg-emerald-500",
    idle:  "bg-gray-400",
    error: "bg-rose-500",
  }[state];

  const label = state === "live" ? "Live" : state === "error" ? "Error" : "Idle";

  return (
    <div className="w-full border-b bg-white/95 backdrop-blur px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* mobile toggle */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden -ml-1 inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100"
          aria-label="Toggle market watch"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="text-base md:text-lg font-semibold truncate max-w-[40vw] md:max-w-none">
          {selectedSymbol ?? "Select a symbol"}
        </div>
        <div className="text-xs md:text-sm text-gray-500">{timeframe?.toUpperCase?.()}</div>

        {lastOHLC && (
          <div className="hidden md:flex text-sm text-gray-700 gap-3">
            <span>O: {lastOHLC.o}</span>
            <span>H: {lastOHLC.h}</span>
            <span>L: {lastOHLC.l}</span>
            <span>C: {lastOHLC.c}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${pillColor}`} />
          <span className="text-gray-600">{label}</span>
        </div>
        <div className="text-[10px] md:text-xs text-gray-400">Hist + Live</div>
      </div>
    </div>
  );
}