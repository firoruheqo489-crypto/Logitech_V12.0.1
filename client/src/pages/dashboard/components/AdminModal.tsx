import { useState } from 'react';
import { Upload, Trash2, Clock, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import { toast } from 'sonner';
import { parseExcelFile } from '../lib/projectUtils';
import type { ProjectData } from '../types/project';

interface AdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastUpdated: string;
  onDataUpdate: (data: ProjectData[]) => Promise<void> | void;
  onDataClear: () => Promise<void> | void;
}

/**
 * Admin Modal for data management
 * Provides upload new file and clear data functionality
 */
export function AdminModal({
  open,
  onOpenChange,
  lastUpdated,
  onDataUpdate,
  onDataClear,
}: AdminModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const projects = await parseExcelFile(file);
      if (projects.length === 0) {
        toast.error('未从 Excel 解析到项目数据，请检查表头模板');
        return;
      }
      await onDataUpdate(projects);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to parse Excel file:', error);
      toast.error('文件解析失败，请检查文件格式是否正确');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleClearData = () => {
    setShowClearConfirm(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#E6EDF3]">
            数据管理
          </DialogTitle>
          <DialogDescription className="text-[#8B949E]">
            管理项目进度数据,上传新文件或清除现有数据
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm text-[#8B949E] bg-white/[0.04] p-3 rounded-lg border border-white/[0.06]">
            <Clock className="w-4 h-4" />
            <span>最后更新: {lastUpdated}</span>
          </div>

          <div>
            <label htmlFor="admin-file-upload">
              <Button
                className="w-full"
                variant="default"
                size="lg"
                disabled={isUploading}
                asChild
              >
                <span className="flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  {isUploading ? '上传中...' : '上传新文件'}
                </span>
              </Button>
            </label>
            <input
              id="admin-file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
            <p className="text-xs text-[#6E7681] mt-2 text-center">
              上传新文件将覆盖当前数据
            </p>
          </div>

          <Button
            className="w-full"
            variant="destructive"
            size="lg"
            onClick={handleClearData}
            disabled={isUploading}
          >
            <Trash2 className="w-5 h-5 mr-2" />
            清除所有数据
          </Button>
        </div>

        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </button>

        <CyberConfirmDialog
          open={showClearConfirm}
          title="清除数据确认"
          message="确定要清除所有数据吗？此操作不可恢复。"
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={async () => {
            setShowClearConfirm(false);
            await onDataClear();
            onOpenChange(false);
          }}
          confirmText="确认清除"
          cancelText="取消"
        />
      </DialogContent>
    </Dialog>
  );
}
