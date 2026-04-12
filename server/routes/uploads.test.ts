import { describe, expect, it, vi } from 'vitest';
import { sendUploadsRouteError } from './uploads.js';

describe('sendUploadsRouteError', () => {
  it('skips writing when the response has already started', () => {
    const res = {
      headersSent: true,
      writableEnded: false,
      destroyed: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    sendUploadsRouteError(res, 500, 'ASSET_UPLOAD_FAILED');

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('writes a structured error when the response is still writable', () => {
    const res = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    sendUploadsRouteError(res, 404, 'ASSET_NOT_FOUND');

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Asset not found',
      code: 'ASSET_NOT_FOUND',
    });
  });
});
