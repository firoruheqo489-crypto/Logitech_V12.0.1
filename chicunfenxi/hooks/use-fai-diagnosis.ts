"use client"

import { useMemo } from "react"

export interface DataAuditResult {
  auditLine: string      // 【数据稽核】line
  profileLine: string    // 【形态测算】line
  timestamp: string
}

interface AuditInput {
  cavityData: Array<{ value: number; status: "OK" | "+NG" | "-NG" }>
  actualMean: number
  nominal: number
  usl: number
  lsl: number
}

/**
 * Hardcore Data Checklist Hook
 * 
 * Pure data aggregation and fill-in-the-blank template.
 * NO trend guessing. NO subjective judgments.
 * Only counts, rates, and shift direction.
 */
export function useFaiDiagnosis({
  cavityData,
  actualMean,
  nominal,
  usl,
  lsl,
}: AuditInput): DataAuditResult {
  return useMemo(() => {
    // === Data Aggregation Layer ===
    const totalCount = cavityData.length
    const overUslCount = cavityData.filter((c) => c.value > usl).length
    const underLslCount = cavityData.filter((c) => c.value < lsl).length
    const okCount = totalCount - overUslCount - underLslCount
    const yieldRate = totalCount > 0 
      ? ((okCount / totalCount) * 100).toFixed(1)
      : "0.0"
    
    const shiftValue = actualMean - nominal
    const toleranceWidth = usl - lsl

    // === Shift Direction Matrix (15% threshold) ===
    let shiftStatus: string
    if (shiftValue > toleranceWidth * 0.15) {
      shiftStatus = "偏上限"
    } else if (shiftValue < -toleranceWidth * 0.15) {
      shiftStatus = "偏下限"
    } else {
      shiftStatus = "无显著偏移"
    }

    // === Timestamp ===
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // === Strict Text Template (fill-in-the-blank only) ===
    const auditLine = `【数据稽核】当前维度共测定 ${totalCount} Pcs 样本。其中超出上限 ${overUslCount} Pcs，低于下限 ${underLslCount} Pcs，该尺寸单项合格率为 ${yieldRate}%。`
    
    const profileLine = `【形态测算】实测均值为 ${actualMean.toFixed(3)}mm，对比标准中值，整体分布呈现 ${shiftStatus}。`

    return {
      auditLine,
      profileLine,
      timestamp,
    }
  }, [cavityData, actualMean, nominal, usl, lsl])
}
