/**
 * Utility to convert API DryerDetail response to Machine interface
 */
import { DryerDetail } from "../types/dryer";

export interface Machine {
  id: string;
  name: string;
  zoneID: string;
  areaId: number;
  factoryId: number;
  status: "running" | "offline" | "alert" | "idle";
  temp: number;
  humidity: number;
  mode: "auto" | "manual";
  isOn: boolean;
  fruit: string;
  runHours: number;
  batchCode: string;
  dryingStage: string;
  sensors: Array<{ id: string; name: string; type: string; value: string; updated_at: string }>;
  outputDevices: Array<{ id: string; name: string; type: string; status: "on" | "off" }>;
}

export const convertDryerToMachine = (dryer: DryerDetail | undefined | null): Machine | null => {
  // Handle undefined or null dryer
  if (!dryer) {
    return null;
  }

  // Safely access sensors array
  const sensors = dryer.sensors || [];
  const controls = dryer.controls || [];

  const temperatureSensor = sensors.find(s => s.sensor_type === 'temperature');
  const humiditySensor = sensors.find(s => s.sensor_type === 'humidity');

  return {
    id: `D${dryer.dry_id}`,
    name: dryer.dry_name,
    zoneID: `zone${dryer.area_id}`,
    areaId: dryer.area_id,
    factoryId: 1,
    status: dryer.status === 'Running' ? 'running' : dryer.status === 'Idle' ? 'idle' : dryer.status === 'Stopped' ? 'offline' : 'alert',
    temp: temperatureSensor?.last_value ?? 0,
    humidity: humiditySensor?.last_value ?? 0,
    mode: 'auto',
    isOn: dryer.status === 'Running' || dryer.status === 'Idle',
    fruit: '',
    runHours: 0,
    batchCode: '',
    dryingStage: dryer.status,
    sensors: sensors.map(s => ({
      id: `S${s.sensor_id}`,
      name: s.sensor_type.charAt(0).toUpperCase() + s.sensor_type.slice(1),
      type: s.sensor_type,
      value: `${(s.last_value !== undefined && s.last_value !== null) ? s.last_value.toFixed(2) : '0'}${s.sensor_type === 'temperature' ? '°C' : '%'}`,
      updated_at: s.updated_at != null ? s.updated_at : new Date().toISOString(),
    })),
    outputDevices: controls.map(c => ({
      id: `C${c.control_id}`,
      name: c.control_name,
      type: c.control_type,
      status: (c.status === 'active' || c.status === 'on') ? 'on' : 'off',
    })),
  };
};

