import { apiFetch } from '@/lib/api';

export type TrialDocument = {
  id: string;
  uploadDate: string;
  moldId: string;
  moldNo: string;
  cavityNumber: string;
  componentName: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
};

export type TrialUploadTicket = {
  uploadUrl: string;
  storagePath: string;
  moldId?: string;
  moldNo?: string;
  cavityNumber?: string;
  expiresInSeconds: number;
  method: 'PUT';
  headers?: Record<string, string>;
};

type TrialDocumentsPayload = {
  documents?: TrialDocument[];
  error?: string;
};

type TrialUploadTicketPayload = TrialUploadTicket & {
  error?: string;
};

type TrialPreviewPayload = {
  previewUrl?: string;
  expiresInSeconds?: number;
  error?: string;
};

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const error = (payload as { error?: unknown }).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

export async function fetchTrialDocuments(filters: {
  moldId?: string;
  cavityNumber?: string;
} = {}): Promise<TrialDocument[]> {
  const params = new URLSearchParams();
  if (filters.moldId?.trim()) params.set('moldId', filters.moldId.trim());
  if (filters.cavityNumber?.trim()) params.set('cavityNumber', filters.cavityNumber.trim());
  const query = params.toString();
  const response = await apiFetch(`/api/dashboard/trial-documents${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as TrialDocumentsPayload | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, '试验档账本加载失败'));
  }
  return Array.isArray(payload?.documents) ? payload.documents : [];
}

export async function createTrialUploadTicket(input: {
  fileName: string;
  fileSize: number;
  uploadDate: string;
  moldId: string;
  moldNo: string;
  cavityNumber?: string;
  componentName: string;
  contentType: string;
}): Promise<TrialUploadTicket> {
  const response = await apiFetch('/api/storage/presigned-url/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as TrialUploadTicketPayload | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'OSS 直传通行证签发失败'));
  }
  if (!payload?.uploadUrl || !payload.storagePath) {
    throw new Error('OSS 直传通行证缺少上传地址');
  }
  return {
    uploadUrl: payload.uploadUrl,
    storagePath: payload.storagePath,
    moldId: payload.moldId,
    moldNo: payload.moldNo,
    cavityNumber: payload.cavityNumber,
    expiresInSeconds: payload.expiresInSeconds,
    method: 'PUT',
    headers: payload.headers,
  };
}

export async function insertTrialDocument(input: {
  uploadDate: string;
  moldId: string;
  moldNo: string;
  cavityNumber?: string;
  componentName: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
}): Promise<TrialDocument> {
  const response = await apiFetch('/api/dashboard/trial-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as { document?: TrialDocument; error?: string } | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, '试验档记录写入失败'));
  }
  if (!payload?.document) {
    throw new Error('试验档记录写入后未返回数据');
  }
  return payload.document;
}

export async function createTrialPreviewUrl(storagePath: string): Promise<string> {
  const response = await apiFetch('/api/storage/presigned-url/preview-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  });
  const payload = (await response.json().catch(() => null)) as TrialPreviewPayload | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'PDF 在线预览地址签发失败'));
  }
  if (!payload?.previewUrl) {
    throw new Error('PDF 在线预览地址为空');
  }
  return payload.previewUrl;
}
