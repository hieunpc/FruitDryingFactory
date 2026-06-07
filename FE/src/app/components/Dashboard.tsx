import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { monitoringAPI, structureAPI } from "../config/api.config";
import { StatsCards } from "./StatsCards";
import { EventLogs } from "./EventLogs";

export function Dashboard() {
 
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
      <div className="max-w-screen-xl mx-auto space-y-4">
        {/* Row 1: KPI Cards */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Factory Overview</h2>
          <StatsCards />
        </section> 
          <section className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Operations Report Overview</h2>
              <EventLogs />
          </section>
 
      </div>
    </div>
  );
}
