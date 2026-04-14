declare module 'multer' {
  import type { RequestHandler } from 'express';

  export interface MulterFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
    fieldname: string;
    encoding: string;
  }

  export interface MulterOptions {
    storage?: unknown;
    limits?: {
      fileSize?: number;
    };
  }

  export interface MulterInstance {
    single(fieldName: string): RequestHandler;
  }

  export interface MulterStatic {
    (options?: MulterOptions): MulterInstance;
    memoryStorage(): unknown;
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
