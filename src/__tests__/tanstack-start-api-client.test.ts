import { describe, expect, it, vi } from 'vitest';
import { TanstackStartApiClient } from '../utils/api/tanstack-start';

describe('TanstackStartApiClient', () => {
  it('should call serverFn with correct data structure for metadataGetLatest', async () => {
    const mockServerFn = vi.fn().mockResolvedValue({
      data: {
        metadata: {
          description: 'Test Description',
          title: 'Test Title',
        },
      },
      error: undefined,
    }) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      headers: {
        Authorization: 'Bearer test-api-key',
      },
      params: {
        path: { dsn: 'test-dsn' },
        query: { path: '/test' },
      },
    };

    const result = await apiClient.metadataGetLatest(args);

    expect(mockServerFn).toHaveBeenCalledWith({
      data: {
        args,
        type: 'metadataGetLatest',
      },
    });

    expect(result).toEqual({
      data: {
        metadata: {
          description: 'Test Description',
          title: 'Test Title',
        },
      },
      error: undefined,
    });
  });

  it('should handle serverFn errors', async () => {
    const mockError = new Error('ServerFn failed');
    const mockServerFn = vi.fn().mockRejectedValue(mockError) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: 'test-dsn' },
        query: { path: '/test' },
      },
    };

    await expect(apiClient.metadataGetLatest(args)).rejects.toThrow(
      'ServerFn failed'
    );
    expect(mockServerFn).toHaveBeenCalled();
  });

  it('should pass through all arguments correctly', async () => {
    const mockServerFn = vi.fn().mockResolvedValue({
      data: {},
      error: undefined,
    }) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      baseUrl: 'https://custom.api.com',
      body: undefined,
      headers: {
        Authorization: 'Bearer custom-key',
        'X-Custom-Header': 'custom-value',
      },
      params: {
        path: { dsn: 'custom-dsn' },
        query: { path: '/custom/path' },
      },
    };

    await apiClient.metadataGetLatest(args);

    expect(mockServerFn).toHaveBeenCalledWith({
      data: {
        args,
        type: 'metadataGetLatest',
      },
    });
  });

  it('should handle response with error', async () => {
    const mockServerFn = vi.fn().mockResolvedValue({
      data: undefined,
      error: {
        code: 404,
        message: 'Not found',
      },
    }) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: 'test-dsn' },
        query: { path: '/test' },
      },
    };

    const result = await apiClient.metadataGetLatest(args);

    expect(result).toEqual({
      data: undefined,
      error: {
        code: 404,
        message: 'Not found',
      },
    });
  });

  it('should handle empty response', async () => {
    const mockServerFn = vi.fn().mockResolvedValue({}) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: 'test-dsn' },
        query: { path: '/test' },
      },
    };

    const result = await apiClient.metadataGetLatest(args);

    expect(result).toEqual({});
  });
});
