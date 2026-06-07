import { useState, useEffect } from "react";
import { Server, Activity, AlertTriangle, TrendingUp, CheckCircle, Clock, Zap, Loader2 } from "lucide-react";
import { apiRequest, MONITORING_ENDPOINTS } from "../config/api.config";

interface StatCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: string;
  trendUp?: boolean;
  accent?: string;
}

interface DashboardOverviewData {
  running_dryers: number;
  idle_dryers: number;
  maintenance_dryers: number;
  running_batches: number | null;
  completed_batches: number | null;
  failed_batches: number | null;
  threshold_alert_rate: number;
}

export function StatsCards() {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const response = await apiRequest('GET', MONITORING_ENDPOINTS.dashboard.overview);
        setData(response.data);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-32"></div>
                <div className="h-8 bg-slate-200 rounded w-16"></div>
                <div className="h-3 bg-slate-100 rounded w-24"></div>
              </div>
              <div className="w-11 h-11 bg-slate-200 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Calculate total dryers
  const totalDryers = (data?.running_dryers || 0) + (data?.idle_dryers || 0) + (data?.maintenance_dryers || 0);
  
  // Build stats from API data
  const stats: StatCard[] = [
    {
      title: "Machines Running",
      value: data?.running_dryers || 0,
      subtitle: `Out of ${totalDryers} total`,
      icon: <Activity size={22} />,
      iconBg: "bg-emerald-100 text-emerald-600",
      trend: `${data?.maintenance_dryers || 0} maintenance, ${data?.idle_dryers || 0} idle`,
      trendUp: (data?.running_dryers || 0) > 0,
      accent: "border-l-emerald-500",
    },
    {
      title: "Active Batches",
      value: data?.running_batches ?? "—",
      subtitle: "Running now",
      icon: <Zap size={22} />,
      iconBg: "bg-blue-100 text-blue-600",
      trend: data?.running_batches ? "Processing" : "No active batches",
      trendUp: (data?.running_batches || 0) > 0,
      accent: "border-l-blue-500",
    },
    {
      title: "Completed Batches",
      value: data?.completed_batches ?? "—",
      subtitle: "This period",
      icon: <CheckCircle size={22} />,
      iconBg: "bg-cyan-100 text-cyan-600",
      trend: "Successfully completed",
      trendUp: true,
      accent: "border-l-cyan-500",
    },
    {
      title: "Failed Batches",
      value: data?.failed_batches ?? "—",
      subtitle: "This period",
      icon: <Clock size={22} />,
      iconBg: "bg-orange-100 text-orange-600",
      trend: data?.failed_batches ? "Review required" : "No failures",
      trendUp: !(data?.failed_batches),
      accent: "border-l-orange-500",
    },
    {
      title: "Threshold Alert Rate",
      value: `${(data?.threshold_alert_rate || 0).toFixed(1)}%`,
      subtitle: "System alerts",
      icon: <AlertTriangle size={22} />,
      iconBg: "bg-red-100 text-red-600",
      trend: data?.threshold_alert_rate ? "Alerts detected" : "No alerts",
      trendUp: !(data?.threshold_alert_rate),
      accent: "border-l-red-500",
    },
    {
      title: "Maintenance Dryers",
      value: data?.maintenance_dryers || 0,
      subtitle: "In maintenance",
      icon: <Server size={22} />,
      iconBg: "bg-purple-100 text-purple-600",
      trend: totalDryers > 0 ? "Operational" : "Idle",
      trendUp: totalDryers > 0,
      accent: "border-l-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className={`bg-white rounded-xl border border-slate-200 border-l-4 ${stat.accent} p-5 shadow-sm hover:shadow-md transition-shadow`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 mb-1" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                {stat.title}
              </p>
              <p
                className={`${stat.title === "Threshold Alert Rate" && data?.threshold_alert_rate ? "text-red-600" : "text-slate-800"}`}
                style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1.1 }}
              >
                {stat.value}
              </p>
              <p className="text-slate-400 mt-1" style={{ fontSize: "0.75rem" }}>
                {stat.subtitle}
              </p>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.iconBg}`}>
              {stat.icon}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <TrendingUp
              size={13}
              className={stat.trendUp ? "text-emerald-500" : "text-red-500"}
            />
            <span
              className={stat.trendUp ? "text-emerald-600" : "text-red-500"}
              style={{ fontSize: "0.75rem", fontWeight: 500 }}
            >
              {stat.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
