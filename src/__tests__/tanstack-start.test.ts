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

      const headFn = client.getHead({ path: "/test" });
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
          name: "twitter:image",
          content: "https://example.com/twitter-image-1.jpg",
        },
      ]);
    });

    it("should merge user head with generated metadata (user takes priority)", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const userHead = {
        meta: [
          { name: "title", content: "User Title" }, // Should override generated
          { name: "custom", content: "User Custom Meta" }, // Should be kept
        ],
        links: [{ rel: "canonical", href: "https://example.com/canonical" }],
      };

      const headFn = client.getHead({ path: "/test" }, { head: userHead });
      const result = await headFn({});

      // User meta should come first
      expect(result.meta?.[0]).toEqual({
        name: "title",
        content: "User Title",
      });
      expect(result.meta?.[1]).toEqual({
        name: "custom",
        content: "User Custom Meta",
      });

      // Generated meta should come after user meta (the title meta tag has a title property)
      const titleMeta = result.meta?.find((m) => m.title === "Test Page Title");
      expect(titleMeta).toBeDefined();

      // Check for description meta tag
      const descriptionMeta = result.meta?.find(
        (m) => m.name === "description",
      );
      expect(descriptionMeta).toEqual({
        name: "description",
        content: "Test page description",
      });

      // User links should be preserved
      expect(result.links?.[0]).toEqual({
        rel: "canonical",
        href: "https://example.com/canonical",
      });
    });

    it("should handle transform function correctly", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const transformResult = vi.fn().mockImplementation((head, ctx) => ({
        ...head,
        meta: [
          ...(head.meta || []),
          { name: "custom-transform", content: `transformed-${ctx.userId}` },
        ],
      }));

      const headFn = client.getHead({ path: "/test" }, { transformResult });

      const result = await headFn({ userId: "123" });

      expect(transformResult).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.arrayContaining([
            expect.objectContaining({
              name: "title",
              content: "Test Page Title",
            }),
          ]),
        }),
        { userId: "123" },
      );

      const customMeta = result.meta?.find(
        (m) => m.name === "custom-transform",
      );
      expect(customMeta).toEqual({
        name: "custom-transform",
        content: "transformed-123",
      });
    });

    it("should return user head when API call fails", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const userHead = {
        meta: [{ name: "fallback", content: "Fallback Meta" }],
      };

      const headFn = client.getHead({ path: "/test" }, { head: userHead });
      const result = await headFn({});

      expect(result).toEqual(userHead);
    });

    it("should return empty object when API fails and no user head provided", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const headFn = client.getHead({ path: "/test" });
      const result = await headFn({});

      expect(result).toEqual({});
    });

    it("should call transform function with fallback head on error", async () => {
      vi.mocked(api.GET).mockRejectedValue(new Error("API Error"));

      const userHead = {
        meta: [{ name: "fallback", content: "Fallback Meta" }],
      };

      const transformResult = vi.fn().mockImplementation((head) => ({
        ...head,
        meta: [
          ...(head.meta || []),
          { name: "error-handled", content: "true" },
        ],
      }));

      const headFn = client.getHead(
        { path: "/test" },
        { head: userHead, transformResult },
      );

      const result = await headFn({ error: true });

      expect(transformResult).toHaveBeenCalledWith(userHead, { error: true });
      const errorMeta = result.meta?.find((m) => m.name === "error-handled");
      expect(errorMeta).toEqual({ name: "error-handled", content: "true" });
    });

    it("should handle empty API response gracefully", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const headFn = client.getHead({ path: "/test" });
      const result = await headFn({});

      expect(result).toEqual({});
    });

    it("should cache API responses", async () => {
      vi.mocked(api.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const headFn = client.getHead({ path: "/test" });

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

      const headFn1 = client.getHead({ path: "/test1" });
      const headFn2 = client.getHead({ path: "/test2" });

      await headFn1({});
      await headFn2({});

      // API should be called twice for different paths
      expect(api.GET).toHaveBeenCalledTimes(2);
    });
  });
});
