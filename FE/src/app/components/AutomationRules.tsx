import { useState, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Thermometer,
  Sun,
  Droplets,
  Wind,
  Flame,
  Save,
  Plus,
  Clock,
  CheckCircle2,
  Cpu,
  Layers,
  Calendar,
  Zap,
  Trash2,
  Apple,
  Edit2,
  Copy,
  ArrowRight,
  Timer,
  Settings2,
  Target,
  Hand,
  Gauge,
  Shield,
  Loader2,
  Lightbulb,
  X,
  ChevronLeft,
  AlertCircle,
  Check,
  BookOpen,
  Sliders,
} from "lucide-react";
import { catalogAPI, structureAPI } from "../config/api.config";
import { usePermission } from "../../hooks/usePermission";
import { Permission } from "../../types/rbac";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DryingPhase {
  id: string;
  name: string;
  duration: number; // in hours
  actions: Action[];
}

interface Action {
  action_id: number;
  action_type: "activate" | "deactivate";
  control_id: number;
  control_type: string;
  start_offset_seconds: number;
}

type ControlMode = "manual" | "threshold" | "time";

interface TimeSchedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
}

interface FruitRecipe {
  id: string;
  name: string;
  phases: DryingPhase[];
  totalTime: number;
  schedules: TimeSchedule[];
  scheduleType: "fixed" | "recurring";
  fixedTime?: string;
  recurringInterval?: number;
  recipe_id?: number;
  fruit_id?: number;
  fruit_name?: string;
}

interface FruitOption {
  fruit_id: number;
  fruit_name: string;
}

interface ControlDevice {
  control_id: number;
  control_name: string;
  control_type: string;
  dry_id: number;
}

