export type Status = "P" | "F" | "N"

export type StandardType = "rigid" | "soft"

export interface TestItem {
  code: string
  name: string
  standard: string
  result?: string
  status: Status
  note?: string
  risk?: boolean
}

export interface ReportModule {
  key: "S" | "E" | "P" | "R"
  name: string
  fullName: string
  summaryStatus: Status
  standardType: StandardType
  standard: string
  items: TestItem[]
}

export interface ReportMeta {
  title: string
  subtitle: string
  oaNumber: string
  applicant: string
  productModel: string
  sampleCount: string
  receiveDate: string
  testDate: string
  tester: string
  testerDate: string
  reviewer: string
  reviewerDate: string
  environment: {
    temp: string
    humidity: string
  }
}

export interface ReportTable {
  title: string
  columns: string[]
  rows: string[][]
  caption?: string
}

export interface TemperatureAppendix extends ReportTable {
  ambient: string
  voltage: string
}

export interface FinalSampleReportData {
  meta: ReportMeta
  modules: ReportModule[]
  appendixTemperature: TemperatureAppendix
  appendixPhotometric: ReportTable
  appendixDimension: ReportTable
}

export interface ModuleStats {
  total: number
  executed: number
  pass: number
  fail: number
  untested: number
  coverage: number
}

export interface OverallStats {
  total: number
  executed: number
  fail: number
  untested: number
  coverage: number
  moduleTotal: number
  modulePass: number
  modulePassRate: number
  riskCount: number
}

export interface RiskCard {
  level: string
  title: string
  body: string
  tags: string[]
}

const MODULE_DEFS: Array<Pick<ReportModule, "key" | "name" | "fullName" | "standardType">> = [
  { key: "S", name: "安规", fullName: "第一章 · 安规 / Safety", standardType: "rigid" },
  { key: "E", name: "EMC", fullName: "第二章 · 电磁兼容 / EMC", standardType: "rigid" },
  { key: "P", name: "性能", fullName: "第三章 · 功能及性能 / Performance", standardType: "soft" },
  { key: "R", name: "可靠性", fullName: "第四章 · 可靠性及其它 / Reliability", standardType: "soft" },
]

const ITEM_ENRICHMENTS: Record<string, Partial<Pick<TestItem, "note" | "risk">>> = {
  S6: { risk: true, note: "人身安全关键项未闭环" },
  S9: { risk: true, note: "接地防线未见闭环数据" },
  S12: { risk: true, note: "绝缘防线未见闭环数据" },
  S14: { note: "有数据路径，明细未给判定" },
  S17: { note: "有参数，明细未给判定" },
  E2: { note: "指向外部报告" },
  E3: { note: "有参数，明细未给判定" },
  E4: { note: "指向外部报告" },
  P1: { risk: true, note: "总评不合格来源" },
  P8: { risk: true, note: "未提供适配器 · 核心功能未验证仍流转" },
  R1: { risk: true, note: "可靠性真空" },
  R2: { risk: true, note: "可靠性真空" },
  R3: { risk: true, note: "可靠性真空" },
  R4: { risk: true, note: "可靠性真空" },
  R5: { risk: true, note: "可靠性真空" },
  R6: { risk: true, note: "可靠性真空" },
  R7: { risk: true, note: "可靠性真空" },
}

