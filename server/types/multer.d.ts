declare module 'multer' {
  import type { Request, RequestHandler } from 'express';

  export interface MulterFile {
    buffer?: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
    fieldname: string;
    encoding: string;
    destination?: string;
    filename?: string;
    path?: string;
  }

  export type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;

  export type DiskStorageFilenameCallback = (error: Error | null, filename: string) => void;
  export type DiskStorageDestinationCallback = (error: Error | null, destination: string) => void;

  export interface DiskStorageOptions {
    destination?:
      | string
      | ((req: Request, file: MulterFile, callback: DiskStorageDestinationCallback) => void);
    filename?: (req: Request, file: MulterFile, callback: DiskStorageFilenameCallback) => void;
  }

  export interface MulterOptions {
    storage?: unknown;
    limits?: {
      fileSize?: number;
    };
    fileFilter?: (req: Request, file: MulterFile, callback: FileFilterCallback) => void;
  }

  export interface MulterInstance {
    single(fieldName: string): RequestHandler;
  }

  export interface MulterStatic {
    (options?: MulterOptions): MulterInstance;
    memoryStorage(): unknown;
    diskStorage(options: DiskStorageOptions): unknown;
  }

  const multer: MulterStatic;
  export default multer;
}

declare global {
  namespace Express {
    interface Request {
      file?: import('multer').MulterFile;
    }
  }
}

export {};
