import path from 'path';
import OSS from 'ali-oss';

type OssClient = InstanceType<typeof OSS>;

type UploadAssetOptions = {
  fileBuffer: Buffer;
  filename: string;
  mimeType?: string;
  category?: string;
  entityId?: string;
  slot?: string;
};

type DeleteAssetResult = {
  deleted: boolean;
  skipped: boolean;
  objectKey?: string;
};

type UploadedAsset = {
  url: string;
  objectKey: string;
  mimeType: string;
  size: number;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/msword': '.doc',
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/zip': '.zip',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'text/plain': '.txt',
};

let cachedClient: OssClient | null = null;
let cachedClientSignature = '';

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function readPublicBaseUrl(): string | null {
  const region = process.env.ALIYUN_OSS_REGION?.trim();
  const bucket = process.env.ALIYUN_OSS_BUCKET?.trim();

  if (!region || !bucket) {
    return null;
  }

  return `https://${bucket}.${region}.aliyuncs.com`;
}

function getPublicBaseUrl(): string {
  const baseUrl = readPublicBaseUrl();
  if (!baseUrl) {
    throw new Error('ALIYUN_OSS_REGION and ALIYUN_OSS_BUCKET are required');
  }
  return baseUrl;
}

function getClient(): OssClient {
  const region = readRequiredEnv('ALIYUN_OSS_REGION');
  const bucket = readRequiredEnv('ALIYUN_OSS_BUCKET');
  const accessKeyId = readRequiredEnv('ALIYUN_OSS_ACCESS_KEY_ID');
  const accessKeySecret = readRequiredEnv('ALIYUN_OSS_ACCESS_KEY_SECRET');
  const signature = [region, bucket, accessKeyId].join('|');

  if (cachedClient && cachedClientSignature === signature) {
    return cachedClient;
  }

  cachedClient = new OSS({
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
  });
  cachedClientSignature = signature;

  return cachedClient;
}

function sanitizeSegment(value: string | undefined, fallback = 'misc'): string {
  if (!value) return fallback;

  const sanitized = value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 80);

  return sanitized || fallback;
}

function sanitizeFileStem(filename: string): string {
  const parsed = path.parse(filename || 'file');
  const stem = parsed.name || 'file';

  return sanitizeSegment(stem, 'file');
}

function resolveExtension(filename: string, mimeType?: string): string {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext && /^[.][a-z0-9]+$/.test(ext)) {
    return ext;
  }

  const mappedExtension = mimeType ? MIME_EXTENSION_MAP[mimeType.toLowerCase()] : '';
  return mappedExtension || '';
}

function encodeObjectKey(objectKey: string): string {
  return objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildObjectKey(options: {
  filename: string;
  mimeType?: string;
  category?: string;
  entityId?: string;
  slot?: string;
}): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const baseDir = options.mimeType?.startsWith('image/') ? 'images' : 'files';
  const fileStem = sanitizeFileStem(options.filename);
  const extension = resolveExtension(options.filename, options.mimeType);
  const uniqueName = `${crypto.randomUUID()}-${fileStem}${extension}`;

  return [
    baseDir,
    year,
    month,
    sanitizeSegment(options.category, 'asset'),
    sanitizeSegment(options.entityId, 'shared'),
    sanitizeSegment(options.slot, 'default'),
    uniqueName,
  ].join('/');
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const record = error as { code?: string; status?: number; statusCode?: number; name?: string };
  return (
    record.code === 'NoSuchKey' ||
    record.name === 'NoSuchKeyError' ||
    record.status === 404 ||
    record.statusCode === 404
  );
}

export async function uploadAssetToOss(options: UploadAssetOptions): Promise<UploadedAsset> {
  const mimeType = options.mimeType?.trim() || 'application/octet-stream';
  const objectKey = buildObjectKey({
    filename: options.filename,
    mimeType,
    category: options.category,
    entityId: options.entityId,
    slot: options.slot,
  });

  const client = getClient();

  await client.put(objectKey, options.fileBuffer, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': mimeType,
    },
  });

  return {
    url: `${getPublicBaseUrl()}/${encodeObjectKey(objectKey)}`,
    objectKey,
    mimeType,
    size: options.fileBuffer.byteLength,
  };
}

export function parseOssObjectKeyFromUrl(assetUrl: string | null | undefined): string | null {
  if (!assetUrl) return null;

  const publicBaseUrl = readPublicBaseUrl();
  if (!publicBaseUrl) {
    return null;
  }

  try {
    const asset = new URL(assetUrl);
    const base = new URL(publicBaseUrl);

    if (asset.protocol !== 'http:' && asset.protocol !== 'https:') {
      return null;
    }

    if (asset.hostname !== base.hostname) {
      return null;
    }

    const objectKey = decodeURIComponent(asset.pathname.replace(/^\/+/, ''));
    return objectKey || null;
  } catch {
    return null;
  }
}

export async function deleteAssetFromOssUrl(assetUrl: string | null | undefined): Promise<DeleteAssetResult> {
  const objectKey = parseOssObjectKeyFromUrl(assetUrl);
  if (!objectKey) {
    return { deleted: false, skipped: true };
  }

  try {
    const client = getClient();
    await client.delete(objectKey);
    return { deleted: true, skipped: false, objectKey };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { deleted: false, skipped: true, objectKey };
    }
    throw error;
  }
}

export async function deleteAssetsFromOssUrls(urls: Array<string | null | undefined>): Promise<void> {
  const objectKeys = [...new Set(urls.map((url) => parseOssObjectKeyFromUrl(url)).filter(Boolean))] as string[];
  if (objectKeys.length === 0) {
    return;
  }

  const client = getClient();
  const results = await Promise.allSettled(
    objectKeys.map(async (objectKey) => {
      try {
        await client.delete(objectKey);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }
    }),
  );

  const rejection = results.find((result) => result.status === 'rejected');
  if (rejection && rejection.status === 'rejected') {
    throw rejection.reason;
  }
}
