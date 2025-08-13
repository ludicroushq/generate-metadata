import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MetadataApiResponse } from "../index";
import { GenerateMetadataClient } from "../tanstack-start";
import { FetchApiClient } from "../utils/api/fetch";

import type { webhooks } from "../__generated__/api";

// Mock hono/vercel
vi.mock("hono/vercel", () => ({
  handle: vi.fn((app) => {
    // Return a mock handler function that simulates Vercel's edge function handler
    const handler = async (req: Request) => {
      // Call the Hono app's fetch method with the request
      return app.fetch(req);
    };
    return handler;
  }),
}));

const validMetadataUpdateBody: webhooks["webhook"]["post"]["requestBody"]["content"]["application/json"] =
  {
    _type: "metadata_update",
    path: "/test-path",
    metadataRevisionId: "rev-123",
    metadata: {},
    site: { hostname: "example.com", dsn: "dsn-123" },
    timestamp: new Date().toISOString(),
  };

// Create a mock API client
const mockApiClient = {
  GET: vi.fn(),
};

// Mock the FetchApiClient
vi.mock("../utils/api/fetch", () => ({
  FetchApiClient: vi.fn().mockImplementation(() => ({
    metadataGetLatest: vi.fn((args) =>
      mockApiClient.GET("/v1/{dsn}/metadata/get-latest", args),
    ),
  })),
}));

