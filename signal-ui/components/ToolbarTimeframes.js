"use client";
import { TIMEFRAMES } from "@/utils/config";
import { useStore } from "@/lib/store";

export default function ToolbarTimeframes() {
  const { timeframe, setTimeframe } = useStore();
  return (
    <div className="px-2 py-2 border-b bg-white flex items-center gap-2 overflow-x-auto no-scrollbar">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => setTimeframe(tf)}
          className={`px-2 py-1 rounded text-xs md:text-sm whitespace-nowrap ${
            timeframe === tf ? "bg-gray-900 text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}