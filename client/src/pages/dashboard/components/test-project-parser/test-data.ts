export type SectionKey = 'routine' | 'destructive' | 'reliability'

export interface TestItem {
  id: string
  name: string
  standard: string
}

export interface CategoryData {
  id: string
  name: string
  sections: Record<SectionKey, TestItem[]>
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  routine: '常规测试项目',
  destructive: '破坏性测试项目',
  reliability: '可靠性测试项目',
}

export const SECTION_LABELS_EN: Record<SectionKey, string> = {
  routine: 'Routine',
  destructive: 'Destructive',
  reliability: 'Reliability',
}

export const SECTION_LABELS_PRINT: Record<SectionKey, string> = {
  routine: '常规测试',
  destructive: '破坏性测试',
  reliability: '可靠性测试',
}

let uid = 0

function item(name: string, standard: string): TestItem {
  uid += 1
  return { id: `t${uid}`, name, standard }
}

const commonRoutine: [string, string][] = [
  ['积分球光电测试', 'LM-79 / GB/T 24824，光通量、色温、显指、光效'],
  ['功率与功率因数', '额定电压下实测，偏差 ≤ ±10%'],
  ['输入电流谐波', 'IEC 61000-3-2 Class C'],
  ['绝缘电阻测试', 'DC 500V，≥ 2MΩ'],
  ['耐压测试 (Hi-Pot)', 'AC 1500V / 3750V，60s 无击穿'],
  ['接地连续性', '≤ 0.1Ω @ 25A（I 类灯具）'],
  ['启动时间测试', '通电至稳定点亮 ≤ 0.5s'],
  ['频闪测试', 'IEEE 1789，波动深度 ≤ 8% (低风险)'],
  ['温升测试', 'GB 7000.1，关键点温度不超限值'],
  ['外观与尺寸检验', '图纸公差要求，无划伤/色差/毛刺'],
]

const commonDestructive: [string, string][] = [
  ['跌落测试', 'GB/T 2423.8，1m 高度自由跌落 ×3 次'],
  ['冲击测试', 'IK08 弹簧冲击锤 5J'],
  ['拉力/扭力测试', '电源线拉力 60N / 扭矩 0.35N·m'],
  ['灼热丝测试', 'IEC 60695-2-11，650°C / 850°C'],
  ['针焰测试', 'IEC 60695-11-5，燃烧 ≤ 30s'],
  ['球压测试', 'IEC 60695-10-2，125°C 压痕 ≤ 2mm'],
  ['螺纹扭矩破坏', '螺钉锁附 5 次后扭矩不衰减 > 20%'],
  ['端子强度测试', 'GB 7000.1 第 14/15 章'],
  ['破坏性拆解分析', '内部工艺、爬电距离与电气间隙检查'],
]

const commonReliability: [string, string][] = [
  ['高温老化', '55°C 满载连续点亮 168h'],
  ['低温启动', '-25°C 存储 4h 后正常启动'],
  ['冷热冲击', '-40°C ↔ +85°C，30min/循环 ×50 次'],
  ['恒温恒湿', '40°C / 93%RH，96h 后功能正常'],
  ['开关寿命测试', '30s 通 / 30s 断，≥ 10,000 次'],
  ['电压波动测试', '额定电压 ±20% 扫描运行 24h'],
  ['浪涌冲击测试', 'IEC 61000-4-5，L-N 1kV / L-PE 2kV'],
  ['静电放电 (ESD)', 'IEC 61000-4-2，接触 4kV / 空气 8kV'],
  ['光衰维持率', 'LM-80 参考，1000h 光通维持率 ≥ 97%'],
]

function build(
  id: string,
  name: string,
  extra: Partial<Record<SectionKey, [string, string][]>> = {},
): CategoryData {
  return {
    id,
    name,
    sections: {
      routine: [...commonRoutine, ...(extra.routine ?? [])].map(([itemName, standard]) =>
        item(itemName, standard),
      ),
      destructive: [...commonDestructive, ...(extra.destructive ?? [])].map(
        ([itemName, standard]) => item(itemName, standard),
      ),
      reliability: [...commonReliability, ...(extra.reliability ?? [])].map(
        ([itemName, standard]) => item(itemName, standard),
      ),
    },
  }
}

export const CATEGORIES: CategoryData[] = [
  build('indoor', '室内灯具', {
    routine: [['眩光等级评估', 'UGR ≤ 19（办公场景）']],
    reliability: [['长期点亮寿命抽测', '常温连续点亮 1000h 抽样']],
  }),
  build('outdoor', '户外灯具', {
    routine: [['IP 防护等级测试', 'IP65/IP66 淋水与粉尘试验']],
    destructive: [['盐雾测试', 'GB/T 2423.17，中性盐雾 96h/240h']],
    reliability: [
      ['紫外老化测试', 'GB/T 16422.3，UV-B 313nm 300h'],
      ['振动测试', 'GB/T 2423.10，10-55Hz 扫频 3 轴向'],
    ],
  }),
  build('portable', '桌面/移动照明', {
    routine: [['触摸/调光功能检验', '全档位调光无闪烁、无异响']],
    destructive: [['翻倒测试', 'GB 7000.204，倾斜 6° 不翻倒']],
    reliability: [['充放电循环测试', '0.5C 充放电 ≥ 300 次容量 ≥ 80%']],
  }),
  build('linear', '线型/柔性照明', {
    routine: [['色容差一致性', '同批次 SDCM ≤ 3']],
    destructive: [['弯折寿命测试', '最小弯折半径反复弯折 ≥ 500 次']],
    reliability: [['硅胶黄变测试', 'UV 照射 168h，Δb* ≤ 1.5']],
  }),
  build('driver', '驱动电源/电池', {
    routine: [
      ['输出纹波测试', '纹波电流 ≤ 输出电流 10%'],
      ['效率测试', '满载效率 ≥ 88%'],
    ],
    destructive: [
      ['短路保护测试', '输出短路 1h 不起火、可自恢复'],
      ['过压过流保护', 'OVP/OCP 阈值验证'],
    ],
    reliability: [['满载高温老化', '60°C 满载 500h 后参数漂移 ≤ 5%']],
  }),
  build('smart', '智能控制部件', {
    routine: [
      ['无线协议一致性', 'BLE Mesh / Zigbee 3.0 认证测试'],
      ['配网成功率', '配网 100 次成功率 ≥ 99%'],
    ],
    destructive: [['按键寿命破坏', '实体按键 ≥ 50,000 次动作']],
    reliability: [
      ['射频拉距测试', '空旷环境通信距离 ≥ 30m'],
      ['断电记忆测试', '断电重启 100 次状态保持正确'],
    ],
  }),
]
