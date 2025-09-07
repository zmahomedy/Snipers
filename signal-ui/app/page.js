"use client";

import { useState } from "react";
import InfoBar from "@/components/InfoBar";
import ToolbarTimeframes from "@/components/ToolbarTimeframes";
import TradingChart from "@/components/TradingChart";
import MarketSidebar from "@/components/MarketSidebar";

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="h-screen flex flex-col">
      {/* Top bar: compact & includes a burger on small screens */}
      <InfoBar onToggleSidebar={() => setSidebarOpen((s) => !s)} />

      {/* Timeframes: sticky & scrollable */}
      <div className="sticky top-0 z-10 bg-white">
        <ToolbarTimeframes />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chart takes all space */}
        <div className="flex-1 min-w-0">
          <TradingChart />
        </div>

        {/* Sidebar: visible on md+, otherwise off-canvas */}
        <MarketSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
    </main>
  );
}