'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, FileSpreadsheet, ImageIcon, Plus } from 'lucide-react';
import EmpiricalKnowledgeBaseModal from './EmpiricalKnowledgeBaseModal';
import type { KnowledgeRecord } from './knowledge-base-types';

interface EmpiricalKnowledgeBaseProps {
  assetId: string;
  knowledgeRecords: KnowledgeRecord[];
}

export default function EmpiricalKnowledgeBase({
  assetId,
  knowledgeRecords,
}: EmpiricalKnowledgeBaseProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tableRecords, setTableRecords] = useState<KnowledgeRecord[]>(knowledgeRecords);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);

  useEffect(() => {
    setTableRecords(knowledgeRecords);
  }, [knowledgeRecords]);

  const getDefectBadgeStyles = (defectType: KnowledgeRecord['defectType']) => {
    const styles: Record<KnowledgeRecord['defectType'], string> = {
      MOLD: 'bg-slate-800 text-slate-300 border-slate-600',
      PROCESS: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.2)]',
      MATERIAL: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };

    return styles[defectType];
  };

  const getDimensionLabel = (defectType: KnowledgeRecord['defectType']) => {
    const labels: Record<KnowledgeRecord['defectType'], string> = {
      MOLD: '模具 / MOLD',
      PROCESS: '工艺 / PROCESS',
      MATERIAL: '材料 / MATERIAL',
    };

    return labels[defectType];
  };

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // TODO: 解析知识库 Excel 模板并更新 records
    console.log('Knowledge Excel file selected:', file);
    event.target.value = '';
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl">
      {/* Header Control Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 p-5">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-100">
          <BookOpen className="h-5 w-5 text-cyan-500" />
          <span>实战经验知识库</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">EMPIRICAL KNOWLEDGE BASE</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Asset Binding Badge */}
          <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5">
            <span className="text-[9px] text-slate-500">ASSET:</span>
            <span className="font-mono text-xs text-cyan-400">{assetId}</span>
          </div>

          <button
            className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-700"
            onClick={() => setIsEntryModalOpen(true)}
            type="button"
          >
            <Plus className="h-4 w-4 text-cyan-400" />
            <span>直接录入</span>
          </button>

          {/* Excel Upload Button */}
          <button
            className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-700"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span>沉淀知识同步</span>
          </button>
          <input
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleExcelUpload}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <thead className="bg-slate-950/80 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <tr>
              <th className="border-b border-slate-800 p-4">
                <div className="flex flex-col items-center">
                  <span>录入日期</span>
                  <span>DATE</span>
                </div>
              </th>
              <th className="border-b border-slate-800 p-4">
                <div className="flex flex-col items-center">
                  <span>缺陷索引</span>
                  <span>DEFECT INDEX</span>
                </div>
              </th>
              <th className="border-b border-slate-800 p-4">
                <div className="flex flex-col items-center">
                  <span>归属维度</span>
                  <span>ROOT CAUSE DIMENSION</span>
                </div>
              </th>
              <th className="border-b border-slate-800 p-4">
                <div className="flex flex-col items-center">
                  <span>验证有效的对策</span>
                  <span>VALIDATED COUNTERMEASURE</span>
                </div>
              </th>
              <th className="border-b border-slate-800 p-4">
                <div className="flex flex-col items-center">
                  <span>附图</span>
                  <span>ATTACHMENT</span>
                </div>
              </th>
              <th className="border-b border-slate-800 p-4">
                <div className="flex flex-col items-center">
                  <span>知识提供者</span>
                  <span>SUBMITTED BY</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRecords.map((entry) => (
              <tr
                key={entry.id}
                className="group border-b border-slate-800/50 transition-colors hover:bg-slate-800/20"
              >
                {/* Date */}
                <td className="p-4 text-sm">
                  <span className="font-mono text-slate-400">{entry.date}</span>
                </td>

                {/* Defect Index Badge */}
                <td className="p-4">
                  <span
                    className={`inline-block rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${getDefectBadgeStyles(entry.defectType)}`}
                  >
                    {entry.defectIndex}
                  </span>
                </td>

                {/* Dimension */}
                <td className="p-4">
                  <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-400">
                    {getDimensionLabel(entry.defectType)}
                  </span>
                </td>

                {/* Countermeasure */}
                <td className="max-w-xs p-4 text-sm text-slate-300">{entry.countermeasure}</td>

                {/* Attachment */}
                <td className="p-4">
                  <div className="flex items-center justify-center">
                    {entry.hasAttachment ? (
                      <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:border-cyan-500/50 hover:bg-slate-700 hover:text-cyan-400" type="button">
                        <ImageIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-600">--</span>
                    )}
                  </div>
                </td>

                {/* Submitter */}
                <td className="p-4 text-sm text-slate-300">
                  <div className="flex flex-col items-center">
                    <span>{entry.submittedBy}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EmpiricalKnowledgeBaseModal
        open={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        assetId={assetId}
        records={tableRecords}
        onRecordsChange={setTableRecords}
      />
    </div>
  );
}
