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

    const toleranceWidth = usl - lsl
    const yellowLowerBound = lsl + toleranceWidth * 0.2
    const yellowUpperBound = usl - toleranceWidth * 0.2
    const yellowCount =
      toleranceWidth > 0
        ? measuredValues.filter(
            (val) =>
              (val >= lsl && val <= yellowLowerBound) ||
              (val >= yellowUpperBound && val <= usl)
          ).length
        : 0
    const yellowRate = totalCount > 0 ? ((yellowCount / totalCount) * 100).toFixed(1) : "0.0"

    const shiftValue = actualMean - nominal
    let shapeAnalysis = ""

    if (totalCount === 0) {
      shapeAnalysis = "无有效样本，无法评估分布。"
    } else if (underLslCount === totalCount) {
      shapeAnalysis = "全部样本低于下限（LSL），判定为下限全量失效。"
    } else if (overUslCount === totalCount) {
      shapeAnalysis = "全部样本高于上限（USL），判定为上限全量失效。"
    } else if (underLslCount > 0 && overUslCount > 0) {
      shapeAnalysis = "样本同时出现上、下限越界，过程失稳。"
    } else if (underLslCount > 0) {
      shapeAnalysis = "存在低于下限（LSL）的越界样本，过程向下偏移并发生失效。"
    } else if (overUslCount > 0) {
      shapeAnalysis = "存在高于上限（USL）的越界样本，过程向上偏移并发生失效。"
    } else if (shiftValue > toleranceWidth * 0.15) {
      shapeAnalysis = "整体分布呈现【偏上限】的系统性偏移"
    } else if (shiftValue < -toleranceWidth * 0.15) {
      shapeAnalysis = "整体分布呈现【偏下限】的系统性偏移"
    } else if (Number(yellowRate) >= 15.0) {
      shapeAnalysis = `均值虽居中，但散布离散度过大。高达 ${yellowRate}% 的样本游走在边缘黄区，存在极高的自然干涉与越界风险`
    } else {
      shapeAnalysis = "分布居中且收敛良好，无显著系统性风险"
    }

    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(
      2,
      "0"
    )}`

    const auditLine = `【数据稽核】当前维度共测定 ${totalCount} Pcs 样本。超出上限 ${overUslCount} Pcs，低于下限 ${underLslCount} Pcs，落入边缘黄区 ${yellowCount} Pcs，单项合格率 ${yieldRate}%。`
    const profileLine = `【形态测算】实测均值 ${actualMean.toFixed(3)} mm（NOM ${nominal.toFixed(3)} / LSL ${lsl.toFixed(3)} / USL ${usl.toFixed(3)}），${shapeAnalysis}`

    return {
      auditLine,
      profileLine,
      timestamp,
    }
  }, [cavityData, sampleValues, actualMean, nominal, usl, lsl])
}
