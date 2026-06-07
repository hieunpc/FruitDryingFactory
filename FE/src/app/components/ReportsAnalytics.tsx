import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  BarChart2, Activity, FileText, List,
  Thermometer, Droplets, Sun, Wind, Lightbulb,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  TrendingUp, TrendingDown, Minus,
  CalendarDays, Filter, Search, ChevronLeft, ChevronRight,
  RefreshCw, Download, Zap, Cpu, User,
  ChevronDown, Info,
} from "lucide-react";
import { monitoringAPI, structureAPI, catalogAPI } from "../config/api.config";
import { useIsAdmin } from "@/hooks/usePermission";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFromDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function round2(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toFixed(2);
}

function pct(a: number, b: number) {
  if (!b) return "0";
  return ((a / b) * 100).toFixed(1);
}

function normalizeRows(res: any): any[] {
  const arr = res?.data ?? res?.items ?? res?.rows ?? res;
  return Array.isArray(arr) ? arr : [];
}

// ─── Colour Palettes ──────────────────────────────────────────────────────────

const SENSOR_COLORS: Record<string, string> = {
  temperature: "#f97316",
  humidity: "#3b82f6",
  light: "#eab308",
};

const FRUIT_COLORS = ["#10b981", "#6366f1", "#f97316", "#ec4899", "#14b8a6", "#8b5cf6", "#f43f5e", "#0ea5e9"];

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  running: "#3b82f6",
  failed: "#ef4444",
  aborted: "#f97316",
  pending: "#94a3b8",
  paused: "#eab308",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, trend }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; trend?: "up" | "down" | "neutral";
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#94a3b8";
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
        style={{ background: color + "18", color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-[0.68rem] font-bold uppercase tracking-widest truncate">{label}</p>
        <p className="text-slate-800 font-extrabold text-2xl leading-tight">{value}</p>
        {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      </div>
      {trend && <TrendIcon size={18} style={{ color: trendColor, flexShrink: 0 }} />}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-slate-800 font-extrabold text-base">{title}</h2>
      {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-2">
      <Info size={28} className="opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// Donut Chart helper
function DonutChart({ data, colors, total }: {
  data: { name: string; value: number }[];
  colors: string[];
  total?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const sum = total ?? data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <PieChart width={140} height={140}>
          <Pie
            data={data}
            cx={65} cy={65}
            innerRadius={42} outerRadius={62}
            dataKey="value"
            paddingAngle={3}
            onMouseEnter={(_, idx) => setActive(idx)}
            onMouseLeave={() => setActive(null)}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
                opacity={active === null || active === i ? 1 : 0.45}
                stroke="none"
              />
            ))}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-slate-800 font-extrabold text-xl leading-none">{sum}</span>
          <span className="text-slate-400 text-[10px] font-semibold">total</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-slate-600 font-medium truncate max-w-[110px]">{d.name}</span>
            <span className="text-slate-400 ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState({ text = "Loading data..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-14 gap-2 text-slate-400">
      <Loader2 size={20} className="animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
      <AlertTriangle size={16} className="shrink-0" />
      <span>{text}</span>
    </div>
  );
}

// Custom tooltip for line/area charts
function SensorTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[160px]">
      <p className="text-slate-400 text-xs font-semibold mb-2">{label ?? payload[0]?.payload?.time}</p>
      {payload.map((e: any) => (
        <div key={e.name} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
            <span className="text-slate-600">{e.name}</span>
          </span>
          <span className="font-bold" style={{ color: e.color }}>{e.value != null ? Number(e.value).toFixed(1) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

// Statistics table row
function StatRow({ label, icon, color, stats }: {
  label: string; icon: React.ReactNode; color: string;
  stats: { avg: any; min: any; max: any; median: any; stddev: any; count: any };
}) {
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: color + "18", color }}>
            {icon}
          </span>
          <span className="text-slate-800 font-semibold text-sm">{label}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className="text-slate-700 font-bold text-sm">{round2(stats.avg)}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className="text-blue-600 font-semibold text-sm">{round2(stats.min)}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className="text-orange-500 font-semibold text-sm">{round2(stats.max)}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className="text-purple-600 font-semibold text-sm">{round2(stats.median)}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className="text-slate-500 text-sm">{round2(stats.stddev)}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className="text-slate-400 text-xs">{stats.count ?? "—"}</span>
      </td>
    </tr>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = "overview" | "sensor" | "batch" | "logs";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart2 size={15} /> },
  { id: "sensor", label: "Sensor Data", icon: <Activity size={15} /> },
  { id: "batch", label: "Batch Performance", icon: <FileText size={15} /> },
  { id: "logs", label: "Activity Logs", icon: <List size={15} /> },
];

// ─── Main component ────────────────────────────────────────────────────────────

const LOGS_PER_PAGE = 10;

export function ReportsAnalytics() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<TabId>("overview");
  const [dateRange, setDateRange] = useState("30d");
  const [dryerId, setDryerId] = useState<string>("all");

  // Dryers list
  const [dryers, setDryers] = useState<{ dry_id: number; dry_name: string }[]>([]);

  // Overview data
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [fruitUsage, setFruitUsage] = useState<any[]>([]);
  const [fruitLoading, setFruitLoading] = useState(false);

  // Sensor tab data
  const [sensorRaw, setSensorRaw] = useState<any[]>([]);
  const [sensorStats, setSensorStats] = useState<any[]>([]);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorRange, setSensorRange] = useState("24h");

  // Batch tab
  const [opsRows, setOpsRows] = useState<any[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [qualityRows, setQualityRows] = useState<any[]>([]);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [incidentRows, setIncidentRows] = useState<any[]>([]);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [perfRows, setPerfRows] = useState<any[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);

  // Logs tab
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [logStyle, setLogStyle] = useState("all");
  const [logPage, setLogPage] = useState(1);

  // Export states
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportReportType, setExportReportType] = useState<string>("overview");
  const [exportFormat, setExportFormat] = useState<"csv" | "txt">("csv");
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  // ── Date window helpers ────────────────────────────────────────────────────
  const days = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "60d" ? 60 : 30;
  const fromDate = useMemo(() => getFromDate(days), [days]);
  const toDate = useMemo(() => new Date().toISOString(), [days]);
  const dryerIdNum = useMemo(() => (dryerId !== "all" ? Number(dryerId) : undefined), [dryerId]);

  // ── Fetch dryers list ──────────────────────────────────────────────────────
  useEffect(() => {
    structureAPI.dryers.list()
      .then(res => setDryers(normalizeRows(res)))
      .catch(() => {});
  }, []);

  // ── Overview data fetch ────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const filters: any = { from: fromDate, to: toDate };
      if (dryerIdNum) filters.dry_id = dryerIdNum;
      const res = await monitoringAPI.dashboard.overview(filters);
      setOverview(res?.data ?? res ?? null);
    } catch { setOverview(null); }
    setOverviewLoading(false);
  }, [fromDate, toDate, dryerIdNum]);

  const fetchFruitUsage = useCallback(async () => {
    setFruitLoading(true);
    try {
      const res = await monitoringAPI.reports.fruitUsage({ from: fromDate, to: toDate });
      setFruitUsage(normalizeRows(res));
    } catch { setFruitUsage([]); }
    setFruitLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    if (tab === "overview") {
      fetchOverview();
      fetchFruitUsage();
    }
  }, [tab, fetchOverview, fetchFruitUsage]);

  // ── Sensor data fetch ──────────────────────────────────────────────────────
  const sensorHours = sensorRange === "6h" ? 6 : sensorRange === "12h" ? 12 : sensorRange === "7d" ? 168 : 24;

  const fetchSensorData = useCallback(async () => {
    setSensorLoading(true);
    try {
      const fromTs = new Date(Date.now() - sensorHours * 3600 * 1000).toISOString();
      const chartParams: any = { from: fromTs };
      if (dryerIdNum) chartParams.dry_id = dryerIdNum;
      const [rawRes, statsRes] = await Promise.all([
        monitoringAPI.charts.temperatureHumidity({ dryId: dryerIdNum, from: fromTs }),
        monitoringAPI.reports.sensorStats({ dry_id: dryerIdNum, from: fromTs }),
      ]);
      setSensorRaw(normalizeRows(rawRes));
      setSensorStats(normalizeRows(statsRes));
    } catch {
      setSensorRaw([]); setSensorStats([]);
    }
    setSensorLoading(false);
  }, [sensorHours, dryerIdNum]);

  useEffect(() => {
    if (tab === "sensor") fetchSensorData();
  }, [tab, fetchSensorData]);

  // ── Batch performance data ─────────────────────────────────────────────────
  const fetchBatchData = useCallback(async () => {
    const filters: any = { from: fromDate, to: toDate };
    if (dryerIdNum) filters.dry_id = dryerIdNum;

    setOpsLoading(true); setQualityLoading(true);
    setIncidentLoading(true); setPerfLoading(true);
    try {
      const [ops, quality, incidents, perf] = await Promise.all([
        monitoringAPI.reports.operations(filters),
        monitoringAPI.reports.quality(filters),
        monitoringAPI.reports.incidents(filters),
        isAdmin ? monitoringAPI.reports.performance() : Promise.resolve({ data: [] }),
      ]);
      setOpsRows(normalizeRows(ops));
      setQualityRows(normalizeRows(quality));
      setIncidentRows(normalizeRows(incidents));
      setPerfRows(normalizeRows(perf));
    } catch {}
    setOpsLoading(false); setQualityLoading(false);
    setIncidentLoading(false); setPerfLoading(false);
  }, [fromDate, toDate, dryerIdNum, isAdmin]);

  useEffect(() => {
    if (tab === "batch") fetchBatchData();
  }, [tab, fetchBatchData]);

  // ── Logs fetch ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true); setLogsError(null);
    try {
      const params: any = {};
      if (dryerIdNum) params.dry_id = dryerIdNum;
      const res = await monitoringAPI.logs.list(params);
      setLogs(normalizeRows(res));
    } catch (e: any) {
      setLogsError(e?.message ?? "Failed to load logs");
    }
    setLogsLoading(false);
  }, [dryerIdNum]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

  // ── Sensor chart transform ─────────────────────────────────────────────────
  const sensorChartData = useMemo(() => {
    // Group by timestamp bucket
    const byTime: Record<string, any> = {};
    sensorRaw.forEach((pt: any) => {
      const t = new Date(pt.created_at ?? pt.time ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (!byTime[t]) byTime[t] = { time: t };
      const type = pt.sensor_type ?? "";
      byTime[t][type] = Number(pt.value ?? 0);
    });
    return Object.values(byTime);
  }, [sensorRaw]);

  // ── Logs filter ────────────────────────────────────────────────────────────
  const logStyleOptions = useMemo(() => ["all", ...Array.from(new Set(logs.map((l: any) => l.log_style).filter(Boolean)))], [logs]);
  const filteredLogs = useMemo(() => logs.filter((l: any) => {
    const styleOk = logStyle === "all" || l.log_style === logStyle;
    const searchOk = !logSearch || [l.message, l.log_style, l.app_user_id].join(" ").toLowerCase().includes(logSearch.toLowerCase());
    return styleOk && searchOk;
  }), [logs, logStyle, logSearch]);
  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const pagedLogs = filteredLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

  // ── Overview derived stats ─────────────────────────────────────────────────
  const totalBatches = (overview?.running_batches ?? 0) + (overview?.completed_batches ?? 0) + (overview?.failed_batches ?? 0);
  const finishedBatches = (overview?.completed_batches ?? 0) + (overview?.failed_batches ?? 0);
  const successRate = finishedBatches > 0 ? pct(overview?.completed_batches ?? 0, finishedBatches) : "—";
  const statusDonutData = [
    { name: "Completed", value: overview?.completed_batches ?? 0 },
    { name: "Running", value: overview?.running_batches ?? 0 },
    { name: "Failed", value: overview?.failed_batches ?? 0 },
  ].filter(d => d.value > 0);
  const statusDonutColors = ["#10b981", "#3b82f6", "#ef4444"];

  const fruitDonutData = fruitUsage.filter(f => f.total_batches > 0).map(f => ({
    name: f.fruit_name ?? `Fruit #${f.fruit_id}`,
    value: Number(f.total_batches),
  }));

  // Sensor stat lookup helper
  const getStat = (type: string) => sensorStats.find(s => s.sensor_type === type) ?? null;

  // ── Client-side Report Generation ──────────────────────────────────────────
  const generateCSV = (type: string) => {
    let csv = "";
    const addRow = (row: string[]) => {
      csv += row.map(val => {
        const clean = String(val ?? "").replace(/"/g, '""');
        return clean.includes(",") || clean.includes("\n") || clean.includes('"') ? `"${clean}"` : clean;
      }).join(",") + "\r\n";
    };

    if (type === "overview") {
      addRow(["DRYER FACTORY OVERVIEW REPORT"]);
      addRow(["Generated At", new Date().toLocaleString()]);
      addRow(["Dryer Scope", dryerId === "all" ? "All Dryers" : `Dryer #${dryerId}`]);
      addRow(["Date Scope", `Last ${days} days (${fmtDate(fromDate)} to ${fmtDate(toDate)})`]);
      addRow([]);
      
      addRow(["KPI Summary"]);
      addRow(["Metric", "Value"]);
      addRow(["Total Batches", String(totalBatches)]);
      addRow(["Completed Batches", String(overview?.completed_batches ?? 0)]);
      addRow(["Failed Batches", String(overview?.failed_batches ?? 0)]);
      addRow(["Success Rate", `${successRate}%`]);
      addRow([]);

      addRow(["Fruit Usage Breakdown"]);
      addRow(["Fruit ID", "Fruit Name", "Total Batches", "Completed Batches", "Failed Batches", "Success Rate"]);
      fruitUsage.forEach(f => {
        const finished = (f.completed_batches ?? 0) + (f.failed_batches ?? 0);
        const rate = finished ? pct(f.completed_batches, finished) : "0";
        addRow([
          String(f.fruit_id ?? ""),
          f.fruit_name ?? `Fruit #${f.fruit_id}`,
          String(f.total_batches ?? 0),
          String(f.completed_batches ?? 0),
          String(f.failed_batches ?? 0),
          `${rate}%`
        ]);
      });
    }
    else if (type === "sensor") {
      addRow(["SENSOR TELEMETRY STATISTICS REPORT"]);
      addRow(["Generated At", new Date().toLocaleString()]);
      addRow(["Dryer Scope", dryerId === "all" ? "All Dryers" : `Dryer #${dryerId}`]);
      addRow(["Time Scope", `Last ${sensorRange}`]);
      addRow([]);

      addRow(["Sensor Summary Statistics"]);
      addRow(["Sensor Type", "Average", "Minimum", "Maximum", "Median", "Std Dev", "Reading Count"]);
      sensorStats.forEach(s => {
        addRow([
          s.sensor_type,
          String(s.avg_value ?? ""),
          String(s.min_value ?? ""),
          String(s.max_value ?? ""),
          String(s.median_value ?? ""),
          String(s.stddev_value ?? ""),
          String(s.reading_count ?? "")
        ]);
      });
      addRow([]);

      addRow(["Telemetry Data Points"]);
      addRow(["Timestamp", "Sensor Type", "Value"]);
      sensorRaw.forEach(r => {
        addRow([
          r.created_at ?? r.time ?? "",
          r.sensor_type ?? "",
          String(r.value ?? "")
        ]);
      });
    }
    else if (type === "batch") {
      addRow(["BATCH PERFORMANCE REPORT"]);
      addRow(["Generated At", new Date().toLocaleString()]);
      addRow(["Dryer Scope", dryerId === "all" ? "All Dryers" : `Dryer #${dryerId}`]);
      addRow(["Date Scope", `Last ${days} days (${fmtDate(fromDate)} to ${fmtDate(toDate)})`]);
      addRow([]);

      if (isAdmin) {
        addRow(["Dryer Durations"]);
        addRow(["Dryer ID", "Dryer Name", "Total Batches", "Completed Batches", "Average Duration"]);
        perfRows.forEach(p => {
          const dur = p.avg_duration_seconds
            ? `${Math.floor(p.avg_duration_seconds / 3600)}h ${Math.floor((p.avg_duration_seconds % 3600) / 60)}m`
            : "—";
          addRow([
            String(p.dry_id ?? ""),
            p.dry_name ?? "",
            String(p.total_batches ?? 0),
            String(p.completed_batches ?? 0),
            dur
          ]);
        });
        addRow([]);
      }

      addRow(["Daily Operations Log"]);
      addRow(["Date", "Total Batches", "Completed Batches", "Failed Batches", "Aborted Batches", "Success Rate"]);
      opsRows.forEach(o => {
        addRow([
          fmtDate(o.report_date),
          String(o.total_batches ?? 0),
          String(o.completed_batches ?? 0),
          String(o.failed_batches ?? 0),
          String(o.aborted_batches ?? 0),
          `${pct(o.completed_batches, o.total_batches)}%`
        ]);
      });
      addRow([]);

      addRow(["Batch Quality Summary"]);
      addRow(["Batch ID", "Dryer ID", "Avg Temp (°C)", "Avg Humidity (%)", "Avg Light (%)", "Manual Interventions"]);
      qualityRows.forEach(q => {
        addRow([
          String(q.batch_id ?? ""),
          String(q.dry_id ?? ""),
          q.avg_temperature != null ? Number(q.avg_temperature).toFixed(2) : "—",
          q.avg_humidity != null ? Number(q.avg_humidity).toFixed(2) : "—",
          q.avg_light != null ? Number(q.avg_light).toFixed(2) : "—",
          String(q.manual_actions ?? 0)
        ]);
      });
    }
    else if (type === "logs") {
      addRow(["ACTIVITY AUDIT LOG REPORT"]);
      addRow(["Generated At", new Date().toLocaleString()]);
      addRow(["Dryer Scope", dryerId === "all" ? "All Dryers" : `Dryer #${dryerId}`]);
      addRow([]);

      addRow(["Timestamp", "Log Style", "Batch ID", "Sensor ID", "Control ID", "User ID", "Message"]);
      filteredLogs.forEach(l => {
        addRow([
          l.created_at ?? "",
          l.log_style ?? "",
          l.batch_id ? String(l.batch_id) : "—",
          l.sensor_id ? String(l.sensor_id) : "—",
          l.control_id ? String(l.control_id) : "—",
          l.app_user_id ? String(l.app_user_id) : "—",
          l.message ?? ""
        ]);
      });
    }
    return csv;
  };

  const generateTXT = (type: string) => {
    let txt = "";
    const pad = (str: string, len: number) => {
      const s = String(str ?? "");
      return s.length >= len ? s.slice(0, len - 3) + "..." : s.padEnd(len);
    };
    const line = (char = "-", len = 80) => char.repeat(len) + "\n";

    txt += line("=");
    txt += `DRYER FACTORY REPORT: ${type.toUpperCase()}\n`;
    txt += `Generated At: ${new Date().toLocaleString()}\n`;
    txt += `Dryer Scope : ${dryerId === "all" ? "All Dryers" : `Dryer #${dryerId}`}\n`;
    txt += `Time Frame  : Last ${days} days (${fmtDate(fromDate)} to ${fmtDate(toDate)})\n`;
    txt += line("=");
    txt += "\n";

    if (type === "overview") {
      txt += "1. KEY PERFORMANCE INDICATORS (KPIs)\n";
      txt += line("-");
      txt += `Total Batches processed : ${totalBatches}\n`;
      txt += `Completed successfully  : ${overview?.completed_batches ?? 0}\n`;
      txt += `Failed / Aborted        : ${overview?.failed_batches ?? 0}\n`;
      txt += `Overall Success Rate    : ${successRate}%\n`;
      txt += "\n";

      txt += "2. FRUIT PROCESSING BREAKDOWN\n";
      txt += line("-");
      txt += `${pad("Fruit Name", 18)} | ${pad("Total", 8)} | ${pad("Success", 8)} | ${pad("Failed", 8)} | ${pad("Rate", 8)}\n`;
      txt += line("-");
      fruitUsage.forEach(f => {
        const finished = (f.completed_batches ?? 0) + (f.failed_batches ?? 0);
        const rate = finished ? pct(f.completed_batches, finished) : "0";
        txt += `${pad(f.fruit_name ?? `Fruit #${f.fruit_id}`, 18)} | ${pad(String(f.total_batches ?? 0), 8)} | ${pad(String(f.completed_batches ?? 0), 8)} | ${pad(String(f.failed_batches ?? 0), 8)} | ${pad(`${rate}%`, 8)}\n`;
      });
    }
    else if (type === "sensor") {
      txt += "1. SENSOR TELEMETRY STATISTICAL SUMMARY\n";
      txt += line("-");
      txt += `${pad("Sensor Type", 18)} | ${pad("Avg", 8)} | ${pad("Min", 8)} | ${pad("Max", 8)} | ${pad("Median", 8)} | ${pad("StdDev", 8)} | ${pad("Readings", 8)}\n`;
      txt += line("-");
      sensorStats.forEach(s => {
        txt += `${pad(s.sensor_type, 18)} | ${pad(String(s.avg_value ?? ""), 8)} | ${pad(String(s.min_value ?? ""), 8)} | ${pad(String(s.max_value ?? ""), 8)} | ${pad(String(s.median_value ?? ""), 8)} | ${pad(String(s.stddev_value ?? ""), 8)} | ${pad(String(s.reading_count ?? ""), 8)}\n`;
      });
      txt += "\n";

      txt += "2. SAMPLE TELEMETRY READINGS (Last 20)\n";
      txt += line("-");
      txt += `${pad("Timestamp", 25)} | ${pad("Sensor Type", 18)} | ${pad("Reading Value", 15)}\n`;
      txt += line("-");
      sensorRaw.slice(0, 20).forEach(r => {
        txt += `${pad(r.created_at ?? r.time ?? "", 25)} | ${pad(r.sensor_type ?? "", 18)} | ${pad(String(r.value ?? ""), 15)}\n`;
      });
      if (sensorRaw.length > 20) {
        txt += `... and ${sensorRaw.length - 20} more records truncated.\n`;
      }
    }
    else if (type === "batch") {
      if (isAdmin) {
        txt += "1. DRYER RUNTIME PERFORMANCE\n";
        txt += line("-");
        txt += `${pad("Dryer Name", 20)} | ${pad("Total", 8)} | ${pad("Success", 8)} | ${pad("Avg Duration", 15)}\n`;
        txt += line("-");
        perfRows.forEach(p => {
          const dur = p.avg_duration_seconds
            ? `${Math.floor(p.avg_duration_seconds / 3600)}h ${Math.floor((p.avg_duration_seconds % 3600) / 60)}m`
            : "—";
          txt += `${pad(p.dry_name ?? "", 20)} | ${pad(String(p.total_batches ?? 0), 8)} | ${pad(String(p.completed_batches ?? 0), 8)} | ${pad(dur, 15)}\n`;
        });
        txt += "\n";
      }

      txt += "2. DAILY OPERATIONS LOG\n";
      txt += line("-");
      txt += `${pad("Date", 15)} | ${pad("Total", 8)} | ${pad("Success", 8)} | ${pad("Failed", 8)} | ${pad("Aborted", 8)} | ${pad("Rate", 8)}\n`;
      txt += line("-");
      opsRows.forEach(o => {
        const finished = (o.completed_batches ?? 0) + (o.failed_batches ?? 0) + (o.aborted_batches ?? 0);
        const rate = finished ? pct(o.completed_batches, finished) : "0";
        txt += `${pad(fmtDate(o.report_date), 15)} | ${pad(String(o.total_batches ?? 0), 8)} | ${pad(String(o.completed_batches ?? 0), 8)} | ${pad(String(o.failed_batches ?? 0), 8)} | ${pad(String(o.aborted_batches ?? 0), 8)} | ${pad(`${rate}%`, 8)}\n`;
      });
      txt += "\n";

      txt += "3. BATCH QUALITY SUMMARY (Last 20)\n";
      txt += line("-");
      txt += `${pad("Batch ID", 10)} | ${pad("Dryer ID", 10)} | ${pad("Avg Temp (°C)", 15)} | ${pad("Avg Humid (%)", 15)} | ${pad("Avg Light (%)", 15)} | ${pad("Manual Act.", 12)}\n`;
      txt += line("-");
      qualityRows.slice(0, 20).forEach(q => {
        txt += `${pad(`#${q.batch_id}`, 10)} | ${pad(`D${q.dry_id}`, 10)} | ${pad(q.avg_temperature != null ? Number(q.avg_temperature).toFixed(2) : "—", 15)} | ${pad(q.avg_humidity != null ? Number(q.avg_humidity).toFixed(2) : "—", 15)} | ${pad(q.avg_light != null ? Number(q.avg_light).toFixed(2) : "—", 15)} | ${pad(String(q.manual_actions ?? 0), 12)}\n`;
      });
    }
    else if (type === "logs") {
      txt += "1. EVENT AND ACTIVITY LOGS\n";
      txt += line("-");
      txt += `${pad("Timestamp", 23)} | ${pad("Style", 15)} | ${pad("B.#", 6)} | ${pad("User", 8)} | Message\n`;
      txt += line("-");
      filteredLogs.forEach(l => {
        txt += `${pad(fmtDateTime(l.created_at), 23)} | ${pad(l.log_style ?? "", 15)} | ${pad(l.batch_id ? `#${l.batch_id}` : "—", 6)} | ${pad(l.app_user_id ? `#${l.app_user_id}` : "—", 8)} | ${l.message ?? ""}\n`;
      });
    }
    return txt;
  };

  const handleExport = async () => {
    setExporting(true);
    setExportStatus("Generating query filters...");
    try {
      const filters = {
        dry_id: dryerIdNum,
        from: fromDate,
        to: toDate,
        sensor_range: sensorRange,
        date_range: dateRange,
      };

      setExportStatus("Logging export activity with server...");
      const backendFormat = exportFormat === "csv" ? "xlsx" : "pdf";
      await monitoringAPI.reports.export({
        report_type: exportReportType,
        file_format: backendFormat,
        filters
      });

      setExportStatus("Assembling data tables...");
      await new Promise(resolve => setTimeout(resolve, 800));

      let content = "";
      let filename = `dryer_report_${exportReportType}_${new Date().toISOString().split('T')[0]}`;

      if (exportFormat === "csv") {
        filename += ".csv";
        content = generateCSV(exportReportType);
      } else {
        filename += ".txt";
        content = generateTXT(exportReportType);
      }

      setExportStatus("Downloading file...");
      const blob = new Blob([content], { type: exportFormat === "csv" ? "text/csv;charset=utf-8;" : "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus("Export completed successfully!");
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsExportOpen(false);
    } catch (err: any) {
      console.error(err);
      setExportStatus(`Export failed: ${err.message || "Server error"}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-slate-800 font-extrabold text-xl">Analytics & Reports</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Sensor trends, batch performance, fruit usage and operational insights
            </p>
          </div>

          {/* Global filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date range */}
            <div className="relative flex items-center">
              <CalendarDays size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
              <select
                value={dateRange} onChange={e => setDateRange(e.target.value)}
                className="pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300 text-sm font-medium appearance-none cursor-pointer"
              >
                <option value="7d">Last 7 Days</option>
                <option value="14d">Last 14 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="60d">Last 60 Days</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Dryer filter */}
            <div className="relative flex items-center">
              <Filter size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
              <select
                value={dryerId} onChange={e => setDryerId(e.target.value)}
                className="pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300 text-sm font-medium appearance-none cursor-pointer"
              >
                <option value="all">All Dryers</option>
                {dryers.map(d => <option key={d.dry_id} value={String(d.dry_id)}>{d.dry_name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Export Report button */}
            <button
              onClick={() => {
                setExportReportType(tab);
                setIsExportOpen(true);
                setExportStatus("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
            >
              <Download size={14} /> Export Report
            </button>
          </div>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit shadow-sm">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1 — OVERVIEW
           ════════════════════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div className="space-y-6">

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Total Batches"
                value={totalBatches}
                sub={`in last ${days} days`}
                icon={<BarChart2 size={22} />}
                color="#6366f1"
              />
              <KpiCard
                label="Completed"
                value={overview?.completed_batches ?? "—"}
                icon={<CheckCircle2 size={22} />}
                color="#10b981"
                trend="up"
              />
              <KpiCard
                label="Failed / Aborted"
                value={overview?.failed_batches ?? "—"}
                icon={<XCircle size={22} />}
                color="#ef4444"
                trend={overview?.failed_batches > 0 ? "down" : "neutral"}
              />
              <KpiCard
                label="Success Rate"
                value={`${successRate}%`}
                icon={<TrendingUp size={22} />}
                color="#0ea5e9"
              />
            </div>

            {/* Donuts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Batch status donut */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <SectionTitle title="Batch Status Breakdown" sub="Distribution of batch outcomes" />
                {overviewLoading ? <LoadingState /> :
                  statusDonutData.length === 0 ? <EmptyState text="No batch data for this period" /> :
                  <DonutChart data={statusDonutData} colors={statusDonutColors} total={totalBatches} />
                }
              </div>

              {/* Fruit usage donut */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <SectionTitle title="Fruit Usage" sub="Batches processed per fruit type" />
                {fruitLoading ? <LoadingState /> :
                  fruitDonutData.length === 0 ? <EmptyState text="No fruit data found" /> :
                  <DonutChart data={fruitDonutData} colors={FRUIT_COLORS} />
                }
              </div>
            </div>

            {/* Fruit usage bar table */}
            {fruitUsage.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <SectionTitle title="Fruit Usage Details" />
                  <span className="text-slate-400 text-xs">{fruitUsage.length} types</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {["Fruit", "Total Batches", "Completed", "Failed", "Success Rate"].map(col => (
                          <th key={col} className="text-left px-5 py-3 text-slate-500 text-[0.72rem] font-bold uppercase tracking-wide">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fruitUsage.map((f, i) => {
                        const finished = (f.completed_batches ?? 0) + (f.failed_batches ?? 0);
                        const rate = finished ? pct(f.completed_batches ?? 0, finished) : "0";
                        return (
                          <tr key={f.fruit_id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: FRUIT_COLORS[i % FRUIT_COLORS.length] }} />
                                <span className="text-slate-800 font-semibold text-sm">{f.fruit_name ?? `Fruit #${f.fruit_id}`}</span>
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-700 font-bold text-sm">{f.total_batches ?? 0}</td>
                            <td className="px-5 py-3.5"><span className="text-emerald-600 font-semibold text-sm">{f.completed_batches ?? 0}</span></td>
                            <td className="px-5 py-3.5"><span className="text-red-500 font-semibold text-sm">{f.failed_batches ?? 0}</span></td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                                  <div className="h-full rounded-full bg-emerald-500 transition-all"
                                    style={{ width: `${finished ? (f.completed_batches / finished) * 100 : 0}%` }} />
                                </div>
                                <span className="text-slate-700 text-xs font-semibold w-10 text-right">
                                  {rate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2 — SENSOR DATA
           ════════════════════════════════════════════════════════════════════ */}
        {tab === "sensor" && (
          <div className="space-y-6">
            {/* Sensor controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex items-center">
                <CalendarDays size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                <select
                  value={sensorRange} onChange={e => setSensorRange(e.target.value)}
                  className="pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300 text-sm font-medium appearance-none cursor-pointer"
                >
                  <option value="6h">Last 6 Hours</option>
                  <option value="12h">Last 12 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 text-slate-400 pointer-events-none" />
              </div>
              <button
                onClick={fetchSensorData}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-emerald-400 hover:text-emerald-700 text-sm font-medium transition-colors"
              >
                <RefreshCw size={13} /> Refresh
              </button>
              {dryerId === "all" && (
                <span className="text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Select a specific dryer for sensor data
                </span>
              )}
            </div>

            {sensorLoading ? <LoadingState /> : (
              <>
                {/* Statistics table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <SectionTitle title="Sensor Statistics" sub="Statistical summary over selected time range" />
                  </div>
                  {sensorStats.length === 0 ? (
                    <EmptyState text="No sensor readings found. Make sure a dryer is running with sensors configured." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            {["Sensor", "Avg", "Min", "Max", "Median", "Std Dev", "Readings"].map(c => (
                              <th key={c} className={`py-3 text-slate-500 text-[0.72rem] font-bold uppercase tracking-wide ${c === "Sensor" ? "text-left px-5" : "text-center px-4"}`}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {getStat("temperature") && (
                            <StatRow label="Temperature (°C)" icon={<Thermometer size={14} />} color="#f97316"
                              stats={getStat("temperature")!} />
                          )}
                          {getStat("humidity") && (
                            <StatRow label="Humidity (%)" icon={<Droplets size={14} />} color="#3b82f6"
                              stats={getStat("humidity")!} />
                          )}
                          {getStat("light") && (
                            <StatRow label="Light (%)" icon={<Sun size={14} />} color="#eab308"
                              stats={getStat("light")!} />
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3 individual charts + 1 combined */}
                {sensorChartData.length > 0 ? (
                  <>
                    {/* Individual charts */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {(["temperature", "humidity", "light"] as const).map(type => {
                        const color = SENSOR_COLORS[type];
                        const labelMap = { temperature: "Temperature (°C)", humidity: "Humidity (%)", light: "Light (%)" };
                        const iconMap = { temperature: <Thermometer size={15} />, humidity: <Droplets size={15} />, light: <Sun size={15} /> };
                        const vals = sensorChartData.map(d => d[type]).filter(v => v != null);
                        const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
                        return (
                          <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: color + "18", color }}>
                                {iconMap[type]}
                              </span>
                              <div>
                                <h3 className="text-slate-800 font-bold text-sm">{labelMap[type]}</h3>
                                <p className="text-slate-400 text-xs">Avg: <span className="font-semibold" style={{ color }}>{avg}</span></p>
                              </div>
                            </div>
                            <ResponsiveContainer width="100%" height={150}>
                              <AreaChart data={sensorChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                <defs>
                                  <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                                <Tooltip content={<SensorTooltip />} />
                                <Area type="monotone" dataKey={type} name={labelMap[type]} stroke={color} strokeWidth={2} fill={`url(#grad-${type})`} dot={false} activeDot={{ r: 4 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })}
                    </div>

                    {/* Combined chart */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <SectionTitle title="Combined Sensor Trends" sub="All sensors overlaid — temperature uses left axis, humidity and light use right" />
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={sensorChartData} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis yAxisId="temp" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}°`} />
                          <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                          <Tooltip content={<SensorTooltip />} />
                          <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: 8 }} formatter={v => <span style={{ color: "#64748b" }}>{v}</span>} />
                          <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#f97316" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                          <Line yAxisId="pct" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                          <Line yAxisId="pct" type="monotone" dataKey="light" name="Light (%)" stroke="#eab308" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <EmptyState text="No sensor readings found for this dryer/time range. Ensure a batch is running with sensor devices configured." />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3 — BATCH PERFORMANCE
           ════════════════════════════════════════════════════════════════════ */}
        {tab === "batch" && (
          <div className="space-y-6">

            {/* Per-dryer performance */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <SectionTitle title="Dryer Performance" sub="Total batches, success rate, and average duration per machine" />
                  {perfLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
                </div>
                {perfLoading ? <LoadingState /> : perfRows.length === 0 ? <EmptyState text="No performance data" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {["Dryer", "Total Batches", "Completed", "Success Rate", "Avg Duration"].map(c => (
                            <th key={c} className="text-left px-5 py-3 text-slate-500 text-[0.72rem] font-bold uppercase tracking-wide">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {perfRows.map((r, i) => {
                          const finished = (r.completed_batches ?? 0) + (r.failed_batches ?? 0);
                          const rate = finished ? pct(r.completed_batches, finished) : "—";
                          const dur = r.avg_duration_seconds
                            ? `${Math.floor(r.avg_duration_seconds / 3600)}h ${Math.floor((r.avg_duration_seconds % 3600) / 60)}m`
                            : "—";
                          return (
                            <tr key={r.dry_id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5">
                                <span className="flex items-center gap-2">
                                  <Cpu size={14} className="text-slate-400" />
                                  <span className="text-slate-800 font-semibold text-sm">{r.dry_name ?? `Dryer #${r.dry_id}`}</span>
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-700 font-bold text-sm">{r.total_batches ?? 0}</td>
                              <td className="px-5 py-3.5"><span className="text-emerald-600 font-semibold text-sm">{r.completed_batches ?? 0}</span></td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[50px]">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all"
                                      style={{ width: `${finished ? (r.completed_batches / finished) * 100 : 0}%` }} />
                                  </div>
                                  <span className="text-slate-700 text-xs font-semibold">{rate}%</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-slate-500 text-sm">{dur}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Operations by date + Incidents chart side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Operations chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <SectionTitle title="Daily Operations" sub="Batch outcomes by date" />
                {opsLoading ? <LoadingState /> : opsRows.length === 0 ? <EmptyState text="No operations data" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={opsRows.slice(0, 14).reverse()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="report_date" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                        tickFormatter={v => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} />
                      <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: "0.75rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}
                        labelFormatter={v => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      />
                      <Legend wrapperStyle={{ fontSize: "0.72rem", paddingTop: 6 }} />
                      <Bar dataKey="completed_batches" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="failed_batches" name="Failed" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="aborted_batches" name="Aborted" fill="#f97316" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Incidents chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <SectionTitle title="Daily Incidents" sub="Threshold triggers & device actions" />
                {incidentLoading ? <LoadingState /> : incidentRows.length === 0 ? <EmptyState text="No incident data" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={incidentRows.slice(0, 14).reverse()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="report_date" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                        tickFormatter={v => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} />
                      <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: "0.75rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}
                        labelFormatter={v => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
                      <Legend wrapperStyle={{ fontSize: "0.72rem", paddingTop: 6 }} />
                      <Bar dataKey="threshold_triggers" name="Threshold Triggers" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="device_actions" name="Device Actions" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Operations table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <SectionTitle title="Operations Log" sub="Daily batch outcome summary" />
                <span className="text-slate-400 text-xs">{opsRows.length} days</span>
              </div>
              {opsLoading ? <LoadingState /> : opsRows.length === 0 ? <EmptyState text="No operations data" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {["Date", "Total", "Completed", "Failed", "Aborted", "Success Rate"].map(c => (
                          <th key={c} className="text-left px-5 py-3 text-slate-500 text-[0.72rem] font-bold uppercase tracking-wide">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {opsRows.map((r, i) => {
                        const finished = (r.completed_batches ?? 0) + (r.failed_batches ?? 0) + (r.aborted_batches ?? 0);
                        const rate = finished ? pct(r.completed_batches, finished) : "0";
                        return (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5 text-slate-700 font-medium text-sm">{fmtDate(r.report_date)}</td>
                            <td className="px-5 py-3.5 text-slate-800 font-bold text-sm">{r.total_batches}</td>
                            <td className="px-5 py-3.5"><span className="text-emerald-600 font-semibold text-sm">{r.completed_batches}</span></td>
                            <td className="px-5 py-3.5"><span className="text-red-500 font-semibold text-sm">{r.failed_batches}</span></td>
                            <td className="px-5 py-3.5"><span className="text-orange-500 font-semibold text-sm">{r.aborted_batches}</span></td>
                            <td className="px-5 py-3.5">
                              <span className={`font-semibold text-sm ${
                                Number(rate) >= 80
                                  ? "text-emerald-600" : Number(rate) >= 50
                                    ? "text-amber-500" : "text-red-500"
                              }`}>
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quality table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <SectionTitle title="Batch Quality" sub="Avg sensor readings and manual interventions per batch" />
                <span className="text-slate-400 text-xs">{qualityRows.length} batches</span>
              </div>
              {qualityLoading ? <LoadingState /> : qualityRows.length === 0 ? <EmptyState text="No quality data" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {["Batch #", "Dryer", "Avg Temp (°C)", "Avg Humidity (%)", "Avg Light (%)", "Manual Actions"].map(c => (
                          <th key={c} className="text-left px-5 py-3 text-slate-500 text-[0.72rem] font-bold uppercase tracking-wide">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {qualityRows.slice(0, 20).map((r, i) => (
                        <tr key={r.batch_id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 text-slate-800 font-bold text-sm">#{r.batch_id}</td>
                          <td className="px-5 py-3.5 text-slate-600 text-sm">D{r.dry_id}</td>
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1 text-orange-600 font-semibold text-sm">
                              <Thermometer size={12} />
                              {r.avg_temperature != null ? Number(r.avg_temperature).toFixed(1) : "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1 text-blue-600 font-semibold text-sm">
                              <Droplets size={12} />
                              {r.avg_humidity != null ? Number(r.avg_humidity).toFixed(1) : "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1 text-yellow-600 font-semibold text-sm">
                              <Sun size={12} />
                              {r.avg_light != null ? Number(r.avg_light).toFixed(1) : "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {(r.manual_actions ?? 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                                <Zap size={10} />{r.manual_actions}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-sm">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {qualityRows.length > 20 && (
                    <p className="px-5 py-3 text-slate-400 text-xs border-t border-slate-50">Showing 20 of {qualityRows.length} batches</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4 — ACTIVITY LOGS
           ════════════════════════════════════════════════════════════════════ */}
        {tab === "logs" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-slate-800 font-extrabold text-base">Activity Logs</h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {logsLoading ? "Loading..." : `${filteredLogs.length} records found`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={logSearch}
                        onChange={e => { setLogSearch(e.target.value); setLogPage(1); }}
                        placeholder="Search logs..."
                        className="pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300 text-sm w-52"
                      />
                    </div>
                    <button
                      onClick={fetchLogs}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-emerald-400 hover:text-emerald-700 text-sm font-medium transition-colors"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                {/* Log style filter chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-400 text-xs font-bold uppercase mr-1">Style:</span>
                  {logStyleOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => { setLogStyle(s); setLogPage(1); }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${
                        logStyle === s ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50 border border-slate-200"
                      }`}
                    >
                      {s === "all" ? "All" : s.replace(/[_-]/g, " ")}
                    </button>
                  ))}
                </div>

                {logsError && <ErrorState text={logsError} />}
              </div>

              {/* Table */}
              {logsLoading ? <LoadingState /> : filteredLogs.length === 0 ? <EmptyState text="No log entries found." /> : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {["Date & Time", "Log Style", "Batch", "Sensor", "Control", "User", "Message"].map(c => (
                            <th key={c} className="text-left px-5 py-3 text-slate-500 text-[0.72rem] font-bold uppercase tracking-wide whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedLogs.map((log: any, idx) => (
                          <tr key={log.log_id ?? idx} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-slate-700 font-semibold text-xs">{fmtDateTime(log.created_at)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.68rem] font-bold border ${
                                log.log_style?.includes("batch") ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
                                log.log_style?.includes("sensor") ? "bg-amber-50 text-amber-700 border-amber-200" :
                                log.log_style?.includes("device") ? "bg-purple-50 text-purple-700 border-purple-200" :
                                log.log_style?.includes("audit") ? "bg-red-50 text-red-600 border-red-200" :
                                "bg-slate-50 text-slate-600 border-slate-200"
                              }`}>
                                {(log.log_style ?? "").replace(/[_-]/g, " ")}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-500 text-xs">{log.batch_id ? `#${log.batch_id}` : "—"}</td>
                            <td className="px-5 py-3 text-slate-500 text-xs">{log.sensor_id ? `S${log.sensor_id}` : "—"}</td>
                            <td className="px-5 py-3 text-slate-500 text-xs">{log.control_id ? `C${log.control_id}` : "—"}</td>
                            <td className="px-5 py-3">
                              {log.app_user_id ? (
                                <span className="flex items-center gap-1 text-slate-500 text-xs">
                                  <User size={11} />#{log.app_user_id}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-5 py-3 max-w-[280px]">
                              <span className="text-slate-600 text-xs truncate block" title={log.message}>{log.message ?? "—"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-slate-100">
                    <span className="text-slate-400 text-xs">
                      Page {logPage} of {totalLogPages} · {filteredLogs.length} records
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLogPage(p => Math.max(1, p - 1))}
                        disabled={logPage === 1}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {Array.from({ length: Math.min(5, totalLogPages) }, (_, i) => {
                        const p = Math.max(1, Math.min(totalLogPages - 4, logPage - 2)) + i;
                        return (
                          <button
                            key={p}
                            onClick={() => setLogPage(p)}
                            className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                              p === logPage ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                        disabled={logPage === totalLogPages}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Export Report Modal ────────────────────────────────────────── */}
        {isExportOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-slate-800 font-extrabold text-base">Export Analytics Report</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Extract current data for offline review</p>
                </div>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-4">
                {/* Report Type Selection */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Report Dataset</label>
                  <div className="relative flex items-center">
                    <select
                      value={exportReportType}
                      onChange={e => setExportReportType(e.target.value)}
                      disabled={exporting}
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300 text-sm font-medium appearance-none cursor-pointer disabled:opacity-60"
                    >
                      <option value="overview">Overview Statistics & Fruits</option>
                      <option value="sensor">Sensor Telemetry & Stats</option>
                      <option value="batch">Batch Performance Logs</option>
                      <option value="logs">Activity & Audit Logs</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Format Selection */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">File Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExportFormat("csv")}
                      disabled={exporting}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        exportFormat === "csv"
                          ? "border-emerald-500 bg-emerald-50/30 text-emerald-800 font-bold"
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <FileText size={18} className={exportFormat === "csv" ? "text-emerald-600" : "text-slate-400"} />
                      <span className="text-xs mt-1.5">CSV Spreadsheet</span>
                      <span className="text-[9px] text-slate-400 font-normal">Excel compatible</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat("txt")}
                      disabled={exporting}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        exportFormat === "txt"
                          ? "border-emerald-500 bg-emerald-50/30 text-emerald-800 font-bold"
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <Info size={18} className={exportFormat === "txt" ? "text-emerald-600" : "text-slate-400"} />
                      <span className="text-xs mt-1.5">Text Summary</span>
                      <span className="text-[9px] text-slate-400 font-normal">Formatted plain text</span>
                    </button>
                  </div>
                </div>

                {/* Filter Scope Note */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-700">Filter Scope:</div>
                  <div>• Dryer: <span className="font-medium text-slate-600">{dryerId === "all" ? "All Dryers" : `Dryer #${dryerId}`}</span></div>
                  <div>• Timeframe: <span className="font-medium text-slate-600">{exportReportType === "sensor" ? `Last ${sensorRange}` : `Last ${days} days`}</span></div>
                </div>

                {/* Dynamic Status message */}
                {exportStatus && (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
                    {exporting && <Loader2 size={13} className="animate-spin text-emerald-600 shrink-0" />}
                    <span>{exportStatus}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExportOpen(false)}
                  disabled={exporting}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {exporting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Download Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
