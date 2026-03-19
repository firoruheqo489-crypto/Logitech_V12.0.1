import type { ProjectInfo, TaskNode } from '@shared/ganttEngine';
import type { PreviewProject, ProjectCard } from '@shared/importGanttAction';

export interface GanttImportWorkerInspectRequest {
  type: 'inspect';
  requestId: number;
  arrayBuffer: ArrayBuffer;
}

export interface GanttImportWorkerParseRequest {
  type: 'parse';
  requestId: number;
  sessionId: string;
  card: ProjectCard;
}

export type GanttImportWorkerRequest =
  | GanttImportWorkerInspectRequest
  | GanttImportWorkerParseRequest;

export interface GanttImportWorkerProgressResponse {
  type: 'progress';
  requestId: number;
  message: string;
}

export interface GanttImportWorkerInspectResultResponse {
  type: 'inspect_result';
  requestId: number;
  sessionId: string;
  allCards: ProjectCard[];
  rowCount: number;
  sheetName: string;
}

export interface GanttImportWorkerParsePayload {
  mode: 'vertical_wbs' | 'matrix_or_legacy';
  tasks: TaskNode[];
  projectInfo: ProjectInfo;
  preview: PreviewProject;
  warnings: string[];
}

export interface GanttImportWorkerParseResultResponse {
  type: 'parse_result';
  requestId: number;
  payload: GanttImportWorkerParsePayload;
}

export interface GanttImportWorkerErrorResponse {
  type: 'error';
  requestId: number;
  message: string;
  details?: string[];
}

export type GanttImportWorkerResponse =
  | GanttImportWorkerProgressResponse
  | GanttImportWorkerInspectResultResponse
  | GanttImportWorkerParseResultResponse
  | GanttImportWorkerErrorResponse;
