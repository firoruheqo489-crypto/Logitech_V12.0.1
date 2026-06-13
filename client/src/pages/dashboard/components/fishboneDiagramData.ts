export type FishboneBranch = "top" | "bottom";
export type FishboneTemplateId = "manufacturing" | "software" | "blank";

export interface FishboneCause {
  id: string;
  text: string;
}

export interface FishboneCategory {
  id: string;
  title: string;
  titleEn: string;
  branch: FishboneBranch;
  causes: FishboneCause[];
}

export interface FishboneDiagramState {
  templateId: FishboneTemplateId;
  problem: string;
  impact: string;
  rootCause: string;
  categories: FishboneCategory[];
}

export interface FishboneTemplateCategory {
  title: string;
  titleEn: string;
  branch: FishboneBranch;
  causes: string[];
}

export interface FishboneTemplateDefinition {
  id: FishboneTemplateId;
  name: string;
  description: string;
  problem: string;
  impact: string;
  rootCause: string;
  categories: FishboneTemplateCategory[];
}

export const FISHBONE_TEMPLATES: FishboneTemplateDefinition[] = [
  {
    id: "manufacturing",
    name: "5M1E 模板",
    description: "适合制造异常、品质问题和试模不良分析。",
    problem: "注塑件良率下降，连续三批次出现毛边与尺寸漂移。",
    impact: "返工率升高，节拍拉长，客户投诉风险增加。",
    rootCause: "当前怀疑工艺窗口收窄，并叠加设备状态与换班执行差异。",
    categories: [
      {
        title: "人员",
        titleEn: "Man",
        branch: "top",
        causes: ["换班交接不完整", "新员工参数理解偏差", "巡检频次不稳定"],
      },
      {
        title: "设备",
        titleEn: "Machine",
        branch: "top",
        causes: ["锁模压力波动", "模温机响应滞后", "顶针磨损未及时更换"],
      },
      {
        title: "材料",
        titleEn: "Material",
        branch: "top",
        causes: ["原料含水率偏高", "回料比例超标", "批次黏度差异较大"],
      },
      {
        title: "方法",
        titleEn: "Method",
        branch: "bottom",
        causes: ["保压切换点未复核", "首件确认流程跳步", "异常闭环时间过长"],
      },
      {
        title: "测量",
        titleEn: "Measurement",
        branch: "bottom",
        causes: ["量具校准临期", "抽检样本过少", "判定标准解释不一致"],
      },
      {
        title: "环境",
        titleEn: "Environment",
        branch: "bottom",
        causes: ["夜班温湿度波动", "料房干燥等待过久", "现场照明不足影响目检"],
      },
    ],
  },
  {
    id: "software",
    name: "研发复盘模板",
    description: "适合线上事故、缺陷复盘与发布问题分析。",
    problem: "发布后用户无法提交关键表单，转换率明显下滑。",
    impact: "核心流程中断，客服工单增加，回滚占用研发资源。",
    rootCause: "需求、实现、验证和发布协同可能同时失效，而不只是单点代码问题。",
    categories: [
      {
        title: "需求",
        titleEn: "Requirement",
        branch: "top",
        causes: ["异常路径未写入验收标准", "字段兼容规则未明确", "灰度范围定义模糊"],
      },
      {
        title: "设计",
        titleEn: "Design",
        branch: "top",
        causes: ["状态流转遗漏回退场景", "接口契约未锁定", "容错策略只覆盖理想路径"],
      },
      {
        title: "代码",
        titleEn: "Code",
        branch: "top",
        causes: ["表单校验与后端规则不一致", "特性开关默认值错误", "边界数据未加保护"],
      },
      {
        title: "测试",
        titleEn: "Testing",
        branch: "bottom",
        causes: ["回归用例缺少首单场景", "联调环境样本过于单一", "自动化断言未覆盖失败态"],
      },
      {
        title: "发布",
        titleEn: "Release",
        branch: "bottom",
        causes: ["变更说明未同步客服", "监控告警阈值过宽", "回滚预案未提前演练"],
      },
      {
        title: "协作",
        titleEn: "Collaboration",
        branch: "bottom",
        causes: ["值班响应链路不清晰", "问题升级路径滞后", "复盘结论未回流模板"],
      },
    ],
  },
  {
    id: "blank",
    name: "空白模板",
    description: "从零开始补分类和原因，适合现场头脑风暴。",
    problem: "把这里改成你要分析的问题。",
    impact: "补充影响范围、客户感知或产线损失。",
    rootCause: "写下当前最值得验证的假设。",
    categories: [
      {
        title: "分类 1",
        titleEn: "Category 1",
        branch: "top",
        causes: ["待补充原因"],
      },
      {
        title: "分类 2",
        titleEn: "Category 2",
        branch: "top",
        causes: ["待补充原因"],
      },
      {
        title: "分类 3",
        titleEn: "Category 3",
        branch: "bottom",
        causes: ["待补充原因"],
      },
      {
        title: "分类 4",
        titleEn: "Category 4",
        branch: "bottom",
        causes: ["待补充原因"],
      },
    ],
  },
];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createFishboneCause(text = ""): FishboneCause {
  return {
    id: makeId("cause"),
    text,
  };
}