interface CreateRecipePhase {
  id: string;
  name: string;
  durationMinutes: number;
  fanEnabled: boolean;
  fanControlId: number | null;
  lampEnabled: boolean;
  lampControlId: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function transformApiPhases(phases: any[]): DryingPhase[] {
  return (phases || []).map((phase: any, index: number) => ({
    id: String(phase.phase_id || index),
    name: `Phase ${phase.phase_order || index + 1}`,
    duration: phase.duration_seconds ? phase.duration_seconds / 3600 : 0,
    actions: phase.actions || [],
  }));
}

// ─── FruitSelector ────────────────────────────────────────────────────────────

function FruitSelector({
  selected,
  onSelect,
  search,
  onSearch,
  recipes = [],
  onCreateNew,
}: {
  selected: string | null;
  onSelect: (recipeId: string) => void;
  search: string;
  onSearch: (s: string) => void;
  recipes: FruitRecipe[];
  onCreateNew: () => void;
}) {
  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <Apple size={15} className="text-emerald-500" />
          <h2 className="text-slate-800" style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
            Recipes
          </h2>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
            style={{ fontSize: "0.78rem" }}
          />
        </div>
      </div>

      {/* Recipe List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {filtered.length > 0 && (
          <div>
            <div className="px-2 py-1 mb-1">
              <span className="text-slate-400" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em" }}>
                ALL RECIPES ({filtered.length})
              </span>
            </div>
            <div className="space-y-0.5">
              {filtered.map((fruit) => (
                <button
                  key={fruit.id}
                  onClick={() => onSelect(String(fruit.recipe_id))}
                  className={`w-full flex items-start justify-between px-3 py-2.5 rounded-lg transition-all ${
                    selected === String(fruit.recipe_id)
                      ? "bg-emerald-500 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <Apple size={14} className={`mt-0.5 shrink-0 ${selected === String(fruit.recipe_id) ? "text-white" : "text-emerald-500"}`} />
                    <div className="flex flex-col items-start min-w-0 text-left">
                      <span className="truncate" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{fruit.name}</span>
                      {fruit.fruit_name && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 font-bold border transition-all truncate max-w-full ${
                          selected === String(fruit.recipe_id)
                            ? "bg-white/20 text-white border-white/30"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        }`}>
                          {fruit.fruit_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded shrink-0 ml-2 mt-0.5 ${
                      selected === String(fruit.recipe_id) ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {fruit.phases?.length ?? 0}p
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Apple size={32} className="mx-auto mb-2 opacity-30" />
            <p style={{ fontSize: "0.78rem" }}>No recipes found</p>
          </div>
        )}
      </div>

      {/* Add New Recipe */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
          style={{ fontSize: "0.78rem", fontWeight: 600 }}
        >
          <Plus size={13} />
          Create New Recipe
        </button>
      </div>
    </div>
  );
}

// ─── RecipeEditor ─────────────────────────────────────────────────────────────

function RecipeEditor({
  recipe,
  recipeData,
  onDeleted,
}: {
  recipe: FruitRecipe;
  recipeData?: any;
  onDeleted?: () => void;
}) {
  const [phases, setPhases] = useState<DryingPhase[]>(
    recipeData?.phases && recipeData.phases.length > 0 ? recipeData.phases : recipe.phases
  );
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [controls, setControls] = useState<any[]>([]);

  useEffect(() => {
    const fetchControls = async () => {
      try {
        const res = await structureAPI.controls.list();
        setControls(res.data ?? res ?? []);
      } catch (err) {
        console.error("Error fetching controls:", err);
      }
    };
    fetchControls();
  }, []);

  const canDeleteRecipePhase = usePermission(Permission.DELETE_RECIPE_PHASE);
  const canAddRecipePhase = usePermission(Permission.ADD_RECIPE_PHASE);
  const canManageRecipes = usePermission(Permission.MANAGE_RECIPES);

  const handleDeleteRecipe = async () => {
    if (!recipe.recipe_id) return;
    if (!window.confirm(`Are you sure you want to delete the recipe "${recipe.name}"?`)) {
      return;
    }
    try {
      setIsSaving(true);
      const res = await catalogAPI.recipes.delete(recipe.recipe_id);
      alert(res.message || "Recipe deleted successfully.");
      if (onDeleted) {
        onDeleted();
      }
    } catch (err: any) {
      console.error("Error deleting recipe:", err);
      alert(err?.message || "Failed to delete recipe.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (recipeData?.phases && recipeData.phases.length > 0) {
      setPhases(recipeData.phases);
    }
  }, [recipeData]);

  const handlePhaseChange = (
    phaseId: string,
    field: keyof DryingPhase,
    value: string | number | string[] | Action[],
  ) => {
    setPhases((prev) =>
      prev.map((p) => (p.id === phaseId ? { ...p, [field]: value } : p))
    );
  };

  const updateActionByControlType = (
    phase: DryingPhase,
    controlType: string,
    updates: Partial<Action>
  ): Action[] => {
    const existingAction = phase.actions.find((a) => a.control_type === controlType);
    if (existingAction) {
      return phase.actions.map((a) =>
        a.control_type === controlType ? { ...a, ...updates } : a
      );
    }
    if (updates.action_type === "activate") {
      return [
        ...phase.actions,
        {
          action_id: 0,
          action_type: "activate",
          control_id: 0,
          control_type: controlType,
          start_offset_seconds: 0,
          ...updates,
        },
      ];
    }
    return phase.actions;
  };

  const handleAddPhase = () => {
    const newPhase: DryingPhase = {
      id: `p${phases.length + 1}`,
      name: `Phase ${phases.length + 1}`,
      duration: 2,
      actions: [],
    };
    setPhases([...phases, newPhase]);
  };

  const handleDeletePhase = (phaseId: string) => {
    if (phases.length > 1) {
      setPhases((prev) => prev.filter((p) => p.id !== phaseId));
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (recipe.recipe_id) {
        const fanControl = controls.find((c) => c.control_type === "fan");
        const lampControl = controls.find((c) => c.control_type === "lamp");
        const defaultFanId = fanControl?.control_id ?? 0;
        const defaultLampId = lampControl?.control_id ?? 0;

        const payloadPhases = phases.map((p) => {
          const mappedActions = p.actions.map((a) => {
            let cid = a.control_id;
            if (!cid || cid === 0) {
              cid = a.control_type === "fan" ? defaultFanId : defaultLampId;
            }
            return {
              action_type: a.action_type,
              control_id: cid,
              start_offset_seconds: a.start_offset_seconds || 0,
              duration_seconds: a.duration_seconds || null,
            };
          });

          return {
            phase_order: phases.indexOf(p) + 1,
            duration_seconds: p.duration * 3600,
            humidity: null,
            temperature: null,
            light: null,
            actions: mappedActions,
          };
        });

        await catalogAPI.recipes.updatePhases(recipe.recipe_id, payloadPhases);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Error saving recipe:", error);
      alert("Error saving recipe. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalTime = phases.reduce((sum, p) => sum + p.duration, 0);

  return (
    <div className="space-y-5">
      {/* Recipe Overview */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-4 border border-emerald-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Apple size={16} className="text-emerald-600" />
              <h3 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
                {recipe.name}
              </h3>
              {recipe.fruit_name && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  {recipe.fruit_name}
                </span>
              )}
            </div>
            <p className="text-slate-600" style={{ fontSize: "0.78rem" }}>
              Multi-phase drying process with automated device control
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <span className="px-3 py-1 bg-white rounded-lg text-emerald-600 border border-emerald-200" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                {phases.length} Phases
              </span>
              <span className="text-slate-500" style={{ fontSize: "0.72rem" }}>
                Total: {totalTime.toFixed(1)}h
              </span>
            </div>
            {canManageRecipes && (
              <button
                onClick={handleDeleteRecipe}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontSize: "0.78rem", fontWeight: 600 }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Phase Flow Diagram */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Timer size={14} className="text-slate-400" />
          <span className="text-slate-700" style={{ fontWeight: 700, fontSize: "0.875rem" }}>
            Process Flow
          </span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center ml-auto gap-2 px-4 py-2 rounded-lg shadow-sm transition-all ${
              isSaving
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : saved
                ? "bg-emerald-500 text-white"
                : "bg-emerald-500 hover:bg-emerald-600 text-white"
            }`}
            style={{ fontSize: "0.8125rem", fontWeight: 600 }}
          >
            {isSaving ? (
              <><Loader2 size={14} className="animate-spin" />Saving...</>
            ) : saved ? (
              <><CheckCircle2 size={14} />Saved!</>
            ) : (
              <><Save size={14} />Save Recipe</>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {phases.map((phase, idx) => (
            <div key={phase.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center min-w-[130px]">
                <div className="w-full bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                  <div className="text-center mb-2">
                    <span className="text-slate-800" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                      {phase.name}
                    </span>
                  </div>
                  {/* Device icons */}
                  <div className="flex items-center justify-center gap-2 mb-2 min-h-[24px]">
                    {phase.actions && phase.actions.length > 0 ? (
                      <>
                        {phase.actions.filter((a) => a.action_type === "activate").map((action, i) => (
                          <div key={i} title={action.control_type}>
                            {action.control_type === "fan" && <Wind size={16} className="text-amber-500" />}
                            {action.control_type === "lamp" && <Lightbulb size={16} className="text-yellow-500" />}
                          </div>
                        ))}
                      </>
                    ) : (
                      <span className="text-slate-400" style={{ fontSize: "0.65rem" }}>No devices</span>
                    )}
                  </div>
                  {/* Device status */}
                  {phase.actions && phase.actions.length > 0 && (
                    <div className="bg-white rounded border border-slate-100 p-1 mb-2 space-y-0.5">
                      {phase.actions.some((a) => a.action_type === "activate" && a.control_type === "fan") && (
                        <div className="text-xs text-slate-600 flex items-center justify-center gap-1">
                          <span className="font-semibold">Fan:</span><span className="text-emerald-600">ON</span>
                        </div>
                      )}
                      {phase.actions.some((a) => a.action_type === "activate" && a.control_type === "lamp") && (
                        <div className="text-xs text-slate-600 flex items-center justify-center gap-1">
                          <span className="font-semibold">Lamp:</span><span className="text-amber-600">ON</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500" style={{ fontSize: "0.68rem" }}>Time:</span>
                    <span className="text-slate-700" style={{ fontSize: "0.72rem", fontWeight: 600 }}>
                      {(phase.duration * 60).toFixed(0)} min
                    </span>
                  </div>
                </div>
              </div>
              {idx < phases.length - 1 && (
                <ArrowRight size={16} className="text-slate-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Phase Configuration Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-slate-700" style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
            Phase Configuration
          </h3>
          {canAddRecipePhase && (
            <button
              onClick={handleAddPhase}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-all"
              style={{ fontSize: "0.78rem", fontWeight: 600 }}
            >
              <Plus size={13} />
              Add Phase
            </button>
          )}
        </div>

        <div className="grid grid-flow-col auto-cols-[250px] gap-3 overflow-x-auto pb-1">
          {phases.map((phase, idx) => (
            <div key={phase.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Phase Header */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white"
                    style={{ fontSize: "0.7rem", fontWeight: 700 }}
                  >
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={phase.name}
                    onChange={(e) => handlePhaseChange(phase.id, "name", e.target.value)}
                    className="bg-transparent text-slate-800 outline-none border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 transition-all"
                    style={{ fontSize: "0.875rem", fontWeight: 700, width: "130px" }}
                  />
                </div>
                {canDeleteRecipePhase && (
                  <button
                    onClick={() => handleDeletePhase(phase.id)}
                    disabled={phases.length === 1}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Phase Controls */}
              <div className="p-4 space-y-4">
                {/* Duration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-slate-500" />
                      <span className="text-slate-700" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Duration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="30"
                        value={phase.duration * 60}
                        onChange={(e) => handlePhaseChange(phase.id, "duration", Number(e.target.value) / 60)}
                        className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-400 text-right"
                        style={{ fontSize: "0.8125rem", fontWeight: 700 }}
                        min={30}
                        max={1440}
                      />
                      <span className="text-slate-400" style={{ fontSize: "0.78rem" }}>min</span>
                    </div>
                  </div>
                </div>

                {/* Control Devices */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu size={14} className="text-slate-500" />
                    <span className="text-slate-700" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      Control Devices
                    </span>
                  </div>
                  <div className="space-y-2">
                    {/* Lamp */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phase.actions.some((a) => a.action_type === "activate" && a.control_type === "lamp")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handlePhaseChange(phase.id, "actions", updateActionByControlType(phase, "lamp", { action_type: "activate" }));
                            } else {
                              handlePhaseChange(phase.id, "actions", phase.actions.filter((a) => !(a.action_type === "activate" && a.control_type === "lamp")));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-500 cursor-pointer"
                        />
                        <Lightbulb size={13} className="text-amber-400" />
                        <span className="text-slate-700" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Lamp (ON)</span>
                      </label>
                    </div>

                    {/* Fan */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phase.actions.some((a) => a.action_type === "activate" && a.control_type === "fan")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handlePhaseChange(phase.id, "actions", updateActionByControlType(phase, "fan", { action_type: "activate" }));
                            } else {
                              handlePhaseChange(phase.id, "actions", phase.actions.filter((a) => !(a.action_type === "activate" && a.control_type === "fan")));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-500 cursor-pointer"
                        />
                        <Wind size={13} className="text-blue-400" />
                        <span className="text-slate-700" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Fan (ON)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CreateRecipeModal ────────────────────────────────────────────────────────

function CreateRecipeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (recipe: any) => void;
}) {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 3;

  // Step 1
  const [recipeName, setRecipeName] = useState("");
  const [selectedFruitId, setSelectedFruitId] = useState<number | null>(null);
  const [recipeType, setRecipeType] = useState<"standard" | "custom">("standard");

  // Step 2
  const [phases, setPhases] = useState<CreateRecipePhase[]>([
    { id: "p1", name: "Phase 1", durationMinutes: 120, fanEnabled: false, fanControlId: null, lampEnabled: false, lampControlId: null },
  ]);

  // Data
  const [fruits, setFruits] = useState<FruitOption[]>([]);
  const [controls, setControls] = useState<ControlDevice[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Add Fruit Type State
  const canManageRecipes = usePermission(Permission.MANAGE_RECIPES);
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
        const fruitName = result.fruit_name || result.name || newFruitName.trim();
        const newFruit: FruitOption = {
          fruit_id: fruitId,
          fruit_name: fruitName,
        };
        setFruits((prev) => [...prev, newFruit].sort((a, b) => a.fruit_name.localeCompare(b.fruit_name)));
        setSelectedFruitId(fruitId);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);
        const [fruitsRes, controlsRes] = await Promise.all([
          catalogAPI.fruits.list(),
          structureAPI.controls.list(),
        ]);
        const fruitsData = fruitsRes.data ?? fruitsRes ?? [];
        const controlsData = controlsRes.data ?? controlsRes ?? [];
        setFruits(Array.isArray(fruitsData) ? fruitsData : []);
        setControls(Array.isArray(controlsData) ? controlsData : []);
      } catch (error) {
        console.error("Error fetching modal data:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const fanControls = controls.filter((c) => c.control_type === "fan");
  const lampControls = controls.filter((c) => c.control_type === "lamp");

  // ── Validation ──
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!recipeName.trim()) errs.recipeName = "Recipe name is required";
    if (!selectedFruitId) errs.fruitId = "Please select a fruit type";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    phases.forEach((p, i) => {
      if (p.durationMinutes < 1) errs[`phase_${i}_dur`] = "Min 1 minute";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setErrors({});
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleAddPhase = () => {
    const n = phases.length + 1;
    setPhases((prev) => [
      ...prev,
      { id: `p${Date.now()}`, name: `Phase ${n}`, durationMinutes: 120, fanEnabled: false, fanControlId: null, lampEnabled: false, lampControlId: null },
    ]);
  };

  const handleRemovePhase = (id: string) => {
    if (phases.length > 1) setPhases((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePhase = (id: string, updates: Partial<CreateRecipePhase>) => {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      setErrors({});
      
      const fanControl = controls.find((c) => c.control_type === "fan");
      const lampControl = controls.find((c) => c.control_type === "lamp");
      const defaultFanId = fanControl?.control_id ?? 0;
      const defaultLampId = lampControl?.control_id ?? 0;

      const payload = {
        recipe_name: recipeName.trim(),
        recipe_type: recipeType,
        fruit_id: selectedFruitId,
        phases: phases.map((p, i) => {
          const actions: { control_id: number; action_type: string; start_offset_seconds: number }[] = [];
          if (p.fanEnabled && defaultFanId) {
            actions.push({ control_id: defaultFanId, action_type: "activate", start_offset_seconds: 0 });
          }
          if (p.lampEnabled && defaultLampId) {
            actions.push({ control_id: defaultLampId, action_type: "activate", start_offset_seconds: 0 });
          }
          return {
            phase_order: i + 1,
            duration_seconds: p.durationMinutes * 60,
            actions,
          };
        }),
      };

      const response = await catalogAPI.recipes.create(payload);
      onCreated(response.data ?? response);
    } catch (error: any) {
      setErrors({ submit: error.message ?? "Failed to create recipe. Please try again." });
      setIsCreating(false);
    }
  };

  const selectedFruit = fruits.find((f) => f.fruit_id === selectedFruitId);
  const totalMinutes = phases.reduce((s, p) => s + p.durationMinutes, 0);

  // ── Step labels ──
  const STEPS = ["Basic Info", "Phase Builder", "Review & Create"];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 0.15s ease" }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
          style={{
            pointerEvents: "auto",
            maxHeight: "90vh",
            animation: "slideUp 0.2s ease",
          }}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                <BookOpen size={17} className="text-white" />
              </div>
              <div>
                <h2 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
                  Create New Recipe
                </h2>
                <p className="text-slate-500" style={{ fontSize: "0.72rem" }}>
                  {STEPS[step - 1]} — Step {step} of {TOTAL_STEPS}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-0 px-6 py-3 border-b border-slate-100">
            {STEPS.map((label, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isDone = stepNum < step;
              return (
                <div key={stepNum} className="flex items-center flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                          : "bg-slate-100 text-slate-400"
                      }`}
                      style={{ fontSize: "0.7rem", fontWeight: 700 }}
                    >
                      {isDone ? <Check size={13} /> : stepNum}
                    </div>
                    <span
                      style={{ fontSize: "0.72rem", fontWeight: isActive ? 700 : 500 }}
                      className={isActive ? "text-emerald-700" : isDone ? "text-emerald-600" : "text-slate-400"}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-3 ${isDone ? "bg-emerald-300" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loadingData ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 size={28} className="text-emerald-500 animate-spin" />
                <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>Loading data...</p>
              </div>
            ) : (
              <>
                {/* ── STEP 1: Basic Info ── */}
                {step === 1 && (
                  <div className="space-y-5">
                    {/* Recipe Name */}
                    <div>
                      <label className="block text-slate-700 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                        Recipe Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mango Drying — Summer Batch"
                        value={recipeName}
                        onChange={(e) => { setRecipeName(e.target.value); setErrors((p) => ({ ...p, recipeName: "" })); }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition-all text-slate-800 ${
                          errors.recipeName
                            ? "border-red-400 ring-2 ring-red-100"
                            : "border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        }`}
                        style={{ fontSize: "0.875rem" }}
                        autoFocus
                      />
                      {errors.recipeName && (
                        <p className="mt-1 flex items-center gap-1 text-red-500" style={{ fontSize: "0.72rem" }}>
                          <AlertCircle size={11} />{errors.recipeName}
                        </p>
                      )}
                    </div>

                    {/* Fruit Type */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-slate-700 mb-0" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                          Fruit Type <span className="text-red-500">*</span>
                        </label>
                        {canManageRecipes && !showAddFruit && (
                          <button
                            type="button"
                            onClick={() => setShowAddFruit(true)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-all"
                          >
                            <Plus size={12} /> Add Fruit Type
                          </button>
                        )}
                      </div>

                      {showAddFruit && (
                        <div className="mb-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2" style={{ animation: "fadeIn 0.15s ease" }}>
                          <span className="block text-slate-700 font-bold" style={{ fontSize: "0.75rem" }}>New Fruit Type</span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. Avocado, Dragon Fruit"
                              value={newFruitName}
                              onChange={(e) => { setNewFruitName(e.target.value); setAddFruitError(""); }}
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all text-slate-800"
                              disabled={isAddingFruit}
                            />
                            <button
                              type="button"
                              onClick={handleAddFruit}
                              disabled={isAddingFruit}
                              className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white rounded-lg font-bold flex items-center gap-1 transition-all"
                            >
                              {isAddingFruit ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAddFruit(false); setNewFruitName(""); setAddFruitError(""); }}
                              disabled={isAddingFruit}
                              className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                          {addFruitError && (
                            <p className="flex items-center gap-1 text-red-500" style={{ fontSize: "0.68rem" }}>
                              <AlertCircle size={10} />{addFruitError}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {fruits.map((fruit) => (
                          <button
                            key={fruit.fruit_id}
                            onClick={() => { setSelectedFruitId(fruit.fruit_id); setErrors((p) => ({ ...p, fruitId: "" })); }}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                              selectedFruitId === fruit.fruit_id
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700"
                            }`}
                          >
                            <Apple
                              size={14}
                              className={selectedFruitId === fruit.fruit_id ? "text-emerald-500" : "text-slate-400"}
                            />
                            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{fruit.fruit_name}</span>
                            {selectedFruitId === fruit.fruit_id && (
                              <Check size={13} className="ml-auto text-emerald-500" />
                            )}
                          </button>
                        ))}
                        {fruits.length === 0 && (
                          <p className="col-span-2 text-center text-slate-400 py-4" style={{ fontSize: "0.8rem" }}>
                            No fruit types available
                          </p>
                        )}
                      </div>
                      {errors.fruitId && (
                        <p className="mt-1 flex items-center gap-1 text-red-500" style={{ fontSize: "0.72rem" }}>
                          <AlertCircle size={11} />{errors.fruitId}
                        </p>
                      )}
                    </div>

                    {/* Recipe Type */}
                    <div>
                      <label className="block text-slate-700 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                        Recipe Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setRecipeType("standard")}
                          className={`p-3.5 rounded-xl border-2 transition-all text-left ${
                            recipeType === "standard"
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={15} className={recipeType === "standard" ? "text-emerald-600" : "text-slate-400"} />
                            <span className="text-slate-800" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>Standard</span>
                            {recipeType === "standard" && <Check size={13} className="ml-auto text-emerald-500" />}
                          </div>
                          <p className="text-slate-500" style={{ fontSize: "0.72rem" }}>
                            Pre-defined phase durations & sequences
                          </p>
                        </button>
                        <button
                          onClick={() => setRecipeType("custom")}
                          className={`p-3.5 rounded-xl border-2 transition-all text-left ${
                            recipeType === "custom"
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Sliders size={15} className={recipeType === "custom" ? "text-emerald-600" : "text-slate-400"} />
                            <span className="text-slate-800" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>Custom</span>
                            {recipeType === "custom" && <Check size={13} className="ml-auto text-emerald-500" />}
                          </div>
                          <p className="text-slate-500" style={{ fontSize: "0.72rem" }}>
                            Fully adjustable phases & device control
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Phase Builder ── */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-700" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          Define Drying Phases
                        </p>
                        <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>
                          Set duration and device control for each phase
                        </p>
                      </div>
                      <button
                        onClick={handleAddPhase}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-all"
                        style={{ fontSize: "0.78rem", fontWeight: 600 }}
                      >
                        <Plus size={13} />
                        Add Phase
                      </button>
                    </div>

                    <div className="space-y-3">
                      {phases.map((phase, i) => (
                        <div
                          key={phase.id}
                          className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
                        >
                          {/* Phase header */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shrink-0"
                                style={{ fontSize: "0.7rem", fontWeight: 700 }}
                              >
                                {i + 1}
                              </span>
                              <input
                                type="text"
                                value={phase.name}
                                onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                                className="bg-transparent text-slate-800 outline-none border-b border-transparent hover:border-emerald-300 focus:border-emerald-500"
                                style={{ fontSize: "0.875rem", fontWeight: 700, width: "150px" }}
                              />
                            </div>
                            <button
                              onClick={() => handleRemovePhase(phase.id)}
                              disabled={phases.length === 1}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Phase body */}
                          <div className="p-4 grid grid-cols-1 gap-4">
                            {/* Duration */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock size={14} className="text-slate-400" />
                                <span className="text-slate-700" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                                  Duration
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={phase.durationMinutes}
                                  onChange={(e) => updatePhase(phase.id, { durationMinutes: Math.max(1, Number(e.target.value)) })}
                                  min={1}
                                  max={1440}
                                  className={`w-20 px-2 py-1.5 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-emerald-300 text-right ${
                                    errors[`phase_${i}_dur`] ? "border-red-400" : "border-slate-200"
                                  }`}
                                  style={{ fontSize: "0.875rem", fontWeight: 700 }}
                                />
                                <span className="text-slate-400" style={{ fontSize: "0.78rem" }}>minutes</span>
                              </div>
                            </div>
                            {errors[`phase_${i}_dur`] && (
                              <p className="text-red-500 flex items-center gap-1 -mt-2" style={{ fontSize: "0.72rem" }}>
                                <AlertCircle size={11} />{errors[`phase_${i}_dur`]}
                              </p>
                            )}

                            {/* Fan Control */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={phase.fanEnabled}
                                    onChange={(e) => updatePhase(phase.id, { fanEnabled: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 accent-emerald-500 cursor-pointer"
                                  />
                                  <Wind size={14} className="text-blue-400" />
                                  <span className="text-slate-700" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Fan — ON</span>
                                </label>
                              </div>
                            </div>

                            {/* Lamp Control */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={phase.lampEnabled}
                                    onChange={(e) => updatePhase(phase.id, { lampEnabled: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 accent-emerald-500 cursor-pointer"
                                  />
                                  <Lightbulb size={14} className="text-amber-400" />
                                  <span className="text-slate-700" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Lamp — ON</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total time summary */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Clock size={13} className="text-slate-400" />
                      <span className="text-slate-500" style={{ fontSize: "0.78rem" }}>
                        Total drying time:
                      </span>
                      <span className="text-slate-800" style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                        {totalMinutes >= 60
                          ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                          : `${totalMinutes}m`}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Review & Create ── */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl p-5 border border-emerald-100">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                          <Apple size={18} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
                            {recipeName}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-slate-500" style={{ fontSize: "0.75rem" }}>
                              🍎 {selectedFruit?.fruit_name ?? "—"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                recipeType === "standard"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-violet-100 text-violet-700"
                              }`}
                            >
                              {recipeType}
                            </span>
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-emerald-600" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                            {phases.length}
                          </div>
                          <div className="text-slate-400" style={{ fontSize: "0.7rem" }}>phases</div>
                        </div>
                      </div>

                      {/* Phase summary */}
                      <div className="space-y-2">
                        {phases.map((phase, i) => {
                          const devicesSummary = [];
                          if (phase.fanEnabled) {
                            devicesSummary.push("Fan ON");
                          }
                          if (phase.lampEnabled) {
                            devicesSummary.push("Lamp ON");
                          }
                          return (
                            <div
                              key={phase.id}
                              className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-slate-100"
                            >
                              <span
                                className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shrink-0"
                                style={{ fontSize: "0.68rem", fontWeight: 700 }}
                              >
                                {i + 1}
                              </span>
                              <span className="text-slate-700 flex-1" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                                {phase.name}
                              </span>
                              <div className="flex items-center gap-2">
                                {phase.fanEnabled && <Wind size={13} className="text-blue-400" />}
                                {phase.lampEnabled && <Lightbulb size={13} className="text-amber-400" />}
                                {!phase.fanEnabled && !phase.lampEnabled && (
                                  <span className="text-slate-300" style={{ fontSize: "0.68rem" }}>no devices</span>
                                )}
                              </div>
                              <span className="text-slate-500 shrink-0" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                                {phase.durationMinutes >= 60
                                  ? `${Math.floor(phase.durationMinutes / 60)}h ${phase.durationMinutes % 60}m`
                                  : `${phase.durationMinutes}m`}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-100">
                        <span className="text-slate-500" style={{ fontSize: "0.78rem" }}>Total drying time</span>
                        <span className="text-slate-800" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          {totalMinutes >= 60
                            ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                            : `${totalMinutes}m`}
                        </span>
                      </div>
                    </div>

                    {errors.submit && (
                      <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                        <p className="text-red-600" style={{ fontSize: "0.8rem" }}>{errors.submit}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <button
              onClick={step === 1 ? onClose : handleBack}
              disabled={isCreating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-40"
              style={{ fontSize: "0.8125rem", fontWeight: 600 }}
            >
              {step === 1 ? (
                <><X size={14} />Cancel</>
              ) : (
                <><ChevronLeft size={14} />Back</>
              )}
            </button>

            {step < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                disabled={loadingData}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all disabled:opacity-40"
                style={{ fontSize: "0.8125rem", fontWeight: 600 }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all disabled:opacity-40 min-w-[140px] justify-center"
                style={{ fontSize: "0.8125rem", fontWeight: 600 }}
              >
                {isCreating ? (
                  <><Loader2 size={14} className="animate-spin" />Creating...</>
                ) : (
                  <><Check size={14} />Create Recipe</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </>
  );
}

// ─── AutomationRules ──────────────────────────────────────────────────────────

export function AutomationRules() {
  const [recipes, setRecipes] = useState<FruitRecipe[]>([]);
  const [selectedFruit, setSelectedFruit] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [selectedRecipeData, setSelectedRecipeData] = useState<any>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canManageRecipes = usePermission(Permission.MANAGE_RECIPES);

  // ── Load recipe list ──
  const loadRecipes = async (selectRecipeId?: number) => {
    try {
      setLoading(true);
      const response = await catalogAPI.recipes.list({ is_active: true });
      const transformed = (response.data || []).map((recipe: any) => ({
        id: String(recipe.recipe_id),
        name: recipe.recipe_name,
        phases: recipe.phases || [],
        totalTime: 0,
        schedules: [],
        scheduleType: "recurring" as const,
        recipe_id: recipe.recipe_id,
        fruit_id: recipe.fruit_id,
        fruit_name: recipe.fruit_name,
      }));

      setRecipes(transformed);

      // Auto-select: prefer the newly created recipe, otherwise keep selection or pick first
      const targetId = selectRecipeId ?? selectedRecipeId ?? (transformed[0]?.recipe_id ?? null);
      if (targetId) {
        const found = transformed.find((r: FruitRecipe) => r.recipe_id === targetId);
        if (found) {
          setSelectedFruit(String(found.recipe_id));
          setSelectedRecipeId(found.recipe_id!);
        } else {
          // If selected recipe was deleted, clear or fallback to first
          if (transformed.length > 0) {
            setSelectedFruit(String(transformed[0].recipe_id));
            setSelectedRecipeId(transformed[0].recipe_id!);
          } else {
            setSelectedFruit(null);
            setSelectedRecipeId(null);
            setSelectedRecipeData(null);
          }
        }
      } else if (transformed.length > 0) {
        setSelectedFruit(String(transformed[0].recipe_id));
        setSelectedRecipeId(transformed[0].recipe_id!);
      } else {
        setSelectedFruit(null);
        setSelectedRecipeId(null);
        setSelectedRecipeData(null);
      }
    } catch (error) {
      console.error("Error loading recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  // ── Load recipe details ──
  useEffect(() => {
    if (!selectedRecipeId) return;
    const loadRecipeDetails = async () => {
      try {
        setLoadingRecipe(true);
        const response = await catalogAPI.recipes.get(selectedRecipeId);
        if (response.data) {
          setSelectedRecipeData({
            ...response.data,
            phases: transformApiPhases(response.data.phases),
          });
        }
      } catch (error) {
        console.error("Error loading recipe details:", error);
      } finally {
        setLoadingRecipe(false);
      }
    };
    loadRecipeDetails();
  }, [selectedRecipeId]);

  const selectedRecipe = recipes.find((f) => String(f.recipe_id) === selectedFruit);

  const handleRecipeCreated = async (newRecipe: any) => {
    setShowCreateModal(false);
    // Reload and auto-select the new recipe
    await loadRecipes(newRecipe?.recipe_id);
  };

  const handleRecipeDeleted = async (deletedId: number) => {
    setSelectedFruit(null);
    setSelectedRecipeId(null);
    setSelectedRecipeData(null);
    await loadRecipes();
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="max-w-screen-xl mx-auto flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-emerald-500 animate-spin" />
            <p className="text-slate-600" style={{ fontSize: "0.875rem" }}>Loading recipes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="max-w-screen-xl mx-auto">
          {/* Page Header */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={24} className="text-emerald-600" />
              <h1 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
                Automation Rules &amp; Drying Recipes
              </h1>
            </div>
            <p className="text-slate-400" style={{ fontSize: "0.8rem", marginLeft: "2rem" }}>
              Define control policies with drying recipes, threshold conditions, and device mappings for each fruit type
            </p>
          </div>

          {/* Split View */}
          <div className="flex gap-5 items-start" style={{ minHeight: "calc(100vh - 220px)" }}>
            {/* Left: Recipe Selector */}
            <div className="w-72 shrink-0" style={{ minHeight: "500px" }}>
              <FruitSelector
                selected={selectedFruit}
                onSelect={(recipeId) => {
                  setSelectedFruit(recipeId);
                  const recipe = recipes.find((r) => String(r.recipe_id) === recipeId);
                  if (recipe?.recipe_id) setSelectedRecipeId(recipe.recipe_id);
                }}
                search={searchQuery}
                onSearch={setSearchQuery}
                recipes={recipes}
                onCreateNew={() => setShowCreateModal(true)}
              />
            </div>

            {/* Right: Recipe Editor */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6">
                {loadingRecipe ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 size={32} className="text-emerald-500 animate-spin" />
                    <p className="text-slate-600" style={{ fontSize: "0.875rem" }}>Loading recipe details...</p>
                  </div>
                ) : selectedRecipe ? (
                  <RecipeEditor
                    recipe={selectedRecipe}
                    recipeData={selectedRecipeData}
                    onDeleted={() => handleRecipeDeleted(selectedRecipe.recipe_id!)}
                  />
                ) : (
                  <div className="text-center py-20 text-slate-400">
                    <Apple size={48} className="mx-auto mb-3 opacity-30" />
                    <p style={{ fontSize: "0.875rem" }}>Select a recipe to view and edit its configuration</p>
                    {canManageRecipes && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all"
                        style={{ fontSize: "0.8125rem", fontWeight: 600 }}
                      >
                        <Plus size={14} />
                        Create First Recipe
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Recipe Modal */}
      {showCreateModal && (
        <CreateRecipeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRecipeCreated}
        />
      )}
    </>
  );
}
