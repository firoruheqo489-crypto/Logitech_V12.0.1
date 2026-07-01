export type RequirementStatus = "√" | "×" | ""

export interface TestItem {
  category: string
  id: number
  item: string
  status: RequirementStatus
  result: string
  comment: string
}

// 扁平化的单一 JSON 数组数据源
export const testData: TestItem[] = [
  // LED 球泡灯
  { category: "LED球泡灯", id: 1, item: "标志与说明", status: "√", result: "合格", comment: "" },
  { category: "LED球泡灯", id: 2, item: "互换性", status: "√", result: "合格", comment: "灯头 E27" },
  { category: "LED球泡灯", id: 3, item: "意外接触带电部件的防护", status: "√", result: "合格", comment: "" },
  { category: "LED球泡灯", id: 4, item: "潮态后的绝缘电阻", status: "√", result: "不合格：绝缘电阻 1.2MΩ，低于 2MΩ 要求", comment: "需改进灌封工艺" },
  { category: "LED球泡灯", id: 5, item: "潮态后的电气强度", status: "√", result: "", comment: "待复测" },
  { category: "LED球泡灯", id: 6, item: "机械强度", status: "√", result: "合格", comment: "" },
  { category: "LED球泡灯", id: 7, item: "耐热性", status: "×", result: "", comment: "本批次不要求" },
  { category: "LED球泡灯", id: 8, item: "故障状态", status: "√", result: "合格", comment: "" },
  { category: "LED球泡灯", id: 9, item: "谐波电流", status: "√", result: "合格", comment: "THD 8.6%" },

  // LED 平板灯
  { category: "LED平板灯", id: 1, item: "标志与说明", status: "√", result: "合格", comment: "" },
  { category: "LED平板灯", id: 2, item: "结构", status: "√", result: "合格", comment: "" },
  { category: "LED平板灯", id: 3, item: "防触电保护", status: "√", result: "合格", comment: "" },
  { category: "LED平板灯", id: 4, item: "接地措施", status: "√", result: "不合格：接地电阻 0.6Ω，超过 0.5Ω", comment: "" },
  { category: "LED平板灯", id: 5, item: "防尘防水（IP 等级）", status: "×", result: "", comment: "室内 IP20 不测" },
  { category: "LED平板灯", id: 6, item: "耐久性试验", status: "√", result: "", comment: "进行中 1000h" },
  { category: "LED平板灯", id: 7, item: "光通量与光效", status: "√", result: "合格", comment: "115 lm/W" },
  { category: "LED平板灯", id: 8, item: "色温与显色指数", status: "√", result: "合格", comment: "4000K / Ra 82" },

  // 开关插座
  { category: "开关插座", id: 1, item: "尺寸检查", status: "√", result: "合格", comment: "" },
  { category: "开关插座", id: 2, item: "防触电保护", status: "√", result: "合格", comment: "" },
  { category: "开关插座", id: 3, item: "接地措施", status: "√", result: "合格", comment: "" },
  { category: "开关插座", id: 4, item: "端子与接线", status: "√", result: "不合格：夹紧螺钉滑牙", comment: "更换端子件" },
  { category: "开关插座", id: 5, item: "正常操作（开合次数）", status: "√", result: "", comment: "目标 40000 次" },
  { category: "开关插座", id: 6, item: "温升", status: "√", result: "合格", comment: "ΔT 32K" },
  { category: "开关插座", id: 7, item: "耐热与耐燃", status: "√", result: "合格", comment: "灼热丝 850℃" },
  { category: "开关插座", id: 8, item: "拔出插头所需的力", status: "×", result: "", comment: "" },

  // 电热水壶
  { category: "电热水壶", id: 1, item: "标志与说明书", status: "√", result: "合格", comment: "" },
  { category: "电热水壶", id: 2, item: "输入功率与电流", status: "√", result: "合格", comment: "1800W" },
  { category: "电热水壶", id: 3, item: "发热与温升", status: "√", result: "合格", comment: "" },
  { category: "电热水壶", id: 4, item: "工作温度下的泄漏电流", status: "√", result: "不合格：泄漏电流 0.9mA，超 0.75mA", comment: "" },
  { category: "电热水壶", id: 5, item: "电气强度", status: "√", result: "合格", comment: "" },
  { category: "电热水壶", id: 6, item: "稳定性与机械危险", status: "√", result: "", comment: "倾倒试验待做" },
  { category: "电热水壶", id: 7, item: "非正常工作（干烧）", status: "√", result: "合格", comment: "温控器有效动作" },
  { category: "电热水壶", id: 8, item: "电源连接和外接软线", status: "√", result: "合格", comment: "" },
  { category: "电热水壶", id: 9, item: "防触电保护", status: "√", result: "合格", comment: "" },

  // 应急照明灯
  { category: "应急照明灯", id: 1, item: "标志", status: "√", result: "合格", comment: "" },
  { category: "应急照明灯", id: 2, item: "应急转换时间", status: "√", result: "合格", comment: "0.3s" },
  { category: "应急照明灯", id: 3, item: "应急工作时间", status: "√", result: "不合格：续航 78min，低于 90min", comment: "电池容量不足" },
  { category: "应急照明灯", id: 4, item: "充电性能", status: "√", result: "", comment: "" },
  { category: "应急照明灯", id: 5, item: "电池过充过放保护", status: "√", result: "合格", comment: "" },
  { category: "应急照明灯", id: 6, item: "绝缘电阻与电气强度", status: "√", result: "合格", comment: "" },
  { category: "应急照明灯", id: 7, item: "防护等级（IP）", status: "×", result: "", comment: "IP20" },
]
