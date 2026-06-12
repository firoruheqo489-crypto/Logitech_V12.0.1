"use client";

import { create } from "zustand";

export const ARRHENIUS_BOLTZMANN_K = 8.6173e-5;
export const ARRHENIUS_KELVIN_OFFSET = 273.15;
export const HOURS_PER_YEAR = 8760;
export const ROOM_TEMP = 25;

type ArrheniusInputs = {
  tUse: number;
  tOven: number;
  ea: number;
  duration: number;
  targetYears: number;
  dailyHours: number;
};

export type ArrheniusComputed = {
  af: number;
  projectedLife: number;
  survivalYears: number;
  hoursPerYear: number;
  targetLifeHours: number;
  requiredTestHours: number;
  deltaT: number;
  tCoreTest: number;
  tUseK: number;
  tCoreTestK: number;
  inverseTemperatureDelta: number;
  exponent: number;
  valid: boolean;
};

export type ArrheniusStoreState = ArrheniusInputs &
  ArrheniusComputed & {
    k: number;
    setTUse: (tUse: number) => void;
    setTOven: (tOven: number) => void;
    setEa: (ea: number) => void;
    setDuration: (duration: number) => void;
    setTargetYears: (targetYears: number) => void;
    setDailyHours: (dailyHours: number) => void;
  };

export function calculateArrhenius({
  tUse,
  tOven,
  ea,
  duration,
  targetYears,
  dailyHours,
  k = ARRHENIUS_BOLTZMANN_K,
}: ArrheniusInputs & { k?: number }): ArrheniusComputed {
  const deltaT = tUse - ROOM_TEMP;
  const tCoreTest = tOven + deltaT;
  const tUseK = tUse + ARRHENIUS_KELVIN_OFFSET;
  const tCoreTestK = tCoreTest + ARRHENIUS_KELVIN_OFFSET;
  const inverseTemperatureDelta = 1 / tUseK - 1 / tCoreTestK;
  const exponent = (ea / k) * inverseTemperatureDelta;
  const af = Math.exp(exponent);
  const projectedLife = duration * af;
  const hoursPerYear = dailyHours * 365;
  const survivalYears = projectedLife / hoursPerYear;
  const targetLifeHours = targetYears * hoursPerYear;
  const requiredTestHours = targetLifeHours / af;

  return {
    af,
    projectedLife,
    survivalYears,
    hoursPerYear,
    targetLifeHours,
    requiredTestHours,
    deltaT,
    tCoreTest,
    tUseK,
    tCoreTestK,
    inverseTemperatureDelta,
    exponent,
    valid: tCoreTest > tUse,
  };
}

const DEFAULT_INPUTS: ArrheniusInputs = {
  tUse: 127,
  tOven: 45,
  ea: 0.9,
  duration: 500,
  targetYears: 3,
  dailyHours: 24,
};

function computeNextState(inputs: ArrheniusInputs, k: number) {
  return {
    ...inputs,
    ...calculateArrhenius({ ...inputs, k }),
  };
}

const initialComputed = calculateArrhenius(DEFAULT_INPUTS);

export const useArrheniusStore = create<ArrheniusStoreState>((set) => ({
  ...DEFAULT_INPUTS,
  k: ARRHENIUS_BOLTZMANN_K,
  ...initialComputed,
  setTUse: (tUse) =>
    set((state) => ({
      ...computeNextState(
        {
          tUse,
          tOven: state.tOven,
          ea: state.ea,
          duration: state.duration,
          targetYears: state.targetYears,
          dailyHours: state.dailyHours,
        },
        state.k,
      ),
    })),
  setTOven: (tOven) =>
    set((state) => ({
      ...computeNextState(
        {
          tUse: state.tUse,
          tOven,
          ea: state.ea,
          duration: state.duration,
          targetYears: state.targetYears,
          dailyHours: state.dailyHours,
        },
        state.k,
      ),
    })),
  setEa: (ea) =>
    set((state) => ({
      ...computeNextState(
        {
          tUse: state.tUse,
          tOven: state.tOven,
          ea,
          duration: state.duration,
          targetYears: state.targetYears,
          dailyHours: state.dailyHours,
        },
        state.k,
      ),
    })),
  setDuration: (duration) =>
    set((state) => ({
      ...computeNextState(
        {
          tUse: state.tUse,
          tOven: state.tOven,
          ea: state.ea,
          duration,
          targetYears: state.targetYears,
          dailyHours: state.dailyHours,
        },
        state.k,
      ),
    })),
  setTargetYears: (targetYears) =>
    set((state) => ({
      ...computeNextState(
        {
          tUse: state.tUse,
          tOven: state.tOven,
          ea: state.ea,
          duration: state.duration,
          targetYears,
          dailyHours: state.dailyHours,
        },
        state.k,
      ),
    })),
  setDailyHours: (dailyHours) =>
    set((state) => ({
      ...computeNextState(
        {
          tUse: state.tUse,
          tOven: state.tOven,
          ea: state.ea,
          duration: state.duration,
          targetYears: state.targetYears,
          dailyHours,
        },
        state.k,
      ),
    })),
}));
