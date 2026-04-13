import type { EventType } from "@/lib/mold-health-types";

export interface WeibullParameters {
  beta: number;
  etaNormal: number;
  etaDegraded: number;
}

export type MaintenanceEventLabelKey =
  | "routine_pm"
  | "slider_jam"
  | "ejector_pin_break";

export interface MaintenanceEvent {
  id: string;
  shots: number;
  type: "PM" | "CM";
  sourceType: EventType;
  labelKey: MaintenanceEventLabelKey;
  recoveryRate?: number;
}

export interface ToolingLifecycleState {
  currentShots: number;
  isCalibrated: boolean;
  events: MaintenanceEvent[];
}

export const DEFAULT_WEIBULL_PARAMETERS: WeibullParameters = {
  beta: 1.8,
  etaNormal: 1_000_000,
  etaDegraded: 800_000,
};

export const DEFAULT_MAINTENANCE_EVENTS: MaintenanceEvent[] = [];

export const DEFAULT_TOOLING_LIFECYCLE_STATE: ToolingLifecycleState = {
  currentShots: 0,
  isCalibrated: false,
  events: DEFAULT_MAINTENANCE_EVENTS,
};
