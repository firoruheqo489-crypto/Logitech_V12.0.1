/**
 * Design Philosophy: Japanese Minimalism
 * - Generous whitespace (Ma concept)
 * - Subtle borders and gentle interactions
 * - Elegant hover states with slow transitions
 */

import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { parseExcelFile } from '../lib/projectUtils';
import type { ProjectData } from '../types/project';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onDataParsed?: (data: ProjectData[]) => Promise<void> | void;
}

export default function FileUpload({ onFileSelect, onDataParsed }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseAndDispatch = async (file: File) => {
    onFileSelect(file);

    if (!onDataParsed) return;

    setIsProcessing(true);
    try {
      const projects = await parseExcelFile(file);
      if (projects.length === 0) {
        toast.error('未从 Excel 解析到项目数据，请检查表头模板');
        return;
      }
      await onDataParsed(projects);
    } catch (error) {
      console.error('Failed to parse Excel:', error);
      toast.error('文件解析失败，请检查文件格式');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('请上传 Excel 文件 (.xlsx 或 .xls)');
      e.target.value = '';
      return;
    }

    await parseAndDispatch(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('请上传 Excel 文件 (.xlsx 或 .xls)');
      return;
    }

    await parseAndDispatch(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="relative cursor-pointer group"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white to-secondary/30" />

      <div className="relative rounded-xl border border-border bg-white/60 p-12 backdrop-blur-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative rounded-full bg-gradient-to-br from-accent/10 to-accent/5 p-6">
              <Upload className="h-10 w-10 text-accent" strokeWidth={1.5} />
            </div>
          </div>

          <div className="space-y-3 text-center">
            <p className="text-lg font-medium tracking-wide text-foreground">
              {isProcessing ? '正在解析项目进度表...' : '上传项目进度表'}
            </p>
            <p className="text-sm font-light text-muted-foreground">
              拖拽 Excel 文件到此处，或点击选择文件
            </p>
            <p className="text-xs font-light text-muted-foreground/70">
              支持 `.xlsx` 和 `.xls` 格式
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