export const INITIAL_REPORT_DATA: FinalSampleReportData = {
  meta: {
    title: "终样测试报告",
    subtitle: "Final Sample Test Report · A1 版本",
    oaNumber: "--",
    applicant: "--",
    productModel: "--",
    sampleCount: "--",
    receiveDate: "--",
    testDate: "--",
    tester: "--",
    testerDate: "--",
    reviewer: "--",
    reviewerDate: "--",
    environment: { temp: "--", humidity: "--" },
  },
  modules: MODULE_DEFS.map((def) => ({
    ...def,
    summaryStatus: "N",
    standard: "--",
    items: [],
  })),
  appendixTemperature: {
    title: "附件 1 · 温度测试数据",
    ambient: "--",
    voltage: "--",
    columns: ["温度点", "6W (℃)", "12W (℃)", "16W (℃)"],
    rows: [],
    caption: "源表附录1",
  },
  appendixPhotometric: {
    title: "附件 2 · 光色电数据记录",
    columns: ["样品型号", "电压(DC)", "功率(W)", "光通量(lm)", "显色指数(Ra)", "色温(K)"],
    rows: [],
    caption: "源表附录2",
  },
  appendixDimension: {
    title: "附件 3 · 尺寸重量数据记录",
    columns: ["样品型号", "整灯重量(g)", "整灯尺寸(mm)"],
    rows: [],
    caption: "源表附录4",
  },
}

function cleanCell(value: unknown): string {
  return String(value ?? "").replace(/\r/g, "").trim()
}

function joinSegments(...segments: Array<string | undefined>): string {
  return segments
    .map((segment) => cleanCell(segment))
    .filter(Boolean)
    .join("\n")
    .trim()
}

function stripEnglishLines(value: string): string {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const kept = lines.filter((line) => /[\u4e00-\u9fff]/.test(line) || !/[A-Za-z]{3,}/.test(line))
  return (kept.length ? kept : lines).join(" ").replace(/\s+/g, " ").trim()
}

function extractPrimaryText(value: string): string {
  return stripEnglishLines(value).split("/")[0].trim()
}

