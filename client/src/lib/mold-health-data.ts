import type { MoldAssetInfo, MoldHealthEvent } from "./mold-health-types"

export const MOCK_ASSET: MoldAssetInfo = {
  moldId: "LA26021",
  moldName: "Mold Maintenance History",
  material: "--",
  cavityCount: 0,
  totalShots: 0,
  designLife: 1_000_000,
  currentReliability: 1,
  weibullBeta: 1.85,
  weibullEta: 1_000_000,
  lastMaintenanceDate: new Date("2026-03-26T00:00:00"),
  nextScheduledMaintenance: new Date("2026-03-26T00:00:00"),
  healthScore: 100,
  riskLevel: "LOW",
}

export const MOCK_EVENTS: MoldHealthEvent[] = []
