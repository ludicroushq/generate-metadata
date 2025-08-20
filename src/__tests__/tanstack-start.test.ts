import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { webhooks } from '../__generated__/api';
import type { MetadataApiResponse } from '../index';
import { GenerateMetadataClient } from '../tanstack-start';
import { FetchApiClient } from '../utils/api/fetch';

// Mock hono/vercel
vi.mock('hono/vercel', () => ({
  handle: vi.fn((app) => {
    // Return a mock handler function that simulates Vercel's edge function handler
    const handler = (req: Request) => {
      // Call the Hono app's fetch method with the request
      return app.fetch(req);
    };
    return handler;
  }),
}));

const validMetadataUpdateBody: webhooks['webhook']['post']['requestBody']['content']['application/json'] =
  {
    _type: 'metadata_update',
    metadata: {},
    metadataRevisionId: 'rev-123',
    path: '/test-path',
    site: { dsn: 'dsn-123', hostname: 'example.com' },
    timestamp: new Date().toISOString(),
  };

// Create a mock API client
const mockApiClient = {
  GET: vi.fn(),
};

// Mock the FetchApiClient
vi.mock('../utils/api/fetch', () => ({
  FetchApiClient: vi.fn().mockImplementation(() => ({
    metadataGetLatest: vi.fn((args) =>
      mockApiClient.GET('/v1/{dsn}/metadata/get-latest', args)
    ),
  })),
}));

// Mock the base URL export
vi.mock('../utils/api', () => ({
  baseUrl: 'https://www.generate-metadata.com/api/openapi',
}));

const mockApiResponse: MetadataApiResponse = {
  metadata: {
    appleTouchIcon: [
      {
        height: 180,
        mimeType: 'image/png',
        url: 'https://example.com/apple-touch-icon.png',
        width: 180,
      },
    ],
    description: 'Test page description',
    icon: [
      {
        height: 32,
        mimeType: 'image/png',
        url: 'https://example.com/icon.png',
        width: 32,
      },
    ],
    openGraph: {
      description: 'OG Test Description',
      image: {
        alt: 'OG Image Alt Text',
        height: 630,
        mimeType: 'image/jpeg',
        url: 'https://example.com/og-image.jpg',
        width: 1200,
      },
      images: [
        {
          alt: 'OG Image 1 Alt',
          height: 600,
          mimeType: 'image/jpeg',
          url: 'https://example.com/og-image-1.jpg',
          width: 800,
        },
      ],
      locale: 'en_US',
      siteName: 'Test Site',
      title: 'OG Test Title',
      type: 'website',
    },
    title: 'Test Page Title',
    twitter: {
      card: 'summary_large_image',
      description: 'Twitter Test Description',
      image: {
        alt: 'Twitter Image Alt',
        height: 630,
        mimeType: 'image/jpeg',
        url: 'https://example.com/twitter-image.jpg',
        width: 1200,
      },
      title: 'Twitter Test Title',
    },
  },
};

