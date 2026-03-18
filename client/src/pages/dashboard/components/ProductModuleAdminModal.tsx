import { useState } from 'react';
import { Clock, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { parseProductModuleExcelFile } from '../lib/productModuleUtils';

interface ProductModuleAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastUpdated: string;
  onUploadSuccess: () => Promise<void> | void;
}

function resolveUploadErrorMessage(message: string): string {
  const normalized = message.trim();
  if (!normalized) return '产品模块数据上传失败';

  if (
    normalized.includes('API Key') ||
    normalized.includes('未授权') ||
    normalized.includes('Write API key is not configured')
  ) {
    return '本地上传被旧鉴权拦截了，请重启本地 API 服务后再试。';
  }

  if (
    normalized.includes('Database not configured') ||
    normalized.includes('CONNECT_TIMEOUT') ||
    normalized.toLowerCase().includes('timeout')
  ) {
    return '本地 API 已响应，但数据库连接不可用，请检查 .env 里的 DATABASE_URL。';
  }

  return normalized;
}

export function ProductModuleAdminModal({
  open,
  onOpenChange,
  lastUpdated,
  onUploadSuccess,
}: ProductModuleAdminModalProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);
    try {
      const records = await parseProductModuleExcelFile(file);
      if (records.length === 0) {
        toast.error('未识别到可上传的产品模块数据');
        return;
      }

      const response = await apiFetch('/api/dashboard/product-data/batch-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || '产品模块数据上传失败');
      }

      toast.success(`产品模块数据已更新 ${records.length} 条`);
      await onUploadSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to upload product module Excel:', error);
      const message = error instanceof Error ? error.message : '产品模块数据上传失败';
      toast.error(resolveUploadErrorMessage(message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#E6EDF3]">产品模块数据管理</DialogTitle>
          <DialogDescription className="text-[#8B949E]">
            仅管理员可上传产品信息 Excel，系统将按模具编号覆盖更新 PDM 卡片数据
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 text-sm text-[#8B949E]">
            <Clock className="h-4 w-4" />
            <span>最后更新: {lastUpdated}</span>
          </div>

          <div>
            <label htmlFor="product-module-file-upload">
              <Button className="w-full" variant="default" size="lg" disabled={isUploading} asChild>
                <span className="flex cursor-pointer items-center justify-center gap-2">
                  <Upload className="h-5 w-5" />
                  {isUploading ? '上传中...' : '上传产品信息 Excel'}
                </span>
              </Button>
            </label>
            <input
              id="product-module-file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
            <p className="mt-2 text-center text-xs text-[#6E7681]">
              使用 `产品信息上传.xlsx` 这套格式，按模具编号 1:1 覆盖更新
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
