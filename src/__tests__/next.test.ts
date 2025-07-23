import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateMetadataClient } from "../next";
import type { MetadataApiResponse } from "../index";
import { revalidatePath } from "next/cache";

import { api } from "../utils/api";

// Mock the API module
vi.mock("../utils/api", () => ({
  api: {
    GET: vi.fn(),
  },
}));

// Mock Next.js cache module
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock hono/vercel
vi.mock("hono/vercel", () => ({
  handle: vi.fn((app) => {
    // Return a mock handler that simulates the Hono app behavior
    return async (req: any) => {
      // Simulate calling the Hono app
      return app.fetch(req);
    };
  }),
}));

const mockApiResponse: MetadataApiResponse = {
  metadata: {
    title: "Test Page Title",
    description: "Test page description",
    icon: [
      {
        url: "https://example.com/icon.png",
        mimeType: "image/png",
        width: 32,
        height: 32,
      },
    ],
    appleTouchIcon: [
      {
        url: "https://example.com/apple-touch-icon.png",
        mimeType: "image/png",
        width: 180,
        height: 180,
      },
    ],
    openGraph: {
      title: "OG Test Title",
      description: "OG Test Description",
      locale: "en_US",
      siteName: "Test Site",
      type: "website",
      image: {
        url: "https://example.com/og-image.jpg",
        alt: "OG Image Alt Text",
        width: 1200,
        height: 630,
        mimeType: "image/jpeg",
      },
      images: [
        {
          url: "https://example.com/og-image-1.jpg",
          alt: "OG Image 1 Alt",
          width: 800,
          height: 600,
          mimeType: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Twitter Test Title",
      description: "Twitter Test Description",
      image: {
        url: "https://example.com/twitter-image.jpg",
        alt: "Twitter Image Alt",
        width: 1200,
        height: 630,
        mimeType: "image/jpeg",
      },
    },
  },
};

describe("GenerateMetadataClient (Next.js)", () => {
  let client: GenerateMetadataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GenerateMetadataClient({
      dsn: "test-dsn",
      apiKey: "test-api-key",
    });
  });

  describe("getMetadata", () => {
    it("should return Next.js metadata when API call succeeds", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        title: "Test Page Title",
        description: "Test page description",
        icons: [
          {
            rel: "icon",
            url: "https://example.com/icon.png",
            type: "image/png",
            sizes: "32x32",
          },
          {
            rel: "apple-touch-icon",
            url: "https://example.com/apple-touch-icon.png",
            type: "image/png",
            sizes: "180x180",
          },
        ],
        openGraph: {
          title: "OG Test Title",
          description: "OG Test Description",
          locale: "en_US",
          siteName: "Test Site",
          type: "website",
          images: [
            {
              url: "https://example.com/og-image-1.jpg",
              alt: "OG Image 1 Alt",
              width: 800,
              height: 600,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: "Twitter Test Title",
          description: "Twitter Test Description",
          images: [
            {
              url: "https://example.com/twitter-image.jpg",
              alt: "Twitter Image Alt",
              width: 1200,
              height: 630,
            },
          ],
        },
      });
    });

    it("should handle function-based options", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const optsFn = vi.fn().mockResolvedValue({ path: "/dynamic-test" });
      const metadataFn = client.getMetadata(optsFn);

      await metadataFn({}, {} as any);

      expect(optsFn).toHaveBeenCalled();
      expect(api.GET).toHaveBeenCalledWith("/v1/{dsn}/metadata/get-latest", {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/dynamic-test" },
        },
        headers: {
          Authorization: "Bearer test-api-key",
        },
      });
    });

    it("should return empty object when API call fails", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should return empty object when API returns null data", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should return empty object when metadata is null", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should handle partial metadata gracefully", async () => {
      const partialApiResponse: MetadataApiResponse = {
        metadata: {
          title: "Only Title",
          description: undefined,
          openGraph: {
            title: "OG Title Only",
            description: undefined,
            image: undefined,
            images: [],
          },
          twitter: {
            card: undefined,
            title: undefined,
            description: undefined,
            image: undefined,
          },
        },
      };

      vi.mocked(api.GET).mockResolvedValue({
        data: partialApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        title: "Only Title",
        description: undefined,
        openGraph: {
          title: "OG Title Only",
          description: undefined,
          images: [],
        },
        twitter: {
          title: undefined,
          description: undefined,
        },
      });
    });

    it("should cache API responses", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));

      // First call
      await metadataFn({}, {} as any);
      // Second call
      await metadataFn({}, {} as any);

      // API should only be called once due to caching
      expect(api.GET).toHaveBeenCalledTimes(1);
    });

    it("should handle different paths separately in cache", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn1 = client.getMetadata(() => ({ path: "/test1" }));
      const metadataFn2 = client.getMetadata(() => ({ path: "/test2" }));

      await metadataFn1({}, {} as any);
      await metadataFn2({}, {} as any);

      // API should be called twice for different paths
      expect(api.GET).toHaveBeenCalledTimes(2);
    });

    it("should handle async function-based options", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const asyncOptsFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { path: "/async-test" };
      };

      const metadataFn = client.getMetadata(asyncOptsFn);
      const result = await metadataFn({}, {} as any);

      expect(result.title).toBe("Test Page Title");
      expect(api.GET).toHaveBeenCalledWith("/v1/{dsn}/metadata/get-latest", {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/async-test" },
        },
        headers: {
          Authorization: "Bearer test-api-key",
        },
      });
    });

    it("should use fallback metadata when API call fails", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const fallbackMetadata = {
        title: "Fallback Title",
        description: "Fallback Description",
      };

      const metadataFn = client.getMetadata(() => ({
        path: "/test",
        fallback: fallbackMetadata,
      }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual(fallbackMetadata);
    });

    it("should merge override metadata with generated metadata", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const overrideMetadata = {
        title: "Override Title",
        keywords: ["override", "test"],
      };

      const metadataFn = client.getMetadata(() => ({
        path: "/test",
        override: overrideMetadata,
      }));
      const result = await metadataFn({}, {} as any);

      expect(result.title).toBe("Override Title");
      expect(result.keywords).toEqual(["override", "test"]);
      expect(result.description).toBe("Test page description");
    });

    it("should use fallback, generated, and override in correct priority order", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const fallbackMetadata = {
        title: "Fallback Title",
        description: "Fallback Description",
        keywords: ["fallback"],
      };

      const overrideMetadata = {
        title: "Override Title",
        robots: "noindex",
      };

      const metadataFn = client.getMetadata(() => ({
        path: "/test",
        fallback: fallbackMetadata,
        override: overrideMetadata,
      }));
      const result = await metadataFn({}, {} as any);

      expect(result.title).toBe("Override Title");
      expect(result.description).toBe("Test page description");
      expect(result.keywords).toEqual(["fallback"]);
      expect(result.robots).toBe("noindex");
    });

    it("should return empty metadata when DSN is undefined (development mode)", async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
        apiKey: "test-api-key",
      });

      const metadataFn = devClient.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
      expect(api.GET).not.toHaveBeenCalled();
    });

    it("should use fallback metadata when DSN is undefined", async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
        apiKey: "test-api-key",
      });

      const fallbackMetadata = {
        title: "Development Title",
        description: "Development Description",
      };

      const metadataFn = devClient.getMetadata(() => ({
        path: "/test",
        fallback: fallbackMetadata,
      }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual(fallbackMetadata);
      expect(api.GET).not.toHaveBeenCalled();
    });

    it("should handle icons that are not arrays", async () => {
      const responseWithBadIcons: MetadataApiResponse = {
        metadata: {
          title: "Test Title",
          description: undefined,
          icon: undefined,
          appleTouchIcon: undefined,
          openGraph: {
            title: undefined,
            description: undefined,
            image: undefined,
            images: [],
          },
          twitter: {
            title: undefined,
            description: undefined,
            card: undefined,
            image: undefined,
          },
        },
      };

      vi.mocked(api.GET).mockResolvedValue({
        data: responseWithBadIcons,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        title: "Test Title",
        description: undefined,
        icons: [],
        openGraph: {
          title: undefined,
          description: undefined,
          images: [],
        },
        twitter: {
          title: undefined,
          description: undefined,
        },
      });
    });

    it("should handle twitter card without value", async () => {
      const responseWithoutCard: MetadataApiResponse = {
        metadata: {
          title: "Test Title",
          description: undefined,
          openGraph: {
            title: undefined,
            description: undefined,
            image: undefined,
            images: [],
          },
          twitter: {
            title: "Twitter Title",
            description: "Twitter Description",
            card: undefined,
            image: undefined,
          },
        },
      };

      vi.mocked(api.GET).mockResolvedValue({
        data: responseWithoutCard,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result.twitter).toEqual({
        title: "Twitter Title",
        description: "Twitter Description",
      });
    });

    it("should handle openGraph images without alt text", async () => {
      const responseWithoutAlt: MetadataApiResponse = {
        metadata: {
          title: "Test Title",
          description: undefined,
          openGraph: {
            title: undefined,
            description: undefined,
            image: {
              url: "https://example.com/og-image.jpg",
              alt: undefined,
              width: 1200,
              height: 630,
              mimeType: "image/jpeg",
            },
            images: [
              {
                url: "https://example.com/og-image-1.jpg",
                alt: undefined,
                width: 800,
                height: 600,
                mimeType: "image/jpeg",
              },
            ],
          },
          twitter: {
            title: undefined,
            description: undefined,
            card: undefined,
            image: {
              url: "https://example.com/twitter-image.jpg",
              alt: undefined,
              width: 1200,
              height: 630,
              mimeType: "image/jpeg",
            },
          },
        },
      };

      vi.mocked(api.GET).mockResolvedValue({
        data: responseWithoutAlt,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result.openGraph?.images).toEqual([
        {
          url: "https://example.com/og-image-1.jpg",
          alt: undefined,
          width: 800,
          height: 600,
        },
      ]);

      expect(result.twitter?.images).toEqual([
        {
          url: "https://example.com/twitter-image.jpg",
          alt: undefined,
          width: 1200,
          height: 630,
        },
      ]);
    });

    it("should include apiKey as bearer token when provided", async () => {
      const client = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: "test-api-key",
      });

      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      await metadataFn({}, {} as any);

      expect(api.GET).toHaveBeenCalledWith("/v1/{dsn}/metadata/get-latest", {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test" },
        },
        headers: {
          Authorization: "Bearer test-api-key",
        },
      });
    });
  });

  describe("getRootMetadata", () => {
    it("should return empty metadata when no factory provided", async () => {
      const rootMetadataFn = client.getRootMetadata();
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should return empty metadata when factory returns empty object", async () => {
      const rootMetadataFn = client.getRootMetadata(() => ({}));
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should return fallback metadata when provided", async () => {
      const fallbackMetadata = {
        title: "Root Fallback Title",
        description: "Root Fallback Description",
      };

      const rootMetadataFn = client.getRootMetadata(() => ({
        fallback: fallbackMetadata,
      }));
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual(fallbackMetadata);
    });

    it("should merge override metadata properly", async () => {
      const fallbackMetadata = {
        title: "Root Fallback Title",
        description: "Root Fallback Description",
      };

      const overrideMetadata = {
        title: "Root Override Title",
        keywords: ["root", "override"],
      };

      const rootMetadataFn = client.getRootMetadata(() => ({
        fallback: fallbackMetadata,
        override: overrideMetadata,
      }));
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({
        title: "Root Override Title", // Override wins
        description: "Root Fallback Description", // Fallback preserved
        keywords: ["root", "override"], // Override added
      });
    });

    it("should handle async factory functions", async () => {
      const asyncFactory = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          fallback: {
            title: "Async Root Title",
            description: "Async Root Description",
          },
        };
      };

      const rootMetadataFn = client.getRootMetadata(asyncFactory);
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({
        title: "Async Root Title",
        description: "Async Root Description",
      });
    });

    it("should pass props and parent to factory function", async () => {
      const mockFactory = vi.fn().mockReturnValue({
        fallback: { title: "Test Title" },
      });
      const mockProps = { test: "prop" };
      const mockParent = { test: "parent" } as any;

      const rootMetadataFn = client.getRootMetadata(mockFactory);
      await rootMetadataFn(mockProps, mockParent);

      expect(mockFactory).toHaveBeenCalledWith(mockProps, mockParent);
    });
  });

  describe("revalidate", () => {
    it("should clear cache and call revalidatePath for specific path", async () => {
      // First, populate the cache
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: "/test" }));
      await metadataFn({}, {} as any);

      // Clear mocks to verify cache behavior
      vi.clearAllMocks();

      // Call revalidate
      (client as any).revalidate("/test");

      // Verify revalidatePath was called
      expect(revalidatePath).toHaveBeenCalledWith("/test");

      // Verify cache was cleared by fetching again
      await metadataFn({}, {} as any);
      expect(api.GET).toHaveBeenCalledTimes(1); // Should fetch again since cache was cleared
    });

    it("should clear entire cache and revalidate all paths when path is null", () => {
      // Call revalidate with null
      (client as any).revalidate(null);

      // Verify revalidatePath was called with layout revalidation
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });
  });

  describe("revalidateHandler", () => {
    it("should return route handlers for all HTTP methods", () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: "test-secret",
      });

      expect(handlers).toHaveProperty("GET");
      expect(handlers).toHaveProperty("POST");
      expect(handlers).toHaveProperty("PUT");
      expect(handlers).toHaveProperty("PATCH");
      expect(handlers).toHaveProperty("DELETE");
      expect(handlers).toHaveProperty("OPTIONS");
      expect(handlers).toHaveProperty("HEAD");

      // All handlers should be the same function
      expect(handlers.GET).toBe(handlers.POST);
      expect(handlers.POST).toBe(handlers.PUT);
    });

    it("should create handler with custom basePath", () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: "test-secret",
        basePath: "/custom/api/path",
      });

      expect(handlers).toHaveProperty("POST");
    });

    it("should have handlers that are functions", async () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: "test-secret",
      });

      // Verify all handlers are functions
      expect(typeof handlers.POST).toBe("function");
      expect(typeof handlers.GET).toBe("function");
    });

    it("should return error handlers when revalidateSecret is undefined", async () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: undefined,
      });

      // Verify all handlers are functions
      expect(typeof handlers.POST).toBe("function");
      expect(typeof handlers.GET).toBe("function");

      // Create a mock request
      const mockRequest = new Request(
        "http://localhost/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: "/test" }),
        },
      );

      // Call the handler
      const response = await handlers.POST(mockRequest);

      // Verify the response
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Revalidate secret is not configured" });
    });

    it("should return the same error handler for all HTTP methods when revalidateSecret is undefined", async () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: undefined,
      });

      // Create a mock request
      const mockRequest = new Request(
        "http://localhost/api/generate-metadata/revalidate",
        {
          method: "GET",
        },
      );

      // Test all handlers return the same error
      const getResponse = await handlers.GET(mockRequest);
      const postResponse = await handlers.POST(mockRequest);
      const putResponse = await handlers.PUT(mockRequest);

      expect(getResponse.status).toBe(500);
      expect(postResponse.status).toBe(500);
      expect(putResponse.status).toBe(500);

      const getBody = await getResponse.json();
      const postBody = await postResponse.json();
      const putBody = await putResponse.json();

      expect(getBody).toEqual({ error: "Revalidate secret is not configured" });
      expect(postBody).toEqual({
        error: "Revalidate secret is not configured",
      });
      expect(putBody).toEqual({ error: "Revalidate secret is not configured" });
    });

    it("should use custom revalidatePath function when provided", async () => {
      const customRevalidatePath = vi.fn();

      const handlers = client.revalidateHandler({
        revalidateSecret: "test-secret",
        revalidatePath: customRevalidatePath,
      });

      // Create a mock request
      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer test-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({ path: "/test-path" }),
        },
      );

      const response = await handlers.POST(mockRequest);

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith("/test-path");
    });

    it("should use custom revalidatePath function with null path", async () => {
      const customRevalidatePath = vi.fn();

      const handlers = client.revalidateHandler({
        revalidateSecret: "test-secret",
        revalidatePath: customRevalidatePath,
      });

      // Create a mock request
      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer test-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({ path: null }),
        },
      );

      const response = await handlers.POST(mockRequest);

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith(null);
    });
  });
});
