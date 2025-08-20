import type { OptionalFetcher } from '@tanstack/react-start';
import _, { merge } from 'es-toolkit/compat';
import { match } from 'ts-pattern';
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from '.';
import { normalizePathname } from './utils/normalize-pathname';

// TanStack Start's head function return type
type TanstackHead = {
  links?: Array<{
    href: string;
    rel: string;
    type?: string;
    sizes?: string;
    [key: string]: any;
  }>;
  scripts?: Array<{
    src?: string;
    children?: string;
    [key: string]: any;
  }>;
  meta?: Array<{
    title?: string;
    name?: string;
    property?: string;
    content?: string;
    [key: string]: any;
  }>;
  styles?: Array<{
    href?: string;
    children?: string;
    [key: string]: any;
  }>;
};

export type GenerateMetadataClientOptions = GenerateMetadataClientBaseOptions;

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  protected getFrameworkName(): 'tanstack-start' {
    return 'tanstack-start';
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: easy
  private mergeMetadata(
    fallback: TanstackHead | undefined,
    generated: TanstackHead,
    override: TanstackHead | undefined
  ): TanstackHead {
    this.debug(
      'Merging metadata - fallback:',
      fallback ? 'present' : 'absent',
      'generated:',
      'present',
      'override:',
      override ? 'present' : 'absent'
    );

    // Merge non-meta properties (destructure to exclude meta)
    const { meta: _1, ...fallbackBase } = fallback || {};
    const { meta: _2, ...generatedBase } = generated;
    const { meta: _3, ...overrideBase } = override || {};

    const result: TanstackHead = merge(
      {},
      fallbackBase,
      generatedBase,
      overrideBase
    );

    // Helper function to get meta key for deduplication
    const getMetaKey = (metaItem: any): string | null => {
      if (metaItem.name) {
        return `name:${metaItem.name}`;
      }
      if (metaItem.property) {
        return `property:${metaItem.property}`;
      }
      if (metaItem.title) {
        return 'title';
      }
      return null;
    };

    // Helper function to remove all occurrences of items with the given keys
    const removeByKeys = (items: any[], keysToRemove: Set<string>): any[] => {
      return items.filter((item) => {
        const key = getMetaKey(item);
        return !(key && keysToRemove.has(key));
      });
    };

    // Start with fallback meta
    let finalMeta = [...(fallback?.meta || [])];

    // Add generated meta, removing any duplicates from fallback first
    if (generated.meta) {
      const generatedKeys = new Set<string>();
      for (const metaItem of generated.meta) {
        const key = getMetaKey(metaItem);
        if (key) {
          generatedKeys.add(key);
        }
      }
      finalMeta = removeByKeys(finalMeta, generatedKeys);
      finalMeta.push(...generated.meta);
    }

    // Add override meta, removing any duplicates from existing meta first
    if (override?.meta) {
      const overrideKeys = new Set<string>();
      for (const metaItem of override.meta) {
        const key = getMetaKey(metaItem);
        if (key) {
          overrideKeys.add(key);
        }
      }
      finalMeta = removeByKeys(finalMeta, overrideKeys);
      finalMeta.push(...override.meta);
    }

    if (finalMeta.length > 0) {
      result.meta = finalMeta;
    }

    this.debug('Merged metadata has', finalMeta.length, 'meta tags');

    return result;
  }

  private convertToTanstackHead(response: MetadataApiResponse): TanstackHead {
    this.debug('Converting API response to TanStack Start head');

    if (!response.metadata) {
      this.debug('No metadata in response');
      return {};
    }

    const { metadata } = response;
    const meta: TanstackHead['meta'] = [];
    const links: TanstackHead['links'] = [];

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata
    ) as (keyof typeof metadata)[];

    this.debug('Processing metadata keys:', keys);

    for (const key of keys) {
      match(key)
        .with('title', () => {
          if (metadata.title) {
            meta.push({ content: metadata.title, name: 'title' });
            meta.push({ title: metadata.title });
          }
        })
        .with('description', () => {
          if (metadata.description) {
            meta.push({ content: metadata.description, name: 'description' });
          }
        })
        .with('icon', () => {
          if (metadata.icon) {
            for (const icon of metadata.icon) {
              links.push({
                href: icon.url,
                rel: 'icon',
                sizes: `${icon.width}x${icon.height}`,
                type: icon.mimeType,
              });
            }
          }
        })
        .with('appleTouchIcon', () => {
          if (metadata.appleTouchIcon) {
            for (const icon of metadata.appleTouchIcon) {
              links.push({
                href: icon.url,
                rel: 'apple-touch-icon',
                sizes: `${icon.width}x${icon.height}`,
                type: icon.mimeType,
              });
            }
          }
        })
        .with('openGraph', () => {
          if (!metadata.openGraph) {
            return;
          }

          const ogKeys: (keyof typeof metadata.openGraph)[] = Object.keys(
            metadata.openGraph
          ) as (keyof typeof metadata.openGraph)[];

          const openGraph = metadata.openGraph;

          for (const ogKey of ogKeys) {
            match(ogKey)
              .with('title', () => {
                if (openGraph.title) {
                  meta.push({
                    content: openGraph.title,
                    property: 'og:title',
                  });
                }
              })
              .with('description', () => {
                if (openGraph.description) {
                  meta.push({
                    content: openGraph.description,
                    property: 'og:description',
                  });
                }
              })
              .with('locale', () => {
                if (openGraph.locale) {
                  meta.push({
                    content: openGraph.locale,
                    property: 'og:locale',
                  });
                }
              })
              .with('siteName', () => {
                if (openGraph.siteName) {
                  meta.push({
                    content: openGraph.siteName,
                    property: 'og:site_name',
                  });
                }
              })
              .with('type', () => {
                if (openGraph.type) {
                  meta.push({
                    content: openGraph.type,
                    property: 'og:type',
                  });
                }
              })
              .with('image', () => {
                const ogImage = openGraph.image;
                if (ogImage) {
                  meta.push({
                    content: ogImage.url,
                    property: 'og:image',
                  });
                  if (ogImage.alt) {
                    meta.push({
                      content: ogImage.alt,
                      property: 'og:image:alt',
                    });
                  }
                }
              })
              // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: easy
              .with('images', () => {
                if (openGraph.images) {
                  for (const img of openGraph.images) {
                    meta.push({ content: img.url, property: 'og:image' });
                    if (img.alt) {
                      meta.push({ content: img.alt, property: 'og:image:alt' });
                    }
                  }
                }
              })
              .with('url', () => {})
              .with('determiner', () => {})
              .with('localeAlternate', () => {})
              .exhaustive(() => {});
          }
        })
        .with('twitter', () => {
          if (!metadata.twitter) {
            return;
          }

          const twitterKeys: (keyof typeof metadata.twitter)[] = Object.keys(
            metadata.twitter
          ) as (keyof typeof metadata.twitter)[];

          const twitter = metadata.twitter;

          for (const twitterKey of twitterKeys) {
            match(twitterKey)
              .with('title', () => {
                if (twitter.title) {
                  meta.push({
                    content: twitter.title,
                    name: 'twitter:title',
                  });
                }
              })
              .with('description', () => {
                if (twitter.description) {
                  meta.push({
                    content: twitter.description,
                    name: 'twitter:description',
                  });
                }
              })
              .with('card', () => {
                if (twitter.card) {
                  meta.push({
                    content: twitter.card,
                    name: 'twitter:card',
                  });
                }
              })
              .with('image', () => {
                const twitterImage = twitter.image;
                if (twitterImage) {
                  meta.push({
                    content: twitterImage.url,
                    name: 'twitter:image',
                  });
                  if (twitterImage.alt) {
                    meta.push({
                      content: twitterImage.alt,
                      name: 'twitter:image:alt',
                    });
                  }
                }
              })
              .exhaustive(() => {});
          }
        })
        .with('noindex', () => {
          if (metadata.noindex) {
            meta.push({ content: 'noindex,nofollow', name: 'robots' });
          }
        })
        .with('customTags', () => {
          if (!metadata.customTags) {
            return;
          }

          this.debug('Processing custom tags:', metadata.customTags.length);

          // Handle custom tags - convert to TanStack Start format
          for (const tag of metadata.customTags) {
            meta.push({
              content: tag.content,
              name: tag.name,
            });
          }
        })
        .exhaustive(() => {});
    }

    return {
      meta,
      ...(links.length > 0 && { links }),
    };
  }

  public getMetadataValidator(data: unknown) {
    return data;
  }

  public async getMetadataHandler(
    { data }: { data: unknown },
    { apiKey }: { apiKey: string | undefined }
  ) {
    const metadata = await this.fetchMetadata({
      ...(data as GenerateMetadataOptions),
      apiKey,
    });
    return metadata;
  }

  public getMetadata() {
    return async ({ data }: { data: unknown }) => {
      const metadata = await this.fetchMetadata(
        data as GenerateMetadataOptions
      );
      return metadata ?? {};
    };
  }

  public async getHead(
    opts: Omit<GenerateMetadataOptions, 'path'> & {
      ctx: {
        match: {
          pathname: string;
        };
        matches: {
          pathname: string;
        }[];
      };
      path?: string;
      override?: TanstackHead;
      fallback?: TanstackHead;
      getMetadataServerFn: OptionalFetcher<
        undefined,
        (data: unknown) => unknown,
        MetadataApiResponse | null,
        'data'
      >;
    }
  ) {
    this.debug('getHead called');
    const { path: originalPath, fallback, override, ctx } = opts;
    const path = normalizePathname(
      originalPath ?? _.last(ctx.matches)?.pathname ?? ctx.match.pathname
    );
    this.debug('Factory returned options with path:', path);

    const data: GenerateMetadataOptions = {
      path,
    };

    try {
      const metadata = await opts.getMetadataServerFn({
        data,
      });

      const tanstackHead = metadata ? this.convertToTanstackHead(metadata) : {};

      // Deep merge: override > generated > fallback
      const result = this.mergeMetadata(fallback, tanstackHead, override);
      this.debug('Returning merged head metadata');
      return result;
    } catch (error) {
      this.debug('Error getting head metadata:', error);
      return fallback || {};
    }
  }

  // biome-ignore lint/complexity/noBannedTypes: ok
  public getRootHead<Ctx = {}>(
    factory?: (ctx: Ctx) =>
      | {
          override?: TanstackHead;
          fallback?: TanstackHead;
          getMetadataServerFn?: OptionalFetcher<
            undefined,
            (data: unknown) => unknown,
            MetadataApiResponse | null,
            'data'
          >;
        }
      | Promise<{
          override?: TanstackHead;
          fallback?: TanstackHead;
          getMetadataServerFn?: OptionalFetcher<
            undefined,
            (data: unknown) => unknown,
            MetadataApiResponse | null,
            'data'
          >;
        }>
  ) {
    return async (ctx: Ctx): Promise<TanstackHead> => {
      this.debug('getRootHead called');
      // biome-ignore lint/nursery/noUnnecessaryConditions: biome is wrong
      const opts = factory ? await factory(ctx) : {};
      const { fallback, override, getMetadataServerFn } = opts;

      if (!getMetadataServerFn) {
        // No API call - just merge fallback and override
        return this.mergeMetadata(fallback, {}, override);
      }

      const data: GenerateMetadataOptions = {
        path: undefined,
      };

      try {
        const metadata = await getMetadataServerFn({
          data,
        });

        const tanstackHead = metadata
          ? this.convertToTanstackHead(metadata)
          : {};

        // Deep merge: override > generated > fallback
        const result = this.mergeMetadata(fallback, tanstackHead, override);
        this.debug('Returning merged root head metadata');
        return result;
      } catch (error) {
        this.debug('Error getting root head metadata:', error);
        return fallback || {};
      }
    };
  }

  // biome-ignore lint/suspicious/useAwait: might need await in the future
  protected async revalidate(_path: string | null): Promise<void> {
    this.debug(
      'Revalidate called with path:',
      _path,
      '(no-op for TanStack Start)'
    );
    // TanStack Start doesn't have a built-in revalidation mechanism
    // So we just return void
  }

  public revalidateWebhookHandler(options: {
    webhookSecret: string | undefined;
    revalidate?: {
      pathRewrite?: (path: string | null) => string | null;
    };
  }) {
    this.debug('Creating revalidate webhook handler');

    // Get the Hono app from base class
    const app = this.createWebhookApp({
      webhookHandler: async (data) => {
        if (data._type !== 'metadata_update') {
          this.debug('Ignoring webhook type:', data._type);
          // Ignore other webhook types
          return;
        }

        const { path: originalPath } = data;
        const normalizedPath = normalizePathname(originalPath);
        this.debug(
          'Processing metadata_update webhook for path:',
          normalizedPath
        );

        const path = normalizePathname(
          options.revalidate?.pathRewrite?.(normalizedPath) ?? normalizedPath
        );

        if (path !== normalizedPath) {
          this.debug('Path rewritten from', normalizedPath, 'to', path);
        }

        this.clearCache(path);
        await this.revalidate(path);

        return { path, revalidated: true };
      },
      webhookSecret: options.webhookSecret,
    });

    // Return the Hono app directly for TanStack Start
    // TanStack Start can use Hono directly or users can wrap it as needed
    return app;
  }
}
