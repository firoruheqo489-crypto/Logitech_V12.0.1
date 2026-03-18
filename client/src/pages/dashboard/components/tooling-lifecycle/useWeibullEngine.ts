import { useMemo } from "react";
import type { WeibullParameters } from "./toolingLifecycleModel";
import { DEFAULT_WEIBULL_PARAMETERS } from "./toolingLifecycleModel";
import {
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
  parameters: WeibullParameters = DEFAULT_WEIBULL_PARAMETERS
): WeibullEngineOutput {
  return useMemo(() => {
    const activeEta = getActiveEta(parameters, isCalibrated);
    const currentReliability =
      getReliabilityRatio(currentShots, activeEta) * 100;
    const currentHazardRate = hazardRate(currentShots, activeEta);
    const wearOutThreshold = getWearOutThreshold(activeEta);

    return {
      parameters,
      activeEta,
      currentReliability,
      currentHazardRate,
      wearOutThreshold,
    };
  }, [currentShots, isCalibrated, parameters]);
}
