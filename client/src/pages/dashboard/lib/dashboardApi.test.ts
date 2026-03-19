import { describe, expect, it } from 'vitest';
import {
  DashboardApiError,
  getDashboardApiErrorDisplayMessage,
  normalizeDashboardApiError,
} from './dashboardApi';

describe('dashboard asset api errors', () => {
  it('normalizes project asset save failures into typed dashboard api errors', () => {
    const error = normalizeDashboardApiError(
      { error: 'raw backend detail', code: 'PROJECT_ASSET_SAVE_FAILED' },
      500,
      'UNKNOWN_ERROR',
    );

    expect(error).toBeInstanceOf(DashboardApiError);
    expect(error.code).toBe('PROJECT_ASSET_SAVE_FAILED');
    expect(error.status).toBe(500);
  });

  it('maps project asset save failures to a safe display message', () => {
    const error = new DashboardApiError('raw backend detail', 'PROJECT_ASSET_SAVE_FAILED', 500);

    expect(getDashboardApiErrorDisplayMessage(error, 'fallback')).toBe('Image save failed, please retry');
  });

  it('maps invalid project asset delete requests to a safe display message', () => {
    const error = new DashboardApiError('raw backend detail', 'INVALID_ASSET_DELETE_REQUEST', 400);

    expect(getDashboardApiErrorDisplayMessage(error, 'fallback')).toBe('Missing mold number or slot type for delete');
  });
});
