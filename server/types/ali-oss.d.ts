declare module 'ali-oss' {
  export interface OssClientOptions {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
  }

  export interface PutOptions {
    headers?: Record<string, string>;
  }

  export interface PutResult {
    name?: string;
    url?: string;
  }

  export default class OSS {
    constructor(options: OssClientOptions);
    put(name: string, file: Buffer, options?: PutOptions): Promise<PutResult>;
    delete(name: string): Promise<unknown>;
  }
}
