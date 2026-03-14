/**
 * importGanttAction — Excel → GanttData 标准化映射
 *
 * 将用户上传的 Excel (通常来自模具厂的项目计划表)
 * 映射为系统内部的 TaskNode 数据结构。
 *
 * 列名标准化映射表 (硬编码)：
 * ┌──────────────────────────┬──────────────────────┐
 * │ Excel 列名 (参考)         │ 数据库字段 (Schema)   │
 * ├──────────────────────────┼──────────────────────┤
 * │ 热流道/模架 (子系统)       │ sub_path (→ track)   │
 * │ 前模仁/后模仁/镶件/滑块    │ task_group (→ track)  │
 * │ 铣床/CNC开粗/HRC...       │ stage                │
 * │ 计划预计时间               │ baseline_start       │
 * │ 计划完成时间               │ baseline_end         │
 * │ 实际开始时间               │ actual_start         │
 * │ 实际完成时间               │ actual_end           │
 * │ 进度 (%)                  │ progress             │
 * │ 状态                      │ status               │
 * └──────────────────────────┴──────────────────────┘
 */

import type { TaskNode, TrackId, PhaseType, TaskStatusType } from './ganttEngine';

// ═══════════════════════════════════════════════════════════════════════════════
// Column Mapping — Excel 列名 → 内部字段
// ═══════════════════════════════════════════════════════════════════════════════

