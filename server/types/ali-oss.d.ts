declare module 'ali-oss' {
  type OssPutInput = Buffer | NodeJS.ReadableStream | string;

  export interface OssClientOptions {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
  }

  export interface PutOptions {
    headers?: Record<string, string>;
  }

  export interface SignatureUrlOptions {
    expires?: number;
    method?: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD';
    'Content-Type'?: string;
    'Content-MD5'?: string;
    headers?: Record<string, string>;
    response?: Record<string, string>;
  }

  export interface PutResult {
    name?: string;
    url?: string;
  }

  export default class OSS {
    constructor(options: OssClientOptions);
    put(name: string, file: OssPutInput, options?: PutOptions): Promise<PutResult>;
    delete(name: string): Promise<unknown>;
    signatureUrl(name: string, options?: SignatureUrlOptions): string;
  }
}
