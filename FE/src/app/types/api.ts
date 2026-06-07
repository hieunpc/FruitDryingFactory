/**
 * API Response Types
 */

export interface Factory {
  fac_id: number;
  fac_name: string;
}

export interface Area {
  area_id: number;
  area_name: string;
  fac_id: number;
}

export interface Dryer {
  dry_id: number;
  dry_name: string;
  status: string;
  area_id: number;
}

export interface Fruit {
  fruit_id: number;
  fruit_name: string;
}

export interface Sensor {
  sensor_id: number;
  sensor_name: string;
  sensor_type: 'temperature' | 'humidity' | 'light';
  dry_id: number;
  last_value: number;
  threshold?: number;
  created_at?: string;
}

export interface LightSensor extends Sensor {
  sensor_type: 'light';
}

export interface LightSensorData {
  sensor_id: number;
  sensor_name: string;
  sensor_type: 'light';
  dry_id: number;
  current_value: number;
  last_value: number;
  threshold?: number;
  unit?: string; // Đơn vị đo (lux, %)
  status: 'normal' | 'warning' | 'alert';
  updated_at?: string;
}