describe('GenerateMetadataClient (TanStack Start)', () => {
  let client: GenerateMetadataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GenerateMetadataClient({
      apiKey: 'test-api-key',
      dsn: 'test-dsn',
    });
  });

  const mockCtx = {
    match: {
      pathname: '/test',
    },
    matches: [{ pathname: '/test' }],
  };

  describe('getHead', () => {
    it('should return generated metadata when API call succeeds', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
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
            "content": "en_US",
            "property": "og:locale",
          },
          {
            "content": "Test Site",
            "property": "og:site_name",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "content": "website",
            "property": "og:type",
          },
          {
            "content": "Test Page Title",
            "name": "title",
          },
          {
            "title": "Test Page Title",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
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
            "content": "Twitter Test Title",
            "name": "twitter:title",
          },
        ]
      `);

      expect(result.links).toMatchInlineSnapshot(`
        [
          {
            "href": "https://example.com/apple-touch-icon.png",
            "rel": "apple-touch-icon",
            "sizes": "180x180",
            "type": "image/png",
          },
          {
            "href": "https://example.com/icon.png",
            "rel": "icon",
            "sizes": "32x32",
            "type": "image/png",
          },
        ]
      `);
    });

    it('should merge override head with generated metadata (override takes priority)', async () => {
      const mockApiResponseNoIcons: MetadataApiResponse = {
        metadata: {
          description: 'Test page description',
          openGraph: {
            description: 'OG Test Description',
            image: undefined,
            images: [],
            title: 'OG Test Title',
          },
          title: 'Test Page Title',
          twitter: {
            card: 'summary_large_image',
            description: 'Twitter Test Description',
            image: undefined,
            title: 'Twitter Test Title',
          },
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponseNoIcons,
        error: undefined,
      });

      const overrideHead = {
        links: [{ href: 'https://example.com/canonical', rel: 'canonical' }],
        meta: [
          { content: 'Override Title', name: 'title' }, // Should override generated
          { content: 'Override Custom Meta', name: 'custom' }, // Should be kept
        ],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        override: overrideHead,
        path: '/test',
      });

      // Override meta should take priority
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "title": "Test Page Title",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
          },
          {
            "content": "Twitter Test Description",
            "name": "twitter:description",
          },
          {
            "content": "Twitter Test Title",
            "name": "twitter:title",
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
          href: 'https://example.com/canonical',
          rel: 'canonical',
        },
      ]);
    });

    it('should handle fallback metadata when API call fails', async () => {
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error('API Error'));

      const fallbackHead = {
        meta: [{ content: 'Fallback Meta', name: 'fallback' }],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        path: '/test',
      });

      expect(result).toEqual(fallbackHead);
    });

    it('should merge override metadata with generated metadata', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const overrideHead = {
        meta: [{ content: 'Override Meta', name: 'custom' }],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        override: overrideHead,
        path: '/test',
      });

      // Should have both generated and override metadata
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
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
            "content": "en_US",
            "property": "og:locale",
          },
          {
            "content": "Test Site",
            "property": "og:site_name",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "content": "website",
            "property": "og:type",
          },
          {
            "content": "Test Page Title",
            "name": "title",
          },
          {
            "title": "Test Page Title",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
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
            "content": "Twitter Test Title",
            "name": "twitter:title",
          },
          {
            "content": "Override Meta",
            "name": "custom",
          },
        ]
      `);
    });

    it('should return fallback head when API call fails', async () => {
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error('API Error'));

      const fallbackHead = {
        meta: [{ content: 'Fallback Meta', name: 'fallback' }],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        path: '/test',
      });

      expect(result).toEqual(fallbackHead);
    });

    it('should return empty object when API fails and no fallback head provided', async () => {
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error('API Error'));

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result).toEqual({});
    });

    it('should use fallback, generated, and override in correct priority order', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const fallbackHead = {
        meta: [
          { content: 'Fallback Only', name: 'fallback-only' },
          { content: 'Fallback Title', name: 'title' },
        ],
      };

      const overrideHead = {
        meta: [
          { content: 'Override Only', name: 'override-only' },
          { content: 'Override Title', name: 'title' },
        ],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        override: overrideHead,
        path: '/test',
      });

      // Should have override title, generated description, fallback-only meta
      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "Fallback Only",
            "name": "fallback-only",
          },
          {
            "content": "Test page description",
            "name": "description",
          },
          {
            "content": "OG Test Description",
            "property": "og:description",
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
            "content": "en_US",
            "property": "og:locale",
          },
          {
            "content": "Test Site",
            "property": "og:site_name",
          },
          {
            "content": "OG Test Title",
            "property": "og:title",
          },
          {
            "content": "website",
            "property": "og:type",
          },
          {
            "title": "Test Page Title",
          },
          {
            "content": "summary_large_image",
            "name": "twitter:card",
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
            "content": "Twitter Test Title",
            "name": "twitter:title",
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

    it('should handle empty API response gracefully', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result).toEqual({});
    });

    it('should cache API responses', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      // First call
      await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });
      // Second call
      await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      // API should only be called once due to caching
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1);
    });

    it('should handle different paths separately in cache', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: {
          ...mockCtx,
          match: { pathname: '/test1' },
          matches: [{ pathname: '/test1' }],
        },
        path: '/test1',
      });
      await client.getHead({
        ctx: {
          ...mockCtx,
          match: { pathname: '/test2' },
          matches: [{ pathname: '/test2' }],
        },
        path: '/test2',
      });

      // API should be called twice for different paths
      expect(mockApiClient.GET).toHaveBeenCalledTimes(2);
    });

    it('should return empty metadata when DSN is undefined (development mode)', async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
      });

      const result = await devClient.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result).toEqual({});
      expect(mockApiClient.GET).not.toHaveBeenCalled();
    });

    it('should use fallback metadata when DSN is undefined', async () => {
      const devClient = new GenerateMetadataClient({
        dsn: undefined,
      });

      const fallbackHead = {
        meta: [
          { content: 'Development Title', name: 'title' },
          { content: 'Development Description', name: 'description' },
        ],
      };

      const result = await devClient.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        path: '/test',
      });

      expect(result).toEqual(fallbackHead);
      expect(mockApiClient.GET).not.toHaveBeenCalled();
    });

    it('should handle null values gracefully', async () => {
      const responseWithNulls: MetadataApiResponse = {
        metadata: {
          appleTouchIcon: undefined,
          description: undefined,
          icon: undefined,
          openGraph: {
            description: undefined,
            image: undefined,
            images: [],
            locale: undefined,
            siteName: undefined,
            title: undefined,
            type: undefined,
          },
          title: undefined,
          twitter: {
            card: undefined,
            description: undefined,
            image: undefined,
            title: undefined,
          },
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: responseWithNulls,
        error: undefined,
      });

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result).toEqual({});
    });

    it('should handle twitter and openGraph images without alt text', async () => {
      const responseWithoutAlt: MetadataApiResponse = {
        metadata: {
          description: undefined,
          openGraph: {
            description: undefined,
            image: {
              alt: undefined,
              height: 630,
              mimeType: 'image/jpeg',
              url: 'https://example.com/og-image.jpg',
              width: 1200,
            },
            images: [
              {
                alt: undefined,
                height: 600,
                mimeType: 'image/jpeg',
                url: 'https://example.com/og-image-1.jpg',
                width: 800,
              },
            ],
            title: undefined,
          },
          title: 'Test Title',
          twitter: {
            card: undefined,
            description: undefined,
            image: {
              alt: undefined,
              height: 630,
              mimeType: 'image/jpeg',
              url: 'https://example.com/twitter-image.jpg',
              width: 1200,
            },
            title: undefined,
          },
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: responseWithoutAlt,
        error: undefined,
      });

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result.meta).toMatchInlineSnapshot(`
        [
          {
            "content": "https://example.com/og-image.jpg",
            "property": "og:image",
          },
          {
            "content": "https://example.com/og-image-1.jpg",
            "property": "og:image",
          },
          {
            "content": "Test Title",
            "name": "title",
          },
          {
            "title": "Test Title",
          },
          {
            "content": "https://example.com/twitter-image.jpg",
            "name": "twitter:image",
          },
        ]
      `);
    });

    it('should handle meta without name property', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const fallbackHead = {
        meta: [
          { content: 'Property Title', property: 'og:title' },
          { title: 'Title Tag' },
          { 'data-custom': 'custom-value' },
        ],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        path: '/test',
      });

      // Non-name meta should be preserved as is
      expect(result.meta).toEqual([
        { content: 'Property Title', property: 'og:title' },
        { title: 'Title Tag' },
        { 'data-custom': 'custom-value' },
      ]);
    });

    it('should handle empty meta map and nonNameMeta', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const fallbackHead = {
        meta: [],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        path: '/test',
      });

      // Result should not have meta property if no meta items
      expect(result.meta).toBeUndefined();
    });

    it('should include apiKey as bearer token when provided', async () => {
      const testClient = new GenerateMetadataClient({
        apiKey: 'test-api-key',
        dsn: 'test-dsn',
      });

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await testClient.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test' },
          },
        }
      );
    });

    it('should not include authorization header when apiKey is not provided', async () => {
      const clientWithoutApiKey = new GenerateMetadataClient({
        apiKey: undefined,
        dsn: 'test-dsn',
      });

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await clientWithoutApiKey.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test' },
          },
        }
      );
    });

    it('should handle custom meta tags', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: [
            {
              content: 'John Doe',
              name: 'author',
            },
            {
              content: 'test,metadata,seo',
              name: 'keywords',
            },
          ],
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "meta": [
            {
              "content": "John Doe",
              "name": "author",
            },
            {
              "content": "test,metadata,seo",
              "name": "keywords",
            },
            {
              "content": "Test Title",
              "name": "title",
            },
            {
              "title": "Test Title",
            },
          ],
        }
      `);
    });

    it('should handle noindex metadata', async () => {
      const noindexApiResponse: MetadataApiResponse = {
        metadata: {
          noindex: true,
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: noindexApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "meta": [
            {
              "content": "noindex,nofollow",
              "name": "robots",
            },
            {
              "content": "Test Title",
              "name": "title",
            },
            {
              "title": "Test Title",
            },
          ],
        }
      `);
    });

    it('should handle empty customTags array', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: [],
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const result = await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(result).toEqual({
        meta: [
          { content: 'Test Title', name: 'title' },
          { title: 'Test Title' },
        ],
      });
    });
  });

  describe('path inference from context', () => {
    it('should use last match from matches array when path is not defined', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/should-not-use-this',
        },
        matches: [
          { pathname: '/root' },
          { pathname: '/products' },
          { pathname: '/products/123' },
        ],
      };

      const result = await client.getHead({
        // path is not defined, should use last match from matches array
        ctx: customCtx,
      });

      // Verify it used the last match pathname
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/products/123' }, // Should use last match
          },
        }
      );

      expect(result.meta).toBeDefined();
    });

    it('should fall back to match.pathname when matches array is empty and path is not defined', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/fallback-path',
        },
        matches: [], // Empty matches array
      };

      const result = await client.getHead({
        // path is not defined, should use match.pathname as fallback
        ctx: customCtx,
      });

      // Verify it used match.pathname as fallback
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/fallback-path' }, // Should use match.pathname
          },
        }
      );

      expect(result.meta).toBeDefined();
    });

    it('should prioritize explicit path over matches array', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/match-path',
        },
        matches: [
          { pathname: '/root' },
          { pathname: '/products' },
          { pathname: '/products/456' },
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
        path: '/explicit-path', // Explicitly defined path
      });

      // Verify it used the explicit path
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/explicit-path' }, // Should use explicit path
          },
        }
      );

      expect(result.meta).toBeDefined();
    });

    it('should handle nested route matches correctly', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/admin',
        },
        matches: [
          { pathname: '/' },
          { pathname: '/admin' },
          { pathname: '/admin/users' },
          { pathname: '/admin/users/123' },
          { pathname: '/admin/users/123/edit' },
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should use the last (most specific) match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/admin/users/123/edit' },
          },
        }
      );

      expect(result.meta).toBeDefined();
    });

    it('should normalize paths from matches array', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/test/',
        },
        matches: [
          { pathname: '/root/' },
          { pathname: 'products/' }, // Missing leading slash
          { pathname: '/items//' }, // Double slashes
          { pathname: 'final/path/' }, // Missing leading slash and trailing slash
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should normalize the last match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/final/path' }, // Normalized
          },
        }
      );

      expect(result.meta).toBeDefined();
    });

    it('should handle single match in matches array', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/different',
        },
        matches: [
          { pathname: '/single-match' }, // Only one match
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should use the single match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/single-match' },
          },
        }
      );

      expect(result.meta).toBeDefined();
    });

    it('should handle undefined matches array', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/only-match-path',
        },
        matches: undefined as any, // Matches might be undefined
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should fallback to match.pathname
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/only-match-path' },
          },
        }
      );

      expect(result.meta).toBeDefined();
    });

    it('should handle matches with query strings and hashes', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const customCtx = {
        match: {
          pathname: '/test',
        },
        matches: [
          { pathname: '/root' },
          { pathname: '/products?category=electronics' }, // With query string
          { pathname: '/items#section' }, // With hash
          { pathname: '/final?query=test#hash' }, // With both
        ],
      };

      const result = await client.getHead({
        ctx: customCtx,
      });

      // Should normalize and strip query/hash from the last match
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/final' }, // Normalized without query and hash
          },
        }
      );

      expect(result.meta).toBeDefined();
    });
  });

  describe('getRootHead', () => {
    it('should return empty head metadata when no factory provided', async () => {
      const rootHeadFn = client.getRootHead();
      const result = await rootHeadFn({});

      expect(result).toEqual({});
    });

    it('should return empty head metadata when factory returns empty object', async () => {
      const rootHeadFn = client.getRootHead(() => ({}));
      const result = await rootHeadFn({});

      expect(result).toEqual({});
    });

    it('should return fallback metadata when provided', async () => {
      const fallbackHead = {
        meta: [
          { content: 'Root Fallback Title', name: 'title' },
          { content: 'Root Fallback Description', name: 'description' },
        ],
      };

      const rootHeadFn = client.getRootHead(() => ({
        fallback: fallbackHead,
      }));
      const result = await rootHeadFn({});

      expect(result).toEqual(fallbackHead);
    });

    it('should merge override metadata properly', async () => {
      const fallbackHead = {
        meta: [
          { content: 'Root Fallback Title', name: 'title' },
          { content: 'Root Fallback Description', name: 'description' },
        ],
      };

      const overrideHead = {
        links: [{ href: 'https://example.com/root', rel: 'canonical' }],
        meta: [
          { content: 'Root Override Title', name: 'title' },
          { content: 'root,override', name: 'keywords' },
        ],
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
        { href: 'https://example.com/root', rel: 'canonical' },
      ]);
    });

    it('should handle async factory functions', async () => {
      const asyncFactory = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          fallback: {
            meta: [
              { content: 'Async Root Title', name: 'title' },
              { content: 'Async Root Description', name: 'description' },
            ],
          },
        };
      };

      const rootHeadFn = client.getRootHead(asyncFactory);
      const result = await rootHeadFn({});

      expect(result).toEqual({
        meta: [
          { content: 'Async Root Title', name: 'title' },
          { content: 'Async Root Description', name: 'description' },
        ],
      });
    });

    it('should pass context to factory function', async () => {
      const mockFactory = vi.fn().mockReturnValue({
        fallback: { meta: [{ content: 'Test Title', name: 'title' }] },
      });
      const mockContext = { test: 'context' };

      const rootHeadFn = client.getRootHead(mockFactory);
      await rootHeadFn(mockContext);

      expect(mockFactory).toHaveBeenCalledWith(mockContext);
    });

    it('should handle meta deduplication with priority: override > generated > fallback', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: {
          metadata: {
            description: 'Generated Description',
            openGraph: {
              description: undefined,
              image: undefined,
              images: [],
              title: undefined,
            },
            title: 'Generated Title',
            twitter: {
              card: undefined,
              description: undefined,
              image: undefined,
              title: undefined,
            },
          },
        },
        error: undefined,
      });

      const fallbackHead = {
        meta: [
          { content: 'Fallback Title', name: 'title' },
          { content: 'Fallback Description', name: 'description' },
          { content: 'Fallback Author', name: 'author' },
        ],
      };

      const overrideHead = {
        meta: [
          { content: 'Override Title', name: 'title' },
          { content: 'override,test', name: 'keywords' },
        ],
      };

      const result = await client.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        override: overrideHead,
        path: '/test',
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
            "content": "Generated Description",
            "name": "description",
          },
          {
            "title": "Generated Title",
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

  describe('triggerRevalidation', () => {
    it('should clear cache for specific path', async () => {
      // First, populate the cache
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      // Clear mocks to verify cache behavior
      vi.clearAllMocks();

      // Call clearCache (which is what revalidateWebhookHandler calls)
      (client as any).clearCache('/test');

      // Verify cache was cleared by fetching again
      await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1); // Should fetch again since cache was cleared
    });

    it('should clear entire cache when path is null', async () => {
      // Populate cache with multiple paths
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: {
          ...mockCtx,
          match: { pathname: '/test1' },
          matches: [{ pathname: '/test1' }],
        },
        path: '/test1',
      });
      await client.getHead({
        ctx: {
          ...mockCtx,
          match: { pathname: '/test2' },
          matches: [{ pathname: '/test2' }],
        },
        path: '/test2',
      });

      // Clear mocks
      vi.clearAllMocks();

      // Call clearCache with null (which is what revalidateWebhookHandler calls)
      (client as any).clearCache(null);

      // Both paths should fetch again
      await client.getHead({
        ctx: {
          ...mockCtx,
          match: { pathname: '/test1' },
          matches: [{ pathname: '/test1' }],
        },
        path: '/test1',
      });
      await client.getHead({
        ctx: {
          ...mockCtx,
          match: { pathname: '/test2' },
          matches: [{ pathname: '/test2' }],
        },
        path: '/test2',
      });

      expect(mockApiClient.GET).toHaveBeenCalledTimes(2); // Both should fetch again
    });
  });

  describe('path normalization', () => {
    it('should normalize paths with trailing slashes', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: '/test/' } },
        path: '/test/',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test' }, // Normalized without trailing slash
          },
        }
      );
    });

    it('should normalize paths without leading slashes', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: 'test' } },
        path: 'test',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test' }, // Normalized with leading slash
          },
        }
      );
    });

    it('should normalize paths with both missing leading and trailing slashes', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: 'test/page/' } },
        path: 'test/page/',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test/page' }, // Normalized with leading slash, without trailing
          },
        }
      );
    });

    it('should handle root path correctly', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: '/' } },
        path: '/',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/' }, // Root path remains as "/"
          },
        }
      );
    });

    it('should normalize paths with query strings', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: '/test?query=param' } },
        path: '/test?query=param',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test' }, // Query string removed
          },
        }
      );
    });

    it('should normalize paths with hash fragments', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: '/test#section' } },
        path: '/test#section',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test' }, // Hash fragment removed
          },
        }
      );
    });

    it('should normalize paths with multiple trailing slashes', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: '/test/page///' } },
        path: '/test/page///',
      });

      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test/page' }, // All trailing slashes removed correctly
          },
        }
      );
    });

    it('should cache using normalized paths', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      // First call
      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: '/test/' } },
        path: '/test/',
      });
      // Second call with different format but same normalized path
      await client.getHead({
        ctx: { ...mockCtx, match: { pathname: 'test' } },
        path: 'test',
      });
      // Third call with normalized format
      await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      // API should only be called once due to cache normalization
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1);
    });

    it('should normalize path in clearCache', async () => {
      // First populate cache with different path formats
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      // Clear cache with unnormalized path
      (client as any).clearCache('/test/');

      // Verify cache was cleared by fetching again
      await client.getHead({
        ctx: mockCtx,
        path: '/test',
      });
      expect(mockApiClient.GET).toHaveBeenCalledTimes(2); // Should fetch again since cache was cleared
    });

    it('should normalize path in webhook handler', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      // Test with trailing slash
      const mockRequest1 = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: '/test/',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await handlers.POST({ request: mockRequest1 });
      expect(clearCacheSpy).toHaveBeenCalledWith('/test');
      expect(revalidateSpy).toHaveBeenCalledWith('/test');

      // Test without leading slash
      const mockRequest2 = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: 'test',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await handlers.POST({ request: mockRequest2 });
      expect(clearCacheSpy).toHaveBeenCalledWith('/test');
      expect(revalidateSpy).toHaveBeenCalledWith('/test');

      revalidateSpy.mockRestore();
    });

    it('should normalize path before applying pathRewrite', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => (path === '/old' ? '/new' : path));

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: 'old/', // Unnormalized path
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await handlers.POST({ request: mockRequest });

      // pathRewrite should receive normalized path
      expect(pathRewriteSpy).toHaveBeenCalledWith('/old');
      expect(clearCacheSpy).toHaveBeenCalledWith('/new');
      expect(revalidateSpy).toHaveBeenCalledWith('/new');

      revalidateSpy.mockRestore();
    });
  });

  describe('pathRewrite normalization', () => {
    it('should normalize the result of pathRewrite', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return unnormalized path
        return path === '/old' ? '/new/path/' : path;
      });

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: '/old',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await handlers.POST({ request: mockRequest });

      // pathRewrite returns "/new/path/" but it should be normalized to "/new/path"
      expect(pathRewriteSpy).toHaveBeenCalledWith('/old');
      expect(clearCacheSpy).toHaveBeenCalledWith('/new/path'); // Normalized
      expect(revalidateSpy).toHaveBeenCalledWith('/new/path'); // Normalized

      revalidateSpy.mockRestore();
    });

    it('should handle pathRewrite returning null (falls back to original path)', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return null for certain paths
        return path === '/skip' ? null : path;
      });

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: '/skip',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await handlers.POST({ request: mockRequest });

      expect(pathRewriteSpy).toHaveBeenCalledWith('/skip');
      // When pathRewrite returns null, it falls back to the original normalized path
      expect(clearCacheSpy).toHaveBeenCalledWith('/skip');
      expect(revalidateSpy).toHaveBeenCalledWith('/skip');

      revalidateSpy.mockRestore();
    });

    it('should normalize pathRewrite result with multiple trailing slashes', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return path with multiple trailing slashes
        return path === '/test' ? '/rewritten///' : path;
      });

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: '/test',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await handlers.POST({ request: mockRequest });

      expect(pathRewriteSpy).toHaveBeenCalledWith('/test');
      expect(clearCacheSpy).toHaveBeenCalledWith('/rewritten'); // All trailing slashes removed
      expect(revalidateSpy).toHaveBeenCalledWith('/rewritten');

      revalidateSpy.mockRestore();
    });

    it('should handle pathRewrite returning path without leading slash', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});
      const pathRewriteSpy = vi.fn((path) => {
        // Return path without leading slash
        return path === '/test' ? 'rewritten/path' : path;
      });

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          pathRewrite: pathRewriteSpy,
        },
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: '/test',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await handlers.POST({ request: mockRequest });

      expect(pathRewriteSpy).toHaveBeenCalledWith('/test');
      expect(clearCacheSpy).toHaveBeenCalledWith('/rewritten/path'); // Leading slash added
      expect(revalidateSpy).toHaveBeenCalledWith('/rewritten/path');

      revalidateSpy.mockRestore();
    });
  });

  describe('revalidateWebhookHandler', () => {
    it('should return route handlers object', () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
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

    it('should handle POST /revalidate request', async () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      // Mock request for webhook
      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/revalidate',
        {
          body: JSON.stringify(validMetadataUpdateBody),
          headers: {
            authorization: 'Bearer test-secret',
            'content-type': 'application/json',
          },
          method: 'POST',
        }
      );

      // Spy on the triggerRevalidation method
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});

      const response = await handlers.POST({ request: mockRequest });
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        metadata: {
          path: '/test-path',
          revalidated: true,
        },
        ok: true,
      });
      expect(revalidateSpy).toHaveBeenCalledWith('/test-path');

      revalidateSpy.mockRestore();
    });

    it('should reject request with invalid auth', async () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/revalidate',
        {
          body: JSON.stringify({ path: '/test-path' }),
          headers: {
            authorization: 'Bearer wrong-secret',
            'content-type': 'application/json',
          },
          method: 'POST',
        }
      );

      const response = await handlers.POST({ request: mockRequest });

      expect(response.status).toBe(401);
      // Our custom auth middleware returns JSON for unauthorized
      const responseData = await response.json();
      expect(responseData).toEqual({ error: 'Unauthorized', ok: false });
    });

    it('should handle request with null path', async () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/revalidate',
        {
          body: JSON.stringify({ ...validMetadataUpdateBody, path: null }),
          headers: {
            authorization: 'Bearer test-secret',
            'content-type': 'application/json',
          },
          method: 'POST',
        }
      );

      // Spy on the triggerRevalidation method
      const revalidateSpy = vi
        .spyOn(client as any, 'triggerRevalidation')
        .mockImplementation(() => {});

      const response = await handlers.POST({ request: mockRequest });
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        metadata: {
          path: null,
          revalidated: true,
        },
        ok: true,
      });
      expect(revalidateSpy).toHaveBeenCalledWith(null);

      revalidateSpy.mockRestore();
    });

    it('should use custom revalidatePath function when provided', async () => {
      const customRevalidatePath = vi.fn();

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          pathRewrite: customRevalidatePath,
        },
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/revalidate',
        {
          body: JSON.stringify(validMetadataUpdateBody),
          headers: {
            authorization: 'Bearer test-secret',
            'content-type': 'application/json',
          },
          method: 'POST',
        }
      );

      const response = await handlers.POST({ request: mockRequest });

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith('/test-path');
    });

    it('should use custom revalidatePath function with null path', async () => {
      const customRevalidatePath = vi.fn();

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          pathRewrite: customRevalidatePath,
        },
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/revalidate',
        {
          body: JSON.stringify({ ...validMetadataUpdateBody, path: null }),
          headers: {
            authorization: 'Bearer test-secret',
            'content-type': 'application/json',
          },
          method: 'POST',
        }
      );

      const response = await handlers.POST({ request: mockRequest });

      expect(response.status).toBe(200);
      expect(customRevalidatePath).toHaveBeenCalledWith(null);
    });

    it('should work with GET requests', async () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/webhook',
        {
          method: 'GET',
        }
      );

      // GET handler expects a context object with request property
      const response = await handlers.GET({ request: mockRequest });

      // GET should work (might return 405 or other response based on Hono setup)
      expect(response).toBeDefined();
    });

    it('should use hono/vercel handle function', async () => {
      // Import the mocked handle function
      const { handle } = await import('hono/vercel');

      client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      // Verify that handle was called
      expect(handle).toHaveBeenCalled();
    });
  });

  describe('serverFn functionality', () => {
    it('should use TanstackStartApiClient when serverFn is provided', async () => {
      const mockServerFn = vi.fn().mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      }) as any;

      const clientWithServerFn = new GenerateMetadataClient({
        apiKey: 'test-api-key',
        dsn: 'test-dsn',
        serverFn: mockServerFn,
      });

      const result = await clientWithServerFn.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      // Should call the serverFn with correct data structure
      expect(mockServerFn).toHaveBeenCalledWith({
        data: {
          args: expect.objectContaining({
            headers: {
              Authorization: 'Bearer test-api-key',
            },
            params: {
              path: { dsn: 'test-dsn' },
              query: { path: '/test' },
            },
          }),
          type: 'metadataGetLatest',
        },
      });

      expect(result.meta).toBeDefined();
    });

    it('should use FetchApiClient when serverFn is not provided', async () => {
      const clientWithoutServerFn = new GenerateMetadataClient({
        apiKey: 'test-api-key',
        dsn: 'test-dsn',
        // No serverFn provided
      });

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const result = await clientWithoutServerFn.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      // Should use the mocked FetchApiClient
      expect(mockApiClient.GET).toHaveBeenCalled();
      expect(result.meta).toBeDefined();
    });

    it('should pass apiKey to serverFn through TanstackStartApiClient', async () => {
      const mockServerFn = vi.fn().mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      }) as any;

      const clientWithServerFn = new GenerateMetadataClient({
        apiKey: 'custom-api-key',
        dsn: 'test-dsn',
        serverFn: mockServerFn,
      });

      await clientWithServerFn.getHead({
        ctx: mockCtx,
        path: '/test',
      });

      expect(mockServerFn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          args: expect.objectContaining({
            headers: {
              Authorization: 'Bearer custom-api-key',
            },
          }),
        }),
      });
    });

    it('should handle serverFn errors gracefully', async () => {
      const mockServerFn = vi
        .fn()
        .mockRejectedValue(new Error('ServerFn Error')) as any;

      const clientWithServerFn = new GenerateMetadataClient({
        apiKey: 'test-api-key',
        dsn: 'test-dsn',
        serverFn: mockServerFn,
      });

      const fallbackHead = {
        meta: [{ content: 'Fallback Meta', name: 'fallback' }],
      };

      const result = await clientWithServerFn.getHead({
        ctx: mockCtx,
        fallback: fallbackHead,
        path: '/test',
      });

      expect(result).toEqual(fallbackHead);
      expect(mockServerFn).toHaveBeenCalled();
    });
  });

  describe('serverFnHandler static method', () => {
    it('should handle metadataGetLatest type correctly', async () => {
      // Mock the FetchApiClient for serverFnHandler
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any
      );

      const ctx = {
        data: {
          args: {
            params: {
              path: { dsn: 'test-dsn' },
              query: { path: '/test' },
            },
          },
          type: 'metadataGetLatest' as const,
        },
      };

      const result = await GenerateMetadataClient.serverFnHandler(ctx as any, {
        apiKey: 'test-api-key',
      });

      expect(result).toEqual({
        data: mockApiResponse,
        error: undefined,
      });

      expect(mockFetchApiClient.metadataGetLatest).toHaveBeenCalledWith({
        headers: {
          Authorization: 'Bearer test-api-key',
        },
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test' },
        },
      });
    });

    it('should throw error for unknown type', async () => {
      const ctx = {
        data: {
          args: {},
          type: 'unknownType' as any,
        },
      };

      await expect(
        GenerateMetadataClient.serverFnHandler(ctx as any, {
          apiKey: 'test-api-key',
        })
      ).rejects.toThrow(
        'generate metadata server function called with unknown type unknownType'
      );
    });

    it('should merge headers correctly in serverFnHandler', async () => {
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any
      );

      const ctx = {
        data: {
          args: {
            headers: {
              'X-Custom-Header': 'custom-value',
            },
            params: {
              path: { dsn: 'test-dsn' },
              query: { path: '/test' },
            },
          },
          type: 'metadataGetLatest' as const,
        },
      };

      await GenerateMetadataClient.serverFnHandler(ctx as any, {
        apiKey: 'test-api-key',
      });

      expect(mockFetchApiClient.metadataGetLatest).toHaveBeenCalledWith({
        headers: {
          Authorization: 'Bearer test-api-key',
          'X-Custom-Header': 'custom-value',
        },
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test' },
        },
      });
    });

    it('should handle serverFnHandler without apiKey', async () => {
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any
      );

      const ctx = {
        data: {
          args: {
            params: {
              path: { dsn: 'test-dsn' },
              query: { path: '/test' },
            },
          },
          type: 'metadataGetLatest' as const,
        },
      };

      await GenerateMetadataClient.serverFnHandler(ctx as any, { apiKey: '' });

      expect(mockFetchApiClient.metadataGetLatest).toHaveBeenCalledWith({
        headers: {
          Authorization: 'Bearer ',
        },
        params: {
          path: { dsn: 'test-dsn' },
          query: { path: '/test' },
        },
      });
    });

    it('should omit response from serverFnHandler result', async () => {
      const mockFetchApiClient = {
        metadataGetLatest: vi.fn().mockResolvedValue({
          data: mockApiResponse,
          error: undefined,
          response: new Response(),
        }),
      };

      vi.mocked(FetchApiClient).mockImplementation(
        () => mockFetchApiClient as any
      );

      const ctx = {
        data: {
          args: {
            params: {
              path: { dsn: 'test-dsn' },
              query: { path: '/test' },
            },
          },
          type: 'metadataGetLatest' as const,
        },
      };

      const result = await GenerateMetadataClient.serverFnHandler(ctx as any, {
        apiKey: 'test-api-key',
      });

      // Result should not have the response property
      expect(result).not.toHaveProperty('response');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('serverFnValidator', () => {
    it('should validate metadataGetLatest type', () => {
      const validData = {
        args: {
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/test' },
          },
        },
        type: 'metadataGetLatest',
      };

      // Should not throw
      expect(() =>
        GenerateMetadataClient.serverFnValidator(validData)
      ).not.toThrow();
    });

    it('should validate placeholder type', () => {
      const validData = {
        type: 'placeholder',
      };

      // Should not throw
      expect(() =>
        GenerateMetadataClient.serverFnValidator(validData)
      ).not.toThrow();
    });

    it('should reject invalid type', () => {
      const invalidData = {
        args: {},
        type: 'invalid',
      };

      expect(() =>
        GenerateMetadataClient.serverFnValidator(invalidData)
      ).toThrow();
    });

    it('should reject missing type', () => {
      const invalidData = {
        args: {},
      };

      expect(() =>
        GenerateMetadataClient.serverFnValidator(invalidData)
      ).toThrow();
    });
  });
});
