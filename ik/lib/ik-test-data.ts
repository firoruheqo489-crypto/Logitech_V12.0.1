import { z } from "zod"

const statusValueSchema = z.boolean().nullable().describe("勾选为 true，明确未勾选为 false，无法判断或漏勾选为 null")

export const ikTestDataSchema = z.object({
  equipment: z.object({
    name: z.string().describe("钢球或冲击设备名称"),
    specification: z.string().describe("设备规格"),
    dropHeight: z.string().describe("落球或冲击高度，保留单位"),
    isChecked: z.boolean().describe("该设备是否被选中"),
  }),
  target: z.object({
    sampleName: z.string().describe("样品编号与名称"),
    model: z.string().describe("产品型号"),
    testPart: z.string().describe("试验部位"),
    selectedIKLevel: z.string().regex(/^IK\d{2}$/).describe("选中的 IK 等级，如 IK08"),
    status: z.object({
      isDamaged: statusValueSchema.describe("样品是否损坏"),
      affectsWaterproof: statusValueSchema.describe("是否影响防水"),
      affectsInsulation: statusValueSchema.describe("是否影响绝缘"),
      affectsFunction: statusValueSchema.describe("是否影响功能或耐压"),
    }),
  }),
  energy: z.object({
    ikLevel: z.string().regex(/^IK\d{2}$/).describe("能量对应的 IK 等级"),
    impactEnergyJ: z.number().nonnegative().describe("选中 IK 等级对应的焦耳数，仅数值"),
    hammerMass: z.string().describe("冲击锤或钢球质量，保留单位；未找到时填写未记录"),
    dropHeight: z.string().describe("落高，保留单位；未找到时填写未记录"),
  }),
  result: z.object({
    finalResult: z.enum(["PASS", "FAIL"]),
    tester: z.string().describe("试验人；未找到时填写未记录"),
    testDate: z.string().describe("试验日期，按原文保留"),
    reviewer: z.string().describe("审核人；未找到时填写未记录"),
    reviewDate: z.string().describe("审核日期，按原文保留"),
  }),
  appendix: z.object({
    hasImage: z.boolean().describe("PDF 是否包含试验附录图片"),
    imageSrc: z.string().describe("解析接口不提取图片，此字段固定为空字符串"),
    caption: z.string().describe("附录图片内容的简短说明；无图片时填写暂无附录图片"),
  }),
})

export type IKTestData = z.infer<typeof ikTestDataSchema>
export type StatusValue = boolean | null

export const IK_ENERGY_VALUES: Record<string, number> = {
  IK07: 2,
  IK08: 5,
  IK09: 10,
  IK10: 20,
}

export const IK_ENERGY_MAP = Object.entries(IK_ENERGY_VALUES).map(
  ([level, joules]) => ({ level, joules }),
)

export function validateEnergyMapping(data: IKTestData): IKTestData {
  if (data.energy.ikLevel !== data.target.selectedIKLevel) {
    throw new Error("解析结果中的 IK 等级不一致")
  }

  const expected = IK_ENERGY_VALUES[data.target.selectedIKLevel]
  if (expected !== undefined && data.energy.impactEnergyJ !== expected) {
    throw new Error(
      `${data.target.selectedIKLevel} 应对应 ${expected.toFixed(1)} J，解析结果不一致`,
    )
  }

  return data
}

export const ikTestData: IKTestData = {
  equipment: {
    name: "1.7kg 钢球",
    specification: "1.7kg 钢球",
    dropHeight: "30 cm",
    isChecked: true,
  },
  target: {
    sampleName: "D26A012-1-1 LG240 100W 投光灯",
    model: "LG240",
    testPart: "玻璃",
    selectedIKLevel: "IK08",
    status: {
      isDamaged: false,
      affectsWaterproof: null,
      affectsInsulation: null,
      affectsFunction: null,
    },
  },
  energy: {
    ikLevel: "IK08",
    impactEnergyJ: 5,
    hammerMass: "1.7 kg",
    dropHeight: "30 cm",
  },
  result: {
    finalResult: "PASS",
    tester: "李景祥",
    testDate: "2026/7/23",
    reviewer: "蔡雷",
    reviewDate: "2026/7/23",
  },
  appendix: {
    hasImage: true,
    imageSrc: "",
    caption: "附录：试验对象与钢球冲击部位图片",
  },
}
