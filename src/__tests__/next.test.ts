import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateMetadataClient } from "../next";
import type { MetadataApiResponse } from "../index";

import { api } from "../utils/api";

// Mock the API module
vi.mock("../utils/api", () => ({
  api: {
    GET: vi.fn(),
  },
}));

const mockApiResponse: MetadataApiResponse = {
  metadata: {
    title: "Test Page Title",
    description: "Test page description",
    openGraph: {
      title: "OG Test Title",
      description: "OG Test Description",
      image: {
        url: "https://example.com/og-image.jpg",
        alt: "OG Image Alt Text",
        width: 1200,
        height: 630,
      },
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
      image: {
        url: "https://example.com/twitter-image.jpg",
        alt: "Twitter Image Alt",
        width: 1200,
        height: 630,
      },
      images: [
        {
          url: "https://example.com/twitter-image-1.jpg",
          alt: "Twitter Image 1 Alt",
          width: 800,
          height: 600,
        },
      ],
    },
  },
};

describe("GenerateMetadataClient (Next.js)", () => {
  let client: GenerateMetadataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GenerateMetadataClient({
      dsn: "test-dsn",
    });
  });

  describe("generateMetadata", () => {
    it("should return Next.js metadata when API call succeeds", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.generateMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        title: "Test Page Title",
        description: "Test page description",
        openGraph: {
          title: "OG Test Title",
          description: "OG Test Description",
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
              url: "https://example.com/twitter-image-1.jpg",
              alt: "Twitter Image 1 Alt",
              width: 800,
              height: 600,
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
      const metadataFn = client.generateMetadata(optsFn);

      await metadataFn({}, {} as any);

      expect(optsFn).toHaveBeenCalled();
      expect(api.GET).toHaveBeenCalledWith("/v1/{dsn}/metadata/get-latest", {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/dynamic-test" },
        },
      });
    });

    it("should return empty object when API call fails", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const metadataFn = client.generateMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should return empty object when API returns null data", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });

      const metadataFn = client.generateMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should return empty object when metadata is null", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const metadataFn = client.generateMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it("should handle partial metadata gracefully", async () => {
      const partialApiResponse: MetadataApiResponse = {
        metadata: {
          title: "Only Title",
          description: null,
          openGraph: {
            title: "OG Title Only",
            description: null,
            image: null,
            images: [],
          },
          twitter: {
            card: null,
            title: null,
            description: null,
            image: null,
            images: [],
          },
        },
      };

      vi.mocked(api.GET).mockResolvedValue({
        data: partialApiResponse,
        error: undefined,
      });

      const metadataFn = client.generateMetadata(() => ({ path: "/test" }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        title: "Only Title",
        openGraph: {
          title: "OG Title Only",
          images: [],
        },
        twitter: {
          images: [],
        },
      });
    });

    it("should cache API responses", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.generateMetadata(() => ({ path: "/test" }));

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

      const metadataFn1 = client.generateMetadata(() => ({ path: "/test1" }));
      const metadataFn2 = client.generateMetadata(() => ({ path: "/test2" }));

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

      const metadataFn = client.generateMetadata(asyncOptsFn);
      const result = await metadataFn({}, {} as any);

      expect(result.title).toBe("Test Page Title");
      expect(api.GET).toHaveBeenCalledWith("/v1/{dsn}/metadata/get-latest", {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/async-test" },
        },
      });
    });

    it("should use fallback metadata when API call fails", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const fallbackMetadata = {
        title: "Fallback Title",
        description: "Fallback Description",
      };

      const metadataFn = client.generateMetadata(() => ({
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

      const metadataFn = client.generateMetadata(() => ({
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

      const metadataFn = client.generateMetadata(() => ({
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
  });
});
