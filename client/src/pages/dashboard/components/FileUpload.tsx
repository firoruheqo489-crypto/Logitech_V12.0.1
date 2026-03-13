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

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onDataParsed?: (data: any[]) => void; // Optional callback after parsing
}

export default function FileUpload({ onFileSelect, onDataParsed }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        onFileSelect(file);
        
        // Parse Excel file if onDataParsed callback is provided
        if (onDataParsed) {
          setIsProcessing(true);
          try {
            const projects = await parseExcelFile(file);
            onDataParsed(projects);
          } catch (error) {
            console.error('Failed to parse Excel:', error);
            toast.error('文件解析失败,请检查文件格式');
          } finally {
            setIsProcessing(false);
          }
        }
      } else {
        toast.error('请上传 Excel 文件 (.xlsx 或 .xls)');
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        onFileSelect(file);
        
        // Parse Excel file if onDataParsed callback is provided
        if (onDataParsed) {
          setIsProcessing(true);
          try {
            const projects = await parseExcelFile(file);
            onDataParsed(projects);
          } catch (error) {
            console.error('Failed to parse Excel:', error);
            toast.error('文件解析失败,请检查文件格式');
          } finally {
            setIsProcessing(false);
          }
        }
      } else {
        toast.error('请上传 Excel 文件 (.xlsx 或 .xls)');
      }
    }
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
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white to-secondary/30 rounded-xl" />
      
      {/* Main content */}
      <div className="relative backdrop-blur-sm bg-white/60 border border-border rounded-xl p-12 transition-all duration-500 ease-out hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1">
        <div className="flex flex-col items-center gap-6">
          {/* Icon with ripple effect on hover */}
          <div className="relative">
            <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-gradient-to-br from-accent/10 to-accent/5 p-6 rounded-full">
              <Upload className="w-10 h-10 text-accent" strokeWidth={1.5} />
            </div>
          </div>
          
          {/* Text content */}
          <div className="text-center space-y-3">
            <p className="text-lg font-medium text-foreground tracking-wide">
              上传项目进度表
            </p>
            <p className="text-sm text-muted-foreground font-light">
              拖拽 Excel 文件到此处,或点击选择文件
            </p>
            <p className="text-xs text-muted-foreground/70 font-light">
              支持 .xlsx 和 .xls 格式
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
