import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetadataApiResponse } from '../index';
import { GenerateMetadataClient } from '../next';

// Create a mock API client
const mockApiClient = {
  GET: vi.fn(),
};

// Mock the API module
vi.mock('../utils/api', () => ({
  getApi: vi.fn(() => mockApiClient),
}));

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock hono/vercel
vi.mock('hono/vercel', () => ({
  handle: vi.fn((app) => {
    // Return a mock handler that simulates the Hono app behavior
    return (req: any) => {
      // Simulate calling the Hono app
      return app.fetch(req);
    };
  }),
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

describe('GenerateMetadataClient (Next.js)', () => {
  let client: GenerateMetadataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GenerateMetadataClient({
      apiKey: 'test-api-key',
      dsn: 'test-dsn',
    });
  });

  describe('getMetadata', () => {
    it('should return Next.js metadata when API call succeeds', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toMatchInlineSnapshot(`
        {
          "description": "Test page description",
          "icons": [
            {
              "rel": "apple-touch-icon",
              "sizes": "180x180",
              "type": "image/png",
              "url": "https://example.com/apple-touch-icon.png",
            },
            {
              "rel": "icon",
              "sizes": "32x32",
              "type": "image/png",
              "url": "https://example.com/icon.png",
            },
          ],
          "openGraph": {
            "description": "OG Test Description",
            "images": [
              {
                "alt": "OG Image 1 Alt",
                "height": 600,
                "url": "https://example.com/og-image-1.jpg",
                "width": 800,
              },
            ],
            "locale": "en_US",
            "siteName": "Test Site",
            "title": "OG Test Title",
            "type": "website",
          },
          "title": "Test Page Title",
          "twitter": {
            "card": "summary_large_image",
            "description": "Twitter Test Description",
            "images": [
              {
                "alt": "Twitter Image Alt",
                "height": 630,
                "url": "https://example.com/twitter-image.jpg",
                "width": 1200,
              },
            ],
            "title": "Twitter Test Title",
          },
        }
      `);
    });

    it('should work with extra keys', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: {
          ...mockApiResponse,
          metadata: {
            ...mockApiResponse.metadata,
            openGraph: {
              ...mockApiResponse.metadata.openGraph,
              extraKey: 'extraValue',
            },
          },
        },
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toMatchInlineSnapshot(`
        {
          "description": "Test page description",
          "icons": [
            {
              "rel": "apple-touch-icon",
              "sizes": "180x180",
              "type": "image/png",
              "url": "https://example.com/apple-touch-icon.png",
            },
            {
              "rel": "icon",
              "sizes": "32x32",
              "type": "image/png",
              "url": "https://example.com/icon.png",
            },
          ],
          "openGraph": {
            "description": "OG Test Description",
            "images": [
              {
                "alt": "OG Image 1 Alt",
                "height": 600,
                "url": "https://example.com/og-image-1.jpg",
                "width": 800,
              },
            ],
            "locale": "en_US",
            "siteName": "Test Site",
            "title": "OG Test Title",
            "type": "website",
          },
          "title": "Test Page Title",
          "twitter": {
            "card": "summary_large_image",
            "description": "Twitter Test Description",
            "images": [
              {
                "alt": "Twitter Image Alt",
                "height": 630,
                "url": "https://example.com/twitter-image.jpg",
                "width": 1200,
              },
            ],
            "title": "Twitter Test Title",
          },
        }
      `);
    });

    it('should handle function-based options', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const optsFn = vi.fn().mockResolvedValue({ path: '/dynamic-test' });
      const metadataFn = client.getMetadata(optsFn);

      await metadataFn({}, {} as any);

      expect(optsFn).toHaveBeenCalled();
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/dynamic-test' },
          },
        }
      );
    });

    it('should return empty object when API call fails', async () => {
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error('API Error'));

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it('should return empty object when API returns null data', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it('should return empty object when metadata is null', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: null },
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it('should handle partial metadata gracefully', async () => {
      const partialApiResponse: MetadataApiResponse = {
        metadata: {
          description: undefined,
          openGraph: {
            description: undefined,
            image: undefined,
            images: [],
            title: 'OG Title Only',
          },
          title: 'Only Title',
          twitter: {
            card: undefined,
            description: undefined,
            image: undefined,
            title: undefined,
          },
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: partialApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        description: undefined,
        openGraph: {
          description: undefined,
          images: [],
          title: 'OG Title Only',
        },
        title: 'Only Title',
        twitter: {
          description: undefined,
          title: undefined,
        },
      });
    });

    it('should cache API responses', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));

      // First call
      await metadataFn({}, {} as any);
      // Second call
      await metadataFn({}, {} as any);

      // API should only be called once due to caching
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1);
    });

    it('should handle different paths separately in cache', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn1 = client.getMetadata(() => ({ path: '/test1' }));
      const metadataFn2 = client.getMetadata(() => ({ path: '/test2' }));

      await metadataFn1({}, {} as any);
      await metadataFn2({}, {} as any);

      // API should be called twice for different paths
      expect(mockApiClient.GET).toHaveBeenCalledTimes(2);
    });

    it('should handle async function-based options', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const asyncOptsFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { path: '/async-test' };
      };

      const metadataFn = client.getMetadata(asyncOptsFn);
      const result = await metadataFn({}, {} as any);

      expect(result.title).toBe('Test Page Title');
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: '/async-test' },
          },
        }
      );
    });

    it('should use fallback metadata when API call fails', async () => {
      vi.mocked(mockApiClient.GET).mockRejectedValue(new Error('API Error'));

      const fallbackMetadata = {
        description: 'Fallback Description',
        title: 'Fallback Title',
      };

      const metadataFn = client.getMetadata(() => ({
        fallback: fallbackMetadata,
        path: '/test',
      }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual(fallbackMetadata);
    });

    it('should merge override metadata with generated metadata', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const overrideMetadata = {
        keywords: ['override', 'test'],
        title: 'Override Title',
      };

      const metadataFn = client.getMetadata(() => ({
        override: overrideMetadata,
        path: '/test',
      }));
      const result = await metadataFn({}, {} as any);

      expect(result.title).toBe('Override Title');
      expect(result.keywords).toEqual(['override', 'test']);
      expect(result.description).toBe('Test page description');
    });

    it('should use fallback, generated, and override in correct priority order', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const fallbackMetadata = {
        description: 'Fallback Description',
        keywords: ['fallback'],
        title: 'Fallback Title',
      };

      const overrideMetadata = {
        robots: 'noindex',
        title: 'Override Title',
      };

      const metadataFn = client.getMetadata(() => ({
        fallback: fallbackMetadata,
        override: overrideMetadata,
        path: '/test',
      }));
      const result = await metadataFn({}, {} as any);

      expect(result.title).toBe('Override Title');
      expect(result.description).toBe('Test page description');
      expect(result.keywords).toEqual(['fallback']);
      expect(result.robots).toBe('noindex');
    });

    it('should return empty metadata when DSN is undefined (development mode)', async () => {
      const devClient = new GenerateMetadataClient({
        apiKey: 'test-api-key',
        dsn: undefined,
      });

      const metadataFn = devClient.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({});
      expect(mockApiClient.GET).not.toHaveBeenCalled();
    });

    it('should use fallback metadata when DSN is undefined', async () => {
      const devClient = new GenerateMetadataClient({
        apiKey: 'test-api-key',
        dsn: undefined,
      });

      const fallbackMetadata = {
        description: 'Development Description',
        title: 'Development Title',
      };

      const metadataFn = devClient.getMetadata(() => ({
        fallback: fallbackMetadata,
        path: '/test',
      }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual(fallbackMetadata);
      expect(mockApiClient.GET).not.toHaveBeenCalled();
    });

    it('should handle icons that are not arrays', async () => {
      const responseWithBadIcons: MetadataApiResponse = {
        metadata: {
          appleTouchIcon: undefined,
          description: undefined,
          icon: undefined,
          openGraph: {
            description: undefined,
            image: undefined,
            images: [],
            title: undefined,
          },
          title: 'Test Title',
          twitter: {
            card: undefined,
            description: undefined,
            image: undefined,
            title: undefined,
          },
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: responseWithBadIcons,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        description: undefined,
        icons: [],
        openGraph: {
          description: undefined,
          images: [],
          title: undefined,
        },
        title: 'Test Title',
        twitter: {
          description: undefined,
          title: undefined,
        },
      });
    });

    it('should handle twitter card without value', async () => {
      const responseWithoutCard: MetadataApiResponse = {
        metadata: {
          description: undefined,
          openGraph: {
            description: undefined,
            image: undefined,
            images: [],
            title: undefined,
          },
          title: 'Test Title',
          twitter: {
            card: undefined,
            description: 'Twitter Description',
            image: undefined,
            title: 'Twitter Title',
          },
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: responseWithoutCard,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result.twitter).toEqual({
        description: 'Twitter Description',
        title: 'Twitter Title',
      });
    });

    it('should handle openGraph images without alt text', async () => {
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

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result.openGraph?.images).toEqual([
        {
          alt: undefined,
          height: 600,
          url: 'https://example.com/og-image-1.jpg',
          width: 800,
        },
      ]);

      expect(result.twitter?.images).toEqual([
        {
          alt: undefined,
          height: 630,
          url: 'https://example.com/twitter-image.jpg',
          width: 1200,
        },
      ]);
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

      const metadataFn = testClient.getMetadata(() => ({ path: '/test' }));
      await metadataFn({}, {} as any);

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

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        other: {
          author: 'John Doe',
          keywords: 'test,metadata,seo',
        },
        title: 'Test Title',
      });
    });

    it('should handle custom meta tags with property-like names', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: [
            {
              content: '123456789',
              name: 'fb:app_id',
            },
            {
              content: 'Jane Smith',
              name: 'article:author',
            },
          ],
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        other: {
          'article:author': 'Jane Smith',
          'fb:app_id': '123456789',
        },
        title: 'Test Title',
      });
    });

    it('should handle custom meta tags with http-equiv-like names', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: [
            {
              content: '30',
              name: 'refresh',
            },
            {
              content: "default-src 'self'",
              name: 'content-security-policy',
            },
          ],
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        other: {
          'content-security-policy': "default-src 'self'",
          refresh: '30',
        },
        title: 'Test Title',
      });
    });

    it('should handle custom meta tags with charset name', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: [
            {
              content: 'utf-8',
              name: 'charset',
            },
          ],
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        other: {
          charset: 'utf-8',
        },
        title: 'Test Title',
      });
    });

    it('should handle custom meta tags with various names', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: [
            {
              content: 'Test Article',
              name: 'name',
            },
            {
              content: 'A test article description',
              name: 'description',
            },
          ],
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        other: {
          description: 'A test article description',
          name: 'Test Article',
        },
        title: 'Test Title',
      });
    });

    it('should handle mixed custom meta tags', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: [
            {
              content: 'John Doe',
              name: 'author',
            },
            {
              content: '123456789',
              name: 'fb:app_id',
            },
            {
              content: '30',
              name: 'refresh',
            },
            {
              content: '$29.99',
              name: 'price',
            },
          ],
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        other: {
          author: 'John Doe',
          'fb:app_id': '123456789',
          price: '$29.99',
          refresh: '30',
        },
        title: 'Test Title',
      });
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

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        title: 'Test Title',
      });
    });

    it('should handle undefined customTags', async () => {
      const customTagsApiResponse: MetadataApiResponse = {
        metadata: {
          customTags: undefined,
          title: 'Test Title',
        },
      };

      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: customTagsApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      const result = await metadataFn({}, {} as any);

      expect(result).toEqual({
        title: 'Test Title',
      });
    });
  });

  describe('getRootMetadata', () => {
    it('should return empty metadata when no factory provided', async () => {
      // Mock API to return null for root metadata
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: {} },
        error: undefined,
      });

      const rootMetadataFn = client.getRootMetadata();
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({});

      // Verify API was called with undefined path
      expect(mockApiClient.GET).toHaveBeenCalledWith(
        '/v1/{dsn}/metadata/get-latest',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
          },
          params: {
            path: { dsn: 'test-dsn' },
            query: { path: undefined },
          },
        }
      );
    });

    it('should return empty metadata when factory returns empty object', async () => {
      // Mock API to return null for root metadata
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: {} },
        error: undefined,
      });

      const rootMetadataFn = client.getRootMetadata(() => ({}));
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({});
    });

    it('should return fallback metadata when provided', async () => {
      // Mock API to return empty metadata for root
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: {} },
        error: undefined,
      });

      const fallbackMetadata = {
        description: 'Root Fallback Description',
        title: 'Root Fallback Title',
      };

      const rootMetadataFn = client.getRootMetadata(() => ({
        fallback: fallbackMetadata,
      }));
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual(fallbackMetadata);
    });

    it('should merge override metadata properly', async () => {
      // Mock API to return empty metadata for root
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: {} },
        error: undefined,
      });

      const fallbackMetadata = {
        description: 'Root Fallback Description',
        title: 'Root Fallback Title',
      };

      const overrideMetadata = {
        keywords: ['root', 'override'],
        title: 'Root Override Title',
      };

      const rootMetadataFn = client.getRootMetadata(() => ({
        fallback: fallbackMetadata,
        override: overrideMetadata,
      }));
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({
        description: 'Root Fallback Description', // Fallback preserved
        keywords: ['root', 'override'], // Override added
        title: 'Root Override Title', // Override wins
      });
    });

    it('should handle async factory functions', async () => {
      // Mock API to return empty metadata for root
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: { metadata: {} },
        error: undefined,
      });

      const asyncFactory = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          fallback: {
            description: 'Async Root Description',
            title: 'Async Root Title',
          },
        };
      };

      const rootMetadataFn = client.getRootMetadata(asyncFactory);
      const result = await rootMetadataFn({}, {} as any);

      expect(result).toEqual({
        description: 'Async Root Description',
        title: 'Async Root Title',
      });
    });

    it('should pass props and parent to factory function', async () => {
      const mockFactory = vi.fn().mockReturnValue({
        fallback: { title: 'Test Title' },
      });
      const mockProps = { test: 'prop' };
      const mockParent = { test: 'parent' } as any;

      const rootMetadataFn = client.getRootMetadata(mockFactory);
      await rootMetadataFn(mockProps, mockParent);

      expect(mockFactory).toHaveBeenCalledWith(mockProps, mockParent);
    });
  });

  describe('revalidate', () => {
    it('should clear cache and call revalidatePath for specific path', async () => {
      // First, populate the cache
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      await metadataFn({}, {} as any);

      // Clear mocks to verify cache behavior
      vi.clearAllMocks();

      // Call clearCache and revalidate (which is what the webhook handler does)
      (client as any).clearCache('/test');
      await (client as any).revalidate('/test');

      // Verify revalidatePath was called
      expect(revalidatePath).toHaveBeenCalledWith('/test');

      // Verify cache was cleared by fetching again
      await metadataFn({}, {} as any);
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1); // Should fetch again since cache was cleared
    });

    it('should clear entire cache and revalidate all paths when path is null', async () => {
      // Call clearCache and revalidate with null
      (client as any).clearCache(null);
      await (client as any).revalidate(null);

      // Verify revalidatePath was called with layout revalidation
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    });
  });

  describe('revalidateHandler', () => {
    it('should return route handlers for all HTTP methods', () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: 'test-secret',
      });

      expect(handlers).toHaveProperty('GET');
      expect(handlers).toHaveProperty('POST');
      expect(handlers).toHaveProperty('PUT');
      expect(handlers).toHaveProperty('PATCH');
      expect(handlers).toHaveProperty('DELETE');
      expect(handlers).toHaveProperty('OPTIONS');
      expect(handlers).toHaveProperty('HEAD');

      // All handlers should be the same function
      expect(handlers.GET).toBe(handlers.POST);
      expect(handlers.POST).toBe(handlers.PUT);
    });

    it('should create handler with custom basePath', () => {
      const handlers = client.revalidateHandler({
        basePath: '/custom/api/path',
        revalidateSecret: 'test-secret',
      });

      expect(handlers).toHaveProperty('POST');
    });

    it('should have handlers that are functions', () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: 'test-secret',
      });

      // Verify all handlers are functions
      expect(typeof handlers.POST).toBe('function');
      expect(typeof handlers.GET).toBe('function');
    });

    it('should return error handlers when revalidateSecret is undefined', async () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: undefined,
      });

      // Verify all handlers are functions
      expect(typeof handlers.POST).toBe('function');
      expect(typeof handlers.GET).toBe('function');

      // Create a mock request
      const mockRequest = new Request(
        'http://localhost/api/generate-metadata/revalidate',
        {
          body: JSON.stringify({ path: '/test' }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        }
      );

      // Call the handler
      const response = await handlers.POST(mockRequest);

      // Verify the response
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({
        error: 'Webhook secret is not configured',
        ok: false,
      });
    });

    it('should return the same error handler for all HTTP methods when revalidateSecret is undefined', async () => {
      const handlers = client.revalidateHandler({
        revalidateSecret: undefined,
      });

      // Create a mock request
      const mockRequest = new Request(
        'http://localhost/api/generate-metadata/revalidate',
        {
          method: 'GET',
        }
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

      expect(getBody).toEqual({
        error: 'Webhook secret is not configured',
        ok: false,
      });
      expect(postBody).toEqual({
        error: 'Webhook secret is not configured',
        ok: false,
      });
      expect(putBody).toEqual({
        error: 'Webhook secret is not configured',
        ok: false,
      });
    });

    it('should use custom revalidatePath function when provided', async () => {
      const customRevalidatePath = vi.fn();

      // Spy on clearCache
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');

      const handlers = client.revalidateHandler({
        revalidatePath: customRevalidatePath,
        revalidateSecret: 'test-secret',
      });

      // Create a mock request with webhook payload
      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/revalidate',
        {
          body: JSON.stringify({
            _type: 'metadata_update',
            path: '/test-path',
          }),
          headers: {
            authorization: 'Bearer test-secret',
            'content-type': 'application/json',
          },
          method: 'POST',
        }
      );

      const response = await handlers.POST(mockRequest);

      expect(response.status).toBe(200);
      expect(clearCacheSpy).toHaveBeenCalledWith('/test-path');
      expect(customRevalidatePath).toHaveBeenCalledWith('/test-path');
    });

    it('should use custom revalidatePath function with null path', async () => {
      const customRevalidatePath = vi.fn();

      // Spy on clearCache
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');

      const handlers = client.revalidateHandler({
        revalidatePath: customRevalidatePath,
        revalidateSecret: 'test-secret',
      });

      // Create a mock request
      const mockRequest = new Request(
        'http://localhost:3000/api/generate-metadata/revalidate',
        {
          body: JSON.stringify({
            _type: 'metadata_update',
            path: null,
          }),
          headers: {
            authorization: 'Bearer test-secret',
            'content-type': 'application/json',
          },
          method: 'POST',
        }
      );

      const response = await handlers.POST(mockRequest);

      expect(response.status).toBe(200);
      expect(clearCacheSpy).toHaveBeenCalledWith(null);
      expect(customRevalidatePath).toHaveBeenCalledWith(null);
    });
  });

  describe('path normalization', () => {
    it('should normalize paths with trailing slashes', async () => {
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test/' }));
      await metadataFn({}, {} as any);

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

      const metadataFn = client.getMetadata(() => ({ path: 'test' }));
      await metadataFn({}, {} as any);

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

      const metadataFn = client.getMetadata(() => ({ path: 'test/page/' }));
      await metadataFn({}, {} as any);

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

      const metadataFn = client.getMetadata(() => ({ path: '/' }));
      await metadataFn({}, {} as any);

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

      const metadataFn = client.getMetadata(() => ({
        path: '/test?query=param',
      }));
      await metadataFn({}, {} as any);

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

      const metadataFn = client.getMetadata(() => ({ path: '/test#section' }));
      await metadataFn({}, {} as any);

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

      const metadataFn = client.getMetadata(() => ({
        path: '/test/page///',
      }));
      await metadataFn({}, {} as any);

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

      const metadataFn1 = client.getMetadata(() => ({ path: '/test/' }));
      const metadataFn2 = client.getMetadata(() => ({ path: 'test' }));
      const metadataFn3 = client.getMetadata(() => ({ path: '/test' }));

      // First call
      await metadataFn1({}, {} as any);
      // Second call with different format but same normalized path
      await metadataFn2({}, {} as any);
      // Third call with normalized format
      await metadataFn3({}, {} as any);

      // API should only be called once due to cache normalization
      expect(mockApiClient.GET).toHaveBeenCalledTimes(1);
    });

    it('should normalize path in revalidate', async () => {
      await (client as any).revalidate('/test/');
      expect(revalidatePath).toHaveBeenCalledWith('/test');

      await (client as any).revalidate('test');
      expect(revalidatePath).toHaveBeenCalledWith('/test');
    });

    it('should normalize path in clearCache', async () => {
      // First populate cache with different path formats
      vi.mocked(mockApiClient.GET).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
      });

      const metadataFn = client.getMetadata(() => ({ path: '/test' }));
      await metadataFn({}, {} as any);

      // Clear cache with unnormalized path
      (client as any).clearCache('/test/');

      // Verify cache was cleared by fetching again
      await metadataFn({}, {} as any);
      expect(mockApiClient.GET).toHaveBeenCalledTimes(2); // Should fetch again since cache was cleared
    });

    it('should normalize path in webhook handler', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');

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

      await handlers.POST(mockRequest1);
      expect(clearCacheSpy).toHaveBeenCalledWith('/test');
      expect(revalidatePath).toHaveBeenCalledWith('/test');

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

      await handlers.POST(mockRequest2);
      expect(clearCacheSpy).toHaveBeenCalledWith('/test');
      expect(revalidatePath).toHaveBeenCalledWith('/test');
    });

    it('should normalize path before applying pathRewrite', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
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

      await handlers.POST(mockRequest);

      // pathRewrite should receive normalized path
      expect(pathRewriteSpy).toHaveBeenCalledWith('/old');
      expect(clearCacheSpy).toHaveBeenCalledWith('/new');
      expect(revalidatePath).toHaveBeenCalledWith('/new');
    });
  });

  describe('pathRewrite normalization', () => {
    it('should normalize the result of pathRewrite', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
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

      await handlers.POST(mockRequest);

      // pathRewrite returns "/new/path/" but it should be normalized to "/new/path"
      expect(pathRewriteSpy).toHaveBeenCalledWith('/old');
      expect(clearCacheSpy).toHaveBeenCalledWith('/new/path'); // Normalized
      expect(revalidatePath).toHaveBeenCalledWith('/new/path'); // Normalized
    });

    it('should handle pathRewrite returning null (falls back to original path)', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
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

      await handlers.POST(mockRequest);

      expect(pathRewriteSpy).toHaveBeenCalledWith('/skip');
      // When pathRewrite returns null, it falls back to the original normalized path
      expect(clearCacheSpy).toHaveBeenCalledWith('/skip');
      expect(revalidatePath).toHaveBeenCalledWith('/skip');
    });

    it('should normalize pathRewrite result with multiple trailing slashes', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
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

      await handlers.POST(mockRequest);

      expect(pathRewriteSpy).toHaveBeenCalledWith('/test');
      expect(clearCacheSpy).toHaveBeenCalledWith('/rewritten'); // All trailing slashes removed
      expect(revalidatePath).toHaveBeenCalledWith('/rewritten');
    });

    it('should handle pathRewrite returning path without leading slash', async () => {
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');
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

      await handlers.POST(mockRequest);

      expect(pathRewriteSpy).toHaveBeenCalledWith('/test');
      expect(clearCacheSpy).toHaveBeenCalledWith('/rewritten/path'); // Leading slash added
      expect(revalidatePath).toHaveBeenCalledWith('/rewritten/path');
    });
  });

  describe('revalidateWebhookHandler', () => {
    it('should return route handlers for all HTTP methods', () => {
      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      expect(handlers).toHaveProperty('GET');
      expect(handlers).toHaveProperty('POST');
      expect(handlers).toHaveProperty('PUT');
      expect(handlers).toHaveProperty('PATCH');
      expect(handlers).toHaveProperty('DELETE');
      expect(handlers).toHaveProperty('OPTIONS');
      expect(handlers).toHaveProperty('HEAD');

      // All handlers should be the same function
      expect(handlers.GET).toBe(handlers.POST);
      expect(handlers.POST).toBe(handlers.PUT);
    });

    it('should clear cache and call revalidatePath when webhook is received', async () => {
      // Spy on clearCache
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      // Create a mock webhook request
      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'metadata_update',
          path: '/test-path',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      const response = await handlers.POST(mockRequest);

      expect(response.status).toBe(200);
      expect(clearCacheSpy).toHaveBeenCalledWith('/test-path');
      expect(revalidatePath).toHaveBeenCalledWith('/test-path');
    });

    it('should apply pathRewrite when provided', async () => {
      // Spy on clearCache
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');

      const handlers = client.revalidateWebhookHandler({
        revalidate: {
          // biome-ignore lint/style/noNonNullAssertion: temp
          pathRewrite: (path) => (path === '/old' ? '/new' : path!),
        },
        webhookSecret: 'test-secret',
      });

      // Create a mock webhook request
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

      const response = await handlers.POST(mockRequest);

      expect(response.status).toBe(200);
      expect(clearCacheSpy).toHaveBeenCalledWith('/new');
      expect(revalidatePath).toHaveBeenCalledWith('/new');
    });

    it('should ignore non-metadata_update webhook types', async () => {
      // Spy on clearCache
      const clearCacheSpy = vi.spyOn(client as any, 'clearCache');

      const handlers = client.revalidateWebhookHandler({
        webhookSecret: 'test-secret',
      });

      // Create a mock webhook request with different type
      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        body: JSON.stringify({
          _type: 'other_event',
          path: '/test-path',
        }),
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      const response = await handlers.POST(mockRequest);

      expect(response.status).toBe(200);
      expect(clearCacheSpy).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
