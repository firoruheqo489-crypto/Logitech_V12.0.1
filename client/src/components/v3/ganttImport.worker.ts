import type { ProjectInfo } from '@shared/ganttEngine';
import {
  buildPreviewFromTasks,
  extractAllProjectCards,
  parseExcelRows,
  parseVerticalWBS,
  transformMatrixToFlatRows,
} from '@shared/importGanttAction';
import type { ExcelRow, ProjectCard } from '@shared/importGanttAction';
import type {
  GanttImportWorkerErrorResponse,
  GanttImportWorkerInspectResultResponse,
  GanttImportWorkerParsePayload,
  GanttImportWorkerParseResultResponse,
  GanttImportWorkerProgressResponse,
  GanttImportWorkerRequest,
} from './ganttImport.worker.types';

const DEFAULT_PROJECT_ID = 'LA26006';

type WorkerSession = {
  rawRows: unknown[][];
  tabularRows: ExcelRow[];
};

const sessions = new Map<string, WorkerSession>();

function postProgress(requestId: number, message: string): void {
  const payload: GanttImportWorkerProgressResponse = { type: 'progress', requestId, message };
  self.postMessage(payload);
}

function postInspectResult(
  requestId: number,
  sessionId: string,
  allCards: ProjectCard[],
  rowCount: number,
  sheetName: string,
): void {
  const payload: GanttImportWorkerInspectResultResponse = {
    type: 'inspect_result',
    requestId,
    sessionId,
    allCards,
    rowCount,
    sheetName,
  };
  self.postMessage(payload);
}

function postParseResult(requestId: number, payload: GanttImportWorkerParsePayload): void {
  const response: GanttImportWorkerParseResultResponse = { type: 'parse_result', requestId, payload };
  self.postMessage(response);
}

function postError(requestId: number, message: string, details?: string[]): void {
  const response: GanttImportWorkerErrorResponse = { type: 'error', requestId, message, details };
  self.postMessage(response);
}