// Mock the base URL export
vi.mock("../utils/api", () => ({
  baseUrl: "https://www.generate-metadata.com/api/openapi",
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
      apiKey: "test-api-key",
    });
  });

  const mockCtx = {
    match: {
      pathname: "/test",
    },
    matches: [{ pathname: "/test" }],
  };

  describe("getHead", () => {
    it("should return generated metadata when API call succeeds", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

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

      vi.mocked(mockApiClient.GET).mockResolvedValue({
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

      const result = await client.getHead({
        path: "/test",
        override: overrideHead,
        ctx: mockCtx,
      });

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
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error("API Error"));

      const fallbackHead = {
        meta: [{ name: "fallback", content: "Fallback Meta" }],
      };

      const result = await client.getHead({
        path: "/test",
        fallback: fallbackHead,
        ctx: mockCtx,
      });

      expect(result).toEqual(fallbackHead);
    });

    it("should merge override metadata with generated metadata", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const overrideHead = {
        meta: [{ name: "custom", content: "Override Meta" }],
      };

      const result = await client.getHead({
        path: "/test",
        override: overrideHead,
        ctx: mockCtx,
      });

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
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error("API Error"));

      const fallbackHead = {
        meta: [{ name: "fallback", content: "Fallback Meta" }],
      };

      const result = await client.getHead({
        path: "/test",
        fallback: fallbackHead,
        ctx: mockCtx,
      });

      expect(result).toEqual(fallbackHead);
    });

    it("should return empty object when API fails and no fallback head provided", async () => {
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error("API Error"));

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(result).toEqual({});
    });

    it("should use fallback, generated, and override in correct priority order", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
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

      const result = await client.getHead({
        path: "/test",
        fallback: fallbackHead,
        override: overrideHead,
        ctx: mockCtx,
      });

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
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(result).toEqual({});
    });

    it("should cache API responses", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      // First call
      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });
      // Second call
      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      // API should only be called once due to caching
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1);
    });

    it("should handle different paths separately in cache", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test1",
        ctx: {
          ...mockCtx,
          match: { pathname: "/test1" },
          matches: [{ pathname: "/test1" }],
        },
      });
      await client.getHead({
        path: "/test2",
        ctx: {
          ...mockCtx,
          match: { pathname: "/test2" },
          matches: [{ pathname: "/test2" }],
        },
      });

      // API should be called twice for different paths
      expect(mockApiClient.GET).toHaveBeenCalledTimes(2);
    });

    it("should return empty metadata when DSN is undefined (development mode)", async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
      });

      const result = await devClient.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(result).toEqual({});
      expect(mockApiClient.GET).not.toHaveBeenCalled();
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

      const result = await devClient.getHead({
        path: "/test",
        fallback: fallbackHead,
        ctx: mockCtx,
      });

      expect(result).toEqual(fallbackHead);
      expect(mockApiClient.GET).not.toHaveBeenCalled();
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

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: responseWithNulls,
        error: undefined,
      });

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

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

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: responseWithoutAlt,
        error: undefined,
      });

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

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
      vi.mocked(mockApiClient.GET).mockResolvedValue({
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

      const result = await client.getHead({
        path: "/test",
        fallback: fallbackHead,
        ctx: mockCtx,
      });

      // Non-name meta should be preserved as is
      expect(result.meta).toEqual([
        { property: "og:title", content: "Property Title" },
        { title: "Title Tag" },
        { "data-custom": "custom-value" },
      ]);
    });

    it("should handle empty meta map and nonNameMeta", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const fallbackHead = {
        meta: [],
      };

      const result = await client.getHead({
        path: "/test",
        fallback: fallbackHead,
        ctx: mockCtx,
      });

      // Result should not have meta property if no meta items
      expect(result.meta).toBeUndefined();
    });

    it("should include apiKey as bearer token when provided", async () => {
      const client = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: "test-api-key",
      });

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" },
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should not include authorization header when apiKey is not provided", async () => {
      const clientWithoutApiKey = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: undefined,
      });

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await clientWithoutApiKey.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" },
          },
        },
      );
    });

    it("should handle custom meta tags", async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          title: "Test Title",
          customTags: [
            {
              name: "author",
              content: "John Doe",
            },
            {
              name: "keywords",
              content: "test,metadata,seo",
            },
          ],
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(result).toEqual({
        meta: [
          { name: "title", content: "Test Title" },
          { title: "Test Title" },
          { name: "author", content: "John Doe" },
          { name: "keywords", content: "test,metadata,seo" },
        ],
      });
    });

    it("should handle noindex metadata", async () => {
      const noindexApiResponse: MetadataApiResponse = {
        metadata: {
          title: "Test Title",
          noindex: true,
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: noindexApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(result).toEqual({
        meta: [
          { name: "title", content: "Test Title" },
          { title: "Test Title" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      });
    });

    it("should handle empty customTags array", async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          title: "Test Title",
          customTags: [],
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(result).toEqual({
        meta: [
          { name: "title", content: "Test Title" },
          { title: "Test Title" },
        ],
      });
    });
  });

  describe("path inference from context", () => {
    it("should use last match from matches array when path is not defined", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/should-not-use-this",
        },
        matches: [
          { pathname: "/root" },
          { pathname: "/products" },
          { pathname: "/products/123" },
        ],
      };

      const result = await client.getHead({
        // path is not defined, should use last match from matches array
        ctx: customCtx,
      });

      // Verify it used the last match pathname
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/products/123" }, // Should use last match
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
    });

    it("should fall back to match.pathname when matches array is empty and path is not defined", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/fallback-path",
        },
        matches: [], // Empty matches array
      };

      const result = await client.getHead({
        // path is not defined, should use match.pathname as fallback
        ctx: customCtx,
      });

      // Verify it used match.pathname as fallback
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/fallback-path" }, // Should use match.pathname
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
    });

    it("should prioritize explicit path over matches array", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/match-path",
        },
        matches: [
          { pathname: "/root" },
          { pathname: "/products" },
          { pathname: "/products/456" },
        ],
      };

      const result = await client.getHead({
        path: "/explicit-path", // Explicitly defined path
        ctx: customCtx,
      });

      // Verify it used the explicit path
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/explicit-path" }, // Should use explicit path
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
    });

    it("should handle nested route matches correctly", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/admin",
        },
        matches: [
          { pathname: "/" },
          { pathname: "/admin" },
          { pathname: "/admin/users" },
          { pathname: "/admin/users/123" },
          { pathname: "/admin/users/123/edit" },
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should use the last (most specific) match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/admin/users/123/edit" },
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
    });

    it("should normalize paths from matches array", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/test/",
        },
        matches: [
          { pathname: "/root/" },
          { pathname: "products/" }, // Missing leading slash
          { pathname: "/items//" }, // Double slashes
          { pathname: "final/path/" }, // Missing leading slash and trailing slash
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should normalize the last match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/final/path" }, // Normalized
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
    });

    it("should handle single match in matches array", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/different",
        },
        matches: [
          { pathname: "/single-match" }, // Only one match
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should use the single match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/single-match" },
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
    });

    it("should handle undefined matches array", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/only-match-path",
        },
        matches: undefined as any, // Matches might be undefined
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should fallback to match.pathname
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/only-match-path" },
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
    });

    it("should handle matches with query strings and hashes", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: "/test",
        },
        matches: [
          { pathname: "/root" },
          { pathname: "/products?category=electronics" }, // With query string
          { pathname: "/items#section" }, // With hash
          { pathname: "/final?query=test#hash" }, // With both
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should normalize and strip query/hash from the last match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/final" }, // Normalized without query and hash
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );

      expect(result.meta).toBeDefined();
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
      vi.mocked(mockApiClient.GET).mockResolvedValue({
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

      const result = await client.getHead({
        path: "/test",
        fallback: fallbackHead,
        override: overrideHead,
        ctx: mockCtx,
      });

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
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      // Clear mocks to verify cache behavior
      vi.clearAllMocks();

      // Call clearCache (which is what revalidateWebhookHandler calls)
      (client as any).clearCache("/test");

      // Verify cache was cleared by fetching again
      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1); // Should fetch again since cache was cleared
    });

    it("should clear entire cache when path is null", async () => {
      // Populate cache with multiple paths
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test1",
        ctx: {
          ...mockCtx,
          match: { pathname: "/test1" },
          matches: [{ pathname: "/test1" }],
        },
      });
      await client.getHead({
        path: "/test2",
        ctx: {
          ...mockCtx,
          match: { pathname: "/test2" },
          matches: [{ pathname: "/test2" }],
        },
      });

      // Clear mocks
      vi.clearAllMocks();

      // Call clearCache with null (which is what revalidateWebhookHandler calls)
      (client as any).clearCache(null);

      // Both paths should fetch again
      await client.getHead({
        path: "/test1",
        ctx: {
          ...mockCtx,
          match: { pathname: "/test1" },
          matches: [{ pathname: "/test1" }],
        },
      });
      await client.getHead({
        path: "/test2",
        ctx: {
          ...mockCtx,
          match: { pathname: "/test2" },
          matches: [{ pathname: "/test2" }],
        },
      });

      expect(mockApiClient.GET).toHaveBeenCalledTimes(2); // Both should fetch again
    });
  });

  describe("path normalization", () => {
    it("should normalize paths with trailing slashes", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test/",
        ctx: { ...mockCtx, match: { pathname: "/test/" } },
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" }, // Normalized without trailing slash
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should normalize paths without leading slashes", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "test",
        ctx: { ...mockCtx, match: { pathname: "test" } },
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" }, // Normalized with leading slash
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should normalize paths with both missing leading and trailing slashes", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "test/page/",
        ctx: { ...mockCtx, match: { pathname: "test/page/" } },
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test/page" }, // Normalized with leading slash, without trailing
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should handle root path correctly", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/",
        ctx: { ...mockCtx, match: { pathname: "/" } },
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/" }, // Root path remains as "/"
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should normalize paths with query strings", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test?query=param",
        ctx: { ...mockCtx, match: { pathname: "/test?query=param" } },
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" }, // Query string removed
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should normalize paths with hash fragments", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test#section",
        ctx: { ...mockCtx, match: { pathname: "/test#section" } },
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" }, // Hash fragment removed
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should normalize paths with multiple trailing slashes", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test/page///",
        ctx: { ...mockCtx, match: { pathname: "/test/page///" } },
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        "/v1/{dsn}/metadata/get-latest",
        {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test/page" }, // All trailing slashes removed correctly
          },
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should cache using normalized paths", async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      // First call
      await client.getHead({
        path: "/test/",
        ctx: { ...mockCtx, match: { pathname: "/test/" } },
      });
      // Second call with different format but same normalized path
      await client.getHead({
        path: "test",
        ctx: { ...mockCtx, match: { pathname: "test" } },
      });
      // Third call with normalized format
      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      // API should only be called once due to cache normalization
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1);
    });

    it("should normalize path in clearCache", async () => {
      // First populate cache with different path formats
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      // Clear cache with unnormalized path
      (client as any).clearCache("/test/");

      // Verify cache was cleared by fetching again
      await client.getHead({
        path: "/test",
        ctx: mockCtx,
      });
      expect(mockApiClient.GET).toHaveBeenCalledTimes(2); // Should fetch again since cache was cleared
    });

    it("should normalize path in webhook handler", async () => {
      const clearCacheSpy = vi.spyOn(client as any, "clearCache");
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      // Test with trailing slash
      const mockRequest1 = new Request("http://localhost:3000/api/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _type: "metadata_update",
          path: "/test/",
        }),
      });

      await handlers.POST({ request: mockRequest1 });
      expect(clearCacheSpy).toHaveBeenCalledWith("/test");
      expect(revalidateSpy).toHaveBeenCalledWith("/test");

      // Test without leading slash
      const mockRequest2 = new Request("http://localhost:3000/api/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _type: "metadata_update",
          path: "test",
        }),
      });

      await handlers.POST({ request: mockRequest2 });
      expect(clearCacheSpy).toHaveBeenCalledWith("/test");
      expect(revalidateSpy).toHaveBeenCalledWith("/test");

      revalidateSpy.mockRestore();
    });

    it("should normalize path before applying pathRewrite", async () => {
      const clearCacheSpy = vi.spyOn(client as any, "clearCache");
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => (path === "/old" ? "/new" : path));

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
      });

      const mockRequest = new Request("http://localhost:3000/api/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _type: "metadata_update",
          path: "old/", // Unnormalized path
        }),
      });

      await handlers.POST({ request: mockRequest });

      // pathRewrite should receive normalized path
      expect(pathRewriteSpy).toHaveBeenCalledWith("/old");
      expect(clearCacheSpy).toHaveBeenCalledWith("/new");
      expect(revalidateSpy).toHaveBeenCalledWith("/new");

      revalidateSpy.mockRestore();
    });
  });

  describe("pathRewrite normalization", () => {
    it("should normalize the result of pathRewrite", async () => {
      const clearCacheSpy = vi.spyOn(client as any, "clearCache");
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return unnormalized path
        return path === "/old" ? "/new/path/" : path;
      });

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
      });

      const mockRequest = new Request("http://localhost:3000/api/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _type: "metadata_update",
          path: "/old",
        }),
      });

      await handlers.POST({ request: mockRequest });

      // pathRewrite returns "/new/path/" but it should be normalized to "/new/path"
      expect(pathRewriteSpy).toHaveBeenCalledWith("/old");
      expect(clearCacheSpy).toHaveBeenCalledWith("/new/path"); // Normalized
      expect(revalidateSpy).toHaveBeenCalledWith("/new/path"); // Normalized

      revalidateSpy.mockRestore();
    });

    it("should handle pathRewrite returning null (falls back to original path)", async () => {
      const clearCacheSpy = vi.spyOn(client as any, "clearCache");
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return null for certain paths
        return path === "/skip" ? null : path;
      });

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
      });

      const mockRequest = new Request("http://localhost:3000/api/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _type: "metadata_update",
          path: "/skip",
        }),
      });

      await handlers.POST({ request: mockRequest });

      expect(pathRewriteSpy).toHaveBeenCalledWith("/skip");
      // When pathRewrite returns null, it falls back to the original normalized path
      expect(clearCacheSpy).toHaveBeenCalledWith("/skip");
      expect(revalidateSpy).toHaveBeenCalledWith("/skip");

      revalidateSpy.mockRestore();
    });

    it("should normalize pathRewrite result with multiple trailing slashes", async () => {
      const clearCacheSpy = vi.spyOn(client as any, "clearCache");
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return path with multiple trailing slashes
        return path === "/test" ? "/rewritten///" : path;
      });

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
      });

      const mockRequest = new Request("http://localhost:3000/api/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _type: "metadata_update",
          path: "/test",
        }),
      });

      await handlers.POST({ request: mockRequest });

      expect(pathRewriteSpy).toHaveBeenCalledWith("/test");
      expect(clearCacheSpy).toHaveBeenCalledWith("/rewritten"); // All trailing slashes removed
      expect(revalidateSpy).toHaveBeenCalledWith("/rewritten");

      revalidateSpy.mockRestore();
    });

    it("should handle pathRewrite returning path without leading slash", async () => {
      const clearCacheSpy = vi.spyOn(client as any, "clearCache");
      const revalidateSpy = vi
        .spyOn(client as any, "revalidate")
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return path without leading slash
        return path === "/test" ? "rewritten/path" : path;
      });

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
      });

      const mockRequest = new Request("http://localhost:3000/api/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _type: "metadata_update",
          path: "/test",
        }),
      });

      await handlers.POST({ request: mockRequest });

      expect(pathRewriteSpy).toHaveBeenCalledWith("/test");
      expect(clearCacheSpy).toHaveBeenCalledWith("/rewritten/path"); // Leading slash added
      expect(revalidateSpy).toHaveBeenCalledWith("/rewritten/path");

      revalidateSpy.mockRestore();
    });
  });

  describe("revalidateWebhookHandler", () => {
    it("should return route handlers object", () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      // Check that it returns an object with route handler methods
      expect(handlers).toBeDefined();
      expect(handlers.GET).toBeDefined();
      expect(handlers.POST).toBeDefined();
      expect(handlers.PUT).toBeDefined();
      expect(handlers.PATCH).toBeDefined();
      expect(handlers.DELETE).toBeDefined();
      expect(handlers.OPTIONS).toBeDefined();
      expect(handlers.HEAD).toBeDefined();

      // All handlers should be the same function (handlerWrapper)
      expect(handlers.GET).toBe(handlers.POST);
      expect(handlers.GET).toBe(handlers.PUT);
      expect(handlers.GET).toBe(handlers.PATCH);
      expect(handlers.GET).toBe(handlers.DELETE);
      expect(handlers.GET).toBe(handlers.OPTIONS);
      expect(handlers.GET).toBe(handlers.HEAD);
    });

    it("should handle POST /revalidate request", async () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      // Mock request for webhook
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

      const response = await handlers.POST({ request: mockRequest });
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
      const handlers = client.revalidateWebhookHandler({
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

      const response = await handlers.POST({ request: mockRequest });

      expect(response.status).toBe(401);
      // Our custom auth middleware returns JSON for unauthorized
      const responseData = await response.json();
      expect(responseData).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("should handle request with null path", async () => {
      const handlers = client.revalidateWebhookHandler({
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

      const response = await handlers.POST({ request: mockRequest });
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

      const handlers = client.revalidateWebhookHandler({
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

      const response = await handlers.POST({ request: mockRequest });

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith("/test-path");
    });

    it("should use custom revalidatePath function with null path", async () => {
      const customRevalidatePath = vi.fn();

      const handlers = client.revalidateWebhookHandler({
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

      const response = await handlers.POST({ request: mockRequest });

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith(null);
    });

    it("should work with GET requests", async () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      const mockRequest = new Request(
        "http://localhost:3000/api/generate-metadata/webhook",
        {
          method: "GET",
        },
      );

      // GET handler expects a context object with request property
      const response = await handlers.GET({ request: mockRequest });

      // GET should work (might return 405 or other response based on Hono setup)
      expect(response).toBeDefined();
    });

    it("should use hono/vercel handle function", async () => {
      // Import the mocked handle function
      const { handle } = await import("hono/vercel");

      client.revalidateWebhookHandler({
        webhookSecret: "test-secret",
      });

      // Verify that handle was called
      expect(handle).toHaveBeenCalled();
    });
  });

  describe("serverFn functionality", () => {
    it("should use TanstackStartApiClient when serverFn is provided", async () => {
      const mockServerFn = vi.fn().mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      }) as any;

      const clientWithServerFn = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: "test-api-key",
        serverFn: mockServerFn,
      });

      const result = await clientWithServerFn.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      // Should call the serverFn with correct data structure
      expect(mockServerFn).toHaveBeenCalledWith({
        data: {
          type: "metadataGetLatest",
          args: expect.objectContaining({
            params: {
              path: { dsn: "test-dsn" },
              query: { path: "/test" },
            },
            headers: {
              Authorization: "Bearer test-api-key",
            },
          }),
        },
      });

      expect(result.meta).toBeDefined();
    });

    it("should use FetchApiClient when serverFn is not provided", async () => {
      const clientWithoutServerFn = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: "test-api-key",
        // No serverFn provided
      });

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const result = await clientWithoutServerFn.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      // Should use the mocked FetchApiClient
      expect(mockApiClient.GET).toHaveBeenCalled();
      expect(result.meta).toBeDefined();
    });

    it("should pass apiKey to serverFn through TanstackStartApiClient", async () => {
      const mockServerFn = vi.fn().mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      }) as any;

      const clientWithServerFn = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: "custom-api-key",
        serverFn: mockServerFn,
      });

      await clientWithServerFn.getHead({
        path: "/test",
        ctx: mockCtx,
      });

      expect(mockServerFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          args: expect.objectContaining({
            headers: {
              Authorization: "Bearer custom-api-key",
            },
          }),
        }),
      });
    });

    it("should handle serverFn errors gracefully", async () => {
      const mockServerFn = vi
        .fn()
        .mockRejectedValue(new Error("ServerFn Error")) as any;

      const clientWithServerFn = new GenerateMetadataClient({
        dsn: "test-dsn",
        apiKey: "test-api-key",
        serverFn: mockServerFn,
      });

      const fallbackHead = {
        meta: [{ name: "fallback", content: "Fallback Meta" }],
      };

      const result = await clientWithServerFn.getHead({
        path: "/test",
        fallback: fallbackHead,
        ctx: mockCtx,
      });

      expect(result).toEqual(fallbackHead);
      expect(mockServerFn).toHaveBeenCalled();
    });
  });

  describe("serverFnHandler static method", () => {
    it("should handle metadataGetLatest type correctly", async () => {
      // Mock the FetchApiClient for serverFnHandler
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any,
      );

      const ctx = {
        data: {
          type: "metadataGetLatest" as const,
          args: {
            params: {
              path: { dsn: "test-dsn" },
              query: { path: "/test" },
            },
          },
        },
      };

      const result = await GenerateMetadataClient.serverFnHandler(ctx as any, {
        apiKey: "test-api-key",
      });

      expect(result).toEqual({
        data: mockApiResponse,
        error: undefined,
      });

      expect(mockFetchApiClient.metadataGetLatest).toHaveBeenCalledWith({
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test" },
        },
        headers: {
          Authorization: "Bearer test-api-key",
        },
      });
    });

    it("should throw error for unknown type", async () => {
      const ctx = {
        data: {
          type: "unknownType" as any,
          args: {},
        },
      };

      await expect(
        GenerateMetadataClient.serverFnHandler(ctx as any, {
          apiKey: "test-api-key",
        }),
      ).rejects.toThrow(
        "generate metadata server function called with unknown type unknownType",
      );
    });

    it("should merge headers correctly in serverFnHandler", async () => {
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any,
      );

      const ctx = {
        data: {
          type: "metadataGetLatest" as const,
          args: {
            params: {
              path: { dsn: "test-dsn" },
              query: { path: "/test" },
            },
            headers: {
              "X-Custom-Header": "custom-value",
            },
          },
        },
      };

      await GenerateMetadataClient.serverFnHandler(ctx as any, {
        apiKey: "test-api-key",
      });

      expect(mockFetchApiClient.metadataGetLatest).toHaveBeenCalledWith({
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test" },
        },
        headers: {
          "X-Custom-Header": "custom-value",
          Authorization: "Bearer test-api-key",
        },
      });
    });

    it("should handle serverFnHandler without apiKey", async () => {
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any,
      );

      const ctx = {
        data: {
          type: "metadataGetLatest" as const,
          args: {
            params: {
              path: { dsn: "test-dsn" },
              query: { path: "/test" },
            },
          },
        },
      };

      await GenerateMetadataClient.serverFnHandler(ctx as any, { apiKey: "" });

      expect(mockFetchApiClient.metadataGetLatest).toHaveBeenCalledWith({
        params: {
          path: { dsn: "test-dsn" },
          query: { path: "/test" },
        },
        headers: {
          Authorization: "Bearer ",
        },
      });
    });

    it("should omit response from serverFnHandler result", async () => {
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any,
      );

      const ctx = {
        data: {
          type: "metadataGetLatest" as const,
          args: {
            params: {
              path: { dsn: "test-dsn" },
              query: { path: "/test" },
            },
          },
        },
      };

      const result = await GenerateMetadataClient.serverFnHandler(ctx as any, {
        apiKey: "test-api-key",
      });

      // Result should not have the response property
      expect(result).not.toHaveProperty("response");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
    });
  });

  describe("serverFnValidator", () => {
    it("should validate metadataGetLatest type", () => {
      const validData = {
        type: "metadataGetLatest",
        args: {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" },
          },
        },
      };

      // Should not throw
      expect(() =>
        GenerateMetadataClient.serverFnValidator(validData),
      ).not.toThrow();
    });

    it("should validate placeholder type", () => {
      const validData = {
        type: "placeholder",
      };

      // Should not throw
      expect(() =>
        GenerateMetadataClient.serverFnValidator(validData),
      ).not.toThrow();
    });

    it("should reject invalid type", () => {
      const invalidData = {
        type: "invalid",
        args: {},
      };

      expect(() =>
        GenerateMetadataClient.serverFnValidator(invalidData),
      ).toThrow();
    });

    it("should reject missing type", () => {
      const invalidData = {
        args: {},
      };

      expect(() =>
        GenerateMetadataClient.serverFnValidator(invalidData),
      ).toThrow();
    });
  });
});
