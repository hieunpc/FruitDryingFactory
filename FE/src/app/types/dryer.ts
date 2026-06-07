/**
 * Dryer API Response Types
 * Maps to /api/v1/dryers/{dryerId} endpoint
 */

export interface Sensor {
  sensor_id: number;
  sensor_type: "temperature" | "humidity" | string;
  threshold: number;
  last_value: number;
  updated_at: string;
}

export interface Control {
  control_id: number;
  control_name: string;
  control_type: "fan" | "lamp" | string;
  status: "active" | "inactive" | "on" | "off" | string;
}

export interface DryerDetail {
  dry_id: number;
  dry_name: string;
  status: "Idle" | "Running" | "Alert" | "Offline" | string;
  area_id: number;
  created_at: string;
  sensors: Sensor[];
  controls: Control[];
}

export interface DryerApiResponse {
  status: "success" | "error";
  data: DryerDetail;
  message?: string;
}
