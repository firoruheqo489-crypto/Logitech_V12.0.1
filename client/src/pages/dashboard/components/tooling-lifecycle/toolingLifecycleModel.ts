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
  labelKey: MaintenanceEventLabelKey;
}

export interface ToolingLifecycleState {
  currentShots: number;
  isCalibrated: boolean;
  events: MaintenanceEvent[];
}

export const DEFAULT_WEIBULL_PARAMETERS: WeibullParameters = {
  beta: 1.85,
  etaNormal: 1_000_000,
  etaDegraded: 800_000,
};

export const DEFAULT_MAINTENANCE_EVENTS: MaintenanceEvent[] = [
  { id: "evt-1", shots: 120_000, type: "PM", labelKey: "routine_pm" },
  { id: "evt-2", shots: 280_500, type: "CM", labelKey: "slider_jam" },
  { id: "evt-3", shots: 420_000, type: "CM", labelKey: "ejector_pin_break" },
];

export const DEFAULT_TOOLING_LIFECYCLE_STATE: ToolingLifecycleState = {
  currentShots: 250_000,
  isCalibrated: false,
  events: DEFAULT_MAINTENANCE_EVENTS,
};
