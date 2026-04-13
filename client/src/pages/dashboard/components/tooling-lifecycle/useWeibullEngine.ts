import { useMemo } from "react";
import type { MaintenanceEvent, WeibullParameters } from "./toolingLifecycleModel";
import { DEFAULT_WEIBULL_PARAMETERS } from "./toolingLifecycleModel";
import {
  getLivingWeibullBeta,
  getActiveEta,
  getReliabilityRatio,
  getWearOutThreshold,
  hazardRate,
} from "./toolingLifecycleMath";

interface WeibullEngineOutput {
  parameters: WeibullParameters;
  activeEta: number;
  currentReliability: number;
  currentHazardRate: number;
  wearOutThreshold: number;
}

export function useWeibullEngine(
  currentShots: number,
  isCalibrated: boolean,
  repairHistory: MaintenanceEvent[],
  parameters: WeibullParameters = DEFAULT_WEIBULL_PARAMETERS
): WeibullEngineOutput {
  return useMemo(() => {
    const activeEta = getActiveEta(parameters, isCalibrated);
    const dynamicBeta = getLivingWeibullBeta(currentShots, activeEta, repairHistory);
    const currentReliability =
      getReliabilityRatio(currentShots, activeEta, repairHistory) * 100;
    const currentHazardRate = hazardRate(currentShots, activeEta, repairHistory);
    const wearOutThreshold = getWearOutThreshold(activeEta);

    return {
      parameters: {
        ...parameters,
        beta: dynamicBeta,
      },
      activeEta,
      currentReliability,
      currentHazardRate,
      wearOutThreshold,
    };
  }, [currentShots, isCalibrated, parameters, repairHistory]);
}
