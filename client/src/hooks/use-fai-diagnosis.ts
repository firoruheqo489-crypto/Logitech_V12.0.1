"use client"

import { useMemo } from "react"

export interface DataAuditResult {
  auditLine: string
  profileLine: string
  timestamp: string
}

interface AuditInput {
  cavityData: Array<{ value: number; status: "OK" | "+NG" | "-NG" }>
  sampleValues?: number[]
  actualMean: number
  nominal: number
  usl: number
  lsl: number
}

export function useFaiDiagnosis({
  cavityData,
  sampleValues,
  actualMean,
  nominal,
  usl,
  lsl,
}: AuditInput): DataAuditResult {
  return useMemo(() => {
    const measuredValues =
      sampleValues && sampleValues.length > 0
        ? sampleValues
        : cavityData.map((item) => item.value)

    const totalCount = measuredValues.length
    const overUslCount = measuredValues.filter((value) => value > usl).length
    const underLslCount = measuredValues.filter((value) => value < lsl).length
    const okCount = totalCount - overUslCount - underLslCount
    const yieldRate = totalCount > 0 ? ((okCount / totalCount) * 100).toFixed(1) : "0.0"

    const shiftValue = actualMean - nominal
    const toleranceWidth = usl - lsl

    let profileConclusion: string
    if (totalCount === 0) {
      profileConclusion = "无有效样本，无法评估分布。"
    } else if (underLslCount === totalCount) {
      profileConclusion = "全部样本低于下限（LSL），判定为下限全量失效。"
    } else if (overUslCount === totalCount) {
      profileConclusion = "全部样本高于上限（USL），判定为上限全量失效。"
    } else if (underLslCount > 0 && overUslCount > 0) {
      profileConclusion = "样本同时出现上、下限越界，过程失稳。"
    } else if (underLslCount > 0) {
      profileConclusion = "存在低于下限（LSL）的越界样本，过程向下偏移并发生失效。"
    } else if (overUslCount > 0) {
      profileConclusion = "存在高于上限（USL）的越界样本，过程向上偏移并发生失效。"
    } else if (toleranceWidth > 0 && shiftValue > toleranceWidth * 0.15) {
      profileConclusion = "样本均在公差内，但整体偏上限。"
    } else if (toleranceWidth > 0 && shiftValue < -toleranceWidth * 0.15) {
      profileConclusion = "样本均在公差内，但整体偏下限。"
    } else {
      profileConclusion = "样本均在公差内，分布居中且无显著偏移。"
    }

    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

    const auditLine = `【数据稽核】当前维度共测定 ${totalCount} Pcs 样本。其中超过上限 ${overUslCount} Pcs、低于下限 ${underLslCount} Pcs，单项合格率 ${yieldRate}%。`
    const profileLine = `【形态测算】实测均值 ${actualMean.toFixed(3)} mm（NOM ${nominal.toFixed(3)} / LSL ${lsl.toFixed(3)} / USL ${usl.toFixed(3)}），${profileConclusion}`

    return {
      auditLine,
      profileLine,
      timestamp,
    }
  }, [cavityData, sampleValues, actualMean, nominal, usl, lsl])
}
