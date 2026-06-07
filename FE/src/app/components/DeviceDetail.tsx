import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { structureAPI, batchAPI, catalogAPI, monitoringAPI, FACTORY_ENDPOINTS, BATCH_ENDPOINTS, apiRequest } from "../config/api.config";
import { 
  ArrowLeft, Thermometer, Droplets, Wind, Lightbulb, Play, Pause, Square, Loader, AlertTriangle,
  Clock, Calendar, Zap, Trash2, Save, CheckCircle2, Loader2, Plus, Sun, Cpu, Timer, ChevronDown, X,
  ArrowRight, FileText, Bell, XCircle
} from "lucide-react";
import { DryerDetail } from "../types/dryer";

type BatchStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "aborted"
  | string;


interface ScheduledInfo {
  current_phase: number | null;
  elapsed_seconds: number;
  total_duration_seconds: number;
  current_phase_remaining_seconds: number;
  total_remaining_seconds: number;
}
interface BatchItem {
  batch_id: number;
  dry_id: number;
  fruit_id?: number;
  recipe_id?: number;
  status: BatchStatus;
  operation_mode?: "manual" | "scheduled" | string;
  threshold_enabled?: boolean;
  is_customize?: boolean;
  created_at?: string;
  fruit_name?: string;
  recipe_name?: string;
  scheduled_info : ScheduledInfo;
}

interface ScheduledPhaseInfo {
  batch_id?: number;
  status?: string;
  operation_mode?: string;
  elapsed_seconds?: number;
  total_duration_seconds?: number;
  current_phase?: any;
  current_phase_order?: number | null;
  current_phase_remaining_seconds?: number;
  total_remaining_seconds?: number;
}

interface RecipeSummary {
  recipe_id: number;
  recipe_name?: string;
  fruit_id?: number;
  fruit_name?: string;
  is_active?: boolean;
}

interface RecipeDetailItem extends RecipeSummary {
  recipe_type?: string;
  description?: string;
  phases?: any[];
  policies?: any[];
}

interface FruitItem {
  fruit_id?: number;
  fruit_name?: string;
  id?: number;
  name?: string;
}

const pickActiveBatch = (list: BatchItem[]) =>
  list.find((b) => b.status === "running") ||
  list.find((b) => b.status === "paused") ||
  list.find((b) => b.status === "scheduled" || b.status === "pending") ||
  null;

