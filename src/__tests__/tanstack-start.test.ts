import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateMetadataClient } from "../tanstack-start";
import type { MetadataApiResponse } from "../index";

import { api } from "../utils/api";
import type { webhooks } from "../__generated__/api";

const validMetadataUpdateBody: webhooks["webhook"]["post"]["requestBody"]["content"]["application/json"] =
  {
    _type: "metadata_update",
    path: "/test-path",
    metadataRevisionId: "rev-123",
    metadata: {},
    site: { hostname: "example.com", dsn: "dsn-123" },
    timestamp: new Date().toISOString(),
  };

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

      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Test Page Title",
            "name": "title",
          },
          {
            "title": "Test Page Title",
          },
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
          },
          {
            "content": "en_US",
            "property": "og:locale",
          },
          {
            "content": "Test Site",
            "property": "og:site_name",
          },
          {
            "content": "website",
            "property": "og:type",
          },
          {
            "content": "https://example.com/og-image.jpg",
            "property": "og:image",
          },
          {
            "content": "OG Image Alt Text",
            "property": "og:image:alt",
          },
          {
            "content": "https://example.com/og-image-1.jpg",
            "property": "og:image",
          },
          {
            "content": "OG Image 1 Alt",
            "property": "og:image:alt",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
          },
          {
            "content": "Twitter Test Title",
            "name": "twitter:title",
          },
          {
            "content": "Twitter Test Description",
            "name": "twitter:description",
          },
          {
            "content": "https://example.com/twitter-image.jpg",
            "name": "twitter:image",
          },
          {
            "content": "Twitter Image Alt",
            "name": "twitter:image:alt",
          },
        ]
      `);

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
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "title": "Test Page Title",
          },
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
          },
          {
            "content": "Twitter Test Title",
            "name": "twitter:title",
          },
          {
            "content": "Twitter Test Description",
            "name": "twitter:description",
          },
          {
            "content": "Override Title",
            "name": "title",
          },
          {
            "content": "Override Custom Meta",
            "name": "custom",
          },
        ]
      `);

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
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Test Page Title",
            "name": "title",
          },
          {
            "title": "Test Page Title",
          },
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
          },
          {
            "content": "en_US",
            "property": "og:locale",
          },
          {
            "content": "Test Site",
            "property": "og:site_name",
          },
          {
            "content": "website",
            "property": "og:type",
          },
          {
            "content": "https://example.com/og-image.jpg",
            "property": "og:image",
          },
          {
            "content": "OG Image Alt Text",
            "property": "og:image:alt",
          },
          {
            "content": "https://example.com/og-image-1.jpg",
            "property": "og:image",
          },
          {
            "content": "OG Image 1 Alt",
            "property": "og:image:alt",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
          },
          {
            "content": "Twitter Test Title",
            "name": "twitter:title",
          },
          {
            "content": "Twitter Test Description",
            "name": "twitter:description",
          },
          {
            "content": "https://example.com/twitter-image.jpg",
            "name": "twitter:image",
          },
          {
            "content": "Twitter Image Alt",
            "name": "twitter:image:alt",
          },
          {
            "content": "Override Meta",
            "name": "custom",
          },
        ]
      `);
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
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Fallback Only",
            "name": "fallback-only",
          },
          {
            "title": "Test Page Title",
          },
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
          },
          {
            "content": "en_US",
            "property": "og:locale",
          },
          {
            "content": "Test Site",
            "property": "og:site_name",
          },
          {
            "content": "website",
            "property": "og:type",
          },
          {
            "content": "https://example.com/og-image.jpg",
            "property": "og:image",
          },
          {
            "content": "OG Image Alt Text",
            "property": "og:image:alt",
          },
          {
            "content": "https://example.com/og-image-1.jpg",
            "property": "og:image",
          },
          {
            "content": "OG Image 1 Alt",
            "property": "og:image:alt",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
          },
          {
            "content": "Twitter Test Title",
            "name": "twitter:title",
          },
          {
            "content": "Twitter Test Description",
            "name": "twitter:description",
          },
          {
            "content": "https://example.com/twitter-image.jpg",
            "name": "twitter:image",
          },
          {
            "content": "Twitter Image Alt",
            "name": "twitter:image:alt",
          },
          {
            "content": "Override Only",
            "name": "override-only",
          },
          {
            "content": "Override Title",
            "name": "title",
          },
        ]
      `);
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

      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Test Title",
            "name": "title",
          },
          {
            "title": "Test Title",
          },
          {
            "content": "https://example.com/og-image.jpg",
            "property": "og:image",
          },
          {
            "content": "https://example.com/og-image-1.jpg",
            "property": "og:image",
          },
          {
            "content": "https://example.com/twitter-image.jpg",
            "name": "twitter:image",
          },
        ]
      `);
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

    it("should include apiKey as bearer token when provided", async () => {
      const client = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: "test-api-key",
      });

      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));
      await headFn({});

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

    it("should not include authorization header when apiKey is not provided", async () => {
      const client = new GenerateMetadataClient({
        dsn: "test-dsn",
      });

      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));
      await headFn({});

      expect(api.GET).toHaveBeenCalledWith("/v1/{dsn}/metadata/get-latest", {
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test" },
        },
      });
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
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Root Fallback Description",
            "name": "description",
          },
          {
            "content": "Root Override Title",
            "name": "title",
          },
          {
            "content": "root,override",
            "name": "keywords",
          },
        ]
      `);

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
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Fallback Author",
            "name": "author",
          },
          {
            "title": "Generated Title",
          },
          {
            "content": "Generated Description",
            "name": "description",
          },
          {
            "content": "Override Title",
            "name": "title",
          },
          {
            "content": "override,test",
            "name": "keywords",
          },
        ]
      `);
    });
  });

  describe("revalidate", () => {
    it("should clear cache for specific path", async () => {
      // First, populate the cache
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));
      await headFn({});

      // Clear mocks to verify cache behavior
      vi.clearAllMocks();

      // Call revalidate
      (client as any).revalidate("/test");

      // Verify cache was cleared by fetching again
      await headFn({});
      expect(api.GET).toHaveBeenCalledTimes(1); // Should fetch again since cache was cleared
    });

    it("should clear entire cache when path is null", async () => {
      // Populate cache with multiple paths
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn1 = client.getHead(() => ({ path: "/test1" }));
      const headFn2 = client.getHead(() => ({ path: "/test2" }));

      await headFn1({});
      await headFn2({});

      // Clear mocks
      vi.clearAllMocks();

      // Call revalidate with null
      (client as any).revalidate(null);

      // Both paths should fetch again
      await headFn1({});
      await headFn2({});

      expect(api.GET).toHaveBeenCalledTimes(2); // Both should fetch again
    });
  });

  describe("revalidateWebhookHandler", () => {
    it("should return a Hono app instance", () => {
      const app = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      // Check that it returns a Hono instance
      expect(app).toBeDefined();
      expect(app.fetch).toBeDefined(); // Hono apps have a fetch method
    });

    it("should handle POST /revalidate request", async () => {
      const app = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      // Mock request for Hono
      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer test-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify(validMetadataUpdateBody),
        },
      );

      // Spy on the revalidate method
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});

      const response = await app.fetch(mockRequest);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        ok: true,
        metadata: {
          revalidated: true,
          path: "/test-path",
        },
      });
      expect(revalidateSpy).toHaveBeenCalledWith("/test-path");

      revalidateSpy.mockRestore();
    });

    it("should reject request with invalid auth", async () => {
      const app = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer wrong-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({ path: "/test-path" }),
        },
      );

      const response = await app.fetch(mockRequest);

      expect(response.status).toBe(401);
      // Our custom auth middleware returns JSON for unauthorized
      const responseData = await response.json();
      expect(responseData).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("should handle request with null path", async () => {
      const app = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer test-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({ ...validMetadataUpdateBody, path: null }),
        },
      );

      // Spy on the revalidate method
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});

      const response = await app.fetch(mockRequest);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        ok: true,
        metadata: {
          revalidated: true,
          path: null,
        },
      });
      expect(revalidateSpy).toHaveBeenCalledWith(null);

      revalidateSpy.mockRestore();
    });

    it("should use custom revalidatePath function when provided", async () => {
      const customRevalidatePath = vi.fn();

      const app = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
        revalidate: {
          pathRewrite: customRevalidatePath,
        },
      });

      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer test-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify(validMetadataUpdateBody),
        },
      );

      const response = await app.fetch(mockRequest);

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith("/test-path");
    });

    it("should use custom revalidatePath function with null path", async () => {
      const customRevalidatePath = vi.fn();

      const app = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
        revalidate: {
          pathRewrite: customRevalidatePath,
        },
      });

      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/revalidate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer test-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({ ...validMetadataUpdateBody, path: null }),
        },
      );

      const response = await app.fetch(mockRequest);

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith(null);
    });
  });
});
