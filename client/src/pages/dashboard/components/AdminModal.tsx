import { useState, type ChangeEvent } from 'react';
import { Upload, Trash2, Clock, RefreshCw, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import { clearDashboardClientState } from '@/lib/dashboardClientState';
import { parseExcelFile } from '../lib/projectUtils';
import type { ProjectData } from '../types/project';

interface AdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastUpdated: string;
  onDataUpdate: (data: ProjectData[]) => void;
  onDataClear: () => void;
}

export function AdminModal({
  open,
  onOpenChange,
  lastUpdated,
  onDataUpdate,
  onDataClear,
}: AdminModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isResettingClientState, setIsResettingClientState] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const projects = await parseExcelFile(file);
      onDataUpdate(projects);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to parse Excel file:', error);
      alert('File parse failed. Please check the spreadsheet format.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleClearData = () => {
    setShowClearConfirm(true);
  };

  const handleResetClientState = async () => {
    setIsResettingClientState(true);
    try {
      await clearDashboardClientState();
      onOpenChange(false);
      window.location.reload();
    } finally {
      setIsResettingClientState(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#E6EDF3]">Data Management</DialogTitle>
          <DialogDescription className="text-[#8B949E]">
            Upload a new snapshot, clear server-side board data, or reset local browser cache.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 text-sm text-[#8B949E]">
            <Clock className="h-4 w-4" />
            <span>Last updated: {lastUpdated}</span>
          </div>

          <div>
            <label htmlFor="admin-file-upload">
              <Button className="w-full" variant="default" size="lg" disabled={isUploading} asChild>
                <span className="flex cursor-pointer items-center justify-center gap-2">
                  <Upload className="h-5 w-5" />
                  {isUploading ? 'Uploading...' : 'Upload spreadsheet'}
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
            <p className="mt-2 text-center text-xs text-[#6E7681]">
              Upload will overwrite current server-side dashboard snapshot.
            </p>
          </div>

          <Button
            className="w-full"
            variant="destructive"
            size="lg"
            onClick={handleClearData}
            disabled={isUploading || isResettingClientState}
          >
            <Trash2 className="mr-2 h-5 w-5" />
            Clear all server data
          </Button>

          <Button
            className="w-full"
            variant="outline"
            size="lg"
            onClick={handleResetClientState}
            disabled={isUploading || isResettingClientState}
          >
            <RefreshCw className={`mr-2 h-5 w-5 ${isResettingClientState ? 'animate-spin' : ''}`} />
            {isResettingClientState ? 'Resetting local state...' : 'Reset local board cache and reload'}
          </Button>
        </div>

        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <CyberConfirmDialog
          open={showClearConfirm}
          title="Confirm data clear"
          message="This will permanently remove all server-side dashboard records. Continue?"
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={() => {
            setShowClearConfirm(false);
            onDataClear();
            onOpenChange(false);
          }}
          confirmText="Clear data"
          cancelText="Cancel"
        />
      </DialogContent>
    </Dialog>
  );
}
