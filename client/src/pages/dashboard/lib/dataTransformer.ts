import { ProjectData } from '../types/project';
import type { DashboardProject } from '@shared/schema';
import {
  denormalizeProjectQualifiedFlag,
  denormalizeProjectRiskLevel,
  denormalizeProjectStatus,
  normalizeProjectQualifiedFlag,
  normalizeProjectRiskLevel,
  normalizeProjectStatus,
} from '@/lib/dashboardProjectState';

type DashboardProjectLike = Omit<DashboardProject, 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const dateValue = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dateValue.getTime()) ? undefined : dateValue.toISOString();
}

/**
 * Transform database Project to frontend ProjectData format
 */
export function transformProjectToData(project: DashboardProjectLike, index: number): ProjectData {
  return {
    no: String(index + 1),
    identity: {
      customerName: project.customerName || '-',
      customerBase: project.customerBase || '-',
      projectName: project.projectName || '-',
      productName: project.productName || '-',
      factory: project.factoryLocation || '-',
      moldSets: project.moldCount || '-',
      partNumber: project.partNumber || '-',
      cavityNumber: project.cavityNumber || '-',
      moldNumber: project.moldId || '-',
      projectManager: project.pmName || '-',
      projectEngineer: project.peName || '-',
      moldProject: project.moldLead || '-',
      qe: project.pqeName || '-',
      riskLevel: project.riskLevel ? normalizeProjectRiskLevel(project.riskLevel) : '-',
      fitterGroup: project.fitterGroup || '-',
      designEngineer: project.designEngineer || '-',
    },
    milestones: {
      projectStart: project.kickoffDate || '-',
      t1: project.t1Date || '-',
      glTime: project.glDate || '-',
      vmp: project.vmpDate || '-',
      mp: project.mpDate || '-',
      estimatedCompletion: project.estimatedCompletion || '-',
      currentStage: project.currentStage || '-',
      t1SizeQualified: project.t1DimensionOk ? normalizeProjectQualifiedFlag(project.t1DimensionOk) : '-',
      trialCount: project.trialCount || '-',
      toolingFAI: project.toolingFai || '-',
      partFAI: project.partFai || '-',
      currentNode: project.currentNode ? normalizeProjectStatus(project.currentNode) : '-',
    },
    details: {
      detailSequence: String(index + 1),
      detailDate: project.updateDate || '-',
      detailProgress: project.progressDetails || '-',
    },
    uploadBatch: toIsoString(project.createdAt),
  };
}

/**
 * Transform frontend ProjectData to database Project format
 */
export function transformDataToProject(data: ProjectData): Record<string, string | undefined> {
  return {
    customerName: data.identity.customerName === '-' ? undefined : data.identity.customerName,
    customerBase: data.identity.customerBase === '-' ? undefined : data.identity.customerBase,
    projectName: data.identity.projectName === '-' ? undefined : data.identity.projectName,
    productName: data.identity.productName === '-' ? undefined : data.identity.productName,
    factoryLocation: data.identity.factory === '-' ? undefined : data.identity.factory,
    moldCount: data.identity.moldSets === '-' ? undefined : data.identity.moldSets,
    partNumber: data.identity.partNumber === '-' ? undefined : data.identity.partNumber,
    cavityNumber: data.identity.cavityNumber === '-' ? undefined : data.identity.cavityNumber,
    moldId: data.identity.moldNumber === '-' ? undefined : data.identity.moldNumber,
    pmName: data.identity.projectManager === '-' ? undefined : data.identity.projectManager,
    peName: data.identity.projectEngineer === '-' ? undefined : data.identity.projectEngineer,
    moldLead: data.identity.moldProject === '-' ? undefined : data.identity.moldProject,
    pqeName: data.identity.qe === '-' ? undefined : data.identity.qe,
    riskLevel: denormalizeProjectRiskLevel(data.identity.riskLevel),
    fitterGroup: data.identity.fitterGroup === '-' ? undefined : data.identity.fitterGroup,
    designEngineer: data.identity.designEngineer === '-' ? undefined : data.identity.designEngineer,
    kickoffDate: data.milestones.projectStart === '-' ? undefined : data.milestones.projectStart,
    t1Date: data.milestones.t1 === '-' ? undefined : data.milestones.t1,
    glDate: data.milestones.glTime === '-' ? undefined : data.milestones.glTime,
    vmpDate: data.milestones.vmp === '-' ? undefined : data.milestones.vmp,
    mpDate: data.milestones.mp === '-' ? undefined : data.milestones.mp,
    currentStage: data.milestones.currentStage === '-' ? undefined : data.milestones.currentStage,
    t1DimensionOk: denormalizeProjectQualifiedFlag(data.milestones.t1SizeQualified),
    trialCount: data.milestones.trialCount === '-' ? undefined : data.milestones.trialCount,
    toolingFai: data.milestones.toolingFAI === '-' ? undefined : data.milestones.toolingFAI,
    partFai: data.milestones.partFAI === '-' ? undefined : data.milestones.partFAI,
    currentNode: denormalizeProjectStatus(data.milestones.currentNode),
    estimatedCompletion: data.milestones.estimatedCompletion === '-' ? undefined : data.milestones.estimatedCompletion,
    progressDetails: data.details.detailProgress === '-' ? undefined : data.details.detailProgress,
    updateDate: data.details.detailDate === '-' ? undefined : data.details.detailDate,
  };
}
