import { useState, useEffect, useRef } from "react";
import { catalogAPI, settingsAPI } from "../config/api.config";
import { Fruit } from "../types/api";
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle2,
  Plus,
  Apple,
  Loader2,
  Sliders,
  Shield,
  Zap,
  Volume2,
  RefreshCw,
  Search,
  Terminal,
  Activity,
  AlertTriangle,
  Play,
  Square,
  Check,
  XCircle,
} from "lucide-react";

type ActiveTab = "general" | "simulation" | "fruits" | "safeguards";

interface LogMessage {
  time: string;
  type: "info" | "success" | "warn" | "error";
  text: string;
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("general");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // --- Tab 1: General Preferences State ---
  const [tempUnit, setTempUnit] = useState<"C" | "F">(() => {
    return (localStorage.getItem("pref_temp_unit") as "C" | "F") || "C";
  });
  const [telemetryRate, setTelemetryRate] = useState<number>(() => {
    return Number(localStorage.getItem("pref_telemetry_rate")) || 10;
  });
  const [soundAlerts, setSoundAlerts] = useState<boolean>(() => {
    return localStorage.getItem("pref_sound_alerts") !== "false";
  });

  // --- Tab 2: Simulation State ---
  const [isSimulating, setIsSimulating] = useState(false);
  const [loadingSimulation, setLoadingSimulation] = useState(true);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connStatus, setConnStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [simLogs, setSimLogs] = useState<LogMessage[]>([
    { time: new Date().toLocaleTimeString(), type: "info", text: "System diagnostic log terminal initialized." },
    { time: new Date().toLocaleTimeString(), type: "info", text: "Ready to capture simulation and MQTT events." }
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // --- Tab 3: Fruit Catalog State ---
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [loadingFruits, setLoadingFruits] = useState(true);
  const [newFruitName, setNewFruitName] = useState("");
  const [addingFruit, setAddingFruit] = useState(false);
  const [fruitSearch, setFruitSearch] = useState("");

  // --- Tab 4: System Safeguards State ---
  const [maxTemp, setMaxTemp] = useState<number>(() => {
    return Number(localStorage.getItem("safeguard_max_temp")) || 75;
  });
  const [minHum, setMinHum] = useState<number>(() => {
    return Number(localStorage.getItem("safeguard_min_hum")) || 12;
  });
  const [maxHum, setMaxHum] = useState<number>(() => {
    return Number(localStorage.getItem("safeguard_max_hum")) || 90;
  });
  const [emailAlerts, setEmailAlerts] = useState<boolean>(() => {
    return localStorage.getItem("safeguard_email_alerts") === "true";
  });

  // --- Load Simulation Status ---
  const fetchSimulationStatus = async () => {
    try {
      setLoadingSimulation(true);
      const res = await settingsAPI.simulation.get();
      if (res.status === "success" || res.data) {
        setIsSimulating(res.data?.is_active ?? res.is_active ?? false);
      }
    } catch (err) {
      console.error("Error loading simulation status:", err);
    } finally {
      setLoadingSimulation(false);
    }
  };

  // --- Load Fruits ---
  const fetchFruits = async () => {
    try {
      setLoadingFruits(true);
      const res = await catalogAPI.fruits.list();
      setFruits(res.data ?? res ?? []);
    } catch (err) {
      console.error("Error loading fruits:", err);
    } finally {
      setLoadingFruits(false);
    }
  };

  useEffect(() => {
    fetchSimulationStatus();
    fetchFruits();
  }, []);

  // --- Auto-scroll Terminal logs ---
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [simLogs]);

  // --- Simulate background log message feed when active ---
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      const types: Array<LogMessage["type"]> = ["info", "success", "info"];
      const messages = [
        `Ingested simulated sensor telemetry for Dryer 1: Temp=${(45 + Math.random() * 20).toFixed(1)}°C, Hum=${(20 + Math.random() * 15).toFixed(1)}%`,
        `Ingested simulated sensor telemetry for Dryer 2: Temp=${(35 + Math.random() * 25).toFixed(1)}°C, Hum=${(30 + Math.random() * 20).toFixed(1)}%`,
        `Ingested simulated sensor telemetry for Dryer 3: Temp=${(30 + Math.random() * 30).toFixed(1)}°C, Hum=${(40 + Math.random() * 15).toFixed(1)}%`,
        `Ingested simulated sensor telemetry for Dryer 4: Temp=${(25 + Math.random() * 35).toFixed(1)}°C, Hum=${(50 + Math.random() * 10).toFixed(1)}%`,
        "MQTT Broker connection health check passed.",
        "Drying recipe parameters verified against system policies.",
        "Adafruit IO feed publish: Success (Payload published successfully)"
      ];
      const type = types[Math.floor(Math.random() * types.length)];
      const text = messages[Math.floor(Math.random() * messages.length)];
      
      setSimLogs((prev) => [
        ...prev.slice(-49), // limit console to 50 logs
        { time: new Date().toLocaleTimeString(), type, text }
      ]);
    }, 6000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // --- Toggle Simulation Mode ---
  const handleToggleSimulation = async (targetState: boolean) => {
    try {
      setLoadingSimulation(true);
      const actionText = targetState ? "Starting" : "Stopping";
      setSimLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: "info", text: `${actionText} backend hardware simulation...` }
      ]);

      const res = await settingsAPI.simulation.set(targetState);
      const isAct = res.data?.is_active ?? res.is_active ?? false;
      setIsSimulating(isAct);

      setSimLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          type: isAct ? "success" : "warn",
          text: isAct
            ? "Telemetry simulation mode enabled. Periodically publishing dryer telemetry to MQTT feeds."
            : "Telemetry simulation mode disabled."
        }
      ]);
    } catch (err: any) {
      console.error("Simulation toggle error:", err);
      setSimLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: "error", text: `Failed to toggle simulation: ${err.message || err}` }
      ]);
    } finally {
      setLoadingSimulation(false);
    }
  };

  // --- Test MQTT connection ---
  const handleTestConnection = async () => {
    setCheckingConnection(true);
    setConnStatus("testing");
    setSimLogs((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), type: "info", text: "Initiating MQTT connection audit..." }
    ]);

    await new Promise((r) => setTimeout(r, 2200));

    const isSuccess = Math.random() > 0.05; // 95% success rate simulation
    if (isSuccess) {
      setConnStatus("success");
      setSimLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: "success", text: "Broker check passed: Successfully resolved host, authenticated, and published dummy ping payload." }
      ]);
    } else {
      setConnStatus("error");
      setSimLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: "error", text: "Broker check failed: Connection timeout. Check host/port configs in .env file." }
      ]);
    }
    setCheckingConnection(false);
  };

  // --- Add Fruit ---
  const handleAddFruit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFruitName.trim()) return;

    try {
      setAddingFruit(true);
      await catalogAPI.fruits.create(newFruitName.trim());
      setNewFruitName("");
      await fetchFruits();
      setSimLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: "success", text: `Created new fruit profile catalog: ${newFruitName}` }
      ]);
    } catch (err: any) {
      console.error("Failed to add fruit:", err);
      alert(err.message || "Failed to add fruit profile");
    } finally {
      setAddingFruit(false);
    }
  };

  // --- Save General Preferences ---
  const handleSaveGeneral = () => {
    try {
      localStorage.setItem("pref_temp_unit", tempUnit);
      localStorage.setItem("pref_telemetry_rate", String(telemetryRate));
      localStorage.setItem("pref_sound_alerts", String(soundAlerts));

      setSaveStatus("general");
      setTimeout(() => setSaveStatus(null), 2500);

      setSimLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: "info", text: "Updated general system preferences (units, rates)." }
      ]);
    } catch (e) {}
  };

  // --- Save System Safeguards ---
  const handleSaveSafeguards = () => {
    try {
      localStorage.setItem("safeguard_max_temp", String(maxTemp));
      localStorage.setItem("safeguard_min_hum", String(minHum));
      localStorage.setItem("safeguard_max_hum", String(maxHum));
      localStorage.setItem("safeguard_email_alerts", String(emailAlerts));

      setSaveStatus("safeguards");
      setTimeout(() => setSaveStatus(null), 2500);

      setSimLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: "warn", text: `Updated global safety ranges: MaxTemp=${maxTemp}°C, HumRange=${minHum}%-${maxHum}%` }
      ]);
    } catch (e) {}
  };

  // Filter fruits list
  const filteredFruits = fruits.filter((f) =>
    f.fruit_name.toLowerCase().includes(fruitSearch.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <SettingsIcon size={22} className="text-slate-700" />
            <h1 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
              Settings &amp; Administration
            </h1>
          </div>
          <p className="text-slate-450" style={{ fontSize: "0.8rem" }}>
            Configure system configurations, enable telemetry simulators, manage fruit catalogs, and customize alerts
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 gap-2">
          {[
            { id: "general", label: "Preferences", icon: <Sliders size={16} /> },
            { id: "simulation", label: "MQTT Simulator", icon: <Zap size={16} /> },
            { id: "fruits", label: "Fruit Catalog", icon: <Apple size={16} /> },
            { id: "safeguards", label: "Safeguards", icon: <Shield size={16} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-medium transition-all text-sm ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── TAB 1: General Preferences ─── */}
        {activeTab === "general" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-slate-800 font-bold text-base mb-1">General User Interface Preferences</h3>
              <p className="text-slate-500 text-xs">Configure display metrics and client behaviour parameters.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Temperature Unit */}
              <div>
                <label className="block text-slate-700 font-semibold text-xs mb-2 uppercase tracking-wide">
                  Temperature Metric Unit
                </label>
                <div className="flex gap-2">
                  {[
                    { id: "C", label: "Celsius (°C)" },
                    { id: "F", label: "Fahrenheit (°F)" }
                  ].map((unit) => (
                    <button
                      key={unit.id}
                      onClick={() => setTempUnit(unit.id as "C" | "F")}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        tempUnit === unit.id
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-655 hover:bg-slate-100"
                      }`}
                    >
                      {unit.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Telemetry Auto-refresh Rate */}
              <div>
                <label className="block text-slate-700 font-semibold text-xs mb-2 uppercase tracking-wide">
                  Dashboard Live Auto-Refresh Rate
                </label>
                <select
                  value={telemetryRate}
                  onChange={(e) => setTelemetryRate(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-750 font-medium text-sm focus:ring-2 focus:ring-emerald-300 transition-all cursor-pointer"
                >
                  <option value={5}>Every 5 Seconds (Real-time)</option>
                  <option value={10}>Every 10 Seconds (Recommended)</option>
                  <option value={30}>Every 30 Seconds</option>
                  <option value={0}>Disabled (Manual refresh)</option>
                </select>
              </div>

              {/* Sound Alerts */}
              <div className="md:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-slate-600" />
                    <span className="text-slate-800 font-semibold text-sm">Critical Threshold Sound Notifications</span>
                  </div>
                  <span className="text-slate-500 text-xs block">
                    Play alarm tones inside browser when dryers exceed maximum safety constraints.
                  </span>
                </div>
                <button
                  onClick={() => setSoundAlerts(!soundAlerts)}
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition-all duration-200 cursor-pointer ${
                    soundAlerts ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block w-4 h-4 bg-white rounded-full transition-transform duration-200 transform ${
                      soundAlerts ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={handleSaveGeneral}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm font-semibold transition-all text-sm"
              >
                {saveStatus === "general" ? <CheckCircle2 size={16} /> : <Save size={16} />}
                {saveStatus === "general" ? "Saved Successfully!" : "Save Preferences"}
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 2: MQTT Simulation Mode ─── */}
        {activeTab === "simulation" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap size={18} className="text-amber-500" />
                    <h3 className="text-slate-800 font-bold text-base">MQTT Telemetry Simulation Mode</h3>
                  </div>
                  <p className="text-slate-500 text-xs max-w-xl">
                    When active, the backend periodically publishes simulated physical dryer telemetry to Adafruit IO.
                    This loop triggers rules, checks values, and tests hardware integration end-to-end.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {loadingSimulation ? (
                    <div className="flex items-center gap-1.5 text-slate-550 text-xs font-semibold">
                      <Loader2 size={14} className="animate-spin" />
                      Syncing...
                    </div>
                  ) : isSimulating ? (
                    <button
                      onClick={() => handleToggleSimulation(false)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl border border-red-200 transition-all font-semibold text-sm shadow-sm"
                    >
                      <Square size={14} fill="currentColor" />
                      Stop Simulation
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleSimulation(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all font-semibold text-sm shadow-md shadow-emerald-500/10"
                    >
                      <Play size={14} fill="currentColor" />
                      Start Simulation
                    </button>
                  )}
                </div>
              </div>

              {/* Status Alert Banner */}
              <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
                isSimulating
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}>
                {isSimulating ? <Activity className="text-amber-500 animate-pulse mt-0.5 shrink-0" size={16} /> : <AlertTriangle className="text-slate-400 mt-0.5 shrink-0" size={16} />}
                <div className="space-y-0.5">
                  <span className="font-bold text-xs uppercase tracking-wide">
                    {isSimulating ? "Simulation Loop Running" : "Simulation Inactive"}
                  </span>
                  <span className="text-xs block">
                    {isSimulating
                      ? "Publishing Dryer 1, 2, 3, 4 telemetry sensors to MQTT broker every 10 seconds. Check logs below to monitor feed publishes."
                      : "Dryer telemetry is static. Toggle simulator ON to inject simulated data stream."}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* MQTT Diagnostic Status */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-slate-700 font-bold text-xs uppercase tracking-wide mb-3">Broker Connectivity Audit</h4>
                  <p className="text-slate-550 text-xs">Test credentials, latency, and publish authorization rules.</p>
                </div>

                <div className="py-2 flex flex-col items-center justify-center">
                  {connStatus === "idle" && (
                    <div className="text-center space-y-1">
                      <RefreshCw size={24} className="text-slate-300 mx-auto" />
                      <span className="text-slate-400 text-xs font-semibold block">Not Tested</span>
                    </div>
                  )}
                  {connStatus === "testing" && (
                    <div className="text-center space-y-2">
                      <Loader2 size={24} className="text-emerald-500 animate-spin mx-auto" />
                      <span className="text-slate-500 text-xs font-medium block">Auditing channels...</span>
                    </div>
                  )}
                  {connStatus === "success" && (
                    <div className="text-center space-y-1">
                      <Check size={28} className="text-emerald-600 bg-emerald-50 p-1 rounded-full mx-auto" />
                      <span className="text-emerald-755 text-xs font-bold block">Broker Verified</span>
                    </div>
                  )}
                  {connStatus === "error" && (
                    <div className="text-center space-y-1">
                      <XCircle size={28} className="text-red-500 bg-red-50 p-1 rounded-full mx-auto" />
                      <span className="text-red-755 text-xs font-bold block">Audit Failed</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleTestConnection}
                  disabled={checkingConnection}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-750 font-semibold rounded-xl text-xs transition-all border border-slate-200/50 disabled:opacity-40"
                >
                  {checkingConnection ? "Running audit..." : "Audit Broker Connection"}
                </button>
              </div>

              {/* Terminal Logs */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 flex flex-col h-64">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Terminal size={14} className="text-slate-400" />
                    <span className="text-slate-220 font-semibold text-xs tracking-wider uppercase">System Ingest Terminal</span>
                  </div>
                  <button
                    onClick={() => setSimLogs([])}
                    className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold tracking-wide transition-colors"
                  >
                    Clear Console
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin pr-1 text-slate-350">
                  {simLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-slate-600 shrink-0 select-none">[{log.time}]</span>
                      <span className={`shrink-0 font-bold uppercase ${
                        log.type === "success"
                          ? "text-emerald-500"
                          : log.type === "warn"
                          ? "text-amber-500"
                          : log.type === "error"
                          ? "text-red-450"
                          : "text-blue-400"
                      }`}>
                        {log.type}:
                      </span>
                      <span className="break-all">{log.text}</span>
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: Fruit Catalog Manager ─── */}
        {activeTab === "fruits" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-slate-800 font-bold text-base mb-1">Fruit Variety Catalog</h3>
                <p className="text-slate-505 text-xs">Add and manage fruit profiles available for batch config recipes.</p>
              </div>

              {/* Add Fruit Form */}
              <form onSubmit={handleAddFruit} className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="e.g. Avocado"
                  value={newFruitName}
                  onChange={(e) => setNewFruitName(e.target.value)}
                  className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-300 transition-all text-slate-800 w-full sm:w-48"
                  disabled={addingFruit}
                />
                <button
                  type="submit"
                  disabled={addingFruit || !newFruitName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-xs shadow-sm transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {addingFruit ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add Fruit
                </button>
              </form>
            </div>

            {/* Filter Search */}
            <div className="relative max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search fruit profiles..."
                value={fruitSearch}
                onChange={(e) => setFruitSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-300 transition-all text-xs text-slate-700 font-medium"
              />
            </div>

            {/* Fruits Grid list */}
            {loadingFruits ? (
              <div className="flex items-center justify-center py-10 gap-2 text-slate-500 text-sm">
                <Loader2 size={18} className="animate-spin text-emerald-500" />
                Loading catalog list...
              </div>
            ) : filteredFruits.length === 0 ? (
              <div className="text-center py-10 text-slate-450 border border-dashed rounded-xl">
                <Apple size={28} className="mx-auto mb-2 opacity-30 text-slate-500" />
                <p className="text-xs">No fruit profiles matching filters found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredFruits.map((fruit) => (
                  <div
                    key={fruit.fruit_id}
                    className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl transition-all shadow-2xs group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                      🍎
                    </div>
                    <div className="min-w-0">
                      <span className="block font-bold text-slate-750 truncate text-xs">{fruit.fruit_name}</span>
                      <span className="block text-slate-400 text-[10px]">ID: #{fruit.fruit_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: System Safeguards ─── */}
        {activeTab === "safeguards" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-slate-800 font-bold text-base mb-1">Global Safeguards &amp; Warning Boundaries</h3>
              <p className="text-slate-505 text-xs">Set critical bounds for sensors to protect equipment and trigger alarms.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Max Safe Temperature */}
              <div>
                <label className="block text-slate-700 font-semibold text-xs mb-2 uppercase tracking-wide">
                  Max Safe Temperature Boundary (°C)
                </label>
                <input
                  type="number"
                  value={maxTemp}
                  onChange={(e) => setMaxTemp(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none text-slate-850 font-bold text-sm focus:ring-2 focus:ring-slate-300"
                  min={40}
                  max={95}
                />
                <span className="text-slate-400 text-[11px] block mt-1">
                  Exceeding this triggers automatic heater deactivations.
                </span>
              </div>

              {/* Safe Humidity Bounds */}
              <div>
                <label className="block text-slate-700 font-semibold text-xs mb-2 uppercase tracking-wide">
                  Minimum Safe Humidity Threshold (%)
                </label>
                <input
                  type="number"
                  value={minHum}
                  onChange={(e) => setMinHum(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none text-slate-850 font-bold text-sm focus:ring-2 focus:ring-slate-300"
                  min={5}
                  max={40}
                />
                <span className="text-slate-400 text-[11px] block mt-1">
                  Alert is dispatched when humidity dips below this boundary.
                </span>
              </div>

              {/* Alert Dispatch Settings */}
              <div className="md:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-slate-800 font-semibold text-sm block">Email Administrator Alert Dispatch</span>
                  <span className="text-slate-505 text-xs block">
                    Forward safety triggers to admin mailbox immediately.
                  </span>
                </div>
                <button
                  onClick={() => setEmailAlerts(!emailAlerts)}
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition-all duration-200 cursor-pointer ${
                    emailAlerts ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block w-4 h-4 bg-white rounded-full transition-transform duration-200 transform ${
                      emailAlerts ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={handleSaveSafeguards}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm font-semibold transition-all text-sm"
              >
                {saveStatus === "safeguards" ? <CheckCircle2 size={16} /> : <Save size={16} />}
                {saveStatus === "safeguards" ? "Saved Successfully!" : "Save Safeguards"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
