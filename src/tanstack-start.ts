import type { ServerFnCtx } from '@tanstack/react-start';
import _ from 'es-toolkit/compat';
import { handle } from 'hono/vercel';
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from '.';
import { FetchApiClient } from './utils/api/fetch';
import {
  type ServerFnType,
  TanstackStartApiClient,
  validator,
} from './utils/api/tanstack-start';
import { normalizePathname } from './utils/normalize-pathname';

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

export type GenerateMetadataClientOptions =
  GenerateMetadataClientBaseOptions & {
    serverFn?: ServerFnType;
  };

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  constructor(props: GenerateMetadataClientOptions) {
    super(props);
    if (props.serverFn) {
      this.api = new TanstackStartApiClient(props.serverFn);
    }
  }
  protected getFrameworkName(): 'tanstack-start' {
    return 'tanstack-start';
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ok
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

    const { meta: _1, ...fallbackBase } = fallback || {};
    const { meta: _2, ...generatedBase } = generated;
    const { meta: _3, ...overrideBase } = override || {};

    const result: TanstackHead = _.merge(
      {},
      fallbackBase,
      generatedBase,
      overrideBase
    );

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

    const removeByKeys = (items: any[], keysToRemove: Set<string>): any[] => {
      return items.filter((item) => {
        const key = getMetaKey(item);
        return !(key && keysToRemove.has(key));
      });
    };

    let finalMeta = [...(fallback?.meta || [])];

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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ok
  private convertToTanstackHead(response: MetadataApiResponse): TanstackHead {
    this.debug('Converting API response to TanStack Start head');

    if (!response.metadata) {
      this.debug('No metadata in response');
      return {};
    }

    const { metadata } = response;
    const meta: TanstackHead['meta'] = [];
    const links: TanstackHead['links'] = [];

    const keys = Object.keys(metadata) as (keyof typeof metadata)[];

    this.debug('Processing metadata keys:', keys);

    for (const key of keys) {
      if (key === 'title') {
        if (metadata.title) {
          meta.push({ content: metadata.title, name: 'title' });
          meta.push({ title: metadata.title });
        }
      } else if (key === 'description') {
        if (metadata.description) {
          meta.push({ content: metadata.description, name: 'description' });
        }
      } else if (key === 'icon') {
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
      } else if (key === 'appleTouchIcon') {
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
      } else if (key === 'openGraph') {
        if (!metadata.openGraph) {
          continue;
        }

        const ogKeys = Object.keys(
          metadata.openGraph
        ) as (keyof typeof metadata.openGraph)[];

        const openGraph = metadata.openGraph;

        for (const ogKey of ogKeys) {
          if (ogKey === 'title') {
            if (openGraph.title) {
              meta.push({
                content: openGraph.title,
                property: 'og:title',
              });
            }
          } else if (ogKey === 'description') {
            if (openGraph.description) {
              meta.push({
                content: openGraph.description,
                property: 'og:description',
              });
            }
          } else if (ogKey === 'locale') {
            if (openGraph.locale) {
              meta.push({
                content: openGraph.locale,
                property: 'og:locale',
              });
            }
          } else if (ogKey === 'siteName') {
            if (openGraph.siteName) {
              meta.push({
                content: openGraph.siteName,
                property: 'og:site_name',
              });
            }
          } else if (ogKey === 'type') {
            if (openGraph.type) {
              meta.push({
                content: openGraph.type,
                property: 'og:type',
              });
            }
          } else if (ogKey === 'image') {
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
          } else if (ogKey === 'images' && openGraph.images) {
            for (const img of openGraph.images) {
              meta.push({ content: img.url, property: 'og:image' });
              if (img.alt) {
                meta.push({ content: img.alt, property: 'og:image:alt' });
              }
            }
          }
        }
      } else if (key === 'twitter') {
        if (!metadata.twitter) {
          continue;
        }

        const twitterKeys = Object.keys(
          metadata.twitter
        ) as (keyof typeof metadata.twitter)[];

        const twitter = metadata.twitter;

        for (const twitterKey of twitterKeys) {
          if (twitterKey === 'title') {
            if (twitter.title) {
              meta.push({
                content: twitter.title,
                name: 'twitter:title',
              });
            }
          } else if (twitterKey === 'description') {
            if (twitter.description) {
              meta.push({
                content: twitter.description,
                name: 'twitter:description',
              });
            }
          } else if (twitterKey === 'card') {
            if (twitter.card) {
              meta.push({
                content: twitter.card,
                name: 'twitter:card',
              });
            }
          } else if (twitterKey === 'image') {
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
          }
        }
      } else if (key === 'noindex') {
        if (metadata.noindex) {
          meta.push({ content: 'noindex,nofollow', name: 'robots' });
        }
      } else if (key === 'customTags') {
        if (!metadata.customTags) {
          continue;
        }

        this.debug('Processing custom tags:', metadata.customTags.length);

        for (const tag of metadata.customTags) {
          meta.push({
            content: tag.content,
            name: tag.name,
          });
        }
      }
    }

    if (response.metadataRevisionId) {
      meta.push({
        content: response.metadataRevisionId,
        name: 'generate-metadata:revision-id',
      });
    }

    return {
      meta,
      ...(links.length > 0 && { links }),
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
      const metadata = await this.fetchMetadata({
        ...data,
      });

      const tanstackHead = metadata ? this.convertToTanstackHead(metadata) : {};

      const result = this.mergeMetadata(fallback, tanstackHead, override);
      this.debug('Returning merged head metadata');
      return result;
    } catch (error) {
      this.debug('Error getting head metadata:', error);
      return fallback || {};
    }
  }

  public static serverFnValidator = validator;

  public static async serverFnHandler(
    ctx: ServerFnCtx<unknown, 'data', undefined, typeof validator>,
    options: { apiKey: string | undefined }
  ) {
    const { apiKey } = options;
    const fetchApiClient = new FetchApiClient();

    if (ctx.data.type === 'metadataGetLatest') {
      const response = await fetchApiClient.metadataGetLatest({
        ...ctx.data.args,
        headers: {
          ...ctx.data.args?.headers,
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return _.omit(response, 'response');
    }

    throw new Error(
      `generate metadata server function called with unknown type ${ctx.data.type}`
    );
  }

  public getRootHead<Ctx = {}>(
    factory?: (ctx: Ctx) =>
      | {
          override?: TanstackHead;
          fallback?: TanstackHead;
        }
      | Promise<{
          override?: TanstackHead;
          fallback?: TanstackHead;
        }>
  ) {
    return async (ctx: Ctx): Promise<TanstackHead> => {
      // biome-ignore lint/nursery/noUnnecessaryConditions: wrong
      const opts = factory ? await factory(ctx) : {};
      return this.mergeMetadata(opts.fallback, { meta: [] }, opts.override);
    };
  }

  // biome-ignore lint/suspicious/useAwait: might need to be async
  protected async triggerRevalidation(_path: string | null): Promise<void> {
    this.debug(
      'Revalidate called with path:',
      _path,
      '(no-op for TanStack Start)'
    );
  }

  public revalidateWebhookHandler(options: {
    webhookSecret: string | undefined;
    revalidate?: {
      pathRewrite?: (path: string | null) => string | null;
    };
  }) {
    this.debug('Creating revalidate webhook handler');

    const app = this.createWebhookApp({
      webhookHandler: async (data) => {
        if (data._type !== 'metadata_update') {
          this.debug('Ignoring webhook type:', data._type);
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
        await this.triggerRevalidation(path);

        return { path, revalidated: true };
      },
      webhookSecret: options.webhookSecret,
    });

    const handler = handle(app);
    function handlerWrapper(ctx: { request: Request }) {
      return handler(ctx.request);
    }

    return {
      DELETE: handlerWrapper,
      GET: handlerWrapper,
      HEAD: handlerWrapper,
      OPTIONS: handlerWrapper,
      PATCH: handlerWrapper,
      POST: handlerWrapper,
      PUT: handlerWrapper,
    };
  }
}