const batchStatusBadge = (status: BatchStatus) => {
  switch (status) {
    case "running":
      return "bg-emerald-100 text-emerald-700";
    case "scheduled":
    case "pending":
      return "bg-blue-100 text-blue-700";
    case "paused":
      return "bg-yellow-100 text-yellow-700";
    case "completed":
      return "bg-slate-100 text-slate-600";
    case "cancelled":
    case "aborted":
    case "error":
      return "bg-red-100 text-red-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export function DeviceDetail() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract ID from URL path: /devices/D1 -> D1, then parse to number
  const idFromPath = location.pathname.split("/").pop() || null;
  const dryerId = idFromPath ? Number(idFromPath.toString().replace(/^[^0-9]*/, "")) || null : null;


  // Dryer detail state
  const [dryerData, setDryerData] = useState<DryerDetail | null>(null);
  const [loadingDryer, setLoadingDryer] = useState(true);
  const [dryerError, setDryerError] = useState<string | null>(null);

  // Batches state
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [batchActionId, setBatchActionId] = useState<number | null>(null);
  const [controlActionId, setControlActionId] = useState<number | null>(null);
  const [creatingControlType, setCreatingControlType] = useState<"fan" | "lamp" | null>(null);
  const [fruitNameById, setFruitNameById] = useState<Record<number, string>>({});
  const [fruitRecipes, setFruitRecipes] = useState<RecipeSummary[]>([]);
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetailItem | null>(null);
  const [loadingRecipeInfo, setLoadingRecipeInfo] = useState(false);
  const [recipeInfoError, setRecipeInfoError] = useState<string | null>(null);

  // Manual parameter overrides (kept in localStorage, keyed by dry_id)
  const [tempTarget, setTempTarget] = useState(0);
  const [humTarget, setHumTarget] = useState(0);

  // Active detail tab
  const [activeDetailTab, setActiveDetailTab] = useState<"batch" | "threshold" | "logs">("batch");


  // Threshold editing state
  const [thresholdValues, setThresholdValues] = useState<Record<number, number | string>>({});
  const [savingThresholdId, setSavingThresholdId] = useState<number | null>(null);

  const [thresholdConditions, setThresholdConditions] = useState<Record<number, string>>({});
  const [scheduledPhaseInfo, setScheduledPhaseInfo] = useState<ScheduledPhaseInfo | null>(null);
  const [thresholdOperators, setThresholdOperators] = useState<Record<number, string>>({});
  const [lastLoadedBatchId, setLastLoadedBatchId] = useState<number | null>(null);
  const [draftActions, setDraftActions] = useState<Record<string, 'activate' | 'deactivate' | 'none'>>({});

  // Dryers list state for dropdown filter
  const [dryersList, setDryersList] = useState<any[]>([]);
  const [loadingDryersList, setLoadingDryersList] = useState(false);
  const [thresholdEnabled, setThresholdEnabled] = useState<Record<number, boolean>>({});
  const [showDeleteControlModal, setShowDeleteControlModal] = useState(false);
  const [selectedDeleteControlId, setSelectedDeleteControlId] = useState<number | null>(null);
  const [deletingControl, setDeletingControl] = useState(false);

  // Choose the most relevant active batch (running > paused > scheduled/pending)
  const activeBatch = pickActiveBatch(batches);
  // Enriched batch detail fetched from GET /batches/{batchId}
  const [activeBatchDetail, setActiveBatchDetail] = useState<any | null>(null);
  const [loadingBatchDetail, setLoadingBatchDetail] = useState(false);
  const [batchDetailError, setBatchDetailError] = useState<string | null>(null);
  const currentBatch = activeBatchDetail ?? activeBatch;
  // Countdown (seconds) until a scheduled/pending batch auto-starts
  const [secondsUntilStart, setSecondsUntilStart] = useState<number | null>(null);

  // States for batch activity logs and trigger alerts
  const [batchLogs, setBatchLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [triggerAlert, setTriggerAlert] = useState<{ message: string; details?: string; timestamp: Date; sensorType?: string } | null>(null);
  const [batchEndAlert, setBatchEndAlert] = useState<{ batchId: number; status: string; message: string; timestamp: Date } | null>(null);

  // Refs to track seen triggers and initial state
  const lastSeenTriggerIdRef = useRef<number | null>(null);
  const isInitialLogsLoadRef = useRef<boolean>(true);
  const prevBatchStatusesRef = useRef<Record<number, string>>({});

  // ---- Fetchers -------------------------------------------------------------
  const fetchDryer = useCallback(async (silent = false) => {
    if (!dryerId) return;
    try {
      if (!silent) setLoadingDryer(true);
      setDryerError(null);
      const response = await structureAPI.dryers.get(dryerId);
      setDryerData(response?.data ?? response ?? null);
    } catch (err) {
      if (!silent) {
        setDryerError(err instanceof Error ? err.message : "Failed to fetch dryer data");
        setDryerData(null);
      }
    } finally {
      if (!silent) setLoadingDryer(false);
    }
  }, [dryerId]);

  
  const fetchScheduledPhaseInfo = useCallback(async (silent = false) => {
      if (!activeBatch?.batch_id) {
        setScheduledPhaseInfo(null);
        setActiveBatchDetail(null);
        return;
      }
      try {
        if (!silent) setLoadingBatchDetail(true);
        setBatchDetailError(null);
        const response = await batchAPI.get(activeBatch.batch_id);
        const batchDetail = response?.data ?? response ?? null;
        const nextInfo = batchDetail?.scheduled_phase_info ?? null;
        setScheduledPhaseInfo(nextInfo);
        setActiveBatchDetail(batchDetail);
      } catch (err) {
        console.error("Failed to fetch scheduled phase info:", err);
        if (!silent) {
          setScheduledPhaseInfo(null);
          setActiveBatchDetail(null);
          setBatchDetailError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!silent) setLoadingBatchDetail(false);
      }
    }, [activeBatch?.batch_id]);

  const fetchBatches = useCallback(async (silent = false) => {
    if (!dryerId) return;
    try {
      if (!silent) setLoadingBatches(true);
      setBatchesError(null);
      const response = await batchAPI.list({ dry_id: dryerId });
      const list: BatchItem[] = response?.data ?? response ?? [];
      setBatches(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Error fetching batches:", err);
      if (!silent) {
        setBatchesError(err instanceof Error ? err.message : "Failed to fetch batches");
        setBatches([]);
      }
    } finally {
      if (!silent) setLoadingBatches(false);
    }
  }, [dryerId]);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!activeBatch?.batch_id) {
      setBatchLogs([]);
      lastSeenTriggerIdRef.current = null;
      isInitialLogsLoadRef.current = true;
      return;
    }
    try {
      if (!silent) setLoadingLogs(true);
      const response = await monitoringAPI.logs.list({ batch_id: activeBatch.batch_id });
      const logsList = response?.data ?? response ?? [];
      const logsArray = Array.isArray(logsList) ? logsList : [];
      setBatchLogs(logsArray);

      // Check for new trigger logs
      const triggerLogs = logsArray
        .filter((l: any) => l.log_style === "sensor_trigger")
        .sort((a: any, b: any) => b.log_id - a.log_id);

      if (triggerLogs.length > 0) {
        const latestTriggerId = triggerLogs[0].log_id;
        if (isInitialLogsLoadRef.current) {
          lastSeenTriggerIdRef.current = latestTriggerId;
          isInitialLogsLoadRef.current = false;
        } else {
          if (lastSeenTriggerIdRef.current === null || latestTriggerId > lastSeenTriggerIdRef.current) {
            const latestLog = triggerLogs[0];
            
            // Resolve details: lookup sensor type and configured threshold condition limits
            let details = "";
            let alertSensorType: string | undefined;
            if (latestLog.sensor_id != null) {
              // sensor_type is now returned directly from the backend log JOIN
              const sensorType: string =
                latestLog.sensor_type ||
                dryerData?.sensors?.find((s: any) => s.sensor_id === latestLog.sensor_id)?.sensor_type ||
                "";
              alertSensorType = sensorType || undefined;

              const condition = activeBatchDetail?.threshold_conditions?.find(
                (c: any) => c.sensor_id === latestLog.sensor_id
              );

              const sensorName =
                sensorType === "temperature" ? "Nhiệt độ (Temperature)"
                : sensorType === "humidity"   ? "Độ ẩm (Humidity)"
                : sensorType === "light"      ? "Ánh sáng (Light)"
                : sensorType || "Cảm biến";

              const unit =
                sensorType === "temperature" ? "°C"
                : sensorType === "humidity"   ? "%"
                : sensorType === "light"      ? "%"
                : "";

              const opSymbol =
                (condition?.cp_operator === "gt"  || condition?.cp_operator === ">")  ? ">"
                : (condition?.cp_operator === "lt"  || condition?.cp_operator === "<")  ? "<"
                : (condition?.cp_operator === "gte" || condition?.cp_operator === ">=") ? "≥"
                : (condition?.cp_operator === "lte" || condition?.cp_operator === "<=") ? "≤"
                : condition?.cp_operator || "≥";

              const limitStr = condition
                ? ` [Giới hạn: ${opSymbol} ${condition.value}${unit}]`
                : "";
              details = `${sensorName}: ${latestLog.value}${unit}${limitStr}`;
            }

            setTriggerAlert({
              message: latestLog.message,
              details,
              sensorType: alertSensorType,
              timestamp: new Date(latestLog.created_at || Date.now())
            });
            lastSeenTriggerIdRef.current = latestTriggerId;
          }
        }
      } else {
        if (isInitialLogsLoadRef.current) {
          isInitialLogsLoadRef.current = false;
        }
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      if (!silent) setLoadingLogs(false);
    }
  }, [activeBatch?.batch_id, dryerData, activeBatchDetail]);

  useEffect(() => {
    fetchDryer();
  }, [fetchDryer]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    fetchScheduledPhaseInfo();
  }, [fetchScheduledPhaseInfo]);

  // Real-time polling for dryer data and active batch status (every 3 seconds)
  useEffect(() => {
    if (!dryerId) return;

    const intervalId = setInterval(() => {
      fetchDryer(true);
      fetchBatches(true);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [dryerId, fetchDryer, fetchBatches]);

  // Real-time polling for active batch phase details and logs (every 3 seconds)
  useEffect(() => {
    if (!activeBatch?.batch_id) {
      setBatchLogs([]);
      setTriggerAlert(null);
      lastSeenTriggerIdRef.current = null;
      isInitialLogsLoadRef.current = true;
      return;
    }

    fetchLogs(); // initial load

    const intervalId = setInterval(() => {
      fetchScheduledPhaseInfo(true);
      fetchLogs(true);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [activeBatch?.batch_id, fetchScheduledPhaseInfo, fetchLogs]);

  // Auto-dismiss trigger alert after 6 seconds
  useEffect(() => {
    if (!triggerAlert) return;
    const timerId = setTimeout(() => {
      setTriggerAlert(null);
    }, 6000);
    return () => clearTimeout(timerId);
  }, [triggerAlert]);

  // Monitor batches for status transitions (completed, aborted, failed)
  useEffect(() => {
    if (!batches || batches.length === 0) return;

    batches.forEach((batch) => {
      const prevStatus = prevBatchStatusesRef.current[batch.batch_id];
      const currentStatus = batch.status;

      if (prevStatus && prevStatus !== currentStatus) {
        if (currentStatus === "completed") {
          setBatchEndAlert({
            batchId: batch.batch_id,
            status: "completed",
            message: `Mẻ sấy #${batch.batch_id} đã hoàn thành xuất sắc!`,
            timestamp: new Date(),
          });
        } else if (currentStatus === "aborted") {
          setBatchEndAlert({
            batchId: batch.batch_id,
            status: "aborted",
            message: `Mẻ sấy #${batch.batch_id} đã bị hủy bỏ.`,
            timestamp: new Date(),
          });
        } else if (currentStatus === "failed") {
          setBatchEndAlert({
            batchId: batch.batch_id,
            status: "failed",
            message: `Mẻ sấy #${batch.batch_id} đã dừng lại do gặp lỗi.`,
            timestamp: new Date(),
          });
        }
      }

      // Record current status in ref
      prevBatchStatusesRef.current[batch.batch_id] = currentStatus;
    });
  }, [batches]);

  // Auto-dismiss batch end alert after 7 seconds
  useEffect(() => {
    if (!batchEndAlert) return;
    const timerId = setTimeout(() => {
      setBatchEndAlert(null);
    }, 7000);
    return () => clearTimeout(timerId);
  }, [batchEndAlert]);

  // High-fidelity local state timer (runs every 1 second when active batch is running)
  useEffect(() => {
    if (activeBatch?.status !== "running") return;

    const timerId = setInterval(() => {
      // 1. Update scheduledPhaseInfo state locally
      setScheduledPhaseInfo((prev) => {
        if (!prev) return prev;

        const nextElapsed = (prev.elapsed_seconds ?? 0) + 1;
        const nextPhaseRemaining = Math.max(0, (prev.current_phase_remaining_seconds ?? 0) - 1);
        const nextTotalRemaining = Math.max(0, (prev.total_remaining_seconds ?? 0) - 1);

        // If a phase completes (remaining counter reaches 0), trigger an immediate API sync
        if (
          prev.current_phase_remaining_seconds !== undefined &&
          prev.current_phase_remaining_seconds > 0 &&
          nextPhaseRemaining === 0
        ) {
          setTimeout(() => {
            fetchScheduledPhaseInfo(true);
            fetchDryer(true);
          }, 1000);
        }

        return {
          ...prev,
          elapsed_seconds: nextElapsed,
          current_phase_remaining_seconds: nextPhaseRemaining,
          total_remaining_seconds: nextTotalRemaining,
        };
      });

      // 2. Update activeBatchDetail state locally
      setActiveBatchDetail((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          elapsed_seconds: (prev.elapsed_seconds ?? 0) + 1,
        };
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [activeBatch?.status, fetchScheduledPhaseInfo, fetchDryer]);

  // Countdown timer for scheduled/pending batches waiting to auto-start
  useEffect(() => {
    const status = activeBatch?.status;
    if (status !== "scheduled" && status !== "pending") {
      setSecondsUntilStart(null);
      return;
    }
    const scheduledTime = activeBatchDetail?.scheduled_start_time;
    if (!scheduledTime) {
      setSecondsUntilStart(null);
      return;
    }
    const computeRemaining = () => {
      const diffMs = new Date(scheduledTime).getTime() - Date.now();
      return Math.max(0, Math.floor(diffMs / 1000));
    };
    setSecondsUntilStart(computeRemaining());
    const countdownId = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsUntilStart(remaining);
      if (remaining === 0) {
        // Auto-start triggered – resync from server after a brief pause
        setTimeout(() => {
          fetchBatches(true);
          fetchScheduledPhaseInfo(true);
        }, 2000);
        clearInterval(countdownId);
      }
    }, 1000);
    return () => clearInterval(countdownId);
  }, [activeBatch?.status, activeBatchDetail?.scheduled_start_time, fetchBatches, fetchScheduledPhaseInfo]);


  // Save threshold value for a sensor
  const handleSaveThreshold = async (sensorId: number) => {
    if (!activeBatch) return;

    const value = thresholdValues[sensorId];
    const op = thresholdOperators[sensorId] ?? thresholdConditions[sensorId] ?? '>=';

    if (value === undefined || value === null || value === "") {
      toast.error("Please enter a trigger limit");
      return;
    }

    const controls = dryerData?.controls ?? [];
    const actions: Array<{ control_id: number; action_type: 'activate' | 'deactivate' }> = [];

    controls.forEach((c: any) => {
      const actType = draftActions[`${sensorId}_${c.control_id}`];
      if (actType === "activate" || actType === "deactivate") {
        actions.push({ control_id: c.control_id, action_type: actType });
      }
    });

    if (actions.length === 0) {
      toast.error("Please configure at least one output device action (ON or OFF) for this rule");
      return;
    }

    setSavingThresholdId(sensorId);
    try {
      const numericVal = Number(value);

      // 1. Save threshold condition to policy & policy_condition
      const condResponse = await batchAPI.saveThresholdCondition(activeBatch.batch_id, {
        sensor_id: sensorId,
        threshold_value: numericVal,
        cp_operator: op
      });

      const conditionId = condResponse?.data?.condition_id ?? condResponse?.condition_id;
      if (!conditionId) {
        throw new Error("Failed to configure threshold condition: no condition_id returned");
      }

      // 2. Save threshold actions
      await batchAPI.saveThresholdActions(activeBatch.batch_id, {
        condition_id: conditionId,
        actions
      });

      setThresholdConditions(prev => ({
        ...prev,
        [sensorId]: op
      }));

      toast.success("Successfully saved threshold rule and actions");

      // Refresh batch detail and dryer
      await fetchScheduledPhaseInfo();
      await fetchDryer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save threshold settings");
      console.error(err);
    } finally {
      setSavingThresholdId(null);
    }
  };
 

  // Initialize threshold enabled state from dryer data
  useEffect(() => {
    if (dryerData?.sensors) {
      const enabledMap: Record<number, boolean> = {};
      dryerData.sensors.forEach((sensor) => {
        enabledMap[sensor.sensor_id] = true; // Default to enabled
      });
      setThresholdEnabled(enabledMap);
    }
  }, [dryerData?.sensors?.length]);

  // Load saved threshold conditions and values from activeBatchDetail
  useEffect(() => {
    if (!activeBatchDetail) return;

    const currentBatchId = activeBatchDetail.batch_id;
    const isNewBatch = currentBatchId !== lastLoadedBatchId;

    if (Array.isArray(activeBatchDetail.threshold_conditions)) {
      const savedConditions: Record<number, string> = {};
      const savedValues: Record<number, number | string> = {};
      const savedActionsMap: Record<string, 'activate' | 'deactivate' | 'none'> = {};

      activeBatchDetail.threshold_conditions.forEach((cond: any) => {
        let op = typeof cond.cp_operator === 'string' ? cond.cp_operator.trim() : cond.cp_operator;
        if (op === 'gt') op = '>=';
        if (op === 'lt') op = '<=';
        if (op === 'gte') op = '>=';
        if (op === 'lte') op = '<=';

        savedConditions[cond.sensor_id] = op;
        savedValues[cond.sensor_id] = cond.value;

        if (Array.isArray(cond.actions)) {
          cond.actions.forEach((act: any) => {
            savedActionsMap[`${cond.sensor_id}_${act.control_id}`] = act.action_type;
          });
        }
      });

      setThresholdConditions(savedConditions);

      if (isNewBatch) {
        setThresholdOperators(savedConditions);
        setThresholdValues(savedValues);
        setDraftActions(savedActionsMap);
        setLastLoadedBatchId(currentBatchId);
      }
    }
  }, [activeBatchDetail, lastLoadedBatchId]);

  // Fetch fruit names for clear display by fruit_id
  useEffect(() => {
    let cancelled = false;

    const fetchFruits = async () => {
      try {
        const response = await catalogAPI.fruits.list();
        const list: FruitItem[] = response?.data ?? response ?? [];

        if (!Array.isArray(list) || cancelled) {
          return;
        }

        const nextMap: Record<number, string> = {};
        list.forEach((fruit) => {
          const fruitId = Number(fruit?.fruit_id ?? fruit?.id);
          const fruitName = fruit?.fruit_name ?? fruit?.name;
          if (Number.isFinite(fruitId) && typeof fruitName === "string" && fruitName.trim()) {
            nextMap[fruitId] = fruitName.trim();
          }
        });

        setFruitNameById(nextMap);
      } catch (err) {
        console.error("Error fetching fruits:", err);
      }
    };

    fetchFruits();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch fruit recipe detail for the current active batch
  useEffect(() => {
    const currentBatch = pickActiveBatch(batches);

    if (!currentBatch) {
      setFruitRecipes([]);
      setRecipeDetail(null);
      setRecipeInfoError(null);
      return;
    }
    
    let cancelled = false;

    const fetchRecipeInfo = async () => {
      setLoadingRecipeInfo(true);
      setRecipeInfoError(null);
      try {
        if (!currentBatch.recipe_id) {setRecipeDetail(null); return;}
        const detailResponse = await catalogAPI.recipes.get(currentBatch.recipe_id);
        const detailData = detailResponse?.data ?? detailResponse ?? null;
        setRecipeDetail(detailData);
      } catch (err) {
        if (!cancelled) {
          setRecipeInfoError(err instanceof Error ? err.message : "Failed to load recipe information");
          setRecipeDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipeInfo(false);
        }
      }
    };
    fetchRecipeInfo();
    return () => {
      cancelled = true;
    };
  }, [activeBatch?.batch_id, activeBatch?.recipe_id]);

  // Sync temperature/humidity targets from sensor values once dryer data is loaded
  useEffect(() => {
    if (!dryerData) return;
    const tempSensor = dryerData.sensors?.find((s) => s.sensor_type === "temperature");
    const humSensor = dryerData.sensors?.find((s) => s.sensor_type === "humidity");
    setTempTarget(tempSensor?.last_value ?? 0);
    setHumTarget(humSensor?.last_value ?? 0);
  }, [dryerData]);

  // Sync active detail tab back to "batch" if activeBatch is null
  useEffect(() => {
    if (!activeBatch) {
      setActiveDetailTab("batch");
    }
  }, [activeBatch]);


  // ---- Batch actions --------------------------------------------------------
  const runBatchAction = async (
    batchId: number,
    action: "start" | "resume" | "pause" | "abort" | "completed",
    successMsg: string
  ) => {
    setBatchActionId(batchId);
    try {
      if (action === "start") {
        await batchAPI.start(batchId);
        toast.success(successMsg);
      } else if (action === "pause") {
        await batchAPI.pause(batchId);
        toast.success(successMsg);
      } else if (action === "abort") {
        await batchAPI.abort(batchId);
        toast.success(successMsg);
        await fetchBatches();
      } else if (action === "completed") {
        await batchAPI.stop(batchId, "completed");
        toast.success(successMsg);
        await fetchBatches();
      }
      else if (action === "resume" ) {
        await batchAPI.resume(batchId);
        toast.success(successMsg);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to perform batch action");
    } finally {
      setBatchActionId(null);
    }
  };

  // Compute which phase is currently running based on the batch API response
  const runningPhaseInfo = (() => {
    if (!activeBatch) return { index: 0, phase: null, progressPercent: 0 };

    const phases = Array.isArray(recipeDetail?.phases) ? recipeDetail.phases : [];
    const phaseInfo = scheduledPhaseInfo;

    if (phaseInfo?.current_phase) {
      const durationSeconds = Number(phaseInfo.current_phase.duration_seconds ?? 0);
      const remainingSeconds = Number(
        phaseInfo.current_phase_remaining_seconds ?? phaseInfo.total_remaining_seconds ?? 0
      );
      const progressPercent =
        durationSeconds > 0
          ? Math.max(0, Math.min(100, Math.round(((durationSeconds - remainingSeconds) / durationSeconds) * 100)))
          : 0;

      return {
        index: Math.max(0, Number(phaseInfo.current_phase_order ?? 1) - 1),
        phase: phaseInfo.current_phase,
        progressPercent,
      };
    }

    if (!phases.length) {
      return { index: 0, phase: null, progressPercent: 0 };
    }

    return { index: 0, phase: phases[0] ?? null, progressPercent: 0 };
  })();

  const startBatch = (batchId: number) => runBatchAction(batchId, "start", "Batch started");
  const pauseBatch = (batchId: number) => runBatchAction(batchId, "pause", "Batch paused");
  const resumeBatch = (batchId: number) => runBatchAction(batchId, "resume", "Batch resumed");
  const abortBatch = (batchId: number) => {
    if (!confirm("Huỷ mẻ sấy này?")) return;
    runBatchAction(batchId, "abort", "Đã huỷ mẻ sấy");
  };

  const isControlOn = (status?: string) => status === "active" || status === "on";


  const toggleControl = async (controlId: number, currentStatus?: string) => {
    const nextStatus = isControlOn(currentStatus) ? "inactive" : "active";
    setControlActionId(controlId);
    try {
      await structureAPI.controls.execute(controlId, nextStatus === "active");
      toast.success(`Successfully ${nextStatus === "active" ? "enabled" : "disabled"} the device`);
      await fetchDryer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setControlActionId(null);
    }
  };



  const handleAddControl = async (controlType: "fan" | "lamp") => {
    if (!dryerId || !dryerData) return;
    console.log(dryerId);
    setCreatingControlType(controlType);
    try {
      const controls = Array.isArray(dryerData.controls) ? dryerData.controls : [];
      const countByType = controls.filter((c) => c.control_type === controlType).length;
      const nextNumber = countByType + 1;
      const controlName = `${controlType === "fan" ? "Fan" : "Lamp"} ${nextNumber}`;

     await structureAPI.controls.create(dryerId, {
        control_type: controlType,
        control_name: controlName,
     });
      toast.success(`Adding ${controlName}`);
      await fetchDryer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add output device");
    } finally {
      setCreatingControlType(null);
    }
  };

  const showFormDelete = () => {
    const controls = Array.isArray(dryerData?.controls) ? dryerData.controls : [];
    if (controls.length === 0) {
      toast.info("Không có thiết bị output để xoá");
      return;
    }

    setSelectedDeleteControlId(controls[0].control_id);
    setShowDeleteControlModal(true);
  };

  const handleDeleteSelectedControl = async () => {
    if (!selectedDeleteControlId) {
      toast.error("Please choose the device to delete");
      return;
    }

    if (!confirm("Are you sure you want to delete this device?")) {
      return;
    }

    setDeletingControl(true);
    try {
      await apiRequest("DELETE", FACTORY_ENDPOINTS.controls.delete(selectedDeleteControlId));
      toast.success("Successfully deleted the output device");
      setShowDeleteControlModal(false);
      setSelectedDeleteControlId(null);
      await fetchDryer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the device");
    } finally {
      setDeletingControl(false);
    }
  };

  const handleThresholdToggle = async (enabled: boolean) => {
    if (!currentBatch) return;
    try {
      await batchAPI.threshold(currentBatch.batch_id, enabled);
      toast.success("Successfully updated device threshold");
      await fetchBatches();
      await fetchDryer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update device threshold");
    }
  };

  // ---- Render ---------------------------------------------------------------

  const formatDuration = (seconds?: number | null) => {
    const s = Number(seconds ?? 0);
    if (!Number.isFinite(s) || s <= 0) return "0s";
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Loading skeleton for dryer
  if (loadingDryer) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="max-w-screen-lg mx-auto space-y-6">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader className="animate-spin" size={20} />
            <span>Loading device data...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border p-4 animate-pulse space-y-3">
                <div className="h-4 w-1/3 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
                <div className="space-y-2">
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error / not found
  if (dryerError || !dryerData) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-screen-md mx-auto bg-white rounded-xl p-6 border border-red-200">
          <button
            onClick={() => navigate("/devices")}
            className="flex items-center gap-2 text-slate-600 mb-4"
          >
            <ArrowLeft /> Back to Devices
          </button>
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-500 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-slate-800" style={{ fontWeight: 700 }}>
                {dryerError ? "Không tải được dữ liệu thiết bị" : "Không tìm thấy thiết bị"}
              </h2>
              <p className="text-slate-500">{dryerError || "Thiết bị này không tồn tại."}</p>
            </div>
            <button
              onClick={fetchDryer}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dependent variables for display
  const matchedRecipeFromFruit =
    currentBatch?.recipe_id != null
      ? fruitRecipes.find((recipe) => recipe.recipe_id === currentBatch.recipe_id)
      : null;
  const fruitNameFromApi =
    currentBatch?.fruit_id != null ? fruitNameById[currentBatch.fruit_id] : undefined;
  const fruitDisplayName =
    fruitNameFromApi ??
    currentBatch?.fruit_name ??
    matchedRecipeFromFruit?.fruit_name ??
    (currentBatch?.fruit_id != null ? `Fruit #${currentBatch.fruit_id}` : "-");
  const recipeDisplayName =
    recipeDetail?.recipe_name ??
    matchedRecipeFromFruit?.recipe_name ??
    currentBatch?.recipe_name ??
    (currentBatch?.recipe_id != null ? `Recipe #${currentBatch.recipe_id}` : "-");
  // Prefer recipeDetail.phases — it includes device actions (control_type/action_type)
  // Fall back to activeBatchDetail.phases if recipe detail not loaded yet
  const batchPhases = recipeDetail?.phases ?? activeBatchDetail?.phases ?? [];
  const sortedControls = [...(dryerData.controls ?? [])].sort((a, b) => {
    const typeRank = (type: string) => (type === "fan" ? 0 : type === "lamp" ? 1 : 2);
    const rankDiff = typeRank(a.control_type) - typeRank(b.control_type);
    if (rankDiff !== 0) return rankDiff;
    return a.control_id - b.control_id;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-screen-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/devices")}
              className="flex items-center gap-2 text-slate-600 mb-1"
            >
              <ArrowLeft /> Back
            </button>           
          </div>

          <div>
            <h1 className="text-slate-800" style={{ fontWeight: 700 }}>
              {dryerData.dry_name}
            </h1>
            <p className="text-slate-400">
              ID: {dryerData.dry_id} • Area: {dryerData.area_id}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Status</p>
            <p
              className={`font-bold ${
                dryerData.status === "Running" ? "text-emerald-600" : "text-slate-600"
              }`}
            >
              {dryerData.status}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sensors */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-slate-800" style={{ fontWeight: 700 }}>
              Input Sensors
            </h3>
            <div className="mt-3 space-y-2">
              {(dryerData.sensors ?? []).map((sensor) => {
                const isEnabled = thresholdEnabled[sensor.sensor_id] !== false;
                const isSaving = savingThresholdId === sensor.sensor_id;

                return (
                  <div
                    key={sensor.sensor_id}
                    className="p-3 border rounded-lg bg-slate-50/60 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {sensor.sensor_type === "temperature" ? (
                          <Thermometer size={16} className="text-orange-500 mt-0.5 shrink-0" />
                        ) : sensor.sensor_type === "humidity" ? (
                          <Droplets size={16} className="text-blue-500 mt-0.5 shrink-0" />
                        ) : sensor.sensor_type === "light" ? (
                          <Sun size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                        ) : (
                          <Thermometer size={16} className="mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="text-slate-800 capitalize text-sm font-medium block">
                            {sensor.sensor_type === "light" ? "Light" : sensor.sensor_type}
                          </span>
                          <p className="text-xs text-slate-400">
                            Last updated: {sensor.updated_at ? new Date(sensor.updated_at).toLocaleTimeString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 min-w-[4.5rem] text-right">
                        <span className="inline-flex items-center justify-center min-w-[4.5rem] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                          {sensor.last_value != null ? sensor.last_value.toFixed(2) : "N/A"}
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
              
              {/* Light Sensor Placeholder (if no light sensor exists) */}
              {(dryerData.sensors ?? []).find(s => s.sensor_type === "light") === undefined && (
                <div className="p-3 border rounded-lg bg-slate-50/60 space-y-3 opacity-60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Sun size={16} className="text-slate-300 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-slate-500 text-sm font-medium block">Light</span>
                        <p className="text-xs text-slate-300">Không có dữ liệu</p>
                      </div>
                    </div>
                    <div className="shrink-0 min-w-[4.5rem] text-right">
                      <span className="inline-flex items-center justify-center min-w-[4.5rem] px-2.5 py-1 rounded-md bg-slate-100 text-slate-400 font-bold">
                        N/A
                      </span>
                    </div>
                  </div>

                  {/* Threshold Controls - Disabled */}
                  <div className="flex items-center gap-2 px-2 py-2 bg-white rounded border border-slate-200">
                    <button
                      disabled
                      className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed"
                    >
                      OFF
                    </button>

                    <span className="text-xs text-slate-300">Ngưỡng:</span>
                    <input
                      type="number"
                      placeholder="0"
                      disabled
                      className="w-16 px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 text-slate-400 opacity-50 cursor-not-allowed"
                    />
                    <button
                      disabled
                      className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              )}

              {(!dryerData.sensors || dryerData.sensors.length === 0) && (
                <p className="text-sm text-slate-400">Chưa có cảm biến.</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-slate-800" style={{ fontWeight: 700 }}>
                Output Devices
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddControl("fan")}
                  disabled={creatingControlType !== null}
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingControlType === "fan" ? "Adding..." : "+ Fan"}
                </button>
                <button
                  type="button"
                  onClick={() => handleAddControl("lamp")}
                  disabled={creatingControlType !== null}
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingControlType === "lamp" ? "Adding..." : "+ Lamp"}
                </button>
                <button
                  type="button"
                  onClick={showFormDelete}
                  className="ml-2 shrink-0 text-xs rounded px-2.5 py-1 font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {sortedControls.map((control) => (
                <div
                  key={control.control_id}
                  className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-slate-50/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {control.control_type === "fan" ? (
                      <Wind size={16} className="text-amber-500 shrink-0" />
                    ) : control.control_type === "lamp" ? (
                      <Lightbulb size={16} className="text-yellow-500 shrink-0" />
                    ) : (
                      <Wind size={16} className="shrink-0" />
                    )}
                    <span className="text-slate-700 capitalize text-sm font-medium truncate">
                      {control.control_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleControl(control.control_id, control.status)}
                    disabled={controlActionId === control.control_id}
                    className={`shrink-0 min-w-[3rem] text-xs rounded px-2.5 py-1 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isControlOn(control.status)
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {controlActionId === control.control_id
                      ? "..."
                      : isControlOn(control.status)
                        ? "ON"
                        : "OFF"}
                  </button>
                </div>
              ))}
              {(!dryerData.controls || dryerData.controls.length === 0) && (
                <p className="text-sm text-slate-400">Chưa có thiết bị output.</p>
              )}
            </div>
          </div>

          {/* Tabbed Detailed Device Panels */}
          {!loadingBatches && !batchesError && (
            <div className="bg-white rounded-xl border shadow-sm md:col-span-2 overflow-hidden flex flex-col">
              {activeBatch && (
                <div className="flex border-b border-slate-200 bg-slate-50/50 p-2 gap-1 overflow-x-auto whitespace-nowrap">
                  <button
                    onClick={() => setActiveDetailTab("batch")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
                      activeDetailTab === "batch"
                        ? "bg-white text-emerald-600 shadow-sm border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                    }`}
                  >
                    <Clock size={14} className="shrink-0" />
                    <span>Batch Details</span>
                  </button>
                  <button
                    onClick={() => setActiveDetailTab("threshold")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
                      activeDetailTab === "threshold"
                        ? "bg-white text-purple-600 shadow-sm border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                    }`}
                  >
                    <Zap size={14} className="shrink-0" />
                    <span>Automation Threshold Settings</span>
                  </button>
                  <button
                    onClick={() => setActiveDetailTab("logs")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
                      activeDetailTab === "logs"
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                    }`}
                  >
                    <FileText size={14} className="shrink-0" />
                    <span>Execution Logs</span>
                  </button>
                </div>
              )}

              <div className="p-5 flex-1">
                {activeDetailTab === "batch" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-slate-800" style={{ fontWeight: 700 }}>
                        Batch Details
                      </h3>
                <button
                  onClick={() => {
                    fetchBatches();
                    fetchScheduledPhaseInfo();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Refresh
                </button>
              </div>
              {activeBatch && (
                <div className="mt-2 flex items-center gap-2 relative">
                  <button
                    onClick={() => pauseBatch(activeBatch.batch_id)}
                    disabled={
                      batchActionId === activeBatch.batch_id ||
                      !(activeBatch.status === "running" || activeBatch.status === "scheduled" || activeBatch.status === "pending")
                    }
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Stop
                  </button>
                  <button
                    onClick={() => abortBatch(activeBatch.batch_id)}
                    disabled={batchActionId === activeBatch.batch_id}
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                  >
                    Abort
                  </button>
                  <button
                    onClick={() => {
                      if (activeBatch.status === "paused") {
                        resumeBatch(activeBatch.batch_id);
                      }
                      else {startBatch(activeBatch.batch_id);
                      }
                    }}
                    disabled={batchActionId === activeBatch.batch_id || !(activeBatch.status === "paused" || activeBatch.status === "pending")}
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              )}
              {!activeBatch ? (
                <div className="mt-3 text-slate-400">Không có mẻ sấy đang hoạt động.</div>
              ) : (
                <div className="mt-3 p-4 border rounded bg-slate-50 relative">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-slate-800 font-bold text-sm">
                        Batch #{activeBatch.batch_id}
                      </p>
                    </div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${batchStatusBadge(
                        activeBatch.status
                      )}`}
                    >
                      {activeBatch.status}
                    </span>
                  </div>

                  {/* ── Countdown until auto-start ───────────────────────────── */}
                  {(activeBatch.status === "scheduled" || activeBatch.status === "pending") && secondsUntilStart !== null && (
                    <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500 text-white shrink-0">
                        <Timer size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-blue-700 text-xs font-semibold uppercase tracking-wide">Starts in</p>
                        <p className="text-blue-900 font-extrabold text-xl tabular-nums leading-tight">
                          {formatDuration(secondsUntilStart)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-blue-500 text-[11px]">Scheduled at</p>
                        <p className="text-blue-700 text-xs font-semibold">
                          {activeBatchDetail?.scheduled_start_time
                            ? new Date(activeBatchDetail.scheduled_start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 p-3 bg-white rounded border border-slate-200">
                    <p className="text-slate-700 text-xs font-semibold">BATCH INFORMATION</p>

                    {loadingRecipeInfo && (
                      <p className="mt-1 text-xs text-slate-400">LOADING...</p>
                    )}

                    {!loadingRecipeInfo && recipeInfoError && (
                      <p className="mt-1 text-xs text-red-500">{recipeInfoError}</p>
                    )}

                    {!loadingRecipeInfo && !recipeInfoError && (
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-2 rounded border border-slate-100 bg-slate-50">
                            <span className="text-slate-400 block">Fruit name</span>
                            <span className="text-slate-700 font-semibold">{fruitDisplayName}</span>
                          </div>
                          <div className="p-2 rounded border border-slate-100 bg-slate-50">
                            <span className="text-slate-400 block">Recipe name</span>
                            <span className="text-slate-700 font-semibold">{recipeDisplayName}</span>
                          </div>
                  <div className="p-2 rounded border border-slate-100 bg-slate-50 sm:col-span-2">
                            <span className="text-slate-400 block">Threshold mode</span>
                            <span className={`font-semibold ${activeBatch.threshold_enabled ? "text-purple-700" : "text-slate-700"}`}>
                              {activeBatch.threshold_enabled ? "Yes" : "No"}
                            </span>
                          </div>
                          
                        {/* Currently Running Phase */}
              <div className="p-2 rounded border border-slate-100 bg-slate-50 sm:col-span-2">
                <h3 className="text-slate-700" style={{ fontWeight: 1000, fontSize: "0.9375rem" }}>
                  Current Phase
                </h3>

                {activeBatch && runningPhaseInfo && (
                  <div className="w-full bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
                    {/* Main Container */}
                    <div className="w-full bg-gradient-to-r from-emerald-50 to-cyan-50 p-5 border-b border-emerald-200">
                      {/* Phase Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500 text-white" style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                          {runningPhaseInfo.phase && runningPhaseInfo.index != null ? `P${runningPhaseInfo.index + 1}` : "P1"}
                        </span>
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <h4 className="text-emerald-700" style={{ fontSize: "1.125rem", fontWeight: 700 }}>
                              {runningPhaseInfo.phase?.phase_name ?? runningPhaseInfo.phase?.name ?? `Phase ${runningPhaseInfo.index + 1}`}
                            </h4>
                            <p className="text-emerald-600 text-xs">
                              Phase {runningPhaseInfo.index + 1} / {batchPhases.length}
                            </p>
                          </div>

                          {/* Small pill (image-like) shown immediately to the right of the Phase text */}
                          <div className="ml-3 shrink-0">
                            <div className="inline-flex items-center bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                              {`Elapsed: ${formatDuration(scheduledPhaseInfo?.elapsed_seconds ?? currentBatch?.elapsed_seconds ?? 0)}`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-emerald-200 rounded-full h-3">
                        <div 
                          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, runningPhaseInfo.progressPercent || 0))}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Phase Info Cards */}
                    <div className="w-full p-5">
                      <div className="grid grid-cols-2 gap-5 w-full">
                        {/* Active Devices */}
                        <div className="bg-slate-50 rounded-lg border border-slate-200 p-5 w-full">
                          <div className="flex items-center gap-2 mb-4">
                            <Cpu size={18} className="text-emerald-600" />
                            <span className="text-slate-700 text-sm font-semibold">Active Devices</span>
                          </div>
                          <div className="space-y-3 min-h-[50px]">
                            {runningPhaseInfo.phase?.actions && 
                             runningPhaseInfo.phase?.actions.length > 0 ? (
                              <>
                                {runningPhaseInfo.phase?.actions
                                  .filter((a: any) => a.action_type === "activate")
                                  .map((action: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2">
                                      {action.control_type === "fan" && (
                                        <>
                                          <Wind size={18} className="text-blue-500" />
                                          <span className="text-blue-700 text-sm font-semibold">Fan: ON</span>
                                        </>
                                      )}
                                      {action.control_type === "lamp" && (
                                        <>
                                          <Lightbulb size={18} className="text-amber-500" />
                                          <span className="text-amber-700 text-sm font-semibold">Light: ON</span>
                                        </>
                                      )}
                                    </div>
                                  ))}
                              </>
                            ) : (
                              <span className="text-slate-400 text-sm">No Change</span>
                            )}
                          </div>
                        </div>

                        {/* Duration Info */}
                        <div className="bg-slate-50 rounded-lg border border-slate-200 p-5 w-full">
                          <div className="flex items-center gap-2 mb-4">
                            <Clock size={18} className="text-emerald-600" />
                            <span className="text-slate-700 text-sm font-semibold">Duration</span>
                          </div>
                              <div className="min-h-[50px] flex items-center">
                            <span className="text-emerald-700 font-bold text-2xl">
                              {runningPhaseInfo.phase?.duration 
                                ? Math.round(runningPhaseInfo.phase.duration * 60) 
                                : runningPhaseInfo.phase?.duration_seconds
                                  ? Math.round(runningPhaseInfo.phase.duration_seconds / 60)
                                  : 0} minutes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* All Phases in Batch */}
              {batchPhases.length > 0 && (
                <div className="p-2 rounded border border-slate-100 bg-slate-50 sm:col-span-2 mt-4">
                  <h4 className="text-slate-700 font-extrabold text-sm mb-3">Batch Phases Schedule</h4>
                  <div className="grid grid-flow-col auto-cols-[240px] gap-4 overflow-x-auto pb-3 pt-1">
                    {batchPhases.map((phase: any, idx: number) => {
                      const isCurrent = activeBatch && activeBatch.status === "running" && idx === runningPhaseInfo.index;
                      const isPaused = activeBatch && activeBatch.status === "paused" && idx === runningPhaseInfo.index;
                      const isCompleted = activeBatch && (activeBatch.status === "completed" || idx < runningPhaseInfo.index);
                      
                      const durationMinutes = phase?.duration 
                        ? Math.round(phase.duration * 60) 
                        : phase?.duration_seconds 
                          ? Math.round(phase.duration_seconds / 60)
                          : 0;

                      return (
                        <div 
                          key={phase.phase_id ?? idx} 
                          className={`rounded-xl border p-3.5 bg-white relative flex flex-col justify-between transition-all duration-200 ${
                            isCurrent ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md" :
                            isPaused ? "border-amber-500 ring-2 ring-amber-500/20 shadow-md" :
                            isCompleted ? "border-slate-200 bg-slate-50/50 opacity-70" :
                            "border-slate-200"
                          }`}
                        >
                          {/* Top Row: Phase Order & Status Badge */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-extrabold ${
                              isCurrent ? "bg-emerald-500 text-white animate-pulse" :
                              isPaused ? "bg-amber-500 text-white" :
                              isCompleted ? "bg-slate-300 text-slate-600" :
                              "bg-slate-100 text-slate-500"
                            }`}>
                              {idx + 1}
                            </span>
                            
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isCurrent ? "bg-emerald-100 text-emerald-700" :
                              isPaused ? "bg-amber-100 text-amber-700" :
                              isCompleted ? "bg-slate-100 text-slate-500" :
                              "bg-slate-50 text-slate-400"
                            }`}>
                              {isCurrent ? "Running" : isPaused ? "Paused" : isCompleted ? "Done" : "Pending"}
                            </span>
                          </div>

                          {/* Phase Name */}
                          <span className="text-slate-800 text-sm font-bold block truncate mb-3">
                            {phase.phase_name ?? phase.name ?? `Phase ${idx + 1}`}
                          </span>

                          {/* Parameter Details */}
                          <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            {/* Duration */}
                            <div className="flex justify-between items-center">
                              <span>Duration:</span>
                              <strong className="text-slate-700 font-semibold">{durationMinutes} min</strong>
                            </div>
                            {/* Temp Target */}
                            {phase.temperature !== null && phase.temperature !== undefined && (
                              <div className="flex justify-between items-center">
                                <span>Temp Target:</span>
                                <strong className="text-slate-700 font-semibold">{phase.temperature}°C</strong>
                              </div>
                            )}
                            {/* Humidity Target */}
                            {phase.humidity !== null && phase.humidity !== undefined && (
                              <div className="flex justify-between items-center">
                                <span>Hum Target:</span>
                                <strong className="text-slate-700 font-semibold">{phase.humidity}%</strong>
                              </div>
                            )}
                          </div>

                          {/* Device ON/OFF actions */}
                          {(() => {
                            if (!Array.isArray(phase.actions) || phase.actions.length === 0) return null;
                            
                            // Map actions to dry_id controls (if dryerData is loaded) to resolve correct names and deduplicate
                            const mappedActions = dryerData?.controls
                              ? phase.actions.map((a: any) => {
                                  const match = dryerData.controls.find(
                                    (c: any) => c.control_id === a.control_id
                                  ) || dryerData.controls.find(
                                    (c: any) => c.control_type === a.control_type && c.control_name === a.control_name
                                  ) || dryerData.controls.find(
                                    (c: any) => c.control_type === a.control_type
                                  );
                                  return match ? { ...a, control_id: match.control_id, control_name: match.control_name } : null;
                                }).filter(Boolean)
                              : phase.actions;

                            // Keep only unique control_id entries, preferring the last action if multiple exist (which represents the override)
                            const uniqueActions = [];
                            const seenIds = new Set();
                            for (let i = mappedActions.length - 1; i >= 0; i--) {
                              const act = mappedActions[i];
                              if (!seenIds.has(act.control_id)) {
                                seenIds.add(act.control_id);
                                uniqueActions.unshift(act);
                              }
                            }

                            if (uniqueActions.length === 0) return null;

                            return (
                              <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
                                {uniqueActions.map((act: any, ai: number) => {
                                  const isOn = act.action_type === "activate";
                                  const icon = act.control_type === "fan"
                                    ? <Wind size={10} className={isOn ? "text-blue-500" : "text-slate-400"} />
                                    : <Lightbulb size={10} className={isOn ? "text-amber-500" : "text-slate-400"} />;
                                  return (
                                    <span
                                      key={ai}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        isOn
                                          ? act.control_type === "fan"
                                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                                            : "bg-amber-50 text-amber-700 border border-amber-200"
                                          : "bg-slate-50 text-slate-400 border border-slate-200 line-through"
                                      }`}
                                    >
                                      {icon}
                                      {act.control_name ?? act.control_type}
                                      <span className={isOn ? "text-emerald-600" : "text-red-400"}>{isOn ? " ON" : " OFF"}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                  
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
                  </div>
                )}

                {activeBatch && activeDetailTab === "threshold" && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-600">
                                    <Zap size={20} className="stroke-[2.5]" />
                                  </div>
                                  <div>
                                    <h3 className="text-slate-800 font-extrabold text-base">Automation Threshold Settings</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Control fans and lamps automatically based on sensor readings</p>
                                  </div>
                                </div>
                                {activeBatch.threshold_enabled ? (
                                  <button 
                                    onClick={() => handleThresholdToggle(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all shadow-sm flex items-center gap-1.5"
                                  >
                                    ✕ Disable automation
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleThresholdToggle(true)}
                                    className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-all shadow-sm flex items-center gap-1.5"
                                  >
                                    ✓ Enable automation
                                  </button>
                                )}
                              </div>
                              
                              <div className="space-y-4">
                                {(dryerData.sensors ?? [])
                                  .map((sensor) => {
                                  const savedCond = activeBatchDetail?.threshold_conditions?.find(
                                    (cond) => cond.sensor_id === sensor.sensor_id
                                  );
                                  const hasSavedRule = savedCond !== undefined;
                                  const savedValue = savedCond?.value;
                                  const savedOp = typeof savedCond?.cp_operator === 'string' ? savedCond.cp_operator.trim() : savedCond?.cp_operator;
                                  const savedOpSymbol = (savedOp === 'lt' || savedOp === '<' || savedOp === 'less' || savedOp === '<=') ? '≤' : '≥';
                                  const unit = sensor.sensor_type === "temperature" ? "°C" : "%";

                                  // Construct dynamic preview string based on draftActions
                                  const activeActionsList = sortedControls
                                    .map(c => {
                                      const act = draftActions[`${sensor.sensor_id}_${c.control_id}`];
                                      if (act === "activate") return `${c.control_name} ➔ ON`;
                                      if (act === "deactivate") return `${c.control_name} ➔ OFF`;
                                      return null;
                                    })
                                    .filter(Boolean);

                                  const actionDesc = activeActionsList.length > 0 ? activeActionsList.join(", ") : "";

                                  const currentDraftOp = thresholdOperators[sensor.sensor_id] ?? savedOp ?? '>=';

                                  return (
                                    <div 
                                      key={sensor.sensor_id} 
                                      className={"bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-4 transition-all duration-200 " + (
                                        !activeBatch?.threshold_enabled ? 'opacity-40 pointer-events-none' : ''
                                      )}
                                    >
                                      <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4">
                                        
                                        {/* Col 1: Sensor Identity & Live Value (Span 3) */}
                                        <div className="lg:col-span-3 flex items-center gap-3">
                                          <div className={"p-2.5 rounded-xl shadow-sm " + (
                                            sensor.sensor_type === "temperature" ? "bg-orange-500/10 text-orange-600" :
                                            sensor.sensor_type === "humidity" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                                          )}>
                                            {sensor.sensor_type === "temperature" ? (
                                              <Thermometer size={20} className="stroke-[2.5]" />
                                            ) : sensor.sensor_type === "humidity" ? (
                                              <Droplets size={20} className="stroke-[2.5]" />
                                            ) : (
                                              <Sun size={20} className="stroke-[2.5]" />
                                            )}
                                          </div>
                                          <div>
                                            <span className="text-slate-800 capitalize text-sm font-bold block leading-tight">
                                              {sensor.sensor_type === "light" ? "Light Sensor" : (sensor.sensor_type.charAt(0).toUpperCase() + sensor.sensor_type.slice(1) + " Sensor")}
                                            </span>
                                            <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                                              Live: <strong className="text-slate-700 font-semibold">{sensor.last_value != null ? (sensor.last_value.toFixed(1) + unit) : "N/A"}</strong>
                                            </span>
                                          </div>
                                        </div>

                                        {/* Col 2: Active Rule Badge (Span 3) */}
                                        <div className="lg:col-span-3 flex flex-col justify-center">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Active Rule</span>
                                          <div className="flex">
                                            <div className={"inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all " + (
                                              hasSavedRule 
                                                ? "bg-purple-50 border-purple-100 text-purple-700 shadow-sm" 
                                                : "bg-slate-100 border-slate-200 text-slate-400 italic"
                                            )}>
                                              {hasSavedRule ? (
                                                <>
                                                  <Zap size={11} className="text-purple-500 fill-purple-100" />
                                                  <span>
                                                    {sensor.sensor_type === "temperature" ? "Temp" : sensor.sensor_type === "humidity" ? "Humidity" : "Light"} {savedOpSymbol} {savedValue}{unit}
                                                  </span>
                                                </>
                                              ) : (
                                                <span>No active rule</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Col 3: Edit Inputs (Span 4) */}
                                        <div className="lg:col-span-4 flex items-center gap-3">
                                          {/* Operator */}
                                          <div className="w-20 shrink-0">
                                            <select
                                              value={currentDraftOp}
                                              onChange={(e) => setThresholdOperators({...thresholdOperators, [sensor.sensor_id]: e.target.value})}
                                              disabled={!activeBatch?.threshold_enabled || savingThresholdId === sensor.sensor_id}
                                              className="w-full px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-bold outline-none text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
                                            >
                                              <option value=">=">≥</option>
                                              <option value="<=">≤</option>
                                            </select>
                                          </div>

                                          {/* Input Value */}
                                          <div className="relative flex-1 min-w-[80px]">
                                            <input
                                              type="number"
                                              value={thresholdValues[sensor.sensor_id] ?? ""}
                                              onChange={(e) => setThresholdValues({...thresholdValues, [sensor.sensor_id]: e.target.value})}
                                              placeholder="Limit"
                                              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-bold outline-none text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                              step={sensor.sensor_type === "temperature" ? "0.1" : "1"}
                                              disabled={!activeBatch?.threshold_enabled || savingThresholdId === sensor.sensor_id}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold select-none pointer-events-none">
                                              {unit}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Col 4: Action Button (Span 2) */}
                                        <div className="lg:col-span-2 flex items-center justify-end w-full">
                                          <button
                                            onClick={() => handleSaveThreshold(sensor.sensor_id)}
                                            disabled={
                                              savingThresholdId === sensor.sensor_id ||
                                              thresholdValues[sensor.sensor_id] === undefined ||
                                              thresholdValues[sensor.sensor_id] === "" ||
                                              !activeBatch?.threshold_enabled
                                            }
                                            className={"w-full lg:w-auto h-9 px-4 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm border " + (
                                              savingThresholdId === sensor.sensor_id
                                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                                : thresholdValues[sensor.sensor_id] !== undefined && thresholdValues[sensor.sensor_id] !== "" && activeBatch?.threshold_enabled
                                                  ? "bg-purple-600 hover:bg-purple-700 text-white border-transparent hover:shadow"
                                                  : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                            )}
                                          >
                                            {savingThresholdId === sensor.sensor_id ? (
                                              <>
                                                <Loader2 size={13} className="animate-spin" />
                                                <span>Saving</span>
                                              </>
                                            ) : (
                                              <>
                                                <Save size={13} />
                                                <span>Save</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Output Actions Configurator Grid */}
                                      <div className="mt-3 pt-3 border-t border-slate-200/50">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Configure Trigger Actions</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                          {sortedControls.map((control) => {
                                            const actionKey = `${sensor.sensor_id}_${control.control_id}`;
                                            const currentAction = draftActions[actionKey] ?? "none";

                                            return (
                                              <div key={control.control_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200">
                                                <span className="text-xs font-semibold text-slate-700 capitalize truncate">
                                                  {control.control_name}
                                                </span>
                                                <select
                                                  value={currentAction}
                                                  onChange={(e) => setDraftActions(prev => ({ ...prev, [actionKey]: e.target.value as any }))}
                                                  disabled={!activeBatch?.threshold_enabled || savingThresholdId === sensor.sensor_id}
                                                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none text-slate-700 focus:border-purple-500 cursor-pointer"
                                                >
                                                  <option value="none">None</option>
                                                  <option value="activate">Turn ON</option>
                                                  <option value="deactivate">Turn OFF</option>
                                                </select>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Description Rule footer */}
                                      <div className="mt-3 pt-3 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="text-slate-400 font-medium">
                                          Rule logic preview:
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/30">
                                          <Zap size={11} className="text-emerald-500 fill-emerald-50" />
                                          <span className="font-semibold text-[11px]">
                                            If {sensor.sensor_type === "temperature" ? "Temp" : sensor.sensor_type === "humidity" ? "Humidity" : "Light"}{' '}
                                            <strong className="text-emerald-800 font-bold">{currentDraftOp}</strong>{' '}
                                            <strong className="text-emerald-800 font-bold">{thresholdValues[sensor.sensor_id] !== undefined && thresholdValues[sensor.sensor_id] !== "" ? thresholdValues[sensor.sensor_id] : "?"}</strong>{unit}
                                            {' '}➔{' '}{actionDesc || "No actions configured"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {(dryerData.sensors ?? []).length === 0 && (
                                  <span className="text-sm text-slate-400 block text-center py-4">Không có cảm biến để điều chỉnh</span>
                                )}
                              </div>
                  </div>
                )}

                {activeBatch && activeDetailTab === "logs" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-105">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-slate-600" />
                  <h3 className="text-slate-800 font-bold text-sm">
                    Nhật ký hoạt động mẻ sấy (Batch #{activeBatch.batch_id})
                  </h3>
                </div>
                <button
                  onClick={() => fetchLogs()}
                  disabled={loadingLogs}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1"
                >
                  {loadingLogs ? <Loader2 size={12} className="animate-spin" /> : "Tải lại"}
                </button>
              </div>

              {loadingLogs && batchLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                  <span>Đang tải nhật ký...</span>
                </div>
              ) : batchLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  Chưa có nhật ký hoạt động cho mẻ sấy này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                          <th className="py-2.5 px-3 w-28">Thời gian</th>
                          <th className="py-2.5 px-3 w-36">Loại sự kiện</th>
                          <th className="py-2.5 px-3">Nội dung chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-xs">
                        {batchLogs.map((log) => {
                          let badgeBg = "bg-slate-100 text-slate-600 border-slate-200/50";
                          let badgeText = log.log_style;

                          if (log.log_style === "sensor_trigger") {
                            badgeBg = "bg-amber-50 text-amber-700 border-amber-100/50";
                            badgeText = "Ngưỡng Kích Hoạt";
                          } else if (log.log_style === "device_action") {
                            badgeBg = "bg-blue-50 text-blue-700 border-blue-100/50";
                            badgeText = "Thiết Bị Kích Hoạt";
                          } else if (log.log_style === "parameter_change") {
                            badgeBg = "bg-slate-50 text-slate-700 border-slate-200/50";
                            badgeText = "Tham Số Cảm Biến";
                          } else if (log.log_style.startsWith("batch_")) {
                            badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-100/50";
                            badgeText = "Mẻ Sấy";
                          }

                          return (
                            <tr key={log.log_id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                                {log.created_at ? new Date(log.created_at).toLocaleTimeString() : "N/A"}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold border rounded-md ${badgeBg}`}>
                                  {badgeText}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 font-semibold break-words">
                                {log.message}
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
              </div>
            </div>
          )}
        </div>

        {/* Center Alert Notification */}
        {triggerAlert && (() => {
          const st = triggerAlert.sensorType;
          const isTemp  = st === "temperature";
          const isHum   = st === "humidity";
          const isLight = st === "light";

          const borderColor  = isTemp ? "border-red-500"    : isHum ? "border-blue-500"   : isLight ? "border-yellow-400" : "border-amber-500";
          const barGradient  = isTemp ? "from-red-500 to-rose-500" : isHum ? "from-blue-500 to-cyan-500" : isLight ? "from-yellow-400 to-amber-400" : "from-amber-500 to-orange-500";
          const iconBg       = isTemp ? "bg-red-500/10 text-red-500"   : isHum ? "bg-blue-500/10 text-blue-500"   : isLight ? "bg-yellow-400/10 text-yellow-500" : "bg-amber-500/10 text-amber-500";
          const detailBg     = isTemp ? "bg-red-50/60 border-red-200/60 text-red-700"  : isHum ? "bg-blue-50/60 border-blue-200/60 text-blue-700" : isLight ? "bg-yellow-50/60 border-yellow-200/60 text-yellow-700" : "bg-amber-50/50 border-amber-200/60 text-amber-700";
          const btnColor     = isTemp ? "bg-red-700 hover:bg-red-800"  : isHum ? "bg-blue-700 hover:bg-blue-800"  : isLight ? "bg-yellow-600 hover:bg-yellow-700" : "bg-slate-800 hover:bg-slate-900";
          const emoji        = isTemp ? "🌡️" : isHum ? "💧" : isLight ? "☀️" : "⚠️";
          const title        = isTemp ? "Ngưỡng Nhiệt Độ Kích Hoạt" : isHum ? "Ngưỡng Độ Ẩm Kích Hoạt" : isLight ? "Ngưỡng Ánh Sáng Kích Hoạt" : "Ngưỡng Tự Động Kích Hoạt";
          const AlertIcon    = isTemp ? Thermometer : isHum ? Droplets : isLight ? Sun : Bell;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in zoom-in-95">
              <div className={`w-full max-w-md bg-white border-2 ${borderColor} rounded-2xl shadow-2xl p-6 relative overflow-hidden`}>
                <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${barGradient}`}></div>

                <button
                  onClick={() => setTriggerAlert(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded-full"
                >
                  <X size={18} />
                </button>

                <div className="flex flex-col items-center text-center mt-2">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 animate-bounce ${iconBg}`}>
                    <AlertIcon size={28} className="stroke-[2.5]" />
                  </div>

                  <h3 className="text-slate-800 text-lg font-extrabold uppercase tracking-wide">
                    {emoji} {title}
                  </h3>

                  <div className="w-full mt-4 space-y-2 text-left">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên quy luật</div>
                    <div className="text-slate-800 text-sm font-bold bg-slate-50 border border-slate-200/60 rounded-xl p-3">
                      {triggerAlert.message}
                    </div>

                    {triggerAlert.details && (
                      <>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-1">Thông số kích hoạt</div>
                        <div className={`text-sm font-extrabold rounded-xl p-3 border ${detailBg}`}>
                          {triggerAlert.details}
                        </div>
                      </>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-bold mt-5 uppercase tracking-wider">
                    Thời gian: {triggerAlert.timestamp.toLocaleTimeString()}
                  </span>

                  <button
                    onClick={() => setTriggerAlert(null)}
                    className={`mt-5 w-full py-2.5 px-4 text-white text-xs font-bold rounded-xl shadow transition-all ${btnColor}`}
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Center Batch End/Abort Notification */}
        {batchEndAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in zoom-in-95">
            <div className={`w-full max-w-md bg-white border-2 rounded-2xl shadow-2xl p-6 relative overflow-hidden ${
              batchEndAlert.status === "completed" ? "border-emerald-500" :
              batchEndAlert.status === "aborted" ? "border-red-500" : "border-orange-500"
            }`}>
              {/* Dynamic top bar color */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${
                batchEndAlert.status === "completed" ? "from-emerald-500 to-teal-500" :
                batchEndAlert.status === "aborted" ? "from-red-500 to-rose-500" : "from-orange-500 to-amber-500"
              }`}></div>
              
              <button
                onClick={() => setBatchEndAlert(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded-full"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center text-center mt-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 animate-bounce ${
                  batchEndAlert.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                  batchEndAlert.status === "aborted" ? "bg-red-500/10 text-red-600" : "bg-orange-500/10 text-orange-600"
                }`}>
                  {batchEndAlert.status === "completed" ? (
                    <CheckCircle2 size={28} className="stroke-[2.5]" />
                  ) : batchEndAlert.status === "aborted" ? (
                    <XCircle size={28} className="stroke-[2.5]" />
                  ) : (
                    <AlertTriangle size={28} className="stroke-[2.5]" />
                  )}
                </div>
                
                <h3 className="text-slate-800 text-lg font-extrabold uppercase tracking-wide">
                  {batchEndAlert.status === "completed" ? "🎉 Mẻ Sấy Hoàn Thành" :
                   batchEndAlert.status === "aborted" ? "🛑 Mẻ Sấy Bị Hủy Bỏ" : "⚠️ Mẻ Sấy Gặp Sự Cố"}
                </h3>
                
                <p className="text-slate-600 text-sm mt-3 font-semibold bg-slate-50 border border-slate-200/60 rounded-xl p-4 w-full">
                  {batchEndAlert.message}
                </p>

                <span className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-wider">
                  Thời gian: {batchEndAlert.timestamp.toLocaleTimeString()}
                </span>
                
                <button
                  onClick={() => setBatchEndAlert(null)}
                  className={`mt-5 w-full py-2.5 px-4 text-white text-xs font-bold rounded-xl shadow transition-all ${
                    batchEndAlert.status === "completed" ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800" :
                    batchEndAlert.status === "aborted" ? "bg-red-600 hover:bg-red-700 active:bg-red-800" : "bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
                  }`}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteControlModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-800" style={{ fontWeight: 700 }}>Select Device to Delete</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteControlModal(false);
                    setSelectedDeleteControlId(null);
                  }}
                  className="text-slate-500"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sortedControls.map((control) => (
                  <label
                    key={control.control_id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="deleteControl"
                      checked={selectedDeleteControlId === control.control_id}
                      onChange={() => setSelectedDeleteControlId(control.control_id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{control.control_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{control.control_type}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteControlModal(false);
                    setSelectedDeleteControlId(null);
                  }}
                  className="px-3 py-2 border rounded"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedControl}
                  disabled={deletingControl || selectedDeleteControlId == null}
                  className={`px-3 py-2 text-white rounded ${deletingControl ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {deletingControl ? "Đang xoá..." : "Xoá thiết bị"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeviceDetail;
