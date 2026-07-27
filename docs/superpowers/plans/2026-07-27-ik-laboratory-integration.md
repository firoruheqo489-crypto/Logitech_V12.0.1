# IK Laboratory Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `ik` 原生迁入 V3 主站，并作为实验室下拉模块完整进入解析、摘要、草稿、归档和打印链。

**Architecture:** 将 IK 数据契约与 UI 放入独立的 `ik-impact` 客户端目录，由 `IkImpactWorkspace` 适配实验室摘要接口；实验室契约只负责注册和分派。服务端把原 Next Route Handler 等价改为 Express + multer 路由，并保留 AI 提示词、Zod 校验及能量映射校验。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Express、multer、Vercel AI SDK、Zod、Tailwind CSS。

---

## 文件结构

- `client/src/pages/dashboard/components/ik-impact/ik-test-data.ts`：IK Schema、示例数据与能量映射校验。
- `client/src/pages/dashboard/components/ik-impact/ik-summary.ts`：把 IK 数据转换为实验室标准摘要。
- `client/src/pages/dashboard/components/ik-impact/IkImpactWorkspace.tsx`：保留原页面状态和布局，并桥接实验室摘要。
- `client/src/pages/dashboard/components/ik-impact/IkDashboard.tsx`：原 IK 结果看板。
- `client/src/pages/dashboard/components/ik-impact/PdfUploadPanel.tsx`：原 PDF 上传面板，接口地址适配到主站。
- `client/src/pages/dashboard/components/ik-impact/StatusPill.tsx`：原判定状态组件。
- `server/routes/dashboard-ik-pdf.ts`：IK PDF 上传、AI 解析与服务端校验。
- `client/src/pages/dashboard/components/laboratory/laboratory-contract.ts`：注册 `IK_IMPACT`。
- `client/src/pages/dashboard/components/LaboratoryPdfParserDashboard.tsx`：分派 `IK_IMPACT` 工作区。
- `server/index.ts`：注册 IK 解析路由。

### Task 1: 注册实验室 IK 模块契约

**Files:**
- Modify: `client/src/pages/dashboard/components/laboratory/laboratory-contract.test.ts`
- Modify: `client/src/pages/dashboard/components/laboratory/laboratory-contract.ts`

- [ ] **Step 1: 写失败测试**

在模块契约测试中断言：

```ts
expect(LABORATORY_MODULES).toContainEqual({
  type: "IK_IMPACT",
  label: "IK 冲击试验",
  printTitle: "IK 冲击试验报告",
  category: "可靠性",
  uploadMode: "single-pdf",
  supportsPrint: true,
  parserEndpoint: "/api/dashboard/ik-pdf/parse-upload",
})
```

- [ ] **Step 2: 验证测试因缺少模块而失败**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/laboratory/laboratory-contract.test.ts`

Expected: FAIL，`LABORATORY_MODULES` 中找不到 `IK_IMPACT`。

- [ ] **Step 3: 最小实现模块类型与定义**

将 `"IK_IMPACT"` 加入 `TelemetryNodeType`，并把上述定义追加到 `LABORATORY_MODULES`。

- [ ] **Step 4: 验证契约测试通过**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/laboratory/laboratory-contract.test.ts`

Expected: PASS。

### Task 2: 迁入 IK 数据契约与实验室摘要

**Files:**
- Create: `client/src/pages/dashboard/components/ik-impact/ik-test-data.ts`
- Create: `client/src/pages/dashboard/components/ik-impact/ik-summary.ts`
- Create: `client/src/pages/dashboard/components/ik-impact/ik-summary.test.ts`

- [ ] **Step 1: 写 Schema、能量映射和摘要失败测试**

测试应断言：IK08 必须对应 5 J；等级不一致时抛出错误；PASS 数据生成 `parsed/PASS` 摘要；FAIL 数据生成 `fail/FAIL` 摘要；摘要保留 `moduleData`。

```ts
expect(buildIkImpactModuleSummary(3, ikTestData, "sample.pdf")).toMatchObject({
  nodeId: 3,
  type: "IK_IMPACT",
  label: "IK 冲击试验",
  verdict: "PASS",
  status: "parsed",
  sourceFiles: ["sample.pdf"],
  moduleData: ikTestData,
})
```

- [ ] **Step 2: 验证测试因文件缺失而失败**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/ik-impact/ik-summary.test.ts`

Expected: FAIL，无法解析 `ik-summary` 或 `ik-test-data`。

- [ ] **Step 3: 迁入数据契约并实现摘要映射**

从 `ik/lib/ik-test-data.ts` 原样迁入 Schema、`IK_ENERGY_VALUES`、`IK_ENERGY_MAP`、`validateEnergyMapping` 和 `ikTestData`。实现：

```ts
export function buildIkImpactModuleSummary(
  nodeId: number,
  data: IKTestData,
  sourceName: string,
): LaboratoryModuleSummary {
  const pass = data.result.finalResult === "PASS"
  return {
    nodeId,
    type: "IK_IMPACT",
    label: "IK 冲击试验",
    printTitle: "IK 冲击试验报告",
    category: "可靠性",
    status: pass ? "parsed" : "fail",
    verdict: data.result.finalResult,
    sourceFiles: sourceName === "示例记录" ? [] : [sourceName],
    keyMetrics: [
      { label: "样品", value: data.target.sampleName },
      { label: "型号", value: data.target.model },
      { label: "试验部位", value: data.target.testPart },
      { label: "IK 等级", value: data.target.selectedIKLevel },
      { label: "冲击能量", value: `${data.energy.impactEnergyJ.toFixed(1)} J` },
      { label: "试验人", value: data.result.tester },
      { label: "审核人", value: data.result.reviewer },
    ],
    warnings: pass ? [] : ["IK 冲击试验最终判定为 FAIL。"],
    moduleData: data,
  }
}
```

- [ ] **Step 4: 验证数据与摘要测试通过**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/ik-impact/ik-summary.test.ts`

