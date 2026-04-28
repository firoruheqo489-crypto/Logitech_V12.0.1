/**
 * Project data structure - Three-Section Model
 * Each project is divided into 3 distinct modules
 */

import type {
  ProjectQualifiedFlag,
  ProjectRiskLevel,
  ProjectStatus,
} from '@/lib/dashboardProjectState';

// Module 1: Project Identity (The "Facts")
export interface ProjectIdentity {
  customerName: string; // 客户名称
  customerBase: string; // 客户基地
  projectName: string; // 项目名称
  productName: string; // 产品名称
  factory: string; // 落地工厂
  moldSets: string; // 模具套数
  partNumber: string; // 料号
  cavityNumber: string; // 穴号
  moldNumber: string; // 模具编号
  projectManager: string; // 项目经理
  projectEngineer: string; // 项目工程师
  moldProject: string; // 模具项目
  qe: string; // 项目QE
  riskLevel: ProjectRiskLevel | '-'; // 风险等级
  fitterGroup: string; // 钳工组
  designEngineer: string; // 设计工程
}

// Module 2: Internal Milestones (The "KPIs")
export interface InternalMilestones {
  // Timeline dates
  projectStart: string; // 项目启动时间
  t1: string; // T1时间
  glTime: string; // G/L时间
  vmp: string; // VMP时间
  mp: string; // MP时间
  estimatedCompletion?: string; // 项目预估完成时间

  // Status indicators
  currentStage: string; // 当前阶段
  t1SizeQualified: ProjectQualifiedFlag | '-'; // T1尺寸是否达标
  trialCount: string; // 试模次数
  toolingFAI: string; // Tooling FAI
  partFAI: string; // Part FAI
  currentNode: ProjectStatus | '-'; // 当前节点
}

// Module 3: Progression Details (The "Narrative")
export interface ProgressionDetails {
  detailSequence: string; // 序号
  detailDate: string; // 日期
  detailProgress: string; // 项目推进细节
}

// Complete project data combining all three modules
export interface ProjectData {
  no: string; // NO. 项目编号
  identity: ProjectIdentity;
  milestones: InternalMilestones;
  details: ProgressionDetails;
  uploadBatch?: string; // 上传批次时间（ISO）
}

// Statistics for dashboard
export interface ProjectStats {
  total: number;
  highRisk: number;
  inProgress: number;
  completed: number;
}

// Excel column mapping - maps Excel headers to field paths
export const DEFAULT_COLUMN_MAPPING: Record<string, string> = {
  '': 'no',

  '客户名称': 'identity.customerName',
  '客户基地': 'identity.customerBase',
  '项目名称': 'identity.projectName',
  '产品名称': 'identity.productName',
  '落地工厂': 'identity.factory',
  '模具\n套数': 'identity.moldSets',
  '模具套数': 'identity.moldSets',
  '料号': 'identity.partNumber',
  '穴号': 'identity.cavityNumber',
  '模具编号': 'identity.moldNumber',
  '项目经理': 'identity.projectManager',
  '项目工程师': 'identity.projectEngineer',
  '项目工程': 'identity.projectEngineer',
  '模具项目': 'identity.moldProject',
  '模具工程': 'identity.moldProject',
  'QE': 'identity.qe',
  '项目QE': 'identity.qe',
  '风险等级': 'identity.riskLevel',
  '钳工组': 'identity.fitterGroup',
  '设计工程': 'identity.designEngineer',

  '项目启动': 'milestones.projectStart',
  '项目启动时间': 'milestones.projectStart',
  'T1': 'milestones.t1',
  'T1时间': 'milestones.t1',
  'G/L\n时间': 'milestones.glTime',
  'G/L时间': 'milestones.glTime',
  'VMP': 'milestones.vmp',
  'VMP时间': 'milestones.vmp',
  'MP': 'milestones.mp',
  'MP时间': 'milestones.mp',
  '项目预估完成时间': 'milestones.estimatedCompletion',
  '现阶段': 'milestones.currentStage',
  '当前阶段': 'milestones.currentStage',
  'T1尺寸是否达标': 'milestones.t1SizeQualified',
  '试模次数': 'milestones.trialCount',
  'Tooling FAI': 'milestones.toolingFAI',
  'Part FAI': 'milestones.partFAI',
  '当前节点': 'milestones.currentNode',
  '项目状态': 'milestones.currentNode',

  '序号': 'details.detailSequence',
  '日期': 'details.detailDate',
  '更新日期': 'details.detailDate',
  '项目推进进展细节': 'details.detailProgress',
  '项目推进细节': 'details.detailProgress',
};
