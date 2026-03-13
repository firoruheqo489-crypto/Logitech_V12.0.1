/**
 * GanttV3ImportModal — 导入项目计划 Excel 的拖拽上传弹窗
 *
 * 两阶段流程：
 * 1. 用户拖拽/选择 Excel → 浏览器端解析 → 展示预览表格
 * 2. 用户点击"确认同步" → 写入 Supabase
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Eye, Database } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GanttData, ProjectInfo } from '@shared/ganttEngine';
import type { TaskNode } from '@shared/ganttEngine';
import {
  parseExcelRows,
  parseVerticalWBS,
  transformMatrixToFlatRows,
  extractAllProjectCards,
  buildPreviewFromTasks,
} from '@shared/importGanttAction';
import type { ExcelRow, ProjectCard, PreviewProject } from '@shared/importGanttAction';
import { apiFetch } from '@/lib/api';

const IMPORT_FETCH_TIMEOUT_MS = 90_000;

async function persistGanttAndReturnData(tasks: TaskNode[], projectInfo: ProjectInfo): Promise<GanttData> {
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), IMPORT_FETCH_TIMEOUT_MS);
  try {
    const res = await apiFetch('/api/gantt/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, projectInfo }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const msg = err?.error ?? `保存失败 ${res.status}`;
      if (res.status === 503) {
        throw new Error('后端数据库未配置。请检查 .env 中 DATABASE_URL（Supabase 连接字符串）。');
      }
      throw new Error(msg);
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        throw new Error('请求超时。任务较多时写入 Supabase 较慢，请稍后重试或联系管理员。');
      }
      if (e.message === 'Failed to fetch' || e.message.includes('NetworkError') || e.message.includes('Load failed')) {
        throw new Error(
          '无法连接到后端服务。请确认已同时运行：pnpm dev（前端）与 pnpm dev:api（后端）。' +
            '若已运行，请检查后端控制台是否有 Supabase 连接错误。',
        );
      }
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkProjectExists(projectId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/gantt/check-project?id=${encodeURIComponent(projectId)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.exists;
  } catch {
    return false;
  }
}

type Phase = 'upload' | 'select' | 'preview' | 'syncing' | 'success' | 'error';

interface ParsedData {
  tasks: TaskNode[];
  projectInfo: ProjectInfo;
  preview: PreviewProject;
  warnings: string[];
}

/** 暂存解析中间数据，用于用户选择项目后继续 */
interface PendingParse {
  rawRows: unknown[][];
  allCards: ProjectCard[];
  XLSX: typeof import('xlsx');
  sheet: import('xlsx').WorkSheet;
}

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: (data: GanttData) => void;
  /** 当前看板绑定的项目编号 — 上传数据必须与此匹配，否则拦截 */
  currentProjectId?: string;
}

