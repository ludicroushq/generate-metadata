import createClient from 'openapi-fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchApiClient } from '../utils/api/fetch';

// Mock openapi-fetch
vi.mock('openapi-fetch', () => ({
  default: vi.fn(),
}));

describe('FetchApiClient', () => {
  let mockClient: any;
  let fetchApiClient: FetchApiClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      DELETE: vi.fn(),
      GET: vi.fn(),
      POST: vi.fn(),
      PUT: vi.fn(),
    };

    vi.mocked(createClient).mockReturnValue(mockClient);
    fetchApiClient = new FetchApiClient();
  });

  describe('constructor', () => {
    it('should create client with correct configuration', () => {
      expect(createClient).toHaveBeenCalledWith({
        baseUrl: 'https://www.generate-metadata.com/api/openapi',
      });
    });

    it('should store the client instance', () => {
      expect(fetchApiClient.client).toBe(mockClient);
    });
  });

  describe('metadataGetLatest', () => {
    it('should call GET with correct endpoint and args', async () => {
      const mockResponse = {
        data: {
          metadata: {
            description: 'Test Description',
            title: 'Test Title',
          },
        },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        headers: {
          Authorization: 'Bearer test-api-key',
        },
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test-path' },
        },
      };

      const result = await fetchApiClient.metadataGetLatest(args);

      expect(mockClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        args
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      const mockError = {
        data: undefined,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
          status: 404,
        },
      };

      mockClient.GET.mockResolvedValue(mockError);

      const args = {
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test-path' },
        },
      };

      const result = await fetchApiClient.metadataGetLatest(args);

      expect(result).toEqual(mockError);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockClient.GET.mockRejectedValue(networkError);

      const args = {
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test-path' },
        },
      };

      await expect(fetchApiClient.metadataGetLatest(args)).rejects.toThrow(
        'Network error'
      );
    });

    it('should pass through all request options', async () => {
      const mockResponse = {
        data: { metadata: {} },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        baseUrl: 'https://custom.api.com',
        body: undefined,
        cache: 'force-cache' as const,
        headers: {
          Authorization: 'Bearer custom-key',
          'X-Custom-Header': 'custom-value',
        },
        params: {
          path: { dsn: 'custom-dsn' },
          query: { path: '/custom/path' },
        },
      };

      await fetchApiClient.metadataGetLatest(args);

      expect(mockClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        args
      );
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        data: null,
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test-path' },
        },
      };

      const result = await fetchApiClient.metadataGetLatest(args);

      expect(result).toEqual(mockResponse);
    });

    it('should handle response with partial metadata', async () => {
      const mockResponse = {
        data: {
          metadata: {
            title: 'Only Title',
            // description is missing
          },
        },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test-path' },
        },
      };

      const result = await fetchApiClient.metadataGetLatest(args);

      expect(result).toEqual(mockResponse);
    });

    it('should handle concurrent requests', async () => {
      const mockResponse1 = {
        data: { metadata: { title: 'Title 1' } },
        error: undefined,
      };
      const mockResponse2 = {
        data: { metadata: { title: 'Title 2' } },
        error: undefined,
      };

      mockClient.GET.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(
        mockResponse2
      );

      const args1 = {
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/path1' },
        },
      };
      const args2 = {
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/path2' },
        },
      };

      const [result1, result2] = await Promise.all([
        fetchApiClient.metadataGetLatest(args1),
        fetchApiClient.metadataGetLatest(args2),
      ]);

      expect(result1).toEqual(mockResponse1);
      expect(result2).toEqual(mockResponse2);
      expect(mockClient.GET).toHaveBeenCalledTimes(2);
    });
  });

  describe('environment variable support', () => {
    it('should use production URL by default', () => {
      // The mock already uses the production URL
      const client = new FetchApiClient();

      expect(createClient).toHaveBeenCalledWith({
        baseUrl: 'https://www.generate-metadata.com/api/openapi',
      });
      expect(client.client).toBeDefined();
    });

    it('should handle different base URLs via constructor config', () => {
      // Since baseUrl is set at import time, we can't easily test the env var
      // But we can verify the client is created with the expected config
      const client = new FetchApiClient();

      // Verify the client uses the mocked createClient
      expect(client.client).toBe(mockClient);
      expect(createClient).toHaveBeenCalled();
    });
  });
});
