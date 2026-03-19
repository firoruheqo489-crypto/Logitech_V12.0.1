import { apiFetch } from './api';

type UploadAssetParams = {
  file: File;
  category: string;
  entityId?: string;
  slot?: string;
};

type UploadAssetResult = {
  url: string;
};

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function uploadAssetViaServer({
  file,
  category,
  entityId,
  slot,
}: UploadAssetParams): Promise<UploadAssetResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  if (entityId) {
    formData.append('entityId', entityId);
  }

  if (slot) {
    formData.append('slot', slot);
  }

  const response = await apiFetch('/api/uploads/assets', {
    method: 'POST',
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Asset upload failed'));
  }

  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    throw new Error('Asset upload did not return a URL');
  }

  return { url: payload.url.trim() };
}

export async function deleteAssetViaServer(assetUrl: string | null | undefined): Promise<void> {
  if (!assetUrl || assetUrl.startsWith('blob:')) {
    return;
  }

  const response = await apiFetch('/api/uploads/assets', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: assetUrl }),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Asset deletion failed'));
  }
}
