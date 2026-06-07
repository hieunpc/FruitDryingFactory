import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { monitoringAPI, structureAPI } from "../config/api.config";


interface EventLogItem {
  created_at: string;
  log_style: string;
  message: string;
  app_user_id?: number;
}

export function EventLogs() {
 const [reportRows, setReportRows] = useState<EventLogItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const itemsPerPage = 10;
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);

  const visibleRows = reportRows.slice(0, visibleCount);
  const hasMoreRows = visibleCount < reportRows.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + itemsPerPage, reportRows.length));
  };

  useEffect(() => {
      setLoadingReports(false);
      setReportsError(null);

    const fetchDailyReport = async () => {
      try {
        setLoadingReports(true);
        setReportsError(null);
        const userData = localStorage.getItem("userData");
        const appUserId = userData ? JSON.parse(userData).app_user_id : undefined;
        const dryerResponse = await structureAPI.dryers.list();
        const dryerList = dryerResponse?.data ?? dryerResponse ?? [];
        const dryerId = Array.isArray(dryerList) && dryerList.length > 0 ? dryerList[0].dry_id : null;

        if (!dryerId) {
          setReportRows([]);
          return;
        }

        const response = await monitoringAPI.logs.list({app_user_id: appUserId });
        const filteredLogs = response?.data?.filter((log: EventLogItem) => log.app_user_id === appUserId) ?? [];
        const list = Array.isArray(filteredLogs) ? filteredLogs : [];
        setReportRows(list);
        setVisibleCount(itemsPerPage);
      } catch (err) {
        console.error("Error fetching daily reports:", err);
        setReportsError(err instanceof Error ? err.message : "Failed to load daily reports");
        setReportRows([]);
        setVisibleCount(itemsPerPage);
      } finally {
        setLoadingReports(false);
      }
    };

    fetchDailyReport();
  }, []);
return (
  <div className="flex-1 overflow-y-auto p-3">
           {loadingReports && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span>Đang tải báo cáo...</span>
              </div>
            )}

            {!loadingReports && reportsError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {reportsError}
              </div>
            )}

            {!loadingReports && !reportsError && reportRows.length === 0 && (
              <div className="text-sm text-slate-500">Không có dữ liệu báo cáo.</div>
            )}

            {!loadingReports && !reportsError && reportRows.length > 0 && (
              <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Style</th>
              <th className="py-2 pr-4">Message</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.created_at} className="border-b border-slate-100 last:border-none text-slate-700">
                <td className="py-2 pr-4">
                  {new Date(row.created_at).toLocaleDateString("vi-VN")}
                </td>
                <td className="py-2 pr-4 font-semibold">{row.log_style}</td>
                <td className="py-2 pr-4">{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>   
            )}
      {!loadingReports && !reportsError && hasMoreRows && (
        <div className="flex items-center justify-center mt-4">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
          >
            Tải thêm
          </button>
        </div>
      )}
      </div>
  );
}