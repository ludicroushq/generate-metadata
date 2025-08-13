import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextApiClient } from "../utils/api/next";
import createClient from "openapi-fetch";

// Mock openapi-fetch
vi.mock("openapi-fetch", () => ({
  default: vi.fn(),
}));

describe("NextApiClient", () => {
  let mockClient: any;
  let nextApiClient: NextApiClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      GET: vi.fn(),
      POST: vi.fn(),
      PUT: vi.fn(),
      DELETE: vi.fn(),
    };

    vi.mocked(createClient).mockReturnValue(mockClient);
    nextApiClient = new NextApiClient();
  });

  describe("constructor", () => {
    it("should create client with Next.js specific configuration", () => {
      expect(createClient).toHaveBeenCalledWith({
        baseUrl: "https://www.generate-metadata.com/api/openapi",
        cache: "no-cache",
        next: { revalidate: 0 },
      });
    });

    it("should extend FetchApiClient", () => {
      // NextApiClient extends FetchApiClient
      expect(nextApiClient).toHaveProperty("client");
      expect(nextApiClient).toHaveProperty("metadataGetLatest");
    });

    it("should override the client with Next.js config", () => {
      expect(nextApiClient.client).toBe(mockClient);
    });
  });

  describe("metadataGetLatest", () => {
    it("should use inherited metadataGetLatest method", async () => {
      const mockResponse = {
        data: {
          metadata: {
            title: "Next.js Title",
            description: "Next.js Description",
          },
        },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: "next-dsn" },
          query: { path: "/next-path" },
        },
        headers: {
          Authorization: "Bearer next-api-key",
        },
      };

      const result = await nextApiClient.metadataGetLatest(args);

      expect(mockClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        args,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle Next.js specific cache options", async () => {
      const mockResponse = {
        data: { metadata: {} },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test-path" },
        },
        next: {
          revalidate: 60,
          tags: ["metadata"],
        },
      };

      await nextApiClient.metadataGetLatest(args);

      expect(mockClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        args,
      );
    });

    it("should handle ISR with Next.js revalidate", async () => {
      const mockResponse = {
        data: {
          metadata: {
            title: "ISR Title",
          },
        },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/isr-path" },
        },
        next: {
          revalidate: 3600, // 1 hour ISR
        },
      };

      const result = await nextApiClient.metadataGetLatest(args);

      expect(mockClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        args,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle Next.js cache tags", async () => {
      const mockResponse = {
        data: { metadata: {} },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/tagged-path" },
        },
        next: {
          tags: ["metadata", "page-specific", "test"],
        },
      };

      await nextApiClient.metadataGetLatest(args);

      expect(mockClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        args,
      );
    });

    it("should handle errors the same as FetchApiClient", async () => {
      const mockError = {
        data: undefined,
        error: {
          message: "Not found in Next.js",
          code: "NOT_FOUND",
          status: 404,
        },
      };

      mockClient.GET.mockResolvedValue(mockError);

      const args = {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/error-path" },
        },
      };

      const result = await nextApiClient.metadataGetLatest(args);

      expect(result).toEqual(mockError);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Next.js network error");
      mockClient.GET.mockRejectedValue(networkError);

      const args = {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test-path" },
        },
      };

      await expect(nextApiClient.metadataGetLatest(args)).rejects.toThrow(
        "Next.js network error",
      );
    });

    it("should work with App Router metadata", async () => {
      const mockResponse = {
        data: {
          metadata: {
            title: "App Router Page",
            description: "Next.js 13+ App Router",
            openGraph: {
              title: "OG Title",
              description: "OG Description",
              images: [
                {
                  url: "https://example.com/og.jpg",
                  width: 1200,
                  height: 630,
                },
              ],
            },
          },
        },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: "app-router-dsn" },
          query: { path: "/app-route" },
        },
        headers: {
          Authorization: "Bearer app-router-key",
        },
      };

      const result = await nextApiClient.metadataGetLatest(args);

      expect(result).toEqual(mockResponse);
    });

    it("should support dynamic segments", async () => {
      const mockResponse = {
        data: {
          metadata: {
            title: "Dynamic Route",
          },
        },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      const args = {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/products/123" },
        },
      };

      const result = await nextApiClient.metadataGetLatest(args);

      expect(result).toEqual(mockResponse);
    });
  });

  describe("inheritance from FetchApiClient", () => {
    it("should inherit all BaseApiClient methods", () => {
      expect(typeof nextApiClient.metadataGetLatest).toBe("function");
    });

    it("should maintain the same method signature", async () => {
      const mockResponse = {
        data: { metadata: {} },
        error: undefined,
      };

      mockClient.GET.mockResolvedValue(mockResponse);

      // Test that the method signature matches FetchApiClient
      const args = {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test" },
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: undefined,
        baseUrl: "https://custom.url",
      };

      const result = await nextApiClient.metadataGetLatest(args);

      expect(mockClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        args,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("environment variable support", () => {
    it("should use production URL by default", () => {
      // The mock already uses the production URL
      const client = new NextApiClient();

      expect(createClient).toHaveBeenCalledWith({
        baseUrl: "https://www.generate-metadata.com/api/openapi",
        cache: "no-cache",
        next: { revalidate: 0 },
      });
      expect(client.client).toBeDefined();
    });

    it("should handle Next.js specific configuration", () => {
      const client = new NextApiClient();

      // Verify Next.js specific config is passed
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          cache: "no-cache",
          next: { revalidate: 0 },
        }),
      );
      expect(client.client).toBe(mockClient);
    });
  });
});
