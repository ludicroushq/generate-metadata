import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateMetadataClient } from "../tanstack-start";
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

describe("GenerateMetadataClient (TanStack Start)", () => {
  let client: GenerateMetadataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GenerateMetadataClient({
      dsn: "test-dsn",
    });
  });

  describe("getHead", () => {
    it("should return generated metadata when API call succeeds", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result.meta).toEqual([
        { name: "title", content: "Test Page Title" },
        { name: "description", content: "Test page description" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Twitter Test Title" },
        { name: "twitter:description", content: "Twitter Test Description" },
        {
          name: "twitter:image",
          content: "https://example.com/twitter-image.jpg",
        },
        {
          name: "twitter:image:alt",
          content: "Twitter Image Alt",
        },
        { title: "Test Page Title" },
        { property: "og:title", content: "OG Test Title" },
        { property: "og:description", content: "OG Test Description" },
        { property: "og:locale", content: "en_US" },
        { property: "og:site_name", content: "Test Site" },
        { property: "og:type", content: "website" },
        { property: "og:image", content: "https://example.com/og-image.jpg" },
        { property: "og:image:alt", content: "OG Image Alt Text" },
        { property: "og:image", content: "https://example.com/og-image-1.jpg" },
        { property: "og:image:alt", content: "OG Image 1 Alt" },
      ]);

      expect(result.links).toEqual([
        {
          rel: "icon",
          href: "https://example.com/icon.png",
          type: "image/png",
          sizes: "32x32",
        },
        {
          rel: "apple-touch-icon",
          href: "https://example.com/apple-touch-icon.png",
          type: "image/png",
          sizes: "180x180",
        },
      ]);
    });

    it("should merge override head with generated metadata (override takes priority)", async () => {
      const mockApiResponseNoIcons: MetadataApiResponse = {
        metadata: {
          title: "Test Page Title",
          description: "Test page description",
          openGraph: {
            title: "OG Test Title",
            description: "OG Test Description",
            image: undefined,
            images: [],
          },
          twitter: {
            card: "summary_large_image",
            title: "Twitter Test Title",
            description: "Twitter Test Description",
            image: undefined,
          },
        },
      };

      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponseNoIcons,
        error: undefined,
      });

      const overrideHead = {
        meta: [
          { name: "title", content: "Override Title" }, // Should override generated
          { name: "custom", content: "Override Custom Meta" }, // Should be kept
        ],
        links: [{ rel: "canonical", href: "https://example.com/canonical" }],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        override: overrideHead,
      }));
      const result = await headFn({});

      // Override meta should take priority
      expect(result.meta).toEqual(
        expect.arrayContaining([
          { name: "title", content: "Override Title" },
          { name: "custom", content: "Override Custom Meta" },
          { name: "description", content: "Test page description" },
        ]),
      );

      // Override links should be preserved
      expect(result.links).toEqual([
        {
          rel: "canonical",
          href: "https://example.com/canonical",
        },
      ]);
    });

    it("should handle fallback metadata when API call fails", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const fallbackHead = {
        meta: [{ name: "fallback", content: "Fallback Meta" }],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        fallback: fallbackHead,
      }));
      const result = await headFn({});

      expect(result).toEqual(fallbackHead);
    });

    it("should merge override metadata with generated metadata", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const overrideHead = {
        meta: [{ name: "custom", content: "Override Meta" }],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        override: overrideHead,
      }));
      const result = await headFn({});

      // Should have both generated and override metadata
      expect(result.meta).toEqual(
        expect.arrayContaining([
          { name: "custom", content: "Override Meta" },
          { name: "title", content: "Test Page Title" },
        ]),
      );
    });

    it("should return fallback head when API call fails", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const fallbackHead = {
        meta: [{ name: "fallback", content: "Fallback Meta" }],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        fallback: fallbackHead,
      }));
      const result = await headFn({});

      expect(result).toEqual(fallbackHead);
    });

    it("should return empty object when API fails and no fallback head provided", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const headFn = client.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result).toEqual({});
    });

    it("should use fallback, generated, and override in correct priority order", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const fallbackHead = {
        meta: [
          { name: "fallback-only", content: "Fallback Only" },
          { name: "title", content: "Fallback Title" },
        ],
      };

      const overrideHead = {
        meta: [
          { name: "override-only", content: "Override Only" },
          { name: "title", content: "Override Title" },
        ],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        fallback: fallbackHead,
        override: overrideHead,
      }));
      const result = await headFn({});

      // Should have override title, generated description, fallback-only meta
      expect(result.meta).toEqual(
        expect.arrayContaining([
          { name: "override-only", content: "Override Only" },
          { name: "title", content: "Override Title" },
          { name: "fallback-only", content: "Fallback Only" },
          { name: "description", content: "Test page description" },
        ]),
      );
    });

    it("should handle empty API response gracefully", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result).toEqual({});
    });

    it("should cache API responses", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));

      // First call
      await headFn({});
      // Second call
      await headFn({});

      // API should only be called once due to caching
      expect(api.GET).toHaveBeenCalledTimes(1);
    });

    it("should handle different paths separately in cache", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn1 = client.getHead(() => ({ path: "/test1" }));
      const headFn2 = client.getHead(() => ({ path: "/test2" }));

      await headFn1({});
      await headFn2({});

      // API should be called twice for different paths
      expect(api.GET).toHaveBeenCalledTimes(2);
    });

    it("should return empty metadata when DSN is undefined (development mode)", async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
      });

      const headFn = devClient.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result).toEqual({});
      expect(api.GET).not.toHaveBeenCalled();
    });

    it("should use fallback metadata when DSN is undefined", async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
      });

      const fallbackHead = {
        meta: [
          { name: "title", content: "Development Title" },
          { name: "description", content: "Development Description" },
        ],
      };

      const headFn = devClient.getHead(() => ({
        path: "/test",
        fallback: fallbackHead,
      }));
      const result = await headFn({});

      expect(result).toEqual(fallbackHead);
      expect(api.GET).not.toHaveBeenCalled();
    });

    it("should handle null values gracefully", async () => {
      const responseWithNulls: MetadataApiResponse = {
        metadata: {
          title: undefined,
          description: undefined,
          icon: undefined,
          appleTouchIcon: undefined,
          openGraph: {
            title: undefined,
            description: undefined,
            locale: undefined,
            siteName: undefined,
            type: undefined,
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
        data: responseWithNulls,
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result).toEqual({});
    });

    it("should handle twitter and openGraph images without alt text", async () => {
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

      const headFn = client.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result.meta).toEqual([
        { name: "title", content: "Test Title" },
        {
          name: "twitter:image",
          content: "https://example.com/twitter-image.jpg",
        },
        { title: "Test Title" },
        { property: "og:image", content: "https://example.com/og-image.jpg" },
        { property: "og:image", content: "https://example.com/og-image-1.jpg" },
      ]);
    });

    it("should handle meta without name property", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const fallbackHead = {
        meta: [
          { property: "og:title", content: "Property Title" },
          { title: "Title Tag" },
          { "data-custom": "custom-value" },
        ],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        fallback: fallbackHead,
      }));
      const result = await headFn({});

      // Non-name meta should be preserved as is
      expect(result.meta).toEqual([
        { property: "og:title", content: "Property Title" },
        { title: "Title Tag" },
        { "data-custom": "custom-value" },
      ]);
    });

    it("should handle empty meta map and nonNameMeta", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const fallbackHead = {
        meta: [],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        fallback: fallbackHead,
      }));
      const result = await headFn({});

      // Result should not have meta property if no meta items
      expect(result.meta).toBeUndefined();
    });
  });

  describe("getRootHead", () => {
    it("should return empty head metadata when no factory provided", async () => {
      const rootHeadFn = client.getRootHead();
      const result = await rootHeadFn({});

      expect(result).toEqual({});
    });

    it("should return empty head metadata when factory returns empty object", async () => {
      const rootHeadFn = client.getRootHead(() => ({}));
      const result = await rootHeadFn({});

      expect(result).toEqual({});
    });

    it("should return fallback metadata when provided", async () => {
      const fallbackHead = {
        meta: [
          { name: "title", content: "Root Fallback Title" },
          { name: "description", content: "Root Fallback Description" },
        ],
      };

      const rootHeadFn = client.getRootHead(() => ({
        fallback: fallbackHead,
      }));
      const result = await rootHeadFn({});

      expect(result).toEqual(fallbackHead);
    });

    it("should merge override metadata properly", async () => {
      const fallbackHead = {
        meta: [
          { name: "title", content: "Root Fallback Title" },
          { name: "description", content: "Root Fallback Description" },
        ],
      };

      const overrideHead = {
        meta: [
          { name: "title", content: "Root Override Title" },
          { name: "keywords", content: "root,override" },
        ],
        links: [{ rel: "canonical", href: "https://example.com/root" }],
      };

      const rootHeadFn = client.getRootHead(() => ({
        fallback: fallbackHead,
        override: overrideHead,
      }));
      const result = await rootHeadFn({});

      // With deduplication, title should come from override, description from fallback
      expect(result.meta).toEqual([
        { name: "title", content: "Root Override Title" }, // Override wins over fallback
        { name: "description", content: "Root Fallback Description" }, // From fallback
        { name: "keywords", content: "root,override" }, // From override
      ]);

      expect(result.links).toEqual([
        { rel: "canonical", href: "https://example.com/root" },
      ]);
    });

    it("should handle async factory functions", async () => {
      const asyncFactory = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          fallback: {
            meta: [
              { name: "title", content: "Async Root Title" },
              { name: "description", content: "Async Root Description" },
            ],
          },
        };
      };

      const rootHeadFn = client.getRootHead(asyncFactory);
      const result = await rootHeadFn({});

      expect(result).toEqual({
        meta: [
          { name: "title", content: "Async Root Title" },
          { name: "description", content: "Async Root Description" },
        ],
      });
    });

    it("should pass context to factory function", async () => {
      const mockFactory = vi.fn().mockReturnValue({
        fallback: { meta: [{ name: "title", content: "Test Title" }] },
      });
      const mockContext = { test: "context" };

      const rootHeadFn = client.getRootHead(mockFactory);
      await rootHeadFn(mockContext);

      expect(mockFactory).toHaveBeenCalledWith(mockContext);
    });

    it("should handle meta deduplication with priority: override > generated > fallback", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: {
          metadata: {
            title: "Generated Title",
            description: "Generated Description",
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
        },
        error: undefined,
      });

      const fallbackHead = {
        meta: [
          { name: "title", content: "Fallback Title" },
          { name: "description", content: "Fallback Description" },
          { name: "author", content: "Fallback Author" },
        ],
      };

      const overrideHead = {
        meta: [
          { name: "title", content: "Override Title" },
          { name: "keywords", content: "override,test" },
        ],
      };

      const headFn = client.getHead(() => ({
        path: "/test",
        fallback: fallbackHead,
        override: overrideHead,
      }));
      const result = await headFn({});

      // Expected priority:
      // - title: Override > Generated > Fallback = "Override Title"
      // - description: Generated > Fallback = "Generated Description"
      // - author: Fallback only = "Fallback Author"
      // - keywords: Override only = "override,test"
      // The actual order based on deduplication logic
      expect(result.meta).toEqual([
        { name: "title", content: "Override Title" }, // Override wins over all
        { name: "description", content: "Generated Description" }, // Generated wins over fallback
        { name: "author", content: "Fallback Author" }, // Only in fallback
        { name: "keywords", content: "override,test" }, // From override
        { title: "Generated Title" }, // From generated (different key)
      ]);
    });
  });
});