export default function GanttV3ImportModal({ open, onOpenChange, onImportSuccess, currentProjectId }: ImportModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('upload');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [pendingParse, setPendingParse] = useState<PendingParse | null>(null);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      setPhase('error');
      setMessage('请上传 .xlsx / .xls / .csv 格式的文件');
      return;
    }
    setFile(f);
    setPhase('upload');
    setMessage(`✓ 文件 "${f.name}" 已选择，点击"解析预览"开始`);
    setDetails([]);
    setParsedData(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  // ═══════════════════════════════════════════════════════════════════
  // 读取 Excel → 提取所有项目组 → 多项目则让用户选择
  // ═══════════════════════════════════════════════════════════════════
  const readExcelAndDetectProjects = useCallback(async (): Promise<{
    rawRows: unknown[][];
    allCards: ProjectCard[];
    XLSX: typeof import('xlsx');
    sheet: import('xlsx').WorkSheet;
  } | null> => {
    if (!file) return null;
    const arrayBuffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    let sheetName = workbook.SheetNames.find((n) =>
      n.includes('项目') || n.includes('甘特') || n.includes('Gantt'),
    );
    if (!sheetName) {
      sheetName = workbook.SheetNames[workbook.SheetNames.length - 1];
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      setPhase('error');
      setMessage('找不到有效的工作表');
      return null;
    }

    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log(`[Import] 选中 Sheet: "${sheetName}", 共 ${rawRows.length} 行`);

    const allCards = extractAllProjectCards(rawRows);
    console.log(`[Import] 检测到 ${allCards.length} 个项目组:`, JSON.stringify(allCards));

    return { rawRows, allCards, XLSX, sheet };
  }, [file]);

  // ═══════════════════════════════════════════════════════════════════
  // 核心解析逻辑：用指定的 ProjectCard 解析 Excel 数据
  // （必须定义在 handleParse / handleSelectProject 之前）
  // ═══════════════════════════════════════════════════════════════════
  const parseWithSelectedCard = useCallback(async (
    rawRows: unknown[][],
    card: ProjectCard,
    XLSX: typeof import('xlsx'),
    sheet: import('xlsx').WorkSheet,
  ) => {
    const projectId = card.moldNumber || 'LA26006';
    console.log(`[Import] 使用项目: ${projectId}, card:`, JSON.stringify(card));
    console.log(`[Import] currentProjectId (URL绑定): ${currentProjectId}`);

    // ═══ 前置校验：解析阶段即拦截项目编号不匹配 ═══
    if (currentProjectId && projectId && projectId !== currentProjectId) {
      setPhase('error');
      setMessage(`⛔ 安全拦截：Excel 中的项目编号 [${projectId}] 与当前看板 [${currentProjectId}] 不符！`);
      setDetails([
        `上传文件中的项目编号: ${projectId}`,
        `当前看板绑定编号: ${currentProjectId}`,
        '请检查文件是否正确，或切换到对应项目的看板后再上传。',
      ]);
      return; // 硬阻断，不进入预览
    }

    // ── 1. 尝试垂直 WBS 格式 ──
    const verticalResult = parseVerticalWBS(rawRows, projectId);
    if (verticalResult && verticalResult.tasks.length > 0) {
      if (verticalResult.errors.length > 0) {
        setPhase('error');
        setMessage(`解析出错 (${verticalResult.errors.length} 个错误)`);
        setDetails([...verticalResult.errors, ...verticalResult.warnings]);
        return;
      }
      // 合并：垂直解析器自己也提取了 projectCard，用用户选择的 card 覆盖
      const mergedCard = verticalResult.projectCard ?? { moldNumber: projectId };
      if (!mergedCard.moldNumber || mergedCard.moldNumber !== projectId) mergedCard.moldNumber = card.moldNumber;
      if (card.project_name) mergedCard.project_name = card.project_name;
      if (card.product_name) mergedCard.product_name = card.product_name;
      if (card.index_no) mergedCard.index_no = card.index_no;
      if (card.fitter_group) mergedCard.fitter_group = card.fitter_group;

      const pid = mergedCard.moldNumber ?? projectId;
      const projectInfo: ProjectInfo = {
        id: pid,
        brand: 'Logitech',
        productName: mergedCard.product_name ?? '',
        moldNumber: pid,
        startDate: verticalResult.tasks[0]?.baselineStart || '',
        endDate: verticalResult.tasks[verticalResult.tasks.length - 1]?.baselineEnd || '',
        index_no: mergedCard.index_no,
        project_name: mergedCard.project_name,
        fitter_group: mergedCard.fitter_group,
      };
      const preview = buildPreviewFromTasks(verticalResult.tasks, mergedCard);
      preview.isExisting = await checkProjectExists(pid);

      setParsedData({ tasks: verticalResult.tasks, projectInfo, preview, warnings: verticalResult.warnings });
      setPhase('preview');
      setMessage(`✓ 垂直WBS格式，解析 ${verticalResult.tasks.length} 个任务`);
      setDetails([
        `模具编号: ${mergedCard.moldNumber}`,
        `No.: ${mergedCard.index_no ?? '(未提取)'}`,
        `项目名称: ${mergedCard.project_name ?? '(未提取)'}`,
        `产品名称: ${mergedCard.product_name ?? '(未提取)'}`,
        `钳工组: ${mergedCard.fitter_group ?? '(未提取)'}`,
        ...verticalResult.warnings,
      ]);
      return;
    }

    // ── 2. 尝试矩阵/传统格式 ──
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const rowStr = rawRows[i].map(String).join('|');
      if (rowStr.includes('铣床') || rowStr.includes('CNC') || rowStr.includes('FIT模')) {
        headerRowIdx = i;
        break;
      }
    }

    let rows: ExcelRow[];

    if (headerRowIdx < 0) {
      rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });
      if (rows.length === 0) {
        setPhase('error');
        setMessage('Excel 文件中没有找到有效的数据行');
        return;
      }
    } else {
      const matrixRows = transformMatrixToFlatRows(rawRows, headerRowIdx);
      if (matrixRows && matrixRows.length > 0) {
        rows = matrixRows;
      } else {
        const headers = rawRows[headerRowIdx].map((h) => String(h).trim());
        const dataRows: ExcelRow[] = [];
        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.every((c) => c === '' || c === null || c === undefined)) continue;
          const obj: ExcelRow = {};
          headers.forEach((h, j) => {
            if (h) obj[h] = row[j] !== undefined && row[j] !== null ? row[j] as string | number : '';
          });
          dataRows.push(obj);
        }
        if (dataRows.length === 0) {
          setPhase('error');
          setMessage('Excel 文件中没有找到数据行（表头后无数据）');
          return;
        }
        rows = dataRows;
      }
    }

    const result = parseExcelRows(rows, projectId);
    if (result.errors.length > 0) {
      setPhase('error');
      setMessage(`解析出错 (${result.errors.length} 个错误)`);
      setDetails([...result.errors, ...result.warnings]);
      return;
    }
    if (result.tasks.length === 0) {
      setPhase('error');
      setMessage('未能从 Excel 中解析出任何有效任务');
      setDetails(result.warnings);
      return;
    }

    const pid = projectId;
    const projectInfo: ProjectInfo = {
      id: pid,
      brand: 'Logitech',
      productName: card.product_name ?? '',
      moldNumber: pid,
      startDate: result.tasks[0]?.baselineStart || '',
      endDate: result.tasks[result.tasks.length - 1]?.baselineEnd || '',
      index_no: card.index_no,
      project_name: card.project_name,
      fitter_group: card.fitter_group,
    };
    const preview = buildPreviewFromTasks(result.tasks, card);
    preview.isExisting = await checkProjectExists(pid);

    setParsedData({ tasks: result.tasks, projectInfo, preview, warnings: result.warnings });
    setPhase('preview');
    setMessage(`✓ 成功解析 ${result.tasks.length} 个任务`);
    setDetails(result.warnings);
  }, [currentProjectId]);

  // ═══════════════════════════════════════════════════════════════════
  // Phase 1: 解析 Excel → 检测项目组 → 多项目则进入选择阶段
  // ═══════════════════════════════════════════════════════════════════
  const handleParse = useCallback(async () => {
    if (!file) return;
    setPhase('syncing');
    setMessage('正在解析 Excel 文件...');
    setDetails([]);

    try {
      const excelData = await readExcelAndDetectProjects();
      if (!excelData) return;

      const { rawRows, allCards, XLSX, sheet } = excelData;

      // 多个项目组 → 让用户选择
      if (allCards.length > 1) {
        setPendingParse({ rawRows, allCards, XLSX, sheet });
        setSelectedCardIdx(0);
        setPhase('select');
        setMessage(`检测到 ${allCards.length} 个项目，请选择要导入的项目：`);
        setDetails([]);
        return;
      }

      // 单个或零个项目组 → 直接解析
      const card = allCards[0] ?? { moldNumber: 'LA26006' };
      await parseWithSelectedCard(rawRows, card, XLSX, sheet);
    } catch (err) {
      console.error('Parse error:', err);
      setPhase('error');
      setMessage(`解析失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [file, readExcelAndDetectProjects, parseWithSelectedCard]);

  // ═══════════════════════════════════════════════════════════════════
  // 用户选择项目后 → 用选中的 card 继续解析
  // ═══════════════════════════════════════════════════════════════════
  const handleSelectProject = useCallback(async (cardIdx: number) => {
    if (!pendingParse) return;
    setPhase('syncing');
    setMessage('正在解析选中的项目...');

    try {
      const card = pendingParse.allCards[cardIdx];
      await parseWithSelectedCard(
        pendingParse.rawRows,
        card,
        pendingParse.XLSX,
        pendingParse.sheet,
      );
    } catch (err) {
      console.error('Parse error:', err);
      setPhase('error');
      setMessage(`解析失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [pendingParse, parseWithSelectedCard]);

  // ═══════════════════════════════════════════════════════════════════
  // Phase 2: 确认同步 → 写入 Supabase
  // ═══════════════════════════════════════════════════════════════════
  const handleConfirmSync = useCallback(async () => {
    if (!parsedData) return;

    // ═══ 项目编号强校验 (ID Validation Guardrail) ═══
    const newParsedId = parsedData.projectInfo?.id || parsedData.preview?.moldNumber || '';
    if (currentProjectId && newParsedId && newParsedId !== currentProjectId) {
      setPhase('error');
      setMessage(`⛔ 安全拦截：数据表项目编号 [${newParsedId}] 与当前看板 [${currentProjectId}] 不符！`);
      setDetails([
        `上传文件中的项目编号: ${newParsedId}`,
        `当前看板绑定编号: ${currentProjectId}`,
        '请检查文件是否正确，或切换到对应项目的看板后再上传。',
      ]);
      return; // 硬阻断，绝不执行后续写入
    }

    setPhase('syncing');
    setMessage('正在写入 Supabase...');

    try {
      const ganttData = await persistGanttAndReturnData(parsedData.tasks, parsedData.projectInfo);
      setPhase('success');
      setMessage(`同步成功！共 ${parsedData.tasks.length} 个任务已${parsedData.preview.isExisting ? '更新' : '写入'}`);
      setDetails([
        `✓ 项目: ${parsedData.preview.moldNumber}`,
        `✓ 轨道: ${ganttData.tracks.length} 条`,
        `✓ 里程碑: ${ganttData.milestones.length} 个`,
        '✓ 已保存到数据库',
      ]);
      if (onImportSuccess) onImportSuccess(ganttData);
      setTimeout(() => onOpenChange(false), 1500);
    } catch (err) {
      setPhase('error');
      setMessage(err instanceof Error ? err.message : '同步失败');
      setDetails([err instanceof Error ? err.message : String(err)]);
    }
  }, [parsedData, onImportSuccess, onOpenChange, currentProjectId]);

  const reset = useCallback(() => {
    setFile(null);
    setPhase('upload');
    setMessage('');
    setDetails([]);
    setParsedData(null);
    setPendingParse(null);
    setSelectedCardIdx(0);
  }, []);

  const isLoading = phase === 'syncing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[#0F0F0F] border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="text-white/90 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            导入项目计划
          </DialogTitle>
          <DialogDescription className="text-white/40">
            {phase === 'preview'
              ? '请确认以下解析结果，点击"确认同步"写入数据库'
              : phase === 'select'
                ? '检测到多个项目，请点击选择要导入的项目'
                : '上传 Excel 文件 (.xlsx / .xls / .csv)，系统将自动识别并预览'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Phase: Upload / Drop Zone ── */}
        {(phase === 'upload' || phase === 'error') && (
          <div
            className={`
              relative mt-2 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
              flex flex-col items-center justify-center py-10 gap-3
              ${isDragOver
                ? 'border-cyan-400/60 bg-cyan-500/5'
                : file
                  ? 'border-emerald-400/30 bg-emerald-500/5'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleInputChange}
            />
            {isDragOver ? (
              <>
                <Upload className="w-10 h-10 text-cyan-400 animate-bounce" />
                <span className="text-sm text-cyan-400 font-medium">释放文件以上传</span>
              </>
            ) : file ? (
              <>
                <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                <span className="text-sm text-white/70 font-medium">{file.name}</span>
                <span className="text-xs text-white/30">{(file.size / 1024).toFixed(1)} KB · 点击更换文件</span>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-white/20" />
                <span className="text-sm text-white/50 font-medium">拖拽文件到此处，或点击选择</span>
                <span className="text-xs text-white/25">支持 .xlsx / .xls / .csv</span>
              </>
            )}
          </div>
        )}

        {/* ── Phase: Select Project (多项目选择) ── */}
        {phase === 'select' && pendingParse && (
          <div className="mt-2 space-y-3">
            <div className="text-xs text-white/50 mb-2">{message}</div>
            <div className="rounded-lg border border-white/[0.08] overflow-hidden">
              {pendingParse.allCards.map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedCardIdx(idx);
                    handleSelectProject(idx);
                  }}
                  className={`
                    w-full flex items-center gap-4 px-4 py-3 text-left transition-all
                    border-b border-white/[0.04] last:border-b-0
                    hover:bg-cyan-500/10
                    ${selectedCardIdx === idx ? 'bg-cyan-500/5 border-l-2 border-l-cyan-400' : 'bg-transparent'}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium font-mono">{card.moldNumber}</div>
                    <div className="flex gap-3 mt-1 text-[10px] text-white/40">
                      <span>No. {card.index_no ?? '-'}</span>
                      <span>项目: {card.project_name ?? '-'}</span>
                      <span>产品: {card.product_name ?? '-'}</span>
                      <span>钳工组: {card.fitter_group ?? '-'}</span>
                    </div>
                  </div>
                  <span className="text-xs text-cyan-400/60 shrink-0">选择 →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Phase: Preview Table ── */}
        {phase === 'preview' && parsedData && (
          <div className="mt-2 space-y-3">
            <div className="rounded-lg border border-white/[0.08] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.04]">
                    <th className="px-3 py-2 text-left text-white/50 font-medium">项目名 / 模具编号</th>
                    <th className="px-3 py-2 text-center text-white/50 font-medium">No.</th>
                    <th className="px-3 py-2 text-center text-white/50 font-medium">任务数</th>
                    <th className="px-3 py-2 text-left text-white/50 font-medium">识别到的泳道</th>
                    <th className="px-3 py-2 text-center text-white/50 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-white/[0.04]">
                    <td className="px-3 py-2.5">
                      <div className="text-white/80 font-medium">{parsedData.preview.moldNumber}</div>
                      {parsedData.preview.projectName !== parsedData.preview.moldNumber && (
                        <div className="text-white/40 text-[10px]">{parsedData.preview.projectName}</div>
                      )}
                      {parsedData.preview.productName && (
                        <div className="text-white/30 text-[10px]">{parsedData.preview.productName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-white/60">{parsedData.preview.indexNo}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-cyan-400 font-mono">{parsedData.preview.taskCount}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {parsedData.preview.swimlanes.length > 0 ? (
                          parsedData.preview.swimlanes.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/80 text-[10px]">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-white/30 text-[10px]">无泳道</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        parsedData.preview.isExisting
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {parsedData.preview.isExisting ? 'UPDATE' : 'INSERT'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Loading indicator ── */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-sm text-cyan-400">{message}</span>
          </div>
        )}

        {/* ── Status Message ── */}
        {message && !isLoading && (
          <div
            className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
              phase === 'error'
                ? 'bg-red-500/10 text-red-400'
                : phase === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-white/[0.03] text-white/50'
            }`}
          >
            {phase === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            {phase === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{message}</div>
              {details.length > 0 && (
                <div className="mt-1 space-y-0.5 text-[9px] opacity-70" style={{ fontFamily: 'var(--font-mono)' }}>
                  {details.slice(0, 8).map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                  {details.length > 8 && <div>...还有 {details.length - 8} 条</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Column Mapping Reference (only in upload phase) ── */}
        {(phase === 'upload' || phase === 'error') && (
          <div className="mt-1 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[10px] font-bold text-white/40 mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              列名映射参考
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[9px]" style={{ fontFamily: 'var(--font-mono)' }}>
              {[
                ['序号 / 工序序号', '→ wbs_id / track'],
                ['工序 / 工序名称', '→ task_name / stage'],
                ['项目工序预计完成时间', '→ baseline_date'],
                ['项目工序实际完成时间', '→ actual_date'],
                ['里程碑列 (6,11,16,21)', '→ 金色菱形标识'],
                ['5-1-1 / 5-1-2 / 5-2-1/2', '→ 四泳道轨道'],
              ].map(([excel, db]) => (
                <div key={excel} className="flex items-center gap-1.5">
                  <span className="text-white/35">{excel}</span>
                  <span className="text-cyan-400/60">{db}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 mt-2">
          {(file || phase === 'preview' || phase === 'select') && (
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              {phase === 'preview' || phase === 'select' ? '重新选择' : '清除'}
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs text-white/50 hover:text-white/70 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition-all"
          >
            取消
          </button>

          {/* Phase 1: 解析预览按钮 */}
          {phase !== 'preview' && phase !== 'success' && phase !== 'select' && (
            <button
              onClick={handleParse}
              disabled={!file || isLoading}
              className={`
                px-4 py-2 text-xs font-bold rounded-lg transition-all
                ${file && !isLoading
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-500/30'
                  : 'bg-white/[0.03] text-white/20 border border-white/[0.04] cursor-not-allowed'
                }
              `}
            >
              <span className="flex items-center gap-1.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                {isLoading ? '解析中...' : '解析预览'}
              </span>
            </button>
          )}

          {/* Phase 2: 确认同步按钮 */}
          {phase === 'preview' && (
            <button
              onClick={handleConfirmSync}
              className="px-4 py-2 text-xs font-bold rounded-lg transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-500/30"
            >
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                确认同步
              </span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
