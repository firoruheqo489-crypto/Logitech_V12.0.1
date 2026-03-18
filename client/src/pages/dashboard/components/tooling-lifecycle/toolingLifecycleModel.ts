export interface WeibullParameters {
  beta: number;
  etaNormal: number;
  etaDegraded: number;
}

export interface MaintenanceEvent {
  id: string;
  shots: number;
  type: "PM" | "CM";
  label: string;
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
  { id: "evt-1", shots: 120_000, type: "PM", label: "常规保养 (PM)" },
  { id: "evt-2", shots: 280_500, type: "CM", label: "滑块卡滞 (CM)" },
  { id: "evt-3", shots: 420_000, type: "CM", label: "顶针断裂 (CM)" },
];

export const DEFAULT_TOOLING_LIFECYCLE_STATE: ToolingLifecycleState = {
  currentShots: 250_000,
  isCalibrated: false,
  events: DEFAULT_MAINTENANCE_EVENTS,
};