/** Excel 列名到内部字段的映射（支持多种常见写法） */
export const COLUMN_MAP: Record<string, string[]> = {
  // sub_path / track
  sub_path: ['子系统', '热流道/模架', 'sub_path', 'subsystem', '系统'],
  task_group: ['组件', '前模仁/后模仁', 'task_group', 'track', '泳道', '模仁'],
  // stage
  stage: ['工序', '工序名称', 'stage', 'process', '加工工序', '工步'],
  // baseline
  baseline_start: ['计划预计时间', '项目工序计划时间', '计划开始', 'baseline_start', 'plan_start', '开始日期', '计划开始时间'],
  baseline_end: ['计划完成时间', '项目工序完成时间', '计划结束', 'baseline_end', 'plan_end', '结束日期', '计划完成日期'],
  // actual
  actual_start: ['实际开始时间', '实际开始', 'actual_start', '实际开始日期'],
  actual_end: ['实际完成时间', '实际完成', 'actual_end', '实际完成日期'],
  // progress & status
  progress: ['进度', '完成率', 'progress', '进度%', '完成百分比'],
  status: ['状态', 'status', '任务状态'],
  // duration
  duration: ['工期', '天数', 'duration', 'duration_days', '加工天数'],
  // assignee
  assignee: ['负责人', '操作员', 'assignee', '责任人'],
  // name
  name: ['任务名称', '名称', 'name', 'task_name', '工序名称'],
  // project card (头部名片，仅文本)
  index_no: ['No.', '序号', 'index_no', 'NO'],
  project_name: ['项目名称', 'project_name', '项目名'],
  product_name: ['产品名称', 'product_name', '产品名'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Track / SubPath Mapping
// ═══════════════════════════════════════════════════════════════════════════════

/** 子系统 → 内部 sub_path 映射 */
export const SUBSYSTEM_MAP: Record<string, string> = {
  '热流道': 'hot_runner',
  '模架': 'mold_base',
  'hot_runner': 'hot_runner',
  'mold_base': 'mold_base',
};

/** task_group → 内部 TrackId 映射 */
export const TRACK_MAP: Record<string, TrackId> = {
  '前模仁': 'cavity_core',
  '后模仁': 'cavity_insert',
  '镶件': 'lifter',
  '滑块': 'slider',
  'cavity_core': 'cavity_core',
  'cavity_insert': 'cavity_insert',
  'slider': 'slider',
  'lifter': 'lifter',
};

/**
 * getSwimlaneType — 根据任务名称/组件名称识别泳道类型
 * 
 * 优先级: 精确匹配 TRACK_MAP → 正则模糊匹配
 * @returns TrackId | undefined (undefined = 项目级任务，不属于四泳道)
 */
export function getSwimlaneType(taskName: string): TrackId | undefined {
  const name = taskName.trim();
  
  // 1. 精确匹配 TRACK_MAP
  if (TRACK_MAP[name]) return TRACK_MAP[name];
  
  // 2. 正则模糊匹配
  if (/前模仁|前模|cavity.?core/i.test(name)) return 'cavity_core';
  if (/后模仁|后模|cavity.?insert/i.test(name)) return 'cavity_insert';
  if (/行位|滑块|slider/i.test(name)) return 'slider';
  if (/斜顶|镶件|lifter/i.test(name)) return 'lifter';
  
  return undefined;
}

/** 泳道 TrackId → 中文显示名 */
export const SWIMLANE_LABELS: Record<TrackId, string> = {
  cavity_core: '前模仁',
  cavity_insert: '后模仁',
  slider: '行位(滑块)',
  lifter: '斜顶(镶件)',
};

/** stage 名称 → 内部 stage id + order（14 个独立工序 + 后汇聚阶段） */
export const STAGE_MAP: Record<string, { id: string; order: number }> = {
  // ── 开模阶段 (per-track, 14 道工序) ──
  '铣床': { id: 'milling', order: 1 },
  'CNC开粗': { id: 'roughing', order: 2 },
  'CNC 开粗': { id: 'roughing', order: 2 },
  'HRC': { id: 'hrc', order: 3 },
  'HRC热处理': { id: 'hrc', order: 3 },
  '磨床': { id: 'grinding', order: 4 },
  'CNC精加工': { id: 'finishing', order: 5 },
  'CNC 精加工': { id: 'finishing', order: 5 },
  'CNC光刀': { id: 'finishing', order: 5 },
  '电极': { id: 'electrode', order: 6 },
  '电极线割': { id: 'wire_edm', order: 7 },
  '线割': { id: 'wire_edm', order: 7 },
  '放电加工': { id: 'edm', order: 8 },
  '放电': { id: 'edm', order: 8 },
  'EDM': { id: 'edm', order: 8 },
  'CMM检测': { id: 'cmm', order: 9 },
  'CMM': { id: 'cmm', order: 9 },
  '钳工': { id: 'bench', order: 10 },
  '组立放电': { id: 'assembly_edm', order: 11 },
  'QC检验': { id: 'qc', order: 12 },
  '省模': { id: 'polishing', order: 13 },
  'FIT模': { id: 'fit', order: 14 },
  'FIT Mold': { id: 'fit', order: 14 },
  // ── 汇聚点 ──
  '模具Fai Cpk报告': { id: 'mold_fai_cpk', order: 100 },
  '模具FaiCpk报告': { id: 'mold_fai_cpk', order: 100 },
  '模具Fai\nCpk报告': { id: 'mold_fai_cpk', order: 100 },
  'Mold FAI': { id: 'mold_fai_cpk', order: 100 },
  // ── T0试模 ──
  'T0试模': { id: 't0_trial', order: 21 },
  'TO试模': { id: 't0_trial', order: 21 },
  '试模全尺寸Fai报告': { id: 't0_fai_report', order: 111 },
  '试模外观报告': { id: 't0_appearance', order: 112 },
  '试模3D报告': { id: 't0_3d_report', order: 113 },
  'T0综合报告': { id: 't0_summary', order: 114 },
  'TO综合报告': { id: 't0_summary', order: 114 },
  // ── T1问题闭环 ──
  'T1试模': { id: 't1_trial', order: 120 },
  'G/L': { id: 'gl', order: 121 },
  'T1尺寸达标日期': { id: 't1_dimension', order: 122 },
  '试模次数': { id: 'trial_count', order: 123 },
  'T0问题闭环报告': { id: 't0_closure_report', order: 124 },
  'T0问题\n闭环报告': { id: 't0_closure_report', order: 124 },
  'TO问题闭环报告': { id: 't0_closure_report', order: 124 },
  'TO问题\n闭环报告': { id: 't0_closure_report', order: 124 },
  // ── 转量产 ──
  'VMP': { id: 'vmp', order: 130 },
  'SIP': { id: 'sip', order: 131 },
  'SOP': { id: 'sop', order: 132 },
  '机台参数表': { id: 'machine_params', order: 133 },
  '巡检SPC数据': { id: 'spc_inspection', order: 134 },
  // ── 项目准备 ──
  '项目立项': { id: 'project_launch', order: -4 },
  '2D图纸': { id: 'drawing_2d', order: -3 },
  '3D图纸': { id: 'drawing_3d', order: -2 },
  'MTD': { id: 'mtd', order: -1 },

  // ── V6 新模板（序号/工序）──
  '模具开发开荒期': { id: 'mold_dev_pioneer', order: 1 },
  '开模': { id: 'open_mold', order: 6 },
  '合模': { id: 'close_mold', order: 7 },

  '【收敛黑盒A】白模尺寸与结构验证期': { id: 'blackbox_a_converge', order: 20 },
  '模具 T0 首次上机试模': { id: 't0_first_trial', order: 22 },
  'T0 外观评估': { id: 't0_appearance_eval', order: 23 },
  'T0 尺寸Fai报告': { id: 't0_fai_report', order: 24 },
  'T0 3D报告': { id: 't0_3d_report', order: 25 },
  '问题检讨与修模流转': { id: 'issue_review_repair_flow', order: 26 },
  'T0修模问题汇总': { id: 't0_issue_summary', order: 27 },
  '修模方案': { id: 'repair_plan', order: 28 },
  '模宝易报修': { id: 'moldbao_repair', order: 29 },
  'T0样品寄样': { id: 't0_sample_send', order: 30 },
  '白模修模损耗池 (节点补丁：缓冲黑盒化)': { id: 'white_mold_buffer_pool', order: 31 },
  'Tn 试模与尺寸修模反复验证': { id: 'tn_trial_repair_loop', order: 32 },

  '咬花前置阀门': { id: 'etching_gate', order: 33 },
  '尺寸达标': { id: 'dimension_ready', order: 34 },
  '结构干涉清零': { id: 'structure_interference_clear', order: 35 },

  '【收敛黑盒B】外观验证与微调期': { id: 'blackbox_b_converge', order: 40 },
  '咬花加工': { id: 'etching_process', order: 41 },
  '咬花后试模与验证': { id: 'post_etch_trial_validation', order: 42 },
  't0试模 (咬花后首试用小写字母区分)': { id: 't0_trial_post_etch', order: 43 },
  'T0试模 (咬花后首试用小写字母区分)': { id: 't0_trial_post_etch', order: 43 },
  't0试模(咬花后)': { id: 't0_trial_post_etch', order: 43 },
  'T0试模(咬花后)': { id: 't0_trial_post_etch', order: 43 },
  '光泽、粗糙度测试': { id: 'gloss_roughness_test', order: 44 },
  '咬花后 FAI 尺寸复测': { id: 'post_etch_fai_recheck', order: 45 },
  '咬花后 3D 扫描复测': { id: 'post_etch_3d_recheck', order: 46 },
  '问题闭环确认': { id: 'issue_closure_confirm', order: 47 },
  '咬花后试模样品寄样': { id: 'post_etch_sample_send', order: 48 },
  '纹理与外观微调反复验证': { id: 'texture_appearance_tuning_loop', order: 49 },

  'PRR 试产准入': { id: 'prr_trial_gate', order: 50 },
  '系统资料本地固化': { id: 'system_data_localize', order: 51 },
  '模宝易上传新模资料': { id: 'moldbao_upload_new_mold_data', order: 52 },
  'MS 系统上传新模资料': { id: 'ms_upload_new_mold_data', order: 53 },
  '下发邮件通知试产': { id: 'notify_trial_by_email', order: 54 },
  '正式试产': { id: 'formal_trial_run', order: 55 },
  '签样': { id: 'sample_signoff', order: 56 },
  '寄样客户确认': { id: 'customer_sample_confirmation', order: 57 },
  '32模CPK测量': { id: 'cpk_32_measurement', order: 58 },
  '试产3D扫描': { id: 'trial_3d_scan', order: 59 },
  '客户其他测试': { id: 'customer_other_tests', order: 60 },
  '转量产': { id: 'transfer_to_mp', order: 61 },
  '客户跑线': { id: 'customer_pilot_run', order: 62 },
  '客户跑线通过': { id: 'customer_pilot_passed', order: 63 },
  '内部下发邮件模具转入量产': { id: 'internal_mail_mold_to_mp', order: 64 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// WBS → Track Mapping (垂直 Excel 格式)
// ═══════════════════════════════════════════════════════════════════════════════

/** WBS 前缀 → 内部 TrackId */
export const WBS_TRACK_MAP: Record<string, TrackId> = {
  '5-1-1': 'cavity_core',   // 前模仁
  '5-1-2': 'cavity_insert', // 后模仁
  '5-2-1': 'lifter',        // 镶件
  '5-2-2': 'slider',        // 滑块
};

/** 里程碑 WBS IDs (仅保留序号 6 = 模具Fai Cpk报告) */
export const MILESTONE_WBS_IDS = new Set(['6']);

/** 状态映射 */
export const STATUS_MAP: Record<string, TaskStatusType> = {
  '未开始': 'NotStart',
  '进行中': 'InProgress',
  '已完成': 'Done',
  '阻塞': 'Blocked',
  '暂停': 'Blocked',
  'not_start': 'NotStart',
  'in_progress': 'InProgress',
  'done': 'Done',
  'blocked': 'Blocked',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Matrix → Flat Row Transformation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Excel 日期序列号 → ISO 日期字符串 (YYYY-MM-DD)
 * Excel 序列号: 从 1900-01-01 起的天数 (含 1900 闰年 bug)
 */
function excelSerialToISO(serial: number): string | null {
  if (serial < 1 || serial > 100000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  // 用 UTC 年月日（Excel 序列号本身就是 UTC 天数）
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 去除日期字符串中的不可见/特殊字符，避免解析断流 */
function normalizeDateInput(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // 零宽字符、不间断空格
    .replace(/\s+/g, ' ')
    .trim();
}

/** 工序名标准化：去除不可见字符/换行，统一空格 */
function normalizeStageNameInput(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 工序别名归一：常见模板误写 TO -> T0 */
function canonicalizeStageName(s: string): string {
  const normalized = normalizeStageNameInput(s);
  return normalized.replace(/^T[OoＯ]/, 'T0');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section-Aware Stage Remapping — 跨区段同名工序去重
// ═══════════════════════════════════════════════════════════════════════════════

/** 后汇聚区段类型 */
type PostMergeSection = 'pre' | 't0' | 't1' | 'production';

/** 区段切换触发器 — 当遇到该 stage ID 时切换到对应区段 */
const SECTION_TRIGGERS: Record<string, PostMergeSection> = {
  't0_trial': 't0',
  't1_trial': 't1',
  'vmp': 'production',
};

/** T0 → T1 重映射 (当同名工序出现在 T1 区段时) */
const T0_TO_T1_REMAP: Record<string, { id: string; order: number }> = {
  't0_fai_report': { id: 't1_fai_report', order: 125 },
  't0_appearance': { id: 't1_appearance', order: 126 },
  't0_3d_report': { id: 't1_3d_report', order: 127 },
};

/** 转量产 → T0 重映射 (当转量产工序出现在 T0 区段时) */
const PROD_IN_T0_REMAP: Record<string, { id: string; order: number }> = {
  'machine_params': { id: 't0_machine_params', order: 115 },
};

/** 根据当前区段重映射 stage ID，消除跨段同名工序冲突 */
function remapStageBySection(
  stageInfo: { id: string; order: number },
  section: PostMergeSection,
): { id: string; order: number } {
  if (section === 't1' && T0_TO_T1_REMAP[stageInfo.id]) {
    return T0_TO_T1_REMAP[stageInfo.id];
  }
  if (section === 't0' && PROD_IN_T0_REMAP[stageInfo.id]) {
    return PROD_IN_T0_REMAP[stageInfo.id];
  }
  return stageInfo;
}

/** 将 Excel 单元格值（序列号/字符串）转为日期字符串 */
function cellToDateStr(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    return excelSerialToISO(val) || '';
  }
  return normalizeDateInput(String(val));
}

/**
 * 从 Excel 前几行提取项目名片（仅文本）：No.、模具编号、项目名称、产品名称。
 */
export function extractProjectCardFromRawRows(rawRows: unknown[][], defaultProjectId: string): ProjectCard {
  const card: ProjectCard = { moldNumber: defaultProjectId };

  const toStr = (v: unknown): string =>
    v !== null && v !== undefined && v !== '' ? normalizeDateInput(String(v)) : '';

  const findValueAfter = (row: unknown[], labelCol: number): string => {
    for (let c = labelCol + 1; c < Math.min(row.length, labelCol + 6); c++) {
      const v = toStr(row[c]);
      if (v) return v;
    }
    return '';
  };

  // ═══════════════════════════════════════════════════════════════════
  // Excel 中可能有多组项目信息并排（如 A-D, G-K, N-Q）
  // 收集所有组，用 defaultProjectId 匹配正确的组
  // ═══════════════════════════════════════════════════════════════════

  const groups: ProjectCard[] = [];
  const moldCols: number[] = []; // 每组 "模具编号" 标签所在列

  // 第一遍：找所有 "模具编号" 标签及其值
  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] as unknown[] | undefined;
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = toStr(row[c]);
      if (cell === '模具编号' || cell.includes('模具编号')) {
        const val = findValueAfter(row, c);
        if (val && /^[A-Z0-9]{4,}$/i.test(val)) {
          groups.push({ moldNumber: val });
          moldCols.push(c);
        }
      }
    }
  }

  // 第二遍：为每组填充 No.、项目名称、产品名称
  for (let g = 0; g < groups.length; g++) {
    const colRange = [moldCols[g] - 1, moldCols[g], moldCols[g] + 1];
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = rawRows[r] as unknown[] | undefined;
      if (!row) continue;
      for (const c of colRange) {
        if (c < 0 || c >= row.length) continue;
        const cell = toStr(row[c]);
        if (!cell) continue;
        if (/^No\.?\s*$/i.test(cell) || cell === 'NO' || cell === 'NO.') {
          const val = findValueAfter(row, c);
          if (val && !groups[g].index_no) groups[g].index_no = String(val).replace(/^No\.?\s*/i, '').trim() || String(val);
        }
        if (cell === '项目名称' || cell.includes('项目名称')) {
          const val = findValueAfter(row, c);
          if (val && !groups[g].project_name) groups[g].project_name = val;
        }
        if (cell === '产品名称' || cell.includes('产品名称')) {
          const val = findValueAfter(row, c);
          if (val && !groups[g].product_name) groups[g].product_name = val;
        }
        if (cell === '钳工组' || cell.includes('钳工组')) {
          const val = findValueAfter(row, c);
          if (val && !groups[g].fitter_group) groups[g].fitter_group = val;
        }
      }
    }
  }

  // 选择正确的组：优先精确匹配 defaultProjectId
  let matched = groups.find(g => g.moldNumber === defaultProjectId);
  if (!matched && groups.length > 0) matched = groups[0];

  if (matched) {
    card.moldNumber = matched.moldNumber;
    if (matched.index_no) card.index_no = matched.index_no;
    if (matched.project_name) card.project_name = matched.project_name;
    if (matched.product_name) card.product_name = matched.product_name;
    if (matched.fitter_group) card.fitter_group = matched.fitter_group;
  }

  return card;
}

/**
 * 从 Excel 前几行提取所有并排的项目组信息
 * 用于让用户在预览阶段选择正确的项目
 */
export function extractAllProjectCards(rawRows: unknown[][]): ProjectCard[] {
  const toStr = (v: unknown): string =>
    v !== null && v !== undefined && v !== '' ? normalizeDateInput(String(v)) : '';

  const findValueAfter = (row: unknown[], labelCol: number): string => {
    for (let c = labelCol + 1; c < Math.min(row.length, labelCol + 6); c++) {
      const v = toStr(row[c]);
      if (v) return v;
    }
    return '';
  };

  const groups: ProjectCard[] = [];
  const moldCols: number[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] as unknown[] | undefined;
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = toStr(row[c]);
      if (cell === '模具编号' || cell.includes('模具编号')) {
        const val = findValueAfter(row, c);
        if (val && /^[A-Z0-9]{4,}$/i.test(val)) {
          groups.push({ moldNumber: val });
          moldCols.push(c);
        }
      }
    }
  }

  for (let g = 0; g < groups.length; g++) {
    const colRange = [moldCols[g] - 1, moldCols[g], moldCols[g] + 1];
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = rawRows[r] as unknown[] | undefined;
      if (!row) continue;
      for (const c of colRange) {
        if (c < 0 || c >= row.length) continue;
        const cell = toStr(row[c]);
        if (!cell) continue;
        if (/^No\.?\s*$/i.test(cell) || cell === 'NO' || cell === 'NO.') {
          const val = findValueAfter(row, c);
          if (val && !groups[g].index_no) groups[g].index_no = String(val).replace(/^No\.?\s*/i, '').trim() || String(val);
        }
        if (cell === '项目名称' || cell.includes('项目名称')) {
          const val = findValueAfter(row, c);
          if (val && !groups[g].project_name) groups[g].project_name = val;
        }
        if (cell === '产品名称' || cell.includes('产品名称')) {
          const val = findValueAfter(row, c);
          if (val && !groups[g].product_name) groups[g].product_name = val;
        }
        if (cell === '钳工组' || cell.includes('钳工组')) {
          const val = findValueAfter(row, c);
          if (val && !groups[g].fitter_group) groups[g].fitter_group = val;
        }
      }
    }
  }

  return groups;
}

/**
 * 将 Excel 矩阵格式（工序为列、时间标签为行）转为扁平行格式。
 *
 * 模板布局（更新后含工序编号行）：
 *   Row 1 : 标题 "项目运行甘特图"
 *   Row 2 : 工序编号 1–34 + "四泳道同步进行" 标记
 *   Row 3 : 大分组列头 (项目立项, 2D图纸 … / 开模 / T0试模 / T1问题闭环 / 转量产)
 *   Row 4 : 工序列头 (铣床, CNC开粗, HRC, 磨床 …)
 *   Row 5 : "计划预计时间"/"项目工序计划时间" (col F) + 各工序 baseline_start
 *   Row 6 : "计划完成时间"/"项目工序完成时间" (col F) + 第一条 track 的 baseline_end
 *   Row 7…: 其他 track (后模仁, 镶件, 滑块) 的 baseline_end
 *
 * 提取规则：
 *   1. 用编号行精确锁定 34 个工序列（编号 × 工序名 × 日期 三要素对齐才提取）
 *   2. "四泳道同步进行" 区间内的工序 → per-track，其余 → 项目级
 *   3. per-track 工序：每个泳道行(前模仁/后模仁/镶件/滑块)各生成一条任务
 *   4. 项目级工序：仅从首条数据行取一次
 *
 * @param rawRows  sheet_to_json(sheet, { header: 1 }) 返回的二维数组
 * @param stageNameRowIdx  工序名称行索引（含 "铣床" 等）
 * @returns 扁平行数组，如果不是矩阵格式则返回 null
 */
export function transformMatrixToFlatRows(
  rawRows: unknown[][],
  stageNameRowIdx: number,
): ExcelRow[] | null {
  if (stageNameRowIdx < 0 || stageNameRowIdx >= rawRows.length) return null;

  const ROW_LABEL_COL = 5; // col F — 行标签列
  const SUB_PATH_COL = 10; // col K — 子系统
  const TRACK_COL = 11;    // col L — 泳道

  // 支持的行标签
  const START_LABELS = new Set(['计划预计时间', '项目工序计划时间', '计划开始时间']);
  const END_LABELS = new Set(['计划完成时间', '项目工序完成时间', '计划结束时间']);

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 查找编号行 — 含连续整数 1,2,3… 的行，锁定 34 个工序列
  // ═══════════════════════════════════════════════════════════════════════
  let numberRowIdx = -1;
  const stageNumberMap = new Map<number, number>(); // colIdx → 工序编号

  for (let i = Math.max(0, stageNameRowIdx - 4); i < stageNameRowIdx; i++) {
    const row = rawRows[i] as (string | number | null | undefined)[];
    if (!row) continue;

    const nums = new Map<number, number>();
    for (let j = 0; j < row.length; j++) {
      const val = row[j];
      if (typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 100) {
        nums.set(j, val);
      }
    }

    // 至少含 20 个编号才认定为编号行
    if (nums.size >= 20) {
      numberRowIdx = i;
      nums.forEach((num, col) => stageNumberMap.set(col, num));
      break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 构建 34 个工序列 (编号 + 名称)
  // ═══════════════════════════════════════════════════════════════════════
  const stageRow = rawRows[stageNameRowIdx] as (string | number | null | undefined)[];

  // 向上查找分组行（通常在工序名称行的上一行），用于取回 "项目立项" / "2D图纸" 等列名
  const GROUP_HEADERS = new Set([
    '开模', 'T0试模', 'T1问题闭环', '转量产',
    'NO.', '项目名称', '产品名称', '模具编号', '产品图', '时间颗粒',
    '四泳道同步进行',
  ]);

  // 从工序名称行往上找带列名的行（跳过编号行本身）
  let groupHeaderRow: (string | number | null | undefined)[] = [];
  for (let i = stageNameRowIdx - 1; i >= Math.max(0, stageNameRowIdx - 3); i--) {
    if (i === numberRowIdx) continue; // 跳过编号行
    const row = rawRows[i] as (string | number | null | undefined)[];
    if (!row) continue;
    // 含 "项目立项" / "NO." 等标志性列头
    const rowStr = row.map((c) => String(c ?? '')).join('|');
    if (rowStr.includes('项目立项') || rowStr.includes('NO.') || rowStr.includes('开模')) {
      groupHeaderRow = row;
      break;
    }
  }

  interface StageCol {
    index: number;
    name: string;
    number: number; // 工序编号 (1-34)
  }

  const stageColumns: StageCol[] = [];

  if (stageNumberMap.size >= 20) {
    // ── 有编号行：以编号为准，精确锁定 34 列 ──
    for (const [colIdx, stageNum] of Array.from(stageNumberMap).sort((a, b) => a[1] - b[1])) {
      if (colIdx <= ROW_LABEL_COL) continue; // 跳过 A-F 元数据列

      let name = String(stageRow[colIdx] ?? '').trim();
      // 工序名称行空白 → 回退到分组行
      if (!name && groupHeaderRow[colIdx]) {
        const fallback = String(groupHeaderRow[colIdx]).trim();
        if (!GROUP_HEADERS.has(fallback)) name = fallback;
      }
      if (!name) continue; // 编号列找不到工序名 → 跳过

      stageColumns.push({ index: colIdx, name, number: stageNum });
    }
  } else {
    // ── 无编号行：用旧逻辑，按非空列头识别 ──
    let autoNum = 1;
    for (let j = 0; j < stageRow.length; j++) {
      if (j <= ROW_LABEL_COL || j === SUB_PATH_COL || j === TRACK_COL) continue;

      let name = String(stageRow[j] ?? '').trim();
      if (!name && groupHeaderRow[j]) {
        const fallback = String(groupHeaderRow[j]).trim();
        if (!GROUP_HEADERS.has(fallback)) name = fallback;
      }
      if (name) {
        stageColumns.push({ index: j, name, number: autoNum++ });
      }
    }
  }

  if (stageColumns.length === 0) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 在工序行之后查找 "计划预计/完成时间" 行与泳道行
  // ═══════════════════════════════════════════════════════════════════════
  let startDateRowIdx = -1;
  const trackRows: { idx: number; subPath: string; track: string }[] = [];

  for (let i = stageNameRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as (string | number | null | undefined)[];
    if (!row || row.every((c) => !c && c !== 0)) continue;

    const colF = String(row[ROW_LABEL_COL] ?? '').trim();

    if (START_LABELS.has(colF)) {
      startDateRowIdx = i;
    } else {
      const sub = String(row[SUB_PATH_COL] ?? '').trim();
      const trk = String(row[TRACK_COL] ?? '').trim();
      if (END_LABELS.has(colF) || sub || trk) {
        trackRows.push({ idx: i, subPath: sub, track: trk });
      }
    }
  }

  if (startDateRowIdx < 0 || trackRows.length === 0) return null;

  const startDateRow = rawRows[startDateRowIdx] as (string | number | null | undefined)[];

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 判断 per-track (四泳道) vs 项目级工序
  //    四泳道工序：多条 track 行都有日期值
  //    项目级工序：只有首条 track 行有值（合并单元格）
  // ═══════════════════════════════════════════════════════════════════════
  const perTrackStages = new Set<number>();
  for (const stage of stageColumns) {
    let trackCount = 0;
    for (const tr of trackRows) {
      const v = (rawRows[tr.idx] as unknown[])[stage.index];
      if (v !== null && v !== undefined && v !== '' && v !== '/') trackCount++;
    }
    if (trackCount > 1) perTrackStages.add(stage.index);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. 生成扁平行 — 每条 = 一个任务 (工序×泳道)
  //    编号 × 工序名 × 日期 三要素对齐才提取
  // ═══════════════════════════════════════════════════════════════════════
  const flatRows: ExcelRow[] = [];

  for (const tr of trackRows) {
    const trackRow = rawRows[tr.idx] as (string | number | null | undefined)[];

    for (const stage of stageColumns) {
      const rawStart = startDateRow[stage.index];
      const rawEnd = trackRow[stage.index];

      // ── 跳过无日期的单元格 ──
      if ((!rawEnd && rawEnd !== 0) || rawEnd === '/' || rawEnd === '') continue;
      if ((!rawStart && rawStart !== 0) || rawStart === '/' || rawStart === '') continue;

      // ── 项目级工序只从首行取一次，避免重复 ──
      if (!perTrackStages.has(stage.index) && tr.idx !== trackRows[0].idx) continue;

      let startStr = cellToDateStr(rawStart);
      let endStr = cellToDateStr(rawEnd);

      if (!startStr && !endStr) continue;
      if (!startStr) startStr = endStr;
      if (!endStr) endStr = startStr;

      // 确保 start ≤ end
      if (startStr > endStr) {
        [startStr, endStr] = [endStr, startStr];
      }

      const isPerTrack = perTrackStages.has(stage.index);

      flatRows.push({
        '工序': stage.name,
        '工序编号': stage.number,
        '子系统': isPerTrack ? tr.subPath : '',
        '组件': isPerTrack ? tr.track : '',
        '计划预计时间': startStr,
        '计划完成时间': endStr,
      });
    }
  }

  // ── 6. 补充合并单元格工序（仅在 startDateRow 有值，track 行全空） ──
  const createdStageNames = new Set(flatRows.map((r) => r['工序'] as string));
  for (const stage of stageColumns) {
    if (createdStageNames.has(stage.name)) continue;
    const rawStart = startDateRow[stage.index];
    if (!rawStart || rawStart === '/' || rawStart === '') continue;
    const dateStr = cellToDateStr(rawStart);
    if (!dateStr) continue;
    flatRows.push({
      '工序': stage.name,
      '工序编号': stage.number,
      '子系统': '',
      '组件': '',
      '计划预计时间': dateStr,
      '计划完成时间': dateStr,
    });
  }

  return flatRows.length > 0 ? flatRows : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vertical WBS Parser (V4 终极格式)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 解析垂直 WBS 格式的 Excel — 每行一个工序，含嵌套层级编号。
 *
 * 模板布局 (Sheet1):
 *   Row 0-1: 项目信息 (模具编号, 产品图)
 *   Row 2  : 列头 — 里程碑 | 工序序号 | 工序名称 | 项目工序预估时间 | 项目工序实际完成时间
 *   Row 3+ : 数据行
 *     - WBS "5-1-1-1" 等有日期的行 = 叶子任务
 *     - WBS "5" / "5-1" 等无日期的行 = 分组节点 (跳过)
 *     - Col 0 含 "里程碑X" = 里程碑标记
 *
 * @returns ParseResult if vertical format detected; null otherwise
 */
export function parseVerticalWBS(
  rawRows: unknown[][],
  projectId: string,
): ParseResult | null {
  // ── 1. 检测表头行 ──
  let headerIdx = -1;
  let colWbs = -1;
  let colName = -1;
  let colBaselineStart = -1;  // 计划开始日期列
  let colBaselineEnd = -1;    // 计划结束日期列（可选）
  let colActual = -1;
  let colMilestone = -1;

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const arr = row as unknown[];
    for (let j = 0; j < arr.length; j++) {
      const cell = String(arr[j] ?? '').trim();
      if (cell === '工序序号' || cell === '序号') { colWbs = j; headerIdx = i; }
      if (cell === '工序名称' || cell === '工序') colName = j;
      // 计划开始日期列：预估时间、计划时间、预计完成时间
      if (colBaselineStart < 0 && (cell.includes('预估时间') || cell.includes('计划时间') || cell.includes('预计完成时间') || cell.includes('计划开始'))) colBaselineStart = j;
      // 计划结束日期列：计划结束、计划完成
      if (colBaselineEnd < 0 && (cell.includes('计划结束') || cell.includes('计划完成日期'))) colBaselineEnd = j;
      // 实际完成日期列
      if (colActual < 0 && cell.includes('项目工序实际完成时间')) colActual = j;
      else if (colActual < 0 && (cell.includes('实际完成') || cell.includes('实际时间'))) colActual = j;
      if (cell === '里程碑') colMilestone = j;
    }
    // 只有在 headerIdx 已找到 且 已经扫描完 headerIdx 所在行才 break
    if (headerIdx >= 0 && i >= headerIdx) break;
  }

  // 不是垂直格式
  if (headerIdx < 0 || colWbs < 0 || colName < 0) return null;

  // ── 列位置推断 ──
  const colBaselineStartFromText = colBaselineStart;
  const colBaselineEndFromText = colBaselineEnd;
  const colActualFromText = colActual;
  if (colBaselineStart < 0) colBaselineStart = colName + 1;
  // 如果没有找到计划结束列，则使用计划开始列（离散 1 天任务）
  if (colBaselineEnd < 0) colBaselineEnd = colBaselineStart;
  // 强制 colActual = colBaselineEnd + 1（如果有计划结束列）或 colBaselineStart + 1（如果没有）
  if (colActual < 0) {
    colActual = colBaselineEnd !== colBaselineStart ? colBaselineEnd + 1 : colBaselineStart + 1;
  }
  if (colMilestone < 0) colMilestone = 0;

  // 调试日志：输出列检测结果和表头原始内容
  if (typeof console !== 'undefined') {
    const headerRow = rawRows[headerIdx] as unknown[];
    console.warn(`[Gantt列检测] headerIdx=${headerIdx}, colWbs=${colWbs}, colName=${colName}, colBaselineStart=${colBaselineStart}(文字匹配=${colBaselineStartFromText}), colBaselineEnd=${colBaselineEnd}(文字匹配=${colBaselineEndFromText}), colActual=${colActual}(文字匹配=${colActualFromText}), colMilestone=${colMilestone}`);
    console.warn(`[Gantt列检测] 表头内容:`, headerRow?.map((c, i) => `[${i}]="${String(c ?? '').trim()}"`).join(', '));
    // 完整 dump 前5个数据行的所有列
    for (let dbg = 0; dbg <= Math.min(headerIdx + 5, rawRows.length - 1); dbg++) {
      const dbgRow = rawRows[dbg] as unknown[];
      if (dbgRow) {
        console.warn(`[Gantt行dump] 行${dbg}: ${dbgRow.map((c, ci) => `[${ci}]=${JSON.stringify(c)}`).join(' | ')}`);
      }
    }
    // 关键对比：前3个数据行的 baseline vs actual 原始值
    for (let dbg = headerIdx + 1; dbg <= Math.min(headerIdx + 3, rawRows.length - 1); dbg++) {
      const dbgRow = rawRows[dbg] as unknown[];
      if (dbgRow) {
        const bStartVal = dbgRow[colBaselineStart];
        const bEndVal = dbgRow[colBaselineEnd];
        const aVal = dbgRow[colActual];
        const rowLen = dbgRow.length;
        console.warn(`[Gantt列对比] 行${dbg}: rowLength=${rowLen}, col[${colBaselineStart}]=${JSON.stringify(bStartVal)}, col[${colBaselineEnd}]=${JSON.stringify(bEndVal)}, col[${colActual}]=${JSON.stringify(aVal)}`);
      }
    }
  }

  // ── 2. 逐行解析 ──
  const tasks: TaskNode[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const createdIds = new Set<string>();
  let currentSection: PostMergeSection = 'pre';

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row) continue;

    const wbsRaw = String(row[colWbs] ?? '').trim();
    const nameRaw = canonicalizeStageName(String(row[colName] ?? ''));
    if (!wbsRaw || !nameRaw) continue;

    const rawBaselineStart = row[colBaselineStart];
    const rawBaselineEnd = row[colBaselineEnd];
    const rawActual = row[colActual];

    // 调试日志：前10个有日期的行
    if (typeof console !== 'undefined' && tasks.length < 10) {
      console.log(`[Gantt解析] 行${i + 1} WBS="${wbsRaw}" name="${nameRaw}" rawBaselineStart=${JSON.stringify(rawBaselineStart)} rawBaselineEnd=${JSON.stringify(rawBaselineEnd)} rawActual=${JSON.stringify(rawActual)}`);
    }
    const milestoneCell = String(row[colMilestone] ?? '').trim();

    // 日期转换（已做 normalizeDateInput，避免特殊字符导致 null）
    const baselineStartStr = cellToDateStr(rawBaselineStart);
    const baselineEndStr = cellToDateStr(rawBaselineEnd);
    const actualStr = cellToDateStr(rawActual);

    // 无日期 = 分组节点 (开模 / 热流道 / 前模仁 等) → 跳过
    if (!baselineStartStr) continue;

    const baselineStartDate = parseDate(baselineStartStr);
    if (!baselineStartDate) {
      warnings.push(`行 ${i + 1}: WBS "${wbsRaw}" 计划开始日期格式无效，已跳过`);
      continue;
    }
    // 计划结束日期：如果没有单独的列，则使用计划开始日期
    const baselineEndDate = baselineEndStr ? parseDate(baselineEndStr) : baselineStartDate;
    const actualDate = actualStr ? parseDate(actualStr) : null;

    // 校验：Excel 中有实际完成时间但解析为空 → 禁止静默失败，抛出并停止导入
    const excelHasActual = rawActual !== null && rawActual !== undefined && String(rawActual).trim() !== '';
    if (excelHasActual && !actualDate) {
      const errMsg = `行 ${i + 1} (WBS ${wbsRaw} "${nameRaw}"): 项目工序实际完成时间有值但解析失败，原始值=[${String(rawActual).slice(0, 50)}]，请检查格式或特殊字符`;
      errors.push(errMsg);
      throw new Error(errMsg);
    }

    // ── 3. WBS → Track / Phase / Stage ──
    const track = resolveTrackFromWBS(wbsRaw);
    let stageInfo = resolveStageFromName(nameRaw, wbsRaw);

    // 跨区段同名工序去重：根据当前段落(T0/T1/转量产)重映射 stage ID
    if (!track) {
      if (SECTION_TRIGGERS[stageInfo.id]) {
        currentSection = SECTION_TRIGGERS[stageInfo.id];
      }
      stageInfo = remapStageBySection(stageInfo, currentSection);
    }

    const phase = resolvePhaseFromWBS(wbsRaw, stageInfo.id);
    const isMerge = stageInfo.id === 'mold_fai_cpk';
    // 仅 mold_fai_cpk 作为里程碑，忽略 Excel 里程碑列和其他 WBS
    const isMilestone = stageInfo.id === 'mold_fai_cpk';

    // 唯一 ID
    let taskId = track
      ? `${projectId}_${track}_${stageInfo.id}`
      : `${projectId}_${stageInfo.id}`;
    if (createdIds.has(taskId)) {
      taskId = `${taskId}_${wbsRaw.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    createdIds.add(taskId);

    // 进度 / 状态推断
    const today = new Date().toISOString().slice(0, 10);
    let progress = 0;
    let status: TaskStatusType = 'NotStart';
    // 超时检测：实际完成日期 > 计划结束日期 = 延期
    // 使用 baselineEndDate 作为计划结束日期进行比较
    // 如果 actualDate <= baselineEndDate，则不算延期（准时或提前完成）
    const isOverdue = !!(actualDate && baselineEndDate && actualDate > baselineEndDate);
    if (actualDate) {
      progress = 100;
      status = 'Done';
    } else if (baselineStartDate <= today) {
      progress = 50;
      status = 'InProgress';
    }

    // 计算工期天数
    const durationDays = baselineEndDate && baselineStartDate
      ? Math.max(1, Math.round((new Date(baselineEndDate).getTime() - new Date(baselineStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 1;

    // 写入前核验
    if (typeof console !== 'undefined' && console.log) {
      console.log(`[Gantt导入] wbs_id=${wbsRaw} baselineStart=${baselineStartDate} baselineEnd=${baselineEndDate} actual=${actualDate ?? '(空)'}${isOverdue ? ' ⚠️延期' : ''}`);
    }

    // 任务创建：使用计划开始和计划结束日期
    tasks.push({
      id: taskId,
      projectId,
      wbsId: wbsRaw,
      name: nameRaw,
      nameCn: nameRaw,
      phase,
      track,
      stage: stageInfo.id,
      stageOrder: stageInfo.order,
      weight: 1,
      durationDays,
      baselineStart: baselineStartDate,
      baselineEnd: baselineEndDate || baselineStartDate,
      actualStart: actualDate || undefined,
      actualEnd: actualDate || undefined,
      progress,
      status,
      isCritical: false,
      isMergePoint: isMerge,
      isMilestone,
      milestoneLabel: isMilestone ? milestoneCell || `里程碑` : undefined,
    });
  }

  if (tasks.length === 0) return null;

  // ── 3b. 已移除链式时间推导 ──
  // 每个工序是离散的 1 天任务，baselineStart=baselineEnd=计划日期，actualStart=actualEnd=实际日期
  // 不再做链式推导，不再修改 baselineEnd / actualStart / durationDays

  // ── 3c. 过滤父分组节点: 若某任务的 wbsId 是其他任务 wbsId 的前缀，则为分组行，跳过 ──
  // 例如 WBS "2.1"(T0试模) 有子项 2.1.1/2.1.2/2.1.3/2.1.4，本身只是分组行，不是叶子工序
  {
    const wbsIds = tasks
      .map((t) => t.wbsId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const leafTasks = tasks.filter((t) => {
      if (!t.wbsId) return true;
      const prefix = t.wbsId + '.';
      return !wbsIds.some((id) => id.startsWith(prefix));
    });
    if (leafTasks.length < tasks.length) {
      warnings.push(`已过滤 ${tasks.length - leafTasks.length} 个父分组节点(WBS前缀行)`);
      tasks.length = 0;
      tasks.push(...leafTasks);
    }
  }

  // ── 4. 汇聚协议: 模具Fai Cpk报告 start = MAX(四条 FIT模 end dates) ──
  const mergeTask = tasks.find((t) => t.isMergePoint);
  if (mergeTask) {
    const fitEndDates = tasks
      .filter((t) => t.stage === 'fit' && !!t.track)
      .map((t) => t.baselineEnd)
      .filter(Boolean)
      .sort();
    if (fitEndDates.length > 0) {
      const latestFitEnd = fitEndDates[fitEndDates.length - 1];
      if (latestFitEnd > mergeTask.baselineStart) {
        mergeTask.baselineStart = latestFitEnd;
        mergeTask.baselineEnd = latestFitEnd;
      }
    }
  }

  // ── 5. 时序约束: 里程碑不得倒挂，后续任务不得早于前续里程碑 ──
  validateMilestoneSequence(tasks, warnings);

  // ── 6. 项目名片: 从表头前几行提取 No. / 模具编号 / 项目名称 / 产品名称 / 产品图 ──
  const projectCard = extractProjectCardFromRawRows(rawRows, projectId);
  if (projectCard.moldNumber) {
    projectCard.moldNumber = projectCard.moldNumber.trim() || projectId;
  }

  return { tasks, errors, warnings, projectCard };
}

// ── Vertical WBS Helpers ──

/** WBS ID → TrackId (e.g., "5-1-1-3" → cavity_core) */
function resolveTrackFromWBS(wbsId: string): TrackId | undefined {
  // 匹配四位 WBS: 5-1-1-X, 5-1-2-X, 5-2-1-X, 5-2-2-X
  const match = wbsId.match(/^(5-[12]-[12])-\d+$/);
  if (!match) return undefined;
  return WBS_TRACK_MAP[match[1]];
}

/** 工序名称 → stage info，回退到 WBS 编号推断 */
function resolveStageFromName(name: string, wbsId: string): { id: string; order: number } {
  const normalizedName = normalizeStageNameInput(name);
  const canonicalName = canonicalizeStageName(normalizedName);

  // 先试 STAGE_MAP 精确匹配
  const mapped = STAGE_MAP[canonicalName] || STAGE_MAP[normalizedName] || STAGE_MAP[name];
  if (mapped) return mapped;

  // WBS 末段数字作为 order
  const parts = wbsId.split('-');
  const lastNum = Number(parts[parts.length - 1]);
  const wbsOrder = isNaN(lastNum) ? 0 : lastNum;

  // 按 WBS 前缀范围分配 order 基数
  if (wbsId.match(/^5-/)) return { id: canonicalName.toLowerCase().replace(/\s+/g, '_'), order: wbsOrder };
  const topLevel = Number(wbsId);
  if (!isNaN(topLevel)) {
    if (topLevel <= 4) return { id: canonicalName.toLowerCase().replace(/\s+/g, '_'), order: topLevel - 10 };
    if (topLevel <= 5) return { id: 'kaimo', order: 50 };
    return { id: canonicalName.toLowerCase().replace(/[\s/]+/g, '_'), order: topLevel * 10 };
  }
  return { id: canonicalName.toLowerCase().replace(/\s+/g, '_'), order: 0 };
}

const NEW_TEMPLATE_PRODUCTION_STAGE_IDS = new Set([
  'prr_trial_gate',
  'system_data_localize',
  'moldbao_upload_new_mold_data',
  'ms_upload_new_mold_data',
  'notify_trial_by_email',
  'formal_trial_run',
  'sample_signoff',
  'customer_sample_confirmation',
  'cpk_32_measurement',
  'trial_3d_scan',
  'customer_other_tests',
  'transfer_to_mp',
  'customer_pilot_run',
  'customer_pilot_passed',
  'internal_mail_mold_to_mp',
]);

/** WBS ID + stage → PhaseType */
function resolvePhaseFromWBS(wbsId: string, stageId: string): PhaseType {
  // 有 track → physical
  if (wbsId.match(/^5-[12]-[12]-\d+$/)) return 'physical';
  // 汇聚点
  if (stageId === 'mold_fai_cpk') return 'physical';

  // 支持新模板层级编号：1 / 1.1 / 6.2 等
  const topLevelMatch = wbsId.match(/^(\d+)/);
  const topLevel = topLevelMatch ? Number(topLevelMatch[1]) : Number(wbsId);

  // 新模板通过 stageId 判定转量产；旧模板保留 17+ 判定
  if (NEW_TEMPLATE_PRODUCTION_STAGE_IDS.has(stageId)) return 'production';
  if (!isNaN(topLevel) && topLevel >= 17) return 'production';
  // 默认 data (T0, T1, 项目准备)
  return 'data';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core Parser (Legacy / Fallback)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExcelRow {
  [key: string]: string | number | null | undefined;
}

/** 从 Excel 前几行解析出的项目名片数据（仅文本） */
export interface ProjectCard {
  index_no?: string;
  moldNumber?: string;
  project_name?: string;
  product_name?: string;
  fitter_group?: string;
}

export interface ParseResult {
  tasks: TaskNode[];
  errors: string[];
  warnings: string[];
  projectCard?: ProjectCard;
}

/** 上传预览阶段的项目摘要 */
export interface PreviewProject {
  projectId: string;
  projectName: string;
  productName: string;
  moldNumber: string;
  indexNo: string;
  taskCount: number;
  swimlanes: string[];  // 识别到的泳道中文名
  isExisting: boolean;   // 数据库中是否已存在 (UPDATE vs INSERT)
}

/**
 * 将 Excel 解析后的行数据映射为 TaskNode 数组
 */
export function parseExcelRows(
  rows: ExcelRow[],
  projectId: string,
): ParseResult {
  const tasks: TaskNode[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    errors.push('Excel 文件中没有数据行');
    return { tasks, errors, warnings };
  }

  // 自动检测列名映射
  const headers = Object.keys(rows[0]);
  const resolvedColumns = resolveColumns(headers);

  if (!resolvedColumns.baseline_start || !resolvedColumns.baseline_end) {
    errors.push('未找到"计划预计时间"或"计划完成时间"列，请检查 Excel 列名');
    return { tasks, errors, warnings };
  }

  const createdIds = new Set<string>();
  let matrixSection: PostMergeSection = 'pre';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel 行号（含表头）

    try {
      const trackStr = getCell(row, resolvedColumns.task_group) || getCell(row, resolvedColumns.sub_path) || '';
      const track = TRACK_MAP[trackStr.trim()] || undefined;
      const stageStr = getCell(row, resolvedColumns.stage) || getCell(row, resolvedColumns.name) || `Task_${i}`;
      const stageKey = canonicalizeStageName(stageStr); // 统一换行/隐藏字符 + TO->T0
      let stageInfo = STAGE_MAP[stageKey] || STAGE_MAP[normalizeStageNameInput(stageStr)] || { id: stageKey.toLowerCase().replace(/\s+/g, '_'), order: i };

      // 跨区段同名工序去重
      if (!track) {
        if (SECTION_TRIGGERS[stageInfo.id]) {
          matrixSection = SECTION_TRIGGERS[stageInfo.id];
        }
        stageInfo = remapStageBySection(stageInfo, matrixSection);
      }

      const baselineStart = parseDate(getCell(row, resolvedColumns.baseline_start));
      const baselineEnd = parseDate(getCell(row, resolvedColumns.baseline_end));

      if (!baselineStart || !baselineEnd) {
        warnings.push(`第 ${rowNum} 行：计划时间格式无效，已跳过`);
        continue;
      }

      const actualStart = parseDate(getCell(row, resolvedColumns.actual_start)) || undefined;
      const actualEnd = parseDate(getCell(row, resolvedColumns.actual_end)) || undefined;

      const progress = parseProgress(getCell(row, resolvedColumns.progress));
      const statusStr = getCell(row, resolvedColumns.status) || '';
      const status = STATUS_MAP[statusStr.trim()] || inferStatus(progress, actualStart, actualEnd);

      // Inclusive duration: Jan17→Jan17 = 1 day; Jan17→Jan19 = 3 days
      const duration = Math.max(1, Math.round(
        (new Date(baselineEnd).getTime() - new Date(baselineStart).getTime()) / (1000 * 60 * 60 * 24),
      ) + 1);

      const phase = resolvePhase(stageInfo.id, !!track);

      // 生成唯一 ID — 同 track+stage 可能对应多个 Excel 工序 (如 线割/放电→edm)
      let taskId = `${projectId}_${track || 'post'}_${stageInfo.id}`;
      if (createdIds.has(taskId)) {
        // 用工序编号（如有）或行索引保证唯一
        const stageNum = row['工序编号'];
        taskId = `${taskId}_${stageNum ?? i}`;
      }
      createdIds.add(taskId);

      tasks.push({
        id: taskId,
        projectId,
        name: stageKey,
        nameCn: stageKey,
        phase,
        track,
        stage: stageInfo.id,
        stageOrder: stageInfo.order,
        weight: 1,
        durationDays: duration,
        baselineStart,
        baselineEnd,
        actualStart,
        actualEnd,
        progress,
        status,
        isCritical: false,
        isMergePoint: stageInfo.id === 'mold_fai_cpk',
        isMilestone: false,
        assignee: getCell(row, resolvedColumns.assignee) || undefined,
      });
    } catch (e) {
      errors.push(`第 ${rowNum} 行解析失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Post-processing: Convergence Protocol (4-to-1)
  // ═════════════════════════════════════════════════════════════════════════

  // 1. 汇聚临界点: 模具Fai Cpk报告 — 强制清除 track，保证在 postMergeTasks 中
  //    以及后续所有任务 (order >= 11) 也强制无 track
  for (const task of tasks) {
    if (task.isMergePoint || (task.stageOrder >= 11 && !task.track)) {
      task.track = undefined;
    }
  }

  // 2. 汇聚日期: FaiCpk_Start = MAX(所有子路径最后一个工序的 EndDate)
  const mergeTask = tasks.find((t) => t.isMergePoint);
  if (mergeTask) {
    const trackEndDates = tasks
      .filter((t) => !!t.track)
      .map((t) => t.baselineEnd)
      .filter(Boolean);

    if (trackEndDates.length > 0) {
      trackEndDates.sort();
      const latestTrackEnd = trackEndDates[trackEndDates.length - 1];
      // 汇聚点开始日期不早于所有泳道的最晚结束日期
      if (latestTrackEnd > mergeTask.baselineStart) {
        mergeTask.baselineStart = latestTrackEnd;
        if (mergeTask.baselineEnd < mergeTask.baselineStart) {
          mergeTask.baselineEnd = mergeTask.baselineStart;
        }
      }
    }
  }

  // ── 时序约束: 里程碑不得倒挂 ──
  validateMilestoneSequence(tasks, warnings);

  return { tasks, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Milestone Sequence Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate milestone ordering: later milestones (by stageOrder) must not end
 * before earlier milestones. Auto-shifts and logs warnings if violated.
 */
function validateMilestoneSequence(tasks: TaskNode[], warnings: string[]): void {
  const milestones = tasks
    .filter((t) => t.isMilestone)
    .sort((a, b) => a.stageOrder - b.stageOrder);

  if (milestones.length < 2) return;

  for (let i = 1; i < milestones.length; i++) {
    const prev = milestones[i - 1];
    const curr = milestones[i];

    if (curr.baselineStart <= prev.baselineEnd) {
      const msg = `[时序警告] 里程碑倒挂: "${curr.nameCn}" (start=${curr.baselineStart}) ≤ "${prev.nameCn}" (end=${prev.baselineEnd})，已自动向后推移`;
      warnings.push(msg);
      console.error(msg);

      // Push forward: next workday after previous milestone
      const prevEnd = new Date(prev.baselineEnd);
      prevEnd.setDate(prevEnd.getDate() + 1);
      curr.baselineStart = prevEnd.toISOString().slice(0, 10);
      if (curr.baselineEnd < curr.baselineStart) {
        curr.baselineEnd = curr.baselineStart;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** 根据 stage id 和是否有 track 判断 phase */
const PRODUCTION_STAGE_IDS = new Set(['vmp', 'sip', 'sop', 'machine_params', 'spc_inspection']);

/**
 * buildPreviewFromTasks — 从解析后的 TaskNode[] 生成上传预览摘要
 * 用于在用户确认同步前展示 "项目名 | 任务数 | 识别到的泳道"
 */
export function buildPreviewFromTasks(
  tasks: TaskNode[],
  projectCard?: ProjectCard,
): PreviewProject {
  const trackSet = new Set<TrackId>();
  for (const t of tasks) {
    if (t.track) trackSet.add(t.track);
    // 也尝试从任务名称识别泳道
    const detected = getSwimlaneType(t.nameCn || t.name);
    if (detected) trackSet.add(detected);
  }
  
  const swimlanes = Array.from(trackSet).map(id => SWIMLANE_LABELS[id]);
  const projectId = projectCard?.moldNumber || tasks[0]?.projectId || 'unknown';
  
  return {
    projectId,
    projectName: projectCard?.project_name || projectId,
    productName: projectCard?.product_name || '',
    moldNumber: projectCard?.moldNumber || projectId,
    indexNo: projectCard?.index_no || '-',
    taskCount: tasks.length,
    swimlanes,
    isExisting: false,
  };
}

function resolvePhase(stageId: string, hasTrack: boolean): PhaseType {
  if (hasTrack) return 'physical';
  // 模具Fai Cpk报告 仍属于开模物理阶段
  if (stageId === 'mold_fai_cpk') return 'physical';
  // 转量产阶段
  if (PRODUCTION_STAGE_IDS.has(stageId)) return 'production';
  // T0 / T1 默认 data
  return 'data';
}

function resolveColumns(headers: string[]): Record<string, string | null> {
  const resolved: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    const match = headers.find((h) =>
      aliases.some((a) => h.trim().toLowerCase().includes(a.toLowerCase())),
    );
    resolved[field] = match || null;
  }
  return resolved;
}

function getCell(row: ExcelRow, column: string | null): string {
  if (!column || row[column] === null || row[column] === undefined) return '';
  return String(row[column]).trim();
}

function parseDate(value: string): string | null {
  const raw = normalizeDateInput(value);
  if (!raw) return null;

  // 尝试 Excel 序列号 (如 "46069") — 先剥离非数字再试
  const numStr = raw.replace(/[^\d.-]/g, '');
  const numVal = Number(numStr);
  if (!isNaN(numVal) && numVal > 25569 && numVal < 100000) {
    const iso = excelSerialToISO(numVal);
    if (iso) return iso;
  }

  // 尝试直接解析（排除纯数字避免误判为毫秒时间戳）
  if (!/^\d+$/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      // 用本地时间避免 UTC 时区偏移导致日期减一天
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  // 尝试中文日期格式：2026年1月5日
  const cnMatch = raw.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (cnMatch) {
    return `${cnMatch[1]}-${cnMatch[2].padStart(2, '0')}-${cnMatch[3].padStart(2, '0')}`;
  }
  // 无年份中文日期：2月5日 / 12月31日 → 默认当前年份
  const cnNoYearMatch = raw.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
  if (cnNoYearMatch) {
    const year = new Date().getFullYear();
    return `${year}-${cnNoYearMatch[1].padStart(2, '0')}-${cnNoYearMatch[2].padStart(2, '0')}`;
  }
  // 尝试 slash 格式：2026/1/5
  const slashMatch = raw.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }
  return null;
}

function parseProgress(value: string): number {
  if (!value) return 0;
  const num = parseFloat(value.replace('%', ''));
  if (isNaN(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num > 1 ? num : num * 100)));
}

function inferStatus(
  progress: number,
  actualStart?: string,
  actualEnd?: string,
): TaskStatusType {
  if (progress >= 100 || actualEnd) return 'Done';
  if (progress > 0 || actualStart) return 'InProgress';
  return 'NotStart';
}