function normalizeDate(value: string): string {
  const cleaned = cleanCell(value)
  const shortDateMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (shortDateMatch) {
    const [, month, day, year] = shortDateMatch
    return `20${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  return cleaned
}

function firstMeaningful(row: string[], indexes: number[]): string {
  for (const index of indexes) {
    const value = cleanCell(row[index])
    if (value) return value
  }
  return ""
}

function extractTail(row: string[]): { result?: string; status: Status } {
  const tail = row
    .slice(14)
    .map((cell) => cleanCell(cell))
    .filter(Boolean)

  if (tail.length === 0) return { status: "N" }

  const statuses = tail.filter((cell) => cell === "P" || cell === "F" || cell === "N") as Status[]
  const status = statuses[0] ?? "N"
  const result = tail.filter((cell) => cell !== "P" && cell !== "F" && cell !== "N").join(" ")
  return {
    result: result ? stripEnglishLines(result) : undefined,
    status,
  }
}

function buildModuleShells(): Record<ReportModule["key"], ReportModule> {
  const shells = {} as Record<ReportModule["key"], ReportModule>
  for (const def of MODULE_DEFS) {
    shells[def.key] = {
      ...def,
      summaryStatus: "N",
      standard: "--",
      items: [],
    }
  }
  return shells
}

function parseModuleSummaries(rows: string[][], modules: Record<ReportModule["key"], ReportModule>) {
  const summaryRows: Array<{ key: ReportModule["key"]; row: number }> = [
    { key: "S", row: 11 },
    { key: "E", row: 12 },
    { key: "P", row: 13 },
    { key: "R", row: 14 },
  ]

  for (const { key, row } of summaryRows) {
    const cells = rows[row] ?? []
    const status = (cells
      .slice(10)
      .map((cell) => cleanCell(cell))
      .find((cell) => cell === "P" || cell === "F" || cell === "N") ?? "N") as Status
    modules[key].summaryStatus = status
    modules[key].standard = stripEnglishLines(firstMeaningful(cells, [4, 3])) || "--"
  }
}

function isChapterRow(value: string): boolean {
  return /^第[一二三四]/.test(value)
}

function parseItems(rows: string[][], modules: Record<ReportModule["key"], ReportModule>) {
  let currentItem: TestItem | null = null

  for (let rowIndex = 29; rowIndex <= 97; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const code = cleanCell(row[0])

    if (/^[SEPR]\d+$/.test(code)) {
      const key = code.charAt(0) as ReportModule["key"]
      const name = extractPrimaryText(cleanCell(row[2])) || code
      const standard = stripEnglishLines(cleanCell(row[4])) || "--"
      const tail = extractTail(row)
      const enrichment = ITEM_ENRICHMENTS[code] ?? {}

      currentItem = {
        code,
        name,
        standard,
        result: tail.result,
        status: tail.status,
        note: enrichment.note,
        risk: enrichment.risk || tail.status === "F",
      }
      modules[key].items.push(currentItem)
      continue
    }

    if (!currentItem) continue

    const continuationText = [row[0], row[2], row[4]]
      .map((cell) => cleanCell(cell))
      .filter((cell) => cell && !isChapterRow(cell))
      .map(stripEnglishLines)
      .filter(Boolean)
      .join("\n")

    if (continuationText) {
      currentItem.standard = joinSegments(currentItem.standard, continuationText)
    }
  }
}

function parseMeta(rows: string[][]): ReportMeta {
  const testerLine = cleanCell(rows[23]?.[0])
  const reviewerLine = cleanCell(rows[23]?.[8])
  const testerMatch = testerLine.match(/测试\/日期：(.+?)\s+(\d{4}\/\d{1,2}\/\d{1,2})/)
  const reviewerMatch = reviewerLine.match(/审核\/日期:\s*(.+?)\s+(\d{4}\/\d{1,2}\/\d{1,2})/)

  return {
    title: "终样测试报告",
    subtitle: "Final Sample Test Report · A1 版本",
    oaNumber: cleanCell(rows[1]?.[4]) || "--",
    applicant: cleanCell(rows[2]?.[4]) || "--",
    productModel: (cleanCell(rows[3]?.[4]) || "--").replaceAll("/", " / "),
    sampleCount: (cleanCell(rows[4]?.[4]) || "--").replace("*", " × "),
    receiveDate: normalizeDate(cleanCell(rows[7]?.[4]) || "--"),
    testDate: normalizeDate(cleanCell(rows[8]?.[4]) || "--"),
    tester: testerMatch?.[1]?.trim() || "--",
    testerDate: testerMatch?.[2]?.replaceAll("/", "-") || "--",
    reviewer: reviewerMatch?.[1]?.trim() || "--",
    reviewerDate: reviewerMatch?.[2]?.replaceAll("/", "-") || "--",
    environment: {
      temp: cleanCell(rows[17]?.[4]) || "--",
      humidity: cleanCell(rows[18]?.[4]) || "--",
    },
  }
}

function createEmptyTemperatureAppendix(): TemperatureAppendix {
  return {
    title: "附件 1 · 温度测试数据",
    ambient: "--",
    voltage: "--",
    columns: ["温度点", "6W (℃)", "12W (℃)", "16W (℃)"],
    rows: [],
    caption: "附件不参与解析",
  }
}

function createEmptyPhotometricAppendix(): ReportTable {
  return {
    title: "附件 2 · 光色电数据记录",
    caption: "附件不参与解析",
    columns: ["样品型号", "电压(DC)", "功率(W)", "光通量(lm)", "显色指数(Ra)", "色温(K)"],
    rows: [],
  }
}

function createEmptyDimensionAppendix(): ReportTable {
  return {
    title: "附件 3 · 尺寸重量数据记录",
    caption: "附件不参与解析",
    columns: ["样品型号", "整灯重量(g)", "整灯尺寸(mm)"],
    rows: [],
  }
}

export function parseFinalSampleReportMatrix(rows: string[][]): FinalSampleReportData {
  const modules = buildModuleShells()
  parseModuleSummaries(rows, modules)
  parseItems(rows, modules)

  return {
    meta: parseMeta(rows),
    modules: MODULE_DEFS.map((def) => modules[def.key]),
    appendixTemperature: createEmptyTemperatureAppendix(),
    appendixPhotometric: createEmptyPhotometricAppendix(),
    appendixDimension: createEmptyDimensionAppendix(),
  }
}

export function isExecuted(item: TestItem): boolean {
  return item.status !== "N" || Boolean(item.result)
}

export function getModuleStats(mod: ReportModule): ModuleStats {
  const total = mod.items.length
  if (total === 0) {
    return { total: 0, executed: 0, pass: 0, fail: 0, untested: 0, coverage: 0 }
  }

  const executed = mod.items.filter(isExecuted).length
  const pass = mod.items.filter((item) => item.status === "P").length
  const fail = mod.items.filter((item) => item.status === "F").length
  const untested = mod.items.filter((item) => item.status === "N" && !item.result).length

  return {
    total,
    executed,
    pass,
    fail,
    untested,
    coverage: Math.round((executed / total) * 100),
  }
}

export function getOverallStats(modules: ReportModule[]): OverallStats {
  const allItems = modules.flatMap((module) => module.items)
  const total = allItems.length
  const executed = allItems.filter(isExecuted).length
  const fail = allItems.filter((item) => item.status === "F").length
  const untested = allItems.filter((item) => item.status === "N" && !item.result).length
  const moduleTotal = modules.length
  const modulePass = modules.filter((module) => module.summaryStatus === "P").length
  const riskCount = allItems.filter((item) => item.risk).length

  return {
    total,
    executed,
    fail,
    untested,
    coverage: total > 0 ? Math.round((executed / total) * 100) : 0,
    moduleTotal,
    modulePass,
    modulePassRate: moduleTotal > 0 ? Math.round((modulePass / moduleTotal) * 100) : 0,
    riskCount,
  }
}

export function getRiskCards(modules: ReportModule[]): RiskCard[] {
  const allItems = modules.flatMap((module) => module.items)
  const byCode = new Map(allItems.map((item) => [item.code, item]))
  const cards: RiskCard[] = []

  const safetyCodes = ["S6", "S9", "S12"].filter((code) => byCode.get(code))
  if (safetyCodes.length > 0) {
    cards.push({
      level: "安全缺口",
      title: `安规防线缺口 · ${safetyCodes.join(" / ")}`,
      body: safetyCodes
        .map((code) => byCode.get(code)?.note || byCode.get(code)?.standard || "")
        .filter(Boolean)
        .join("；"),
      tags: safetyCodes,
    })
  }

  const perfCodes = ["P1", "P8"].filter((code) => byCode.get(code))
  if (perfCodes.length > 0) {
    cards.push({
      level: "功能失效",
      title: `性能闭环告警 · ${perfCodes.join(" / ")}`,
      body: perfCodes
        .map((code) => byCode.get(code)?.note || byCode.get(code)?.standard || "")
        .filter(Boolean)
        .join("；"),
      tags: perfCodes,
    })
  }

  const reliabilityCodes = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"].filter((code) => byCode.get(code))
  if (reliabilityCodes.length > 0) {
    cards.push({
      level: "可靠性空窗",
      title: `可靠性未闭环 · ${reliabilityCodes[0]}-${reliabilityCodes[reliabilityCodes.length - 1]}`,
      body: reliabilityCodes
        .map((code) => `${code} ${byCode.get(code)?.name}`)
        .join("、"),
      tags: reliabilityCodes.slice(0, 3).concat(reliabilityCodes.length > 3 ? ["..."] : []),
    })
  }

  if (cards.length >= 3) return cards.slice(0, 3)

  const fallback = allItems
    .filter((item) => item.status === "F" || item.risk)
    .slice(0, 3 - cards.length)
    .map((item) => ({
      level: item.status === "F" ? "直接失效" : "高风险项",
      title: `${item.code} · ${item.name}`,
      body: item.note || item.standard,
      tags: [item.code, item.status],
    }))

  return cards.concat(fallback)
}

export const statusLabel: Record<Status, string> = {
  P: "合格",
  F: "不合格",
  N: "未测 / 不适用",
}
