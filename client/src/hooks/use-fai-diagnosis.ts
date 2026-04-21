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
    const flatValues = measuredValues

    const totalCount = measuredValues.length
    const overUslCount = measuredValues.filter((value) => value > usl).length
    const underLslCount = measuredValues.filter((value) => value < lsl).length
    const okCount = totalCount - overUslCount - underLslCount
    const yieldRate =
      totalCount > 0 ? ((okCount / totalCount) * 100).toFixed(1) : "0.0"

    // 1. 散布指标测算
    const toleranceWidth = usl - lsl
    const yellowLowerBound = lsl + toleranceWidth * 0.2
    const yellowUpperBound = usl - toleranceWidth * 0.2
    const yellowCount =
      toleranceWidth > 0
        ? measuredValues.filter(
            (value) =>
              (value >= lsl && value <= yellowLowerBound) ||
              (value >= yellowUpperBound && value <= usl)
          ).length
        : 0
    const yellowRate =
      totalCount > 0 ? ((yellowCount / totalCount) * 100).toFixed(1) : "0.0"

    const maxValue =
      measuredValues.length > 0 ? Math.max(...measuredValues) : nominal
    const minValue =
      measuredValues.length > 0 ? Math.min(...measuredValues) : nominal
    const range = maxValue - minValue
    const spreadRatio =
      toleranceWidth > 0 ? range / toleranceWidth : Number.POSITIVE_INFINITY
    const isHighVariance = Number(yellowRate) >= 15.0 || spreadRatio > 0.5
    const isModerateVariance =
      !isHighVariance && (Number(yellowRate) > 0 || spreadRatio > 0.33)
    const spreadPercentText = Number.isFinite(spreadRatio)
      ? (spreadRatio * 100).toFixed(0)
      : "∞"
    const varianceText =
      spreadRatio > 0.5
        ? `散布极差占公差带总宽的 ${spreadPercentText}%`
        : `边缘黄区占比 ${yellowRate}%`

    // 2. GR&R 测量系统冗余
    const grrBuffer = toleranceWidth * 0.05
    const absoluteLSL = lsl - grrBuffer
    const absoluteUSL = usl + grrBuffer
    const absoluteDefects = flatValues.filter(
      (value) => value < absoluteLSL || value > absoluteUSL
    ).length
    const absoluteDefectRate =
      totalCount > 0 ? absoluteDefects / totalCount : 0
    const nominalDefectRate =
      totalCount > 0 ? (underLslCount + overUslCount) / totalCount : 0

    // 3. 新增：靶心偏离率 (Ca) 与空间切片边界
    const halfTolerance = toleranceWidth / 2
    const shiftAmount = actualMean - nominal
    const caRate =
      halfTolerance > 0
        ? (Math.abs(shiftAmount) / halfTolerance) * 100
        : Number.POSITIVE_INFINITY
    const isShiftUp = shiftAmount > 0
    const fiftyPercentLine = isShiftUp
      ? nominal + halfTolerance * 0.5
      : nominal - halfTolerance * 0.5
    const cross50Count = flatValues.filter((value) =>
      isShiftUp ? value >= fiftyPercentLine : value <= fiftyPercentLine
    ).length

    // 4. 严重度路由判定
    let shapeAnalysis = ""

    if (totalCount === 0) {
      shapeAnalysis = "无有效样本，无法评估分布。"
    } else if (
      actualMean <= absoluteLSL ||
      actualMean >= absoluteUSL ||
      absoluteDefectRate >= 0.5
    ) {
      const disasterDirection =
        actualMean <= absoluteLSL || underLslCount > overUslCount
          ? "跌破绝对下限"
          : "突破绝对上限"
      if (isHighVariance) {
        shapeAnalysis = `【绝对超差】实测均值已整体${disasterDirection}（已扣除测量系统误差冗余），数据极度发散（${varianceText}）。制程已实质性失效。`
      } else {
        shapeAnalysis = `【绝对超差】实测均值已整体${disasterDirection}（已扣除测量系统误差冗余），整体分布已系统性平移至绝对失效区。`
      }
    } else if (
      actualMean <= lsl ||
      actualMean >= usl ||
      nominalDefectRate >= 0.5
    ) {
      const edgeDirection = actualMean <= lsl ? "触碰下限" : "触碰上限"
      shapeAnalysis = `【临界超差】实测均值或批量样本已${edgeDirection}，但仍落入测量系统 ${(grrBuffer * 1000).toFixed(1)}μm 的物理误差缓冲带内。制程处于干涉边缘，存在假性失效风险，请引入 CMM 复核或人工实配验判。`
    } else if (caRate > 15.0) {
      const shiftDirection = isShiftUp ? "向上限" : "向下限"
      const shiftSign = isShiftUp ? "+" : "-"
      const limitName = isShiftUp ? "上限" : "下限"
      const spatialDesc = `共 ${cross50Count} Pcs 跨越单边 50% 控制区间，其中 ${yellowCount} Pcs 触及 80% 边缘黄区`

      if (isHighVariance) {
        shapeAnalysis = `数据整体${shiftDirection}偏移（偏离靶心 ${shiftSign}${Math.abs(
          shiftAmount
        ).toFixed(3)}mm）。由于散布较大且整体偏心（${spatialDesc}），距离${limitName}的安全缓冲空间已极度匮乏，后续生产极易发生批量超差。`
      } else if (isModerateVariance) {
        shapeAnalysis = `数据整体${shiftDirection}偏移（偏离靶心 ${shiftSign}${Math.abs(
          shiftAmount
        ).toFixed(3)}mm）。分布伴随中度散布（${spatialDesc}），导致靠近${limitName}的安全缓冲带被大幅压缩，制程容错率降低。`
      } else {
        shapeAnalysis = `数据整体${shiftDirection}偏移（偏离靶心 ${shiftSign}${Math.abs(
          shiftAmount
        ).toFixed(3)}mm），但样本形态高度集中。虽然数据一致性好，但整体偏心导致单侧安全空间变窄。`
      }
    } else if (isHighVariance) {
      shapeAnalysis = `均值居中，但散布离散度大（${varianceText}），样本呈现显著的发散分布形态。`
    } else if (isModerateVariance) {
      shapeAnalysis = `均值居中，呈现轻微至中度的散布趋势（极差占公差带宽 ${spreadPercentText}%）。`
    } else {
      shapeAnalysis = "分布居中且高度收敛，统计学形态优异且受控。"
    }

    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
      now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

    const auditLine = `【数据稽核】当前维度共测定 ${totalCount} Pcs 样本。超出上限 ${overUslCount} Pcs，低于下限 ${underLslCount} Pcs，落入边缘黄区 ${yellowCount} Pcs，单项合格率 ${yieldRate}%。`
    const profileLine = `【形态测算】实测均值 ${actualMean.toFixed(
      3
    )} mm（NOM ${nominal.toFixed(3)} / LSL ${lsl.toFixed(3)} / USL ${usl.toFixed(
      3
    )}），${shapeAnalysis}`

    return {
      auditLine,
      profileLine,
      timestamp,
    }
  }, [cavityData, sampleValues, actualMean, nominal, usl, lsl])
}
