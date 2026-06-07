import { useState, useEffect } from "react";
import { Thermometer, Droplets, Sun, Wifi, RefreshCw } from "lucide-react";
import { CircularGauge } from "./CircularGauge";

export function SensorTelemetry() {
  const [temperature, setTemperature] = useState(65);
  const [humidity, setHumidity] = useState(45);
  const [light, setLight] = useState(850);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTemperature((t) => Math.max(55, Math.min(80, t + (Math.random() - 0.5) * 2)));
      setHumidity((h) => Math.max(30, Math.min(70, h + (Math.random() - 0.5) * 1.5)));
      setLight((l) => Math.max(100, Math.min(100, l + (Math.random() - 0.5) * 30)));
      setLastUpdated(new Date());
      setPulsing(true);
      setTimeout(() => setPulsing(false), 600);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getTempStatus = (t: number) =>
    t >= 75 ? { label: "⚠ Critical", color: "#ef4444" } :
    t >= 65 ? { label: "● Optimal", color: "#f97316" } :
    { label: "● Low", color: "#3b82f6" };

  const getHumidityStatus = (h: number) =>
    h <= 35 ? { label: "● Dry", color: "#f59e0b" } :
    h <= 55 ? { label: "● Optimal", color: "#3b82f6" } :
    { label: "⚠ High", color: "#ef4444" };

  const getLightStatus = (l: number) =>
    l >= 1000 ? { label: "● Intense", color: "#f59e0b" } :
    l >= 700 ? { label: "● Optimal", color: "#eab308" } :
    { label: "● Low", color: "#94a3b8" };

  const tempStatus = getTempStatus(temperature);
  const humidityStatus = getHumidityStatus(humidity);
  const lightStatus = getLightStatus(light);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-slate-800" style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
            Real-time Environment
          </h2>
          <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>
            Machine #01 — Dryer Bay A
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full bg-emerald-400 ${pulsing ? "scale-150" : ""} transition-transform`}
              style={{ display: "inline-block" }}
            />
            <span className="text-emerald-600" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 ml-2">
            <RefreshCw size={12} className={pulsing ? "animate-spin" : ""} />
            <span style={{ fontSize: "0.7rem" }}>
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* Machine ID badge */}
      <div className="flex items-center gap-2 mb-5 p-3 bg-slate-50 rounded-lg border border-slate-100">
        <Wifi size={15} className="text-emerald-500" />
        <span className="text-slate-600" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
          Device ID: FDRY-M01-BayA
        </span>
        <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full" style={{ fontSize: "0.7rem", fontWeight: 600 }}>
          Online
        </span>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-3 gap-2">
        <CircularGauge
          value={Math.round(temperature)}
          max={100}
          label="Temperature"
          unit="°C"
          color="#f97316"
          trackColor="#fed7aa"
          icon={<Thermometer size={16} />}
          size={130}
          status={tempStatus.label}
          statusColor={tempStatus.color}
        />
        <CircularGauge
          value={Math.round(humidity)}
          max={100}
          label="Humidity"
          unit="%"
          color="#3b82f6"
          trackColor="#bfdbfe"
          icon={<Droplets size={16} />}
          size={130}
          status={humidityStatus.label}
          statusColor={humidityStatus.color}
        />
        <CircularGauge
          value={Math.round(light / 1500 * 100)}
          max={100}
          label="Light Intensity"
          unit="%"
          color="#eab308"
          trackColor="#fef08a"
          icon={<Sun size={16} />}
          size={130}
          status={lightStatus.label}
          statusColor={lightStatus.color}
        />
      </div>

      {/* Mini bar indicators */}
      <div className="mt-4 space-y-2">
        {[
          { label: "Temperature", val: temperature, max: 100, color: "bg-orange-400", warn: 75 },
          { label: "Humidity", val: humidity, max: 100, color: "bg-blue-400", warn: 60 },
          { label: "Light", val: (light / 1500) * 100, max: 100, color: "bg-yellow-400", warn: 90 },
        ].map((bar) => (
          <div key={bar.label} className="flex items-center gap-2">
            <span className="text-slate-500 w-24 shrink-0" style={{ fontSize: "0.7rem" }}>
              {bar.label}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  bar.val >= bar.warn ? "bg-red-400" : bar.color
                }`}
                style={{ width: `${(bar.val / bar.max) * 100}%` }}
              />
            </div>
            <span className="text-slate-600 w-8 text-right shrink-0" style={{ fontSize: "0.7rem", fontWeight: 600 }}>
              {Math.round(bar.val)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
