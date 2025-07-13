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
    favicon: {
      url: "https://example.com/favicon.ico",
      alt: "Site Favicon",
      width: 32,
      height: 32,
    },
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
        { title: "Test Page Title" },
        { name: "description", content: "Test page description" },
        { property: "og:title", content: "OG Test Title" },
        { property: "og:description", content: "OG Test Description" },
        { property: "og:image", content: "https://example.com/og-image.jpg" },
        { property: "og:image:alt", content: "OG Image Alt Text" },
        { property: "og:image", content: "https://example.com/og-image-1.jpg" },
        { property: "og:image:alt", content: "OG Image 1 Alt" },
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
      ]);

      expect(result.links).toEqual([
        {
          rel: "icon",
          href: "https://example.com/favicon.ico",
          sizes: "32x32",
        },
      ]);
    });

    it("should merge override head with generated metadata (override takes priority)", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
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

    it("should handle favicon metadata correctly", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn = client.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result.links).toEqual([
        {
          rel: "icon",
          href: "https://example.com/favicon.ico",
          sizes: "32x32",
        },
      ]);
    });

    it("should return empty metadata when DSN is undefined (development mode)", async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
      });

      const headFn = devClient.getHead(() => ({ path: "/test" }));
      const result = await headFn({});

      expect(result).toEqual({ meta: [] });
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
  });
});
