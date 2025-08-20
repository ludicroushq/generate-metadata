import { merge } from 'es-toolkit/compat';
import { handle } from 'hono/vercel';
import type { Metadata, ResolvingMetadata } from 'next';
import { revalidatePath } from 'next/cache';
import { match } from 'ts-pattern';
import {
  GenerateMetadataClientBase,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from '.';
import { normalizePathname } from './utils/normalize-pathname';
import type { FlattenUnion } from './utils/types';

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  protected getFrameworkName(): 'next' {
    return 'next';
  }

  private mergeMetadata(
    fallback: Metadata | undefined,
    generated: Metadata,
    override: Metadata | undefined
  ): Metadata {
    this.debug(
      'Merging metadata - fallback:',
      fallback ? 'present' : 'absent',
      'generated:',
      generated ? 'present' : 'absent',
      'override:',
      override ? 'present' : 'absent'
    );
    // Deep merge: override > generated > fallback
    return merge({}, fallback || {}, generated, override || {});
  }

  private convertToNextMetadata(response: MetadataApiResponse): Metadata {
    this.debug('Converting API response to Next.js metadata');

    if (!response.metadata) {
      this.debug('No metadata in response');
      return {};
    }

    const { metadata } = response;
    const nextMetadata: Metadata = {};

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata
    ) as (keyof typeof metadata)[];

    this.debug('Processing metadata keys:', keys);

    for (const key of keys) {
      match(key)
        .with('title', () => {
          nextMetadata.title = metadata.title;
        })
        .with('description', () => {
          nextMetadata.description = metadata.description;
        })
        .with('appleTouchIcon', () => {
          if (!nextMetadata.icons) {
            nextMetadata.icons = [];
          }

          if (!(Array.isArray(nextMetadata.icons) && metadata.appleTouchIcon)) {
            return;
          }

          for (const icon of metadata.appleTouchIcon) {
            nextMetadata.icons.push({
              rel: 'apple-touch-icon',
              sizes: `${icon.width}x${icon.height}`,
              type: icon.mimeType,
              url: icon.url,
            });
          }
        })
        .with('icon', () => {
          if (!nextMetadata.icons) {
            nextMetadata.icons = [];
          }

          if (!(Array.isArray(nextMetadata.icons) && metadata.icon)) {
            return;
          }

          for (const icon of metadata.icon) {
            nextMetadata.icons.push({
              rel: 'icon',
              sizes: `${icon.width}x${icon.height}`,
              type: icon.mimeType,
              url: icon.url,
            });
          }
        })
        .with('openGraph', () => {
          const { openGraph } = metadata;
          if (!openGraph) {
            return;
          }
          const ogKeys: (keyof typeof openGraph)[] = Object.keys(
            openGraph
          ) as (keyof typeof openGraph)[];

          const result: Metadata['openGraph'] & { type?: string } = {};

          for (const ogKey of ogKeys) {
            match(ogKey)
              .with('title', () => {
                result.title = openGraph.title;
              })
              .with('description', () => {
                result.description = openGraph?.description;
              })
              .with('images', () => {
                if (openGraph.images) {
                  result.images = openGraph.images.map((img) => ({
                    alt: img.alt || undefined,
                    height: img.height || undefined,
                    url: img.url,
                    width: img.width || undefined,
                  }));
                }
              })
              .with('locale', () => {
                result.locale = openGraph.locale;
              })
              .with('siteName', () => {
                result.siteName = openGraph.siteName;
              })
              .with('type', () => {
                result.type = openGraph.type;
              })
              .with('image', () => {
                const ogImage = openGraph.image;
                if (ogImage) {
                  if (!(result.images && Array.isArray(result.images))) {
                    result.images = [];
                  }
                  result.images.push({
                    alt: ogImage.alt || undefined,
                    height: ogImage.height || undefined,
                    url: ogImage.url,
                    width: ogImage.width || undefined,
                  });
                }
              })
              .with('url', () => {
                result.url = openGraph.url;
              })
              .with('determiner', () => {
                result.determiner = openGraph.determiner;
              })
              .with('localeAlternate', () => {
                result.alternateLocale = openGraph.localeAlternate;
              })
              .exhaustive(() => {});
          }

          nextMetadata.openGraph = result;
        })
        .with('twitter', () => {
          if (!metadata.twitter) {
            return;
          }

          const twitterKeys: (keyof typeof metadata.twitter)[] = Object.keys(
            metadata.twitter
          ) as (keyof typeof metadata.twitter)[];

          const twitter: FlattenUnion<Metadata['twitter']> = {};

          for (const twitterKey of twitterKeys) {
            match(twitterKey)
              .with('title', () => {
                twitter.title = metadata.twitter?.title;
              })
              .with('description', () => {
                twitter.description = metadata.twitter?.description;
              })
              .with('card', () => {
                if (metadata.twitter?.card) {
                  twitter.card = metadata.twitter?.card;
                }
              })
              .with('image', () => {
                const twitterImage = metadata.twitter?.image;
                if (twitterImage) {
                  twitter.images = [
                    {
                      alt: twitterImage.alt || undefined,
                      height: twitterImage.height || undefined,
                      url: twitterImage.url,
                      width: twitterImage.width || undefined,
                    },
                  ];
                }
              })
              .exhaustive(() => {});
          }

          nextMetadata.twitter = twitter;
        })
        .with('noindex', () => {
          nextMetadata.robots = 'noindex,nofollow';
        })
        .with('customTags', () => {
          if (!metadata.customTags) {
            return;
          }

          this.debug('Processing custom tags:', metadata.customTags.length);

          // Handle custom tags - convert to Next.js metadata format
          for (const tag of metadata.customTags) {
            if (!nextMetadata.other) {
              nextMetadata.other = {};
            }

            // Convert meta tags based on their format
            nextMetadata.other[tag.name] = tag.content;
          }
        })
        .exhaustive(() => {});
    }

    return nextMetadata;
  }

  public getMetadata<Props>(
    factory: (
      props: Props,
      parent: ResolvingMetadata
    ) =>
      | (GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata })
      | Promise<
          GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata }
        >
  ) {
    return async (
      props: Props,
      parent: ResolvingMetadata
    ): Promise<Metadata> => {
      this.debug('getMetadata called');
      const opts = await factory(props, parent);
      const { path: originalPath, fallback, override } = opts;
      const path = normalizePathname(originalPath);
      this.debug('Factory returned options with path:', path);

      try {
        const metadata = await this.fetchMetadata(opts);

        const nextMetadata = metadata
          ? this.convertToNextMetadata(metadata)
          : {};

        // Deep merge: override > generated > fallback
        const result = this.mergeMetadata(fallback, nextMetadata, override);
        this.debug('Returning merged metadata');
        return result;
      } catch (error) {
        this.debug('Error generating metadata:', error);
        return fallback || {};
      }
    };
  }

  // biome-ignore lint/complexity/noBannedTypes: type
  public getRootMetadata<Props = {}>(
    factory?: (
      props: Props,
      parent: ResolvingMetadata
    ) =>
      | { override?: Metadata; fallback?: Metadata }
      | Promise<{ override?: Metadata; fallback?: Metadata }>
  ) {
    return async (
      props: Props,
      parent: ResolvingMetadata
    ): Promise<Metadata> => {
      // biome-ignore lint/nursery/noUnnecessaryConditions: biome is wrong
      const opts = factory ? await factory(props, parent) : {};
      // Return empty metadata merged with fallback and override
      return this.mergeMetadata(opts.fallback, {}, opts.override);
    };
  }

  protected async revalidate(path: string | null): Promise<void> {
    const normalizedPath = normalizePathname(path);
    if (normalizedPath !== null) {
      this.debug('Revalidating path:', normalizedPath);
      await revalidatePath(normalizedPath);
    } else {
      this.debug('Revalidating all paths (root layout)');
      // Revalidate all paths by revalidating the root layout
      await revalidatePath('/', 'layout');
    }
  }

  /**
   * @deprecated Please use `revalidateWebhookHandler` instead.
   */
  public revalidateHandler(options: {
    revalidateSecret: string | undefined;
    basePath?: string;
    revalidatePath?: (path: string | null) => void | Promise<void>;
  }) {
    // Get the Hono app from base class
    const app = this.createRevalidateApp(options);

    // Return Next.js compatible handlers using Hono's Vercel adapter
    const handler = handle(app);

    return {
      DELETE: handler,
      GET: handler,
      HEAD: handler,
      OPTIONS: handler,
      PATCH: handler,
      POST: handler,
      PUT: handler,
    };
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
          originalPath
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

    // Return Next.js compatible handlers using Hono's Vercel adapter
    const handler = handle(app);

    return {
      DELETE: handler,
      GET: handler,
      HEAD: handler,
      OPTIONS: handler,
      PATCH: handler,
      POST: handler,
      PUT: handler,
    };
  }
}
