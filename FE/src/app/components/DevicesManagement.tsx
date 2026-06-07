import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { structureAPI, catalogAPI, BATCH_ENDPOINTS, FACTORY_ENDPOINTS, apiRequest } from "../config/api.config";
import { useApiData, useConditionalApiData } from "../../hooks/useApiData";
import { useIsAdmin } from "../../hooks/usePermission";
import { convertDryerToMachine, Machine } from "../utils/dryerConverter";
import { DryerDetail } from "../types/dryer";
import { Factory, Area, Fruit } from "../types/api";
import {
  Plus,
  ChevronDown,
  MoreVertical,
  Thermometer,
  Droplets,
  Edit2,
  Trash2,
  Cpu,
  CheckCircle,
  AlertTriangle,
  WifiOff,
  ChevronRight,
  Wind,
  Lightbulb,
  Activity,
  ChevronUp,
  Sun,
  ChevronLeft,
  Shield,
  FileText,
  Loader2,
  AlertCircle,
  Play,
  Timer,
} from "lucide-react";

type MachineStatus = "running" | "offline" | "alert" | "idle";

const statusConfig: Record<MachineStatus, { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }> = {
  running: { label: "Running", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", icon: <CheckCircle size={11} /> },
  idle: { label: "Idle", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", icon: <Activity size={11} /> },
  offline: { label: "Offline", bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400", icon: <WifiOff size={11} /> },
  alert: { label: "Alert", bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", icon: <AlertTriangle size={11} /> },
};

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex items-center w-10 h-5 rounded-full transition-all duration-200 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transform transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function MachineCard({ machine, onToggle, onViewDetails, onDelete, onChangeName }: { machine: Machine; onToggle: (id: string) => void; onViewDetails: (id: string) => void; onDelete: (id: string) => void; onChangeName: (id: string, currentName: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [freshTemp, setFreshTemp] = useState<number | null>(null);
  const [freshHumidity, setFreshHumidity] = useState<number | null>(null);
  const [freshLight, setFreshLight] = useState<number | null>(null);
  const [localPowerOn, setLocalPowerOn] = useState(machine.isOn ?? true);
  const [powerLoading, setPowerLoading] = useState(false);
  const [hasRunningBatch, setHasRunningBatch] = useState<boolean>(false);
  const [hasPendingBatch, setHasPendingBatch] = useState<boolean>(false);
  const [fanOn, setFanOn] = useState<boolean>(false);
  const [lampOn, setLampOn] = useState<boolean>(false);
  const s = statusConfig[(machine.status as MachineStatus)] ?? statusConfig.offline;

  // Keep localPowerOn synced with machine prop updates
  useEffect(() => {
    setLocalPowerOn(machine.isOn);
  }, [machine.isOn]);

  // Fetch fresh dryer data including temperature and humidity
  useEffect(() => {
    const fetchFreshDryerData = async () => {
      try {
        const dryerId = Number(machine.id.replace(/^D/, ''));
        if (!dryerId) return;

        const response = await apiRequest('GET', FACTORY_ENDPOINTS.dryers.get(dryerId)) as any;
        
        // Extract dryer data from response wrapper
        const dryerData = response?.data || response;
        const sensors = dryerData?.sensors || [];
        
        const temperatureSensor = sensors.find((s: any) => s.sensor_type === 'temperature');
        const humiditySensor = sensors.find((s: any) => s.sensor_type === 'humidity');
        const lightSensor = sensors.find((s: any) => s.sensor_type === 'light');
        
        setFreshTemp(temperatureSensor?.last_value ?? null);
        setFreshHumidity(humiditySensor?.last_value ?? null);
        setFreshLight(lightSensor?.last_value ?? null);
        
        // Set running/pending batches and fan/LED control states
        setHasRunningBatch(!!dryerData?.has_running_batch);
        setHasPendingBatch(!!dryerData?.has_pending_batch);
        setFanOn(!!dryerData?.has_fan_on);
        setLampOn(!!dryerData?.has_lamp_on);

        // Update power state from fetched data
        if (dryerData?.is_on !== undefined) {
          setLocalPowerOn(dryerData.is_on);
        }
      } catch (error) {
        console.error(`Failed to fetch fresh dryer data for ${machine.name}:`, error);
        // Use fallback values from machine object
        setFreshTemp(machine.temp);
        setFreshHumidity(machine.humidity);
      }
    };

    fetchFreshDryerData();
    
    // Optional: Poll for updates every 10 seconds
    const interval = setInterval(fetchFreshDryerData, 10000);
    return () => clearInterval(interval);
  }, [machine.id, machine.name]);

  // Handler for Master Power toggle - calls API to update dryer status
  const handlePowerToggle = async (newPowerState: boolean) => {
    try {
      setPowerLoading(true);
      const dryerId = Number(machine.id.replace(/^D/, ''));
      if (!dryerId) {
        toast.error("Không thể xác định ID máy");
        return;
      }

      // Call API to update dryer status - update both is_on and status
      await structureAPI.dryers.update(dryerId, {
        is_on: newPowerState,
        status: newPowerState ? "Idle" : "Stopped",
      });

      setLocalPowerOn(newPowerState);
      toast.success(newPowerState ? "Bật máy thành công" : "Tắt máy thành công");
      onToggle(machine.id);
    } catch (error) {
      console.error("Error updating dryer power status:", error);
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái máy");
      // Revert to previous state on error
      setLocalPowerOn(!newPowerState);
    } finally {
      setPowerLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-visible relative ${machine.status === "alert" ? "border-red-200" : "border-slate-200"}`}>
      {machine.status === "alert" && <div className="h-0.5 w-full bg-gradient-to-r from-red-400 to-orange-400 rounded-t-xl" />}

      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${machine.isOn ? "bg-slate-800" : "bg-slate-100"}`}>
            <Cpu size={16} className={machine.isOn ? "text-emerald-400" : "text-slate-400"} />
          </div>
          <div>
            <p className="text-slate-800" style={{ fontWeight: 700, fontSize: "0.875rem" }}>{machine.name}</p>
            <p className="text-slate-400" style={{ fontSize: "0.7rem" }}>{machine.fruit} Drying</p>
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-36">
              <button onClick={() => {setMenuOpen(false); onChangeName(machine.id, machine.name);}} className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 transition-all" style={{ fontSize: "0.8rem" }}>
                <Edit2 size={13} className="text-slate-400" /> Change Name
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(machine.id); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-red-500 hover:bg-red-50 transition-all" style={{ fontSize: "0.8rem" }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${s.bg} ${s.text}`} style={{ fontSize: "0.7rem", fontWeight: 600 }}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${machine.status === "alert" ? "animate-pulse" : ""}`} />
          {s.icon}
          {s.label}
        </span>
        {hasRunningBatch && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
            <Play size={10} className="fill-emerald-700 text-emerald-700" />
            Mẻ sấy đang chạy
          </span>
        )}
        {hasPendingBatch && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
            <Timer size={10} />
            Mẻ sấy chờ/lịch
          </span>
        )}
      </div>

      {/* Temperature & Humidity & Light Display - Only show if machine is not offline or if power is on */}
      {(machine.status !== "offline" || localPowerOn) && (
        <>
          <div className="px-4 pb-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-1 bg-orange-50 rounded-lg px-2.5 py-1.5 border border-orange-100">
              <Thermometer size={14} className="text-orange-500" />
              <span className="text-orange-700" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {(freshTemp !== null ? freshTemp : machine.temp).toFixed(1)}°C
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-100">
              <Droplets size={14} className="text-blue-500" />
              <span className="text-blue-700" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {(freshHumidity !== null ? freshHumidity : machine.humidity).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 bg-yellow-50 rounded-lg px-2.5 py-1.5 border border-yellow-100">
              <Sun size={14} className="text-yellow-500" />
              <span className="text-yellow-700" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {(freshLight !== null ? freshLight : 0).toFixed(0)} %
              </span>
            </div>
          </div>

          {/* Fan & LED Output States */}
          <div className="px-4 pb-3 flex items-center gap-3">
            <div className={`flex items-center gap-1.5 flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              fanOn 
                ? "bg-blue-50/70 text-blue-700 border-blue-100/50" 
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}>
              <Wind size={13} className={fanOn ? "text-blue-500 animate-spin shrink-0" : "shrink-0"} style={{ animationDuration: '3s' }} />
              <span className="truncate">Quạt: {fanOn ? "ON" : "OFF"}</span>
            </div>
            <div className={`flex items-center gap-1.5 flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              lampOn 
                ? "bg-amber-50/70 text-amber-700 border-amber-100/50" 
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}>
              <Lightbulb size={13} className={lampOn ? "text-amber-500 shrink-0" : "shrink-0"} />
              <span className="truncate">Đèn: {lampOn ? "ON" : "OFF"}</span>
            </div>
          </div>
        </>
      )}

      <div className="px-4 pb-3 flex items-center justify-between">
        {machine.status === "offline" ? (
          <>
            <div>
              <p className="text-slate-600" style={{ fontSize: "0.78rem", fontWeight: 600 }}>Master Power</p>
              <p className="text-slate-400" style={{ fontSize: "0.68rem" }}>Offline - Không khả dụng</p>
            </div>
            <ToggleSwitch checked={localPowerOn} onChange={handlePowerToggle} disabled={false} />
          </>
        ) : (
          <>
            <div>
              <p className="text-slate-600" style={{ fontSize: "0.78rem", fontWeight: 600 }}>Master Power</p>
              <p className="text-slate-400" style={{ fontSize: "0.68rem" }}>{localPowerOn ? `Active` : "Powered off"}</p>
            </div>
            <ToggleSwitch checked={localPowerOn} onChange={handlePowerToggle} disabled={powerLoading} />
          </>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-end bg-slate-50 rounded-b-xl">
        <button onClick={() => onViewDetails(machine.id)} className="flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700 transition-all" style={{ fontSize: "0.7rem", fontWeight: 600 }}>
          Details <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

function ZoneSection({ title, subtitle, machines, onToggle, onViewDetails, onDelete, onChangeName, show }: { title: string; subtitle: string; machines: Machine[]; onToggle: (id: string) => void; onViewDetails: (id: string) => void; onDelete: (id: string) => void; onChangeName: (id: string, currentName: string) => void; show: boolean }) {
  const runningCount = machines.filter((m) => m.status === "running").length;
  const idleCount = machines.filter((m) => m.status === "idle").length;
  const offlineCount = machines.filter((m) => m.status === "offline").length;
  if (!show) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>{title}</h2>
          <span className="px-2.5 py-0.5 bg-slate-100 rounded-full text-slate-500" style={{ fontSize: "0.72rem", fontWeight: 600 }}>{machines.length} Machines</span>
          {runningCount > 0 && <span className="px-2.5 py-0.5 bg-emerald-50 rounded-full text-emerald-700 border border-emerald-100" style={{ fontSize: "0.72rem", fontWeight: 600 }}>{runningCount} Active</span>}
          {idleCount > 0 && <span className="px-2.5 py-0.5 bg-yellow-50 rounded-full text-yellow-700 border border-yellow-100" style={{ fontSize: "0.72rem", fontWeight: 600 }}>{idleCount} Idle</span>}
          {offlineCount > 0 && <span className="px-2.5 py-0.5 bg-slate-100 rounded-full text-slate-500 border border-slate-200" style={{ fontSize: "0.72rem", fontWeight: 600 }}>{offlineCount} Offline</span>}
        </div>
        <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {machines.map((m) => <MachineCard key={m.id} machine={m} onToggle={onToggle} onViewDetails={onViewDetails} onDelete={onDelete} onChangeName={onChangeName} />)}
      </div>
    </div>
  );
}

export function DevicesManagement() {
  const navigate = useNavigate();

  const [zoneFilter, setZoneFilter] = useState<string>("all");


  const { data: areas } = useApiData<Area>(
    () => structureAPI.areas.list(),
    []
  );
  const {
    data: dryers,
    loading: loadingDryers,
    error: dryersError,
    refetch: refetchDryers,
  } = useConditionalApiData<DryerDetail>(
    zoneFilter
      ? () => structureAPI.dryers.list({
          area_id: zoneFilter === "all" ? undefined : Number(zoneFilter),
        })
      : null,
    [zoneFilter]
  );

  const { data: fruits, refetch: refetchFruits } = useApiData<Fruit>(
    () => catalogAPI.fruits.list(),
    []
  );

  // Add Fruit Type State inside DevicesManagement
  const isAdmin = useIsAdmin();
  const [showAddFruit, setShowAddFruit] = useState(false);
  const [newFruitName, setNewFruitName] = useState("");
  const [isAddingFruit, setIsAddingFruit] = useState(false);
  const [addFruitError, setAddFruitError] = useState("");

  const handleAddFruit = async () => {
    if (!newFruitName.trim()) {
      setAddFruitError("Fruit name is required");
      return;
    }
    try {
      setIsAddingFruit(true);
      setAddFruitError("");
      const response = await catalogAPI.fruits.create(newFruitName.trim());
      const result = response.data ?? response;
      if (result && (result.fruit_id || result.id)) {
        const fruitId = result.fruit_id || result.id;
        if (refetchFruits) {
          await refetchFruits();
        }
        setPatchForm((prev) => ({ ...prev, fruit_id: String(fruitId), recipe_id: "" }));
        setShowAddFruit(false);
        setNewFruitName("");
      } else {
        throw new Error("Failed to add fruit type");
      }
    } catch (err: any) {
      setAddFruitError(err.message || "Failed to add fruit type");
    } finally {
      setIsAddingFruit(false);
    }
  };

  const [showAddMachine, setShowAddMachine] = useState(false);
  const [newMachineName, setNewMachineName] = useState("");
  const [newMachineArea, setNewMachineArea] = useState<string>("");
  const [creatingMachine, setCreatingMachine] = useState(false);


  const [showNewPatch, setShowNewPatch] = useState(false);
  const [patchForm, setPatchForm] = useState({
    dry_id: "",
    fruit_id: "",
    recipe_id: "",
    operation_mode: "scheduled",
    schedule_type: "fixed",
    fixed_time: "08:00",
    recurring_interval: 8,
    threshold_enabled: false,
    is_customize: false,
  });
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchRecipes, setPatchRecipes] = useState<any[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Wizard state variables for Step-by-Step Batch Creation
  const [batchStep, setBatchStep] = useState(1);
  const [recipeSource, setRecipeSource] = useState<"existing" | "new">("existing");
  const [newRecipeName, setNewRecipeName] = useState("");
  const [modalPhases, setModalPhases] = useState<Array<{
    phase_order: number;
    duration: number; // in minutes
    temperature?: number | null;
    humidity?: number | null;
    actions?: Array<{
      control_id: number;
      action_type: 'activate' | 'deactivate';
    }>;
  }>>([
    { phase_order: 1, duration: 60, actions: [] },
  ]);
  const [selectedRecipePhases, setSelectedRecipePhases] = useState<any[]>([]);
  const [loadingRecipePhases, setLoadingRecipePhases] = useState(false);

  // New state variables for dryer details and threshold rule configurations
  const [selectedDryerDetails, setSelectedDryerDetails] = useState<any | null>(null);
  const [loadingDryerDetails, setLoadingDryerDetails] = useState(false);
  const [modalThresholdValues, setModalThresholdValues] = useState<Record<number, number | string>>({});
  const [modalThresholdOperators, setModalThresholdOperators] = useState<Record<number, string>>({});
  const [modalDraftActions, setModalDraftActions] = useState<Record<string, 'activate' | 'deactivate' | 'none'>>({});

  // Safety limits validation constants
  const POLICY_LIMITS = {
    minTemp: 30,
    maxTemp: 80,
    minHumidity: 10,
    maxHumidity: 90,
    maxPhases: 6,
    maxTotalDuration: 2880, // 48 hours in minutes
  };

  // Fetch recipes when fruit is selected in patch form
  useEffect(() => {
    if (patchForm.fruit_id) {
      const fetchRecipes = async () => {
        try {
          setLoadingRecipes(true);
          const result = await catalogAPI.recipes.list({ fruit_id: Number(patchForm.fruit_id), is_active: true });
          if (result.data && Array.isArray(result.data)) {
            setPatchRecipes(result.data);
          } else {
            console.log("No recipe data found");
            setPatchRecipes([]);
          }
        } catch (error) {
          console.error("Error fetching recipes:", error);
          setPatchRecipes([]);
        } finally {
          setLoadingRecipes(false);
        }
      };
      fetchRecipes();
    } else {
      setPatchRecipes([]);
    }
  }, [patchForm.fruit_id]);

  // Fetch selected dryer details when dry_id changes
  useEffect(() => {
    if (patchForm.dry_id) {
      const fetchSelectedDryerDetails = async () => {
        try {
          setLoadingDryerDetails(true);
          const response = await structureAPI.dryers.get(Number(patchForm.dry_id));
          setSelectedDryerDetails(response?.data ?? response ?? null);
        } catch (error) {
          console.error("Error fetching selected dryer details:", error);
          setSelectedDryerDetails(null);
        } finally {
          setLoadingDryerDetails(false);
        }
      };
      fetchSelectedDryerDetails();
    } else {
      setSelectedDryerDetails(null);
    }
  }, [patchForm.dry_id]);

  // Reset modal states when showNewPatch changes to false
  useEffect(() => {
    if (!showNewPatch) {
      setBatchStep(1);
      setRecipeSource("existing");
      setNewRecipeName("");
      setModalPhases([{ phase_order: 1, duration: 60, actions: [] }]);
      setModalThresholdValues({});
      setModalThresholdOperators({});
      setModalDraftActions({});
      setPatchForm({
        dry_id: "",
        fruit_id: "",
        recipe_id: "",
        operation_mode: "scheduled",
        schedule_type: "fixed",
        fixed_time: "08:00",
        recurring_interval: 8,
        threshold_enabled: false,
        is_customize: false,
      });
      setSelectedDryerDetails(null);
    }
  }, [showNewPatch]);

  // Fetch recipe phases when recipe is selected
  useEffect(() => {
    if (patchForm.recipe_id) {
      const fetchPhases = async () => {
        try {
          setLoadingRecipePhases(true);
          const result = await catalogAPI.recipes.get(Number(patchForm.recipe_id));
          const detail = result?.data || result;
          if (detail && Array.isArray(detail.phases)) {
            setSelectedRecipePhases(detail.phases);
            // Default populate modalPhases in case they customize
            setModalPhases(detail.phases.map((p: any) => ({
              phase_order: p.phase_order,
              duration: Math.round((p.duration_seconds || 0) / 60),
              temperature: p.temperature,
              humidity: p.humidity,
              actions: p.actions ? p.actions.map((a: any) => ({
                control_id: a.control_id,
                control_name: a.control_name,
                control_type: a.control_type,
                action_type: a.action_type
              })) : []
            })));
          }
        } catch (error) {
          console.error("Error fetching recipe phases:", error);
          setSelectedRecipePhases([]);
        } finally {
          setLoadingRecipePhases(false);
        }
      };
      fetchPhases();
    } else {
      setSelectedRecipePhases([]);
    }
  }, [patchForm.recipe_id]);

  // Synchronize modalPhases actions if the selected dryer changes
  useEffect(() => {
    if (selectedDryerDetails?.controls) {
      setModalPhases((prevPhases) => {
        let changed = false;
        const mapped = prevPhases.map((phase) => {
          if (!phase.actions || phase.actions.length === 0) return phase;

          const updatedActions = phase.actions.map((action: any) => {
            // Check if the current control_id already belongs to selectedDryerDetails
            const belongsToSelected = selectedDryerDetails.controls.some(
              (c: any) => c.control_id === action.control_id
            );
            if (belongsToSelected) return action;

            // Otherwise, find a match in the new dryer's controls
            let match = selectedDryerDetails.controls.find(
              (c: any) => c.control_type === action.control_type && c.control_name === action.control_name
            );
            if (!match) {
              match = selectedDryerDetails.controls.find(
                (c: any) => c.control_type === action.control_type
              );
            }
            if (match) {
              changed = true;
              return {
                ...action,
                control_id: match.control_id,
                control_name: match.control_name,
                control_type: match.control_type,
              };
            }
            changed = true;
            return null;
          }).filter(Boolean);

          // Deduplicate actions by control_id to prevent duplicates (keeping the latest one)
          const uniqueActions = [];
          const seenIds = new Set();
          for (let i = updatedActions.length - 1; i >= 0; i--) {
            const act = updatedActions[i];
            if (!seenIds.has(act.control_id)) {
              seenIds.add(act.control_id);
              uniqueActions.unshift(act);
            } else {
              changed = true; // We removed a duplicate
            }
          }

          return {
            ...phase,
            actions: uniqueActions,
          };
        });

        return changed ? mapped : prevPhases;
      });
    }
  }, [selectedDryerDetails]);

  // Reactive Safety Checks against Safety Policy Limits
  const activePhases = recipeSource === "new" || patchForm.is_customize
    ? modalPhases
    : selectedRecipePhases.map((p: any) => ({
        phase_order: p.phase_order,
        duration: Math.round((p.duration_seconds || 0) / 60),
        temperature: p.temperature,
        humidity: p.humidity,
        actions: p.actions ? p.actions.map((a: any) => ({
          control_id: a.control_id,
          action_type: a.action_type
        })) : []
      }));

  const validationChecks = {
    phasesLimit: activePhases.length > 0 && activePhases.length <= POLICY_LIMITS.maxPhases,
    durationLimit: activePhases.length > 0 && activePhases.reduce((sum, p) => sum + p.duration, 0) <= POLICY_LIMITS.maxTotalDuration,
  };

  const isRecipeValids = validationChecks.phasesLimit && validationChecks.durationLimit;

  const handleAddMachine = async () => {
    if (!newMachineName.trim()) {
      toast.error("Vui lòng nhập tên máy");
      return;
    }
    if (!newMachineArea) {
      toast.error("Vui lòng chọn khu vực");
      return;
    }
    try {
      setCreatingMachine(true);
      await structureAPI.dryers.create({ dry_name: newMachineName.trim(), area_id: Number(newMachineArea) });
      toast.success("Đã thêm máy sấy");
      setShowAddMachine(false);
      setNewMachineName("");
      setNewMachineArea("");
      refetchDryers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Thêm máy sấy thất bại");
    } finally {
      setCreatingMachine(false);
    }
  };

  const handleDeleteMachine = async (machineId: string) => {
    if (!confirm("Bạn có chắc muốn xóa máy này?")) return;
    const dryerId = Number(machineId.replace(/^[^0-9]*/, '')) || 0;
    if (!dryerId) {
      toast.error("ID máy không hợp lệ");
      return;
    }
    try {
      await structureAPI.dryers.delete(dryerId);
      toast.success("Đã xóa máy sấy");
      refetchDryers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa máy sấy thất bại");
    }
  };

  const handleChangeMachineName = async (machineId: string, currentName: string) => {
    const nextName = prompt("Nhập tên mới cho máy:", currentName)?.trim();
    if (!nextName || nextName === currentName.trim()) return;

    const dryerId = Number(machineId.replace(/^[^0-9]*/, "")) || 0;
    if (!dryerId) {
      toast.error("ID máy không hợp lệ");
      return;
    }

    try {
      await structureAPI.dryers.update(dryerId, { dry_name: nextName });
      toast.success("Đã đổi tên máy");
      refetchDryers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đổi tên máy thất bại");
    }
  };

  const handleViewDetails = (id: string) => {
    navigate(`/devices/${id}`);
  };

  const buildScheduledStartTime = (fixedTime: string) => {
    const [hourStr, minuteStr] = fixedTime.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    const now = new Date();
    const scheduled = new Date(now);
    scheduled.setHours(hour, minute, 0, 0);

    // If selected time already passed today, schedule for next day.
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    return scheduled.toISOString();
  };


  const handleNewPatch = async () => {
    if (!patchForm.dry_id || !patchForm.fruit_id) {
      toast.error("Vui lòng điền đầy đủ thông tin: Máy, Loại trái cây");
      return;
    }

    let finalRecipeId = Number(patchForm.recipe_id);

    // If creating a new recipe OR customizing an existing one, create a recipe entry first
    if (recipeSource === "new" || (recipeSource === "existing" && patchForm.is_customize)) {
      let customRecipeName = newRecipeName.trim();
      if (recipeSource === "existing" && patchForm.is_customize) {
        const originalRecipe = patchRecipes.find(r => Number(r.recipe_id) === Number(patchForm.recipe_id));
        customRecipeName = originalRecipe ? `${originalRecipe.recipe_name} (Customized)` : "Customized Recipe";
      }

      if (!customRecipeName) {
        toast.error("Vui lòng nhập tên công thức mới");
        return;
      }
      if (!isRecipeValids) {
        toast.error("Công thức vi phạm chính sách an toàn. Vui lòng kiểm tra lại các thông số.");
        return;
      }

      try {
        setPatchLoading(true);
        const recipeResult = await catalogAPI.recipes.create({
          recipe_name: customRecipeName,
          recipe_type: "custom",
          fruit_id: Number(patchForm.fruit_id),
          phases: modalPhases.map((p) => ({
            phase_order: p.phase_order,
            duration_seconds: p.duration * 60,
            temperature: p.temperature ?? null,
            humidity: p.humidity ?? null,
            actions: p.actions ? p.actions.map((a: any) => ({
              control_id: a.control_id,
              action_type: a.action_type
            })) : []
          }))
        });

        const resData = recipeResult?.data || recipeResult;
        if (resData?.recipe_id) {
          finalRecipeId = resData.recipe_id;
          toast.success("Tạo công thức mới thành công");
        } else {
          toast.error("Lỗi tạo công thức: " + (recipeResult.message || "Unknown error"));
          setPatchLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error creating recipe:", error);
        toast.error("Lỗi khi tạo công thức: " + (error instanceof Error ? error.message : "Unknown error"));
        setPatchLoading(false);
        return;
      }
    } else {
      if (!finalRecipeId) {
        toast.error("Vui lòng chọn công thức sấy");
        return;
      }
      if (!isRecipeValids) {
        toast.error("Công thức vi phạm chính sách an toàn. Vui lòng kiểm tra lại các thông số.");
        return;
      }
    }

    const scheduledStartTime =
      patchForm.operation_mode === "scheduled" && patchForm.schedule_type === "fixed"
        ? buildScheduledStartTime(patchForm.fixed_time)
        : null;

    if (
      patchForm.operation_mode === "scheduled" &&
      patchForm.schedule_type === "fixed" &&
      !scheduledStartTime
    ) {
      toast.error("Thời gian hẹn lịch không hợp lệ");
      setPatchLoading(false);
      return;
    }

    const recurringDelaySeconds =
      patchForm.operation_mode === "scheduled" && patchForm.schedule_type === "recurring"
        ? Number(patchForm.recurring_interval) * 60
        : null;

    try {
      setPatchLoading(true);
      const result = await apiRequest('POST', BATCH_ENDPOINTS.create, {
        dry_id: Number(patchForm.dry_id),
        fruit_id: Number(patchForm.fruit_id),
        recipe_id: finalRecipeId,
        operation_mode: patchForm.operation_mode,
        schedule_type: patchForm.operation_mode === "scheduled" ? patchForm.schedule_type : null,
        scheduled_start_time: scheduledStartTime,
        scheduled_delay_seconds: recurringDelaySeconds,
        threshold_enabled: patchForm.threshold_enabled,
        is_customize: patchForm.is_customize || recipeSource === "new",
      });

      if (result.status === 'success') {
        const batchId = result.data.batch_id;

        // If threshold_enabled is checked, save configured threshold rules
        if (patchForm.threshold_enabled && selectedDryerDetails?.sensors) {
          for (const sensor of selectedDryerDetails.sensors) {
            const val = modalThresholdValues[sensor.sensor_id];
            const op = modalThresholdOperators[sensor.sensor_id] ?? ">=";

            if (val !== undefined && val !== null && val !== "") {
              try {
                const numericVal = Number(val);
                // 1. Save threshold condition
                const condResponse = await batchAPI.saveThresholdCondition(batchId, {
                  sensor_id: sensor.sensor_id,
                  threshold_value: numericVal,
                  cp_operator: op
                });

                const conditionId = condResponse?.data?.condition_id ?? condResponse?.condition_id;
                if (conditionId) {
                  // 2. Gather actions configured for this sensor
                  const actions: Array<{ control_id: number; action_type: 'activate' | 'deactivate' }> = [];
                  sortedControls.forEach((control: any) => {
                    const actType = modalDraftActions[`${sensor.sensor_id}_${control.control_id}`];
                    if (actType === "activate" || actType === "deactivate") {
                      actions.push({ control_id: control.control_id, action_type: actType });
                    }
                  });

                  // 3. Save threshold actions
                  if (actions.length > 0) {
                    await batchAPI.saveThresholdActions(batchId, {
                      condition_id: conditionId,
                      actions
                    });
                  }
                }
              } catch (thresholdError) {
                console.error(`Error saving threshold for sensor ${sensor.sensor_id}:`, thresholdError);
                toast.warning(`Không thể lưu cấu hình threshold cho cảm biến ${sensor.sensor_type}`);
              }
            }
          }
        }

        toast.success(`Tạo mẻ sấy thành công (Batch ID: ${batchId})`);
        setShowNewPatch(false);
        setBatchStep(1);
        setRecipeSource("existing");
        setNewRecipeName("");
        setModalPhases([{ phase_order: 1, duration: 60, actions: [] }]);
        setModalThresholdValues({});
        setModalThresholdOperators({});
        setModalDraftActions({});
        setPatchForm({
          dry_id: "",
          fruit_id: "",
          recipe_id: "",
          operation_mode: "scheduled",
          schedule_type: "fixed",
          fixed_time: "08:00",
          recurring_interval: 8,
          threshold_enabled: false,
          is_customize: false,
        });
        refetchDryers();
      } else {
        toast.error("Lỗi tạo mẻ sấy: " + (result.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error creating patch:", error);
      toast.error("Lỗi khi tạo mẻ sấy: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setPatchLoading(false);
    }
  };
  const sortedControls = selectedDryerDetails
    ? [...(selectedDryerDetails.controls ?? [])].sort((a, b) => {
        const typeRank = (type: string) => (type === "fan" ? 0 : type === "lamp" ? 1 : 2);
        const rankDiff = typeRank(a.control_type) - typeRank(b.control_type);
        if (rankDiff !== 0) return rankDiff;
        return a.control_id - b.control_id;
      })
    : [];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1.25rem" }}>Device Management</h1>
            <p className="text-slate-400" style={{ fontSize: "0.8rem" }}>Monitor, configure and control all drying machines across factory zones</p>
          </div>
          <div className="flex items-center gap-3">

            {/* Zone Filter */}
            <div className="relative flex items-center">
              <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="appearance-none bg-white border border-slate-200 text-slate-700 rounded-lg pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 cursor-pointer hover:border-slate-300 transition-all" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                <option value="all">All Zones</option>
                {areas.map((area) => (
                  <option key={area.area_id} value={area.area_id}>
                    {area.area_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={() => setShowAddMachine(true)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-150">
              <Plus size={16} /> <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Add New Machine</span>
            </button>
            <button onClick={() => setShowNewPatch(true)} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-150">
              <Plus size={16} /> <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>New Batch</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Machines", value: dryers.length || 0, color: "text-slate-800", bg: "bg-white" },
            { label: "Active / Running", value: dryers.filter((m) => m.status === "Running").length, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Machines Idle", value: dryers.filter((m) => m.status === "Idle").length, color: "text-yellow-600", bg: "bg-yellow-50" },
          ].map((item) => (
            <div key={item.label} className={`${item.bg} rounded-xl border border-slate-200 px-5 py-3.5 flex items-center justify-between shadow-sm`}>
              <span className="text-slate-500" style={{ fontSize: "0.8125rem" }}>{item.label}</span>
              <span className={`${item.color}`} style={{ fontWeight: 800, fontSize: "1.5rem" }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Errors */}
        {(dryersError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p style={{ fontWeight: 700, fontSize: "0.875rem" }}>Không tải được dữ liệu thiết bị</p>
              <p style={{ fontSize: "0.78rem" }}>{dryersError}</p>
            </div>
            <button onClick={() => refetchDryers()} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
              Thử lại
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loadingDryers && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 bg-slate-200 rounded" />
                    <div className="h-2.5 w-1/3 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-slate-100 rounded-full" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 bg-slate-100 rounded-lg" />
                  <div className="h-12 bg-slate-100 rounded-lg" />
                </div>
                <div className="h-8 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loadingDryers && !dryersError && dryers.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            Không có máy sấy nào {zoneFilter !== "all" ? "trong khu vực đã chọn" : "tại nhà máy này"}.
          </div>
        )}

        {/* Dryer list from API */}
        {!loadingDryers && !dryersError && dryers.length > 0 && (
          <ZoneSection
            title={`Dryers${zoneFilter !== "all" ? ` in ${areas.find(a => a.area_id === Number(zoneFilter))?.area_name || "selected zone"}` : ""}`}
            subtitle="Real-time dryer data from API"
            machines={dryers.map((d) => convertDryerToMachine(d)).filter((m): m is Machine => m !== null)}
            onToggle={() => refetchDryers()}
            onViewDetails={handleViewDetails}
            onDelete={handleDeleteMachine}
            onChangeName={handleChangeMachineName}
            show={true}
          />
        )}

        {/* Add Machine Modal */}
        {showAddMachine && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-800" style={{ fontWeight: 700 }}>Add New Machine</h3>
                <button onClick={() => setShowAddMachine(false)} className="text-slate-500">Close</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Machine Name</label>
                  <input value={newMachineName} onChange={(e) => setNewMachineName(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zone</label>
                  <select value={newMachineArea} onChange={(e) => setNewMachineArea(e.target.value)} className="w-full px-3 py-2 border rounded">
                    <option value="">Chọn khu vực...</option>
                    {areas.map((area) => (
                      <option key={area.area_id} value={area.area_id}>
                        {area.area_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowAddMachine(false)} className="px-3 py-2 border rounded">Cancel</button>
                  <button onClick={handleAddMachine} disabled={creatingMachine} className={`px-3 py-2 text-white rounded ${creatingMachine ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                    {creatingMachine ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Patch Modal */}
        {showNewPatch && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="text-emerald-500" size={18} />
                  <h3 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1.05rem" }}>Create New Batch</h3>
                </div>
                <button onClick={() => { setShowNewPatch(false); setBatchStep(1); }} className="text-slate-400 hover:text-slate-600 transition-colors">Close</button>
              </div>

              {/* Steps Progress Indicator */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-center gap-4">
                {[
                  { num: 1, label: "Selection" },
                  { num: 2, label: "Recipe" },
                  { num: 3, label: "Validation" }
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${batchStep === s.num ? 'bg-emerald-500 text-white ring-4 ring-emerald-100' : batchStep > s.num ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {s.num}
                    </span>
                    <span className={`text-xs font-semibold ${batchStep === s.num ? 'text-slate-800' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                    {s.num < 3 && <ChevronRight size={14} className="text-slate-300" />}
                  </div>
                ))}
              </div>

              {/* Step Content Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {batchStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Machine (Dryer)</label>
                      <select value={patchForm.dry_id} onChange={(e) => setPatchForm({ ...patchForm, dry_id: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 cursor-pointer text-slate-700 font-medium transition-all">
                        <option value="">Select machine</option>
                        {dryers.map((m) => <option key={m.dry_id} value={m.dry_id}>{m.dry_name} ({m.status})</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Fruit</label>
                        {isAdmin && !showAddFruit && (
                          <button
                            type="button"
                            onClick={() => setShowAddFruit(true)}
                            className="text-xs font-bold text-emerald-650 hover:text-emerald-700 flex items-center gap-1 transition-all"
                          >
                            <Plus size={11} /> Add Fruit
                          </button>
                        )}
                      </div>

                      {showAddFruit && (
                        <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2" style={{ animation: "fadeIn 0.15s ease" }}>
                          <span className="block text-xs font-bold text-slate-700">New Fruit Type</span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. Avocado"
                              value={newFruitName}
                              onChange={(e) => { setNewFruitName(e.target.value); setAddFruitError(""); }}
                              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all text-slate-800"
                              disabled={isAddingFruit}
                            />
                            <button
                              type="button"
                              onClick={handleAddFruit}
                              disabled={isAddingFruit}
                              className="px-2.5 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white rounded-lg font-bold flex items-center justify-center transition-all min-w-[50px]"
                            >
                              {isAddingFruit ? <Loader2 size={11} className="animate-spin" /> : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAddFruit(false); setNewFruitName(""); setAddFruitError(""); }}
                              disabled={isAddingFruit}
                              className="px-2.5 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                          {addFruitError && (
                            <p className="flex items-center gap-1 text-red-500 text-[10px]" style={{ fontSize: "10px" }}>
                              <AlertCircle size={10} />{addFruitError}
                            </p>
                          )}
                        </div>
                      )}

                      <select value={patchForm.fruit_id} onChange={(e) => setPatchForm({ ...patchForm, fruit_id: e.target.value, recipe_id: "" })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 cursor-pointer text-slate-700 font-medium transition-all">
                        <option value="">Select fruit</option>
                        {fruits.map((f) => <option key={f.fruit_id} value={f.fruit_id}>{f.fruit_name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {batchStep === 2 && (
                  <div className="space-y-4">
                    {/* Recipe Source Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button type="button" onClick={() => setRecipeSource("existing")} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${recipeSource === "existing" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                        Select Existing Recipe
                      </button>
                      <button type="button" onClick={() => setRecipeSource("new")} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${recipeSource === "new" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                        Create Custom Recipe
                      </button>
                    </div>

                    {recipeSource === "existing" ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recipe</label>
                          <select value={patchForm.recipe_id} onChange={(e) => setPatchForm({ ...patchForm, recipe_id: e.target.value })} disabled={loadingRecipes || patchRecipes.length === 0} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 cursor-pointer text-slate-700 font-medium transition-all disabled:bg-slate-100 disabled:cursor-not-allowed">
                            <option value="">{loadingRecipes ? "Loading recipes..." : patchRecipes.length === 0 ? "No recipes for selected fruit" : "Select recipe"}</option>
                            {patchRecipes.map((recipe) => (
                              <option key={recipe.recipe_id} value={recipe.recipe_id}>
                                {recipe.recipe_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {patchForm.recipe_id && (
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="is_customize" checked={patchForm.is_customize} onChange={(e) => setPatchForm({ ...patchForm, is_customize: e.target.checked })} className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-400" />
                            <label htmlFor="is_customize" className="text-xs font-bold text-slate-600 cursor-pointer">Customize Recipe Phases</label>
                          </div>
                        )}

                        {patchForm.recipe_id && !patchForm.is_customize && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                            <span className="text-xs font-bold text-slate-500 block uppercase">Recipe Phases Preview</span>
                            {loadingRecipePhases ? (
                              <p className="text-xs text-slate-400">Loading phases...</p>
                            ) : selectedRecipePhases.length === 0 ? (
                              <p className="text-xs text-slate-400">No phases configured for this recipe</p>
                            ) : (
                              <div className="space-y-1.5">
                                {selectedRecipePhases.map((p, idx) => {
                                  // Map actions to selected dryer controls to show accurate preview and deduplicate
                                  const mappedPreviewActions = p.actions && selectedDryerDetails?.controls
                                    ? p.actions.map((a: any) => {
                                        const match = selectedDryerDetails.controls.find(
                                          (c: any) => c.control_id === a.control_id
                                        ) || selectedDryerDetails.controls.find(
                                          (c: any) => c.control_type === a.control_type && c.control_name === a.control_name
                                        ) || selectedDryerDetails.controls.find(
                                          (c: any) => c.control_type === a.control_type
                                        );
                                        return match ? { ...a, control_name: match.control_name, control_id: match.control_id } : null;
                                      }).filter(Boolean)
                                    : p.actions || [];

                                  // Filter to unique control device ids to prevent duplicate display rows
                                  const uniqueActions = [];
                                  const seenIds = new Set();
                                  for (const act of mappedPreviewActions) {
                                    if (!seenIds.has(act.control_id)) {
                                      seenIds.add(act.control_id);
                                      uniqueActions.push(act);
                                    }
                                  }

                                  const actionsList = uniqueActions.length > 0
                                    ? uniqueActions.map((a: any) => `${a.control_name ?? a.control_type}: ${a.action_type === 'activate' ? 'ON' : 'OFF'}`).join(', ')
                                    : 'No actions';
                                  return (
                                    <div key={idx} className="flex justify-between items-start text-xs text-slate-700 py-1 border-b border-slate-100 last:border-b-0">
                                      <span className="font-semibold shrink-0">Phase {p.phase_order}</span>
                                      <div className="text-right">
                                        <div>{Math.round((p.duration_seconds || 0) / 60)} mins</div>
                                        <div className="text-[10px] text-slate-400">{actionsList}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Recipe Name</label>
                          <input type="text" placeholder="e.g. Mango Premium Recipe" value={newRecipeName} onChange={(e) => setNewRecipeName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all text-slate-700 font-semibold" />
                        </div>
                      </div>
                    )}

                    {/* Phase Editor for New or Customized Recipes */}
                    {(recipeSource === "new" || (recipeSource === "existing" && patchForm.is_customize)) && (
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Drying Phases</span>
                          <button type="button" onClick={() => setModalPhases([...modalPhases, { phase_order: modalPhases.length + 1, duration: 60, actions: [] }])} className="flex items-center gap-1 text-xs text-emerald-600 font-bold hover:text-emerald-700 transition-all">
                            <Plus size={14} /> Add Phase
                          </button>
                        </div>

                        <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                          {modalPhases.map((phase, idx) => (
                            <div key={idx} className="p-3 border border-slate-200 bg-slate-50/50 rounded-xl relative flex flex-wrap gap-3 items-center">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                              <div className="flex-1 min-w-[70px]">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Min</label>
                                <input type="number" min={1} value={phase.duration} onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setModalPhases(modalPhases.map((p, i) => i === idx ? { ...p, duration: val } : p));
                                }} className="w-full bg-white border border-slate-200 px-2 py-1 rounded text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-400" />
                              </div>
                              {loadingDryerDetails ? (
                                <div className="w-full text-center text-xs text-slate-400 py-2">
                                  Loading output devices...
                                </div>
                              ) : selectedDryerDetails?.controls && selectedDryerDetails.controls.length > 0 ? (
                                <div className="w-full mt-2 pt-2 border-t border-slate-200 flex flex-col gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device Actions</span>
                                  <div className="grid grid-cols-2 gap-2">
                                    {selectedDryerDetails.controls.map((control: any) => {
                                      const action = phase.actions?.find((a: any) => a.control_id === control.control_id);
                                      const value = action ? action.action_type : "none";
                                      return (
                                        <div key={control.control_id} className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-white border border-slate-200">
                                          <span className="text-[10px] font-semibold text-slate-600 truncate">{control.control_name}</span>
                                          <select
                                            value={value}
                                            onChange={(e) => {
                                              const actType = e.target.value;
                                              let updatedActions = phase.actions ? [...phase.actions] : [];
                                              if (actType === "none") {
                                                updatedActions = updatedActions.filter((a: any) => a.control_id !== control.control_id);
                                              } else {
                                                const existingIdx = updatedActions.findIndex((a: any) => a.control_id === control.control_id);
                                                const newAction = { 
                                                  control_id: control.control_id, 
                                                  control_name: control.control_name,
                                                  control_type: control.control_type,
                                                  action_type: actType as 'activate' | 'deactivate' 
                                                };
                                                if (existingIdx > -1) {
                                                  updatedActions[existingIdx] = newAction;
                                                } else {
                                                  updatedActions.push(newAction);
                                                }
                                              }
                                              setModalPhases(modalPhases.map((p, i) => i === idx ? { ...p, actions: updatedActions } : p));
                                            }}
                                            className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none text-slate-700 focus:border-emerald-500 cursor-pointer"
                                          >
                                            <option value="none">None</option>
                                            <option value="activate">ON</option>
                                            <option value="deactivate">OFF</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                              {modalPhases.length > 1 && (
                                <button type="button" onClick={() => setModalPhases(modalPhases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, phase_order: i + 1 })))} className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {batchStep === 3 && (
                  <div className="space-y-4">
                    {/* Schedule options */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Operation Mode</label>
                        <select value={patchForm.operation_mode} onChange={(e) => setPatchForm({ ...patchForm, operation_mode: e.target.value, schedule_type: e.target.value === "scheduled" ? patchForm.schedule_type : "fixed" })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 text-slate-700 font-semibold transition-all">
                          <option value="scheduled">Scheduled</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>

                      {patchForm.operation_mode === "scheduled" && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Schedule Type</label>
                          <select value={patchForm.schedule_type} onChange={(e) => setPatchForm({ ...patchForm, schedule_type: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 text-slate-700 font-semibold transition-all">
                            <option value="fixed">Fixed time</option>
                            <option value="recurring">Recurring</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {patchForm.operation_mode === "scheduled" && (
                      <div className="p-3 border border-slate-100 bg-slate-50/50 rounded-xl">
                        {patchForm.schedule_type === "fixed" ? (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fixed Time</label>
                            <input type="time" value={patchForm.fixed_time} onChange={(e) => setPatchForm({ ...patchForm, fixed_time: e.target.value })} className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-400" />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recurring Interval</label>
                            <div className="flex items-center gap-2">
                              <input type="number" min={1} max={1440} value={patchForm.recurring_interval} onChange={(e) => setPatchForm({ ...patchForm, recurring_interval: Number(e.target.value) })} className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-400" />
                              <span className="text-xs text-slate-500 font-bold">minutes</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="threshold_enabled" checked={patchForm.threshold_enabled} onChange={(e) => setPatchForm({ ...patchForm, threshold_enabled: e.target.checked })} className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-400" />
                      <label htmlFor="threshold_enabled" className="text-xs font-bold text-slate-600 cursor-pointer">Enable Threshold-based Automation</label>
                    </div>

                    {/* Editable Threshold Configuration Grid */}
                    {patchForm.threshold_enabled && (
                      <div className="space-y-3 pt-2 border-t border-slate-150">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Configure Threshold Rules</span>
                        
                        {loadingDryerDetails ? (
                          <div className="text-center py-4 text-xs text-slate-400">
                            Loading sensors and controls...
                          </div>
                        ) : selectedDryerDetails?.sensors && selectedDryerDetails.sensors.length > 0 ? (
                          <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                            {selectedDryerDetails.sensors.map((sensor: any) => {
                              const unit = sensor.sensor_type === "temperature" ? "°C" : "%";
                              const currentOp = modalThresholdOperators[sensor.sensor_id] ?? ">=";
                              const currentValue = modalThresholdValues[sensor.sensor_id] ?? "";

                              // Build preview actions
                              const activeActionsList = sortedControls
                                .map((c: any) => {
                                  const act = modalDraftActions[`${sensor.sensor_id}_${c.control_id}`];
                                  if (act === "activate") return `${c.control_name} ➔ ON`;
                                  if (act === "deactivate") return `${c.control_name} ➔ OFF`;
                                  return null;
                                })
                                .filter(Boolean);
                              const actionDesc = activeActionsList.length > 0 ? activeActionsList.join(", ") : "No actions";

                              return (
                                <div key={sensor.sensor_id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <div className={"p-1.5 rounded-lg " + (
                                        sensor.sensor_type === "temperature" ? "bg-orange-500/10 text-orange-600" :
                                        sensor.sensor_type === "humidity" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                                      )}>
                                        {sensor.sensor_type === "temperature" ? (
                                          <Thermometer size={16} />
                                        ) : sensor.sensor_type === "humidity" ? (
                                          <Droplets size={16} />
                                        ) : (
                                          <Sun size={16} />
                                        )}
                                      </div>
                                      <span className="text-xs font-bold text-slate-700 capitalize">
                                        {sensor.sensor_type} Sensor
                                      </span>
                                    </div>

                                    {/* Op & Value inputs */}
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={currentOp}
                                        onChange={(e) => setModalThresholdOperators({...modalThresholdOperators, [sensor.sensor_id]: e.target.value})}
                                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-slate-700 focus:border-emerald-500 cursor-pointer"
                                      >
                                        <option value=">=">≥</option>
                                        <option value="<=">≤</option>
                                      </select>
                                      <div className="relative w-24">
                                        <input
                                          type="number"
                                          value={currentValue}
                                          onChange={(e) => setModalThresholdValues({...modalThresholdValues, [sensor.sensor_id]: e.target.value})}
                                          placeholder="Limit"
                                          className="w-full pl-2 pr-6 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-slate-700 focus:border-emerald-500"
                                          step={sensor.sensor_type === "temperature" ? "0.1" : "1"}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold select-none pointer-events-none">
                                          {unit}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Actions Config */}
                                  <div className="pt-2.5 border-t border-slate-200/60">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Trigger Actions</span>
                                    <div className="grid grid-cols-2 gap-2">
                                      {sortedControls.map((control: any) => {
                                        const actionKey = `${sensor.sensor_id}_${control.control_id}`;
                                        const currentAction = modalDraftActions[actionKey] ?? "none";
                                        return (
                                          <div key={control.control_id} className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-white border border-slate-200">
                                            <span className="text-[10px] font-semibold text-slate-600 truncate">{control.control_name}</span>
                                            <select
                                              value={currentAction}
                                              onChange={(e) => setModalDraftActions({ ...modalDraftActions, [actionKey]: e.target.value as any })}
                                              className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none text-slate-700 focus:border-emerald-500 cursor-pointer"
                                            >
                                              <option value="none">None</option>
                                              <option value="activate">ON</option>
                                              <option value="deactivate">OFF</option>
                                            </select>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Logic Preview */}
                                  <div className="text-[10px] text-slate-500 italic bg-white/50 p-1.5 rounded border border-slate-100 mt-1.5">
                                    Logic: If {sensor.sensor_type} {currentOp} {currentValue || "?"}{unit} ➔ {actionDesc}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-xs text-slate-400">
                            No sensors available for this machine.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Policy Verification Panel */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <Shield className="text-emerald-500" size={16} />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Safety Policy Verification</span>
                      </div>

                      <div className="space-y-2">
                        {[
                          { key: 'phasesLimit', label: `Phases Limit: Max ${POLICY_LIMITS.maxPhases}`, valid: validationChecks.phasesLimit },
                          { key: 'durationLimit', label: `Total Time: Max ${POLICY_LIMITS.maxTotalDuration / 60} hours`, valid: validationChecks.durationLimit }
                        ].map((rule) => (
                          <div key={rule.key} className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-medium">{rule.label}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${rule.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              {rule.valid ? (
                                <>
                                  <CheckCircle size={10} /> Valid
                                </>
                              ) : (
                                <>
                                  <AlertTriangle size={10} /> Invalid
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>

                      {!isRecipeValids && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-700 text-xs font-semibold">
                          ⚠️ Warning: The selected/custom recipe violates the factory safety policy. Adjust the values or phases before proceeding.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                {batchStep > 1 ? (
                  <button type="button" onClick={() => setBatchStep(batchStep - 1)} className="flex items-center gap-1.5 text-xs text-slate-600 font-bold hover:text-slate-800 transition-all">
                    <ChevronLeft size={16} /> Back
                  </button>
                ) : (
                  <button type="button" onClick={() => { setShowNewPatch(false); setBatchStep(1); }} className="px-4 py-2 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all">
                    Cancel
                  </button>
                )}

                {batchStep < 3 ? (
                  <button type="button" onClick={() => {
                    if (batchStep === 1 && (!patchForm.dry_id || !patchForm.fruit_id)) {
                      toast.error("Vui lòng chọn máy và loại trái cây");
                      return;
                    }
                    if (batchStep === 2 && recipeSource === "existing" && !patchForm.recipe_id) {
                      toast.error("Vui lòng chọn công thức sấy");
                      return;
                    }
                    if (batchStep === 2 && recipeSource === "new" && !newRecipeName.trim()) {
                      toast.error("Vui lòng nhập tên công thức mới");
                      return;
                    }
                    setBatchStep(batchStep + 1);
                  }} className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all">
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  <button type="button" onClick={handleNewPatch} disabled={patchLoading || !isRecipeValids} className={`px-4 py-2 text-white rounded-lg text-xs font-bold shadow-sm transition-all ${patchLoading || !isRecipeValids ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                    {patchLoading ? "Creating..." : "Create Batch"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