Expected: PASS。

### Task 3: 迁入 IK UI 并挂载实验室分派

**Files:**
- Create: `client/src/pages/dashboard/components/ik-impact/StatusPill.tsx`
- Create: `client/src/pages/dashboard/components/ik-impact/IkDashboard.tsx`
- Create: `client/src/pages/dashboard/components/ik-impact/PdfUploadPanel.tsx`
- Create: `client/src/pages/dashboard/components/ik-impact/IkImpactWorkspace.tsx`
- Create: `client/src/pages/dashboard/components/ik-impact/ik-impact-integration.structure.test.ts`
- Modify: `client/src/pages/dashboard/components/LaboratoryPdfParserDashboard.tsx`

- [ ] **Step 1: 写挂载结构失败测试**

读取 `LaboratoryPdfParserDashboard.tsx` 并断言包含 `IkImpactWorkspace` 导入、`case "IK_IMPACT"` 和 `onSummaryChange` 传递；读取上传面板并断言请求 `/api/dashboard/ik-pdf/parse-upload`。

- [ ] **Step 2: 验证测试因 UI 尚未迁入而失败**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/ik-impact/ik-impact-integration.structure.test.ts`

Expected: FAIL，缺少 `IkImpactWorkspace` 或分派 case。

- [ ] **Step 3: 原样迁入 UI 并实现包装层**

复制 `ik` 中三个 UI 组件，只改主站导入路径和请求地址。包装层恢复 `initialSummary.moduleData`，否则使用示例数据；每次数据或来源变化时调用：

```ts
useEffect(() => {
  onSummaryChange(buildIkImpactModuleSummary(nodeId, data, sourceName))
}, [data, nodeId, onSummaryChange, sourceName])
```

并在 `renderTelemetryModule` 增加：

```tsx
case "IK_IMPACT":
  return (
    <IkImpactWorkspace
      key={`ik-impact-${nodeId}`}
      nodeId={nodeId}
      onSummaryChange={onSummaryChange}
      initialSummary={context?.initialSummary}
    />
  )
```

- [ ] **Step 4: 验证挂载结构测试和摘要测试通过**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/ik-impact`

Expected: PASS。

### Task 4: 适配 Express IK PDF 解析路由

**Files:**
- Create: `server/routes/dashboard-ik-pdf.ts`
- Create: `server/routes/dashboard-ik-pdf.test.ts`
- Modify: `server/index.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: 写服务端校验失败测试**

测试导出的 `validateIkUpload`：无文件返回 400、非 PDF 返回 400、空文件返回 400、超过 15 MB 返回 400、有效 PDF 返回文件；测试解析函数对 Schema 或能量映射错误返回 422。

- [ ] **Step 2: 验证测试因路由文件缺失而失败**

Run: `pnpm exec vitest run server/routes/dashboard-ik-pdf.test.ts`

Expected: FAIL，无法解析 `dashboard-ik-pdf`。

- [ ] **Step 3: 安装原模块 AI SDK 运行时依赖**

Run: `pnpm add ai@^7.0.37`

Expected: `package.json` 与 `pnpm-lock.yaml` 更新，安装成功。

- [ ] **Step 4: 实现 Express 路由**

使用 `multer.memoryStorage()` 和 15 MB 限制；复制原 `EXTRACTION_PROMPT`；用 `generateText({ model: "google/gemini-2.5-flash", output: Output.object({ schema: ikTestDataSchema }) })`；执行 `validateEnergyMapping`；成功响应 `{ data }`，验证错误响应 422，其他错误响应 500。

- [ ] **Step 5: 在主服务注册路由**

在 `server/index.ts` 导入 `parseDashboardIkPdfUpload` 并注册：

```ts
app.post("/api/dashboard/ik-pdf/parse-upload", parseDashboardIkPdfUpload)
```

- [ ] **Step 6: 验证路由测试通过**

Run: `pnpm exec vitest run server/routes/dashboard-ik-pdf.test.ts`

Expected: PASS。

### Task 5: 全量验证与范围复核

**Files:**
- Modify only if verification exposes an IK integration compatibility issue.

- [ ] **Step 1: 运行 IK 与实验室相关测试**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/ik-impact client/src/pages/dashboard/components/laboratory/laboratory-contract.test.ts server/routes/dashboard-ik-pdf.test.ts`

Expected: PASS，0 failures。

- [ ] **Step 2: 运行类型检查**

Run: `pnpm run check`

Expected: exit 0；只修复本次接入造成的类型问题。

- [ ] **Step 3: 运行生产构建**

Run: `pnpm run build`

Expected: exit 0，客户端与服务端产物生成成功。

- [ ] **Step 4: 检查改动范围**

Run: `git status --short` and `git diff --check`

Expected: 无空白错误；已有用户修改保持原状；IK 接入只涉及计划列出的文件及依赖锁文件。
