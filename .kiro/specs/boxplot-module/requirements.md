# Requirements Document

## Introduction

将已有的独立箱线图模块（xiangxiantu）集成到主仪表盘应用中，作为新的 Tab 页"箱线图"。该模块提供过程方差与能力监控工作台，包含 SVG 箱线图、KPI 卡片、洞察面板和控制台。

## Glossary

- **Dashboard**: 主仪表盘应用，基于 Vite + React + TypeScript 构建
- **Boxplot_Module**: 箱线图模块，包含 ProcessVarianceWorkspace 主组件及其子组件
- **DASHBOARD_TABS**: 仪表盘 Tab 注册数组，定义所有可用 Tab 的 ID 和顺序
- **PUBLIC_DASHBOARD_TABS**: 无需管理员模式即可访问的公开 Tab 子集
- **LazyWorkspace**: 仪表盘中用于懒加载模块的 Suspense 包装组件
- **BoxplotChart**: SVG 箱线图组件，渲染多维方差分析图表
- **KPICards**: KPI 摘要卡片行组件
- **InsightPanel**: 稳定性仪表盘和异常分布面板组件
- **ControlConsole**: 图表参数控制台组件（开关、选择器、输入框）

## Requirements

### Requirement 1: Tab 注册

**User Story:** As a dashboard user, I want to see a "箱线图" tab in the dashboard navigation, so that I can access the boxplot analysis workspace.

#### Acceptance Criteria

1. THE Dashboard SHALL include 'boxplot' as an entry in the DASHBOARD_TABS array, positioned immediately after 'fmea-analysis'
2. THE Dashboard SHALL display the label "箱线图" for the 'boxplot' tab in the tab navigation strip
3. THE Dashboard SHALL include the 'boxplot' tab in PUBLIC_DASHBOARD_TABS so that it is visible without admin mode

### Requirement 2: 模块懒加载

**User Story:** As a developer, I want the boxplot module to be lazy-loaded, so that it does not increase the initial bundle size of the dashboard.

#### Acceptance Criteria

1. THE Dashboard SHALL lazy-load the Boxplot_Module using React.lazy and dynamic import
2. THE Dashboard SHALL wrap the Boxplot_Module in a LazyWorkspace component when the 'boxplot' tab is selected
3. WHEN the 'boxplot' tab is selected, THE Dashboard SHALL render the ProcessVarianceWorkspace component

### Requirement 3: 组件迁移

**User Story:** As a developer, I want the boxplot components to be placed in the dashboard component directory following existing conventions, so that the codebase remains consistent.

#### Acceptance Criteria

1. THE Boxplot_Module SHALL consist of a main workspace file (ProcessVarianceWorkspace) and its sub-components (BoxplotChart, KPICards, InsightPanel, ControlConsole)
2. THE Boxplot_Module SHALL use path alias imports (e.g. @/components/ui/...) consistent with the main project's tsconfig paths
3. THE Boxplot_Module SHALL NOT contain "use client" directives since the project uses Vite, not Next.js
4. THE Boxplot_Module SHALL reuse existing shadcn/ui components (Button, Switch, Input, Select) from the main project
5. THE Boxplot_Module SHALL reuse lucide-react icons already available in the main project

### Requirement 4: 功能完整性

**User Story:** As a quality engineer, I want the boxplot workspace to provide full process variance analysis capabilities, so that I can monitor manufacturing quality.

#### Acceptance Criteria

1. WHEN the 'boxplot' tab is active, THE Boxplot_Module SHALL render a header with title "过程方差与能力监控工作台"
2. WHEN the 'boxplot' tab is active, THE Boxplot_Module SHALL render 5 KPI summary cards (总样本量, 平均偏差, 系统稳定性, 过程能力指数, 异常检测数)
3. WHEN the 'boxplot' tab is active, THE Boxplot_Module SHALL render an SVG boxplot chart with USL/LSL spec limit lines, whiskers, IQR boxes, median lines, mean diamonds, and outlier markers
4. WHEN the 'boxplot' tab is active, THE Boxplot_Module SHALL render an insight panel with stability gauge and anomaly distribution bars
5. WHEN the 'boxplot' tab is active, THE Boxplot_Module SHALL render a control console with data source selection, chart parameter toggles, and spec limit inputs

### Requirement 5: 交互控制

**User Story:** As a quality engineer, I want to control chart display parameters, so that I can customize the visualization for different analysis needs.

#### Acceptance Criteria

1. WHEN the user toggles "显示均值连线", THE BoxplotChart SHALL show or hide the mean connecting line across all boxplots
2. WHEN the user toggles "显示置信区间", THE BoxplotChart SHALL show or hide confidence interval bands around each boxplot
3. WHEN the user toggles "高亮异常值", THE BoxplotChart SHALL show or hide outlier markers with color-coded indicators (red for above USL, cyan for below LSL, amber for in-spec outliers)
4. WHEN the user changes USL or LSL values, THE BoxplotChart SHALL update the spec limit lines and outlier color coding accordingly
5. WHEN the user hovers over a boxplot IQR box, THE BoxplotChart SHALL display a tooltip with Q1, Median, Q3, IQR, Mean, Max, Min, and outlier count
6. WHEN the user selects a label display mode (mean/median/none), THE BoxplotChart SHALL display the corresponding value label above each mean diamond