export function materializeFishboneTemplate(
  templateId: FishboneTemplateId
): FishboneDiagramState {
  const template =
    FISHBONE_TEMPLATES.find((item) => item.id === templateId) ?? FISHBONE_TEMPLATES[0];

  return {
    templateId: template.id,
    problem: template.problem,
    impact: template.impact,
    rootCause: template.rootCause,
    categories: template.categories.map((category) => ({
      id: makeId("category"),
      title: category.title,
      titleEn: category.titleEn,
      branch: category.branch,
      causes: category.causes.map((cause) => createFishboneCause(cause)),
    })),
  };
}

export function normalizeFishboneState(input: unknown): FishboneDiagramState | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<FishboneDiagramState>;
  if (!Array.isArray(candidate.categories) || typeof candidate.problem !== "string") {
    return null;
  }

  const templateId = FISHBONE_TEMPLATES.some((item) => item.id === candidate.templateId)
    ? (candidate.templateId as FishboneTemplateId)
    : "manufacturing";

  const categories = candidate.categories
    .map((category, index) => {
      if (!category || typeof category !== "object") {
        return null;
      }

      const value = category as Partial<FishboneCategory>;
      const title =
        typeof value.title === "string" && value.title.trim().length > 0
          ? value.title
          : `分类 ${index + 1}`;

      return {
        id: typeof value.id === "string" ? value.id : makeId("category"),
        title,
        titleEn: typeof value.titleEn === "string" ? value.titleEn : "",
        branch: value.branch === "bottom" ? "bottom" : "top",
        causes: Array.isArray(value.causes)
          ? value.causes
              .map((cause) => {
                if (!cause || typeof cause !== "object") {
                  return null;
                }

                const causeValue = cause as Partial<FishboneCause>;
                return {
                  id: typeof causeValue.id === "string" ? causeValue.id : makeId("cause"),
                  text: typeof causeValue.text === "string" ? causeValue.text : "",
                };
              })
              .filter((cause): cause is FishboneCause => cause !== null)
          : [],
      };
    })
    .filter((category): category is FishboneCategory => category !== null);

  if (categories.length === 0) {
    return null;
  }

  return {
    templateId,
    problem: candidate.problem,
    impact: typeof candidate.impact === "string" ? candidate.impact : "",
    rootCause: typeof candidate.rootCause === "string" ? candidate.rootCause : "",
    categories,
  };
}

export function getNextFishboneBranch(categories: FishboneCategory[]): FishboneBranch {
  const topCount = categories.filter((category) => category.branch === "top").length;
  const bottomCount = categories.length - topCount;
  return topCount <= bottomCount ? "top" : "bottom";
}

export function getSelectedFishboneCategory(
  categories: FishboneCategory[],
  selectedId: string
) {
  return categories.find((category) => category.id === selectedId) ?? categories[0] ?? null;
}

export function getFishboneBranchLabel(branch: FishboneBranch) {
  return branch === "top" ? "上支路" : "下支路";
}