function createSessionId(): string {
  return `gantt_import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickSheetName(sheetNames: string[]): string | undefined {
  return (
    sheetNames.find((name) => name.includes('项目') || name.includes('甘特') || name.includes('Gantt')) ??
    sheetNames[sheetNames.length - 1]
  );
}

function buildProjectInfo(tasks: GanttImportWorkerParsePayload['tasks'], projectId: string, card: ProjectCard): ProjectInfo {
  return {
    id: projectId,
    brand: 'Logitech',
    productName: card.product_name ?? '',
    moldNumber: projectId,
    startDate: tasks[0]?.baselineStart || '',
    endDate: tasks[tasks.length - 1]?.baselineEnd || '',
    index_no: card.index_no,
    project_name: card.project_name,
    fitter_group: card.fitter_group,
  };
}

function findMatrixHeaderRow(rawRows: unknown[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const rowStr = rawRows[i].map(String).join('|');
    if (rowStr.includes('铣床') || rowStr.includes('CNC') || rowStr.includes('FIT模')) {
      return i;
    }
  }
  return -1;
}

function buildFallbackRows(rawRows: unknown[][], headerRowIdx: number): ExcelRow[] {
  const headers = rawRows[headerRowIdx].map((header) => String(header).trim());
  const dataRows: ExcelRow[] = [];

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((cell) => cell === '' || cell === null || cell === undefined)) continue;

    const nextRow: ExcelRow = {};
    headers.forEach((header, index) => {
      if (!header) return;
      nextRow[header] = row[index] !== undefined && row[index] !== null ? (row[index] as string | number) : '';
    });
    dataRows.push(nextRow);
  }

  return dataRows;
}

async function inspectWorkbook(arrayBuffer: ArrayBuffer, requestId: number): Promise<void> {
  postProgress(requestId, '正在后台读取 Excel 文件...');
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  postProgress(requestId, '正在扫描工作表...');
  const sheetName = pickSheetName(workbook.SheetNames);
  if (!sheetName) {
    throw new Error('找不到有效的工作表');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('找不到有效的工作表');
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const tabularRows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

  postProgress(requestId, '正在识别项目组...');
  const allCards = extractAllProjectCards(rawRows);
  const sessionId = createSessionId();
  sessions.set(sessionId, { rawRows, tabularRows });

  postInspectResult(requestId, sessionId, allCards, rawRows.length, sheetName);
}

function parseWorkbookSession(sessionId: string, card: ProjectCard, requestId: number): void {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('解析会话已失效，请重新选择文件');
  }

  const projectId = card.moldNumber || DEFAULT_PROJECT_ID;

  postProgress(requestId, '正在后台解析垂直 WBS...');
  const verticalResult = parseVerticalWBS(session.rawRows, projectId);
  if (verticalResult && verticalResult.tasks.length > 0) {
    if (verticalResult.errors.length > 0) {
      postError(
        requestId,
        `解析出错 (${verticalResult.errors.length} 个错误)`,
        [...verticalResult.errors, ...verticalResult.warnings],
      );
      return;
    }

    const mergedCard = verticalResult.projectCard ?? { moldNumber: projectId };
    if (!mergedCard.moldNumber || mergedCard.moldNumber !== projectId) mergedCard.moldNumber = card.moldNumber;
    if (card.project_name) mergedCard.project_name = card.project_name;
    if (card.product_name) mergedCard.product_name = card.product_name;
    if (card.index_no) mergedCard.index_no = card.index_no;
    if (card.fitter_group) mergedCard.fitter_group = card.fitter_group;

    const resolvedProjectId = mergedCard.moldNumber ?? projectId;
    const projectInfo: ProjectInfo = {
      id: resolvedProjectId,
      brand: 'Logitech',
      productName: mergedCard.product_name ?? '',
      moldNumber: resolvedProjectId,
      startDate: verticalResult.tasks[0]?.baselineStart || '',
      endDate: verticalResult.tasks[verticalResult.tasks.length - 1]?.baselineEnd || '',
      index_no: mergedCard.index_no,
      project_name: mergedCard.project_name,
      fitter_group: mergedCard.fitter_group,
    };
    const preview = buildPreviewFromTasks(verticalResult.tasks, mergedCard);
    preview.isExisting = false;

    postParseResult(requestId, {
      mode: 'vertical_wbs',
      tasks: verticalResult.tasks,
      projectInfo,
      preview,
      warnings: verticalResult.warnings,
    });
    return;
  }

  postProgress(requestId, '正在后台解析矩阵/传统格式...');
  const headerRowIdx = findMatrixHeaderRow(session.rawRows);

  let rows: ExcelRow[];
  if (headerRowIdx < 0) {
    rows = session.tabularRows;
    if (rows.length === 0) {
      postError(requestId, 'Excel 文件中没有找到有效的数据行');
      return;
    }
  } else {
    const matrixRows = transformMatrixToFlatRows(session.rawRows, headerRowIdx);
    if (matrixRows && matrixRows.length > 0) {
      rows = matrixRows;
    } else {
      rows = buildFallbackRows(session.rawRows, headerRowIdx);
      if (rows.length === 0) {
        postError(requestId, 'Excel 文件中没有找到数据行（表头后无数据）');
        return;
      }
    }
  }

  const result = parseExcelRows(rows, projectId);
  if (result.errors.length > 0) {
    postError(requestId, `解析出错 (${result.errors.length} 个错误)`, [...result.errors, ...result.warnings]);
    return;
  }
  if (result.tasks.length === 0) {
    postError(requestId, '未能从 Excel 中解析出任何有效任务', result.warnings);
    return;
  }

  const projectInfo = buildProjectInfo(result.tasks, projectId, card);
  const preview = buildPreviewFromTasks(result.tasks, card);
  preview.isExisting = false;

  postParseResult(requestId, {
    mode: 'matrix_or_legacy',
    tasks: result.tasks,
    projectInfo,
    preview,
    warnings: result.warnings,
  });
}

self.onmessage = async (event: MessageEvent<GanttImportWorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === 'inspect') {
      await inspectWorkbook(request.arrayBuffer, request.requestId);
      return;
    }

    if (request.type === 'parse') {
      parseWorkbookSession(request.sessionId, request.card, request.requestId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Excel 解析失败';
    postError(request.requestId, message);
  }
};
