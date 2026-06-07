import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CalendarDays, TrendingUp, Loader, AlertTriangle } from "lucide-react";
import { monitoringAPI } from "../config/api.config";

interface TrendChartProps {
  dryId?: number; // Machine/Dryer ID for sensor data
  machineLabel?: string; // Display label for the machine
  onDataLoaded?: (data: any[]) => void; // Callback to pass chart data back
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // `label` is the numeric idx; resolve to time from the first payload entry
    const timeLabel = payload[0]?.payload?.time ?? label;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[140px]">
        <p className="text-slate-500 mb-1.5" style={{ fontSize: "0.72rem", fontWeight: 600 }}>
          {timeLabel}
        </p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: entry.color, display: "inline-block" }}
              />
              <span className="text-slate-600" style={{ fontSize: "0.75rem" }}>
                {entry.name}
              </span>
            </div>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: entry.color }}>
              {entry.value}
              {entry.name === "Temperature" ? "°C" : entry.name === "Humidity" ? "%" : entry.name === "Light" ? " %" : ""}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function TrendChart({ dryId, machineLabel, onDataLoaded }: TrendChartProps) {
  const [range, setRange] = useState("24h");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sensor data from dryer endpoint
  useEffect(() => {
    if (!dryId) {
      setError("Machine ID is required to display sensor data");
      setData([]);
      return;
    }

    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch temperature and humidity data from dashboard charts API with dry_id
        const response = await monitoringAPI.charts.temperatureHumidity({ dryId });
        const chartData = response?.data ?? response ?? [];

        // Transform API data to chart format
        if (Array.isArray(chartData)) {
          const byTime: Record<string, any> = {};
          chartData.forEach((pt: any) => {
            const timeStr = pt.created_at ?? pt.time ?? "";
            const t = timeStr ? new Date(timeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
            if (!t) return;
            if (!byTime[t]) {
              byTime[t] = { time: t, temperature: 0, humidity: 0, light: 0 };
            }
            const type = pt.sensor_type ?? "";
            if (type === "temperature" || type === "humidity" || type === "light") {
              byTime[t][type] = Number(pt.value ?? 0);
            }
          });
          const transformedData = Object.values(byTime).map((point: any, idx: number) => ({
            idx,
            time: point.time,
            temperature: point.temperature ?? 0,
            humidity: point.humidity ?? 0,
            light: point.light ?? 0,
          }));
          setData(transformedData);
          onDataLoaded?.(transformedData);
        } else {
          setError("Invalid chart data format");
          setData([]);
        }
      } catch (err) {
        console.error("Error fetching chart data:", err);
        setError(err instanceof Error ? err.message : "Failed to load chart data");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [dryId, range]);

  // Show every Nth label to avoid crowding
  const tickInterval = range === "6h" ? 0 : range === "12h" ? 1 : 3;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-slate-800" style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
            Environmental Trends
          </h2>
          <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>
            {machineLabel ? `${machineLabel} — Sensor tracking` : "Temperature, humidity & light monitoring"}
          </p>
        </div>
        {/* Date Range Dropdown */}
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-slate-400" />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-emerald-400 focus:border-emerald-400 transition-colors"
            style={{ fontSize: "0.8rem", fontWeight: 500 }}
          >
            <option value="6h">Last 6 Hours</option>
            <option value="12h">Last 12 Hours</option>
            <option value="24h">Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle size={16} className="text-red-500" />
          <span className="text-red-700" style={{ fontSize: "0.8rem" }}>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-[220px]">
          <Loader size={24} className="text-emerald-500 animate-spin" />
        </div>
      )}

      {/* Summary pills */}
      {!loading && data.length > 0 && (
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-100">
          <TrendingUp size={12} className="text-orange-500" />
          <span className="text-orange-700" style={{ fontSize: "0.72rem", fontWeight: 600 }}>
            Avg Temp: {(data.reduce((s, d) => s + d.temperature, 0) / data.length).toFixed(1)}°C
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
          <TrendingUp size={12} className="text-blue-500" />
          <span className="text-blue-700" style={{ fontSize: "0.72rem", fontWeight: 600 }}>
            Avg Humidity: {(data.reduce((s, d) => s + d.humidity, 0) / data.length).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-lg border border-yellow-100">
          <TrendingUp size={12} className="text-yellow-500" />
          <span className="text-yellow-700" style={{ fontSize: "0.72rem", fontWeight: 600 }}>
            Avg Light: {(data.reduce((s, d) => s + d.light, 0) / data.length).toFixed(0)} %
          </span>
        </div>
      </div>
      )}

      {/* Chart */}
      {!loading && data.length > 0 && (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            key="x-axis"
            dataKey="idx"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
            tickFormatter={(idx) => data[idx]?.time ?? ""}
          />
          <YAxis
            key="y-axis-temp"
            yAxisId="temp"
            domain={[40, 90]}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}°`}
          />
          <YAxis
            key="y-axis-humid"
            yAxisId="humid"
            orientation="right"
            domain={[20, 80]}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            key="y-axis-light"
            yAxisId="light"
            orientation="right"
            domain={[0, 200]}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}L`}
            dx={10}
          />
          <Tooltip key="tooltip" content={<CustomTooltip />} />
          <Legend
            key="legend"
            wrapperStyle={{ fontSize: "0.75rem", paddingTop: "8px" }}
            formatter={(value) => (
              <span style={{ color: "#64748b", fontWeight: 500 }}>{value}</span>
            )}
          />
          <ReferenceLine
            key="ref-line-temp"
            yAxisId="temp"
            y={75}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: "⚠ 75°C", position: "right", fontSize: 10, fill: "#ef4444" }}
          />
          <Line
            key="line-temperature"
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            name="Temperature"
            stroke="#f97316"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: "#f97316" }}
          />
          <Line
            key="line-humidity"
            yAxisId="humid"
            type="monotone"
            dataKey="humidity"
            name="Humidity"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            strokeDasharray="0"
            activeDot={{ r: 5, fill: "#3b82f6" }}
          />
          <Line
            key="line-light"
            yAxisId="light"
            type="monotone"
            dataKey="light"
            name="Light"
            stroke="#eab308"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: "#eab308" }}
          />
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}