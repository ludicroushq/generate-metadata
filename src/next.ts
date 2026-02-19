import _ from 'es-toolkit/compat';
import { handle } from 'hono/vercel';
import type { Metadata, ResolvingMetadata } from 'next';
import { revalidatePath } from 'next/cache';
import {
  GenerateMetadataClientBase,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from '.';
import { normalizePathname } from './utils/normalize-pathname';

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
    return _.merge({}, fallback || {}, generated, override || {});
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ok
  private convertToNextMetadata(response: MetadataApiResponse): Metadata {
    this.debug('Converting API response to Next.js metadata');

    if (!response.metadata) {
      this.debug('No metadata in response');
      return {};
    }

    const { metadata } = response;
    const nextMetadata: Metadata = {};

    const keys = Object.keys(metadata) as (keyof typeof metadata)[];

    this.debug('Processing metadata keys:', keys);

    for (const key of keys) {
      if (key === 'title') {
        nextMetadata.title = metadata.title;
      } else if (key === 'description') {
        nextMetadata.description = metadata.description;
      } else if (key === 'appleTouchIcon') {
        if (!nextMetadata.icons) {
          nextMetadata.icons = [];
        }

        if (!(Array.isArray(nextMetadata.icons) && metadata.appleTouchIcon)) {
          continue;
        }

        for (const icon of metadata.appleTouchIcon) {
          nextMetadata.icons.push({
            rel: 'apple-touch-icon',
            sizes: `${icon.width}x${icon.height}`,
            type: icon.mimeType,
            url: icon.url,
          });
        }
      } else if (key === 'icon') {
        if (!nextMetadata.icons) {
          nextMetadata.icons = [];
        }

        if (!(Array.isArray(nextMetadata.icons) && metadata.icon)) {
          continue;
        }

        for (const icon of metadata.icon) {
          nextMetadata.icons.push({
            rel: 'icon',
            sizes: `${icon.width}x${icon.height}`,
            type: icon.mimeType,
            url: icon.url,
          });
        }
      } else if (key === 'openGraph') {
        const { openGraph } = metadata;
        if (!openGraph) {
          continue;
        }
        const ogKeys = Object.keys(openGraph) as (keyof typeof openGraph)[];

        const result: Metadata['openGraph'] & { type?: string } = {};

        for (const ogKey of ogKeys) {
          if (ogKey === 'title') {
            result.title = openGraph.title;
          } else if (ogKey === 'description') {
            result.description = openGraph?.description;
          } else if (ogKey === 'images') {
            if (openGraph.images) {
              result.images = openGraph.images.map((img) => ({
                alt: img.alt || undefined,
                height: img.height || undefined,
                url: img.url,
                width: img.width || undefined,
              }));
            }
          } else if (ogKey === 'locale') {
            result.locale = openGraph.locale;
          } else if (ogKey === 'siteName') {
            result.siteName = openGraph.siteName;
          } else if (ogKey === 'type') {
            result.type = openGraph.type;
          } else if (ogKey === 'image') {
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
          } else if (ogKey === 'url') {
            result.url = openGraph.url;
          } else if (ogKey === 'determiner') {
            result.determiner = openGraph.determiner;
          } else if (ogKey === 'localeAlternate') {
            result.alternateLocale = openGraph.localeAlternate;
          }
        }

        nextMetadata.openGraph = result;
      } else if (key === 'twitter') {
        if (!metadata.twitter) {
          continue;
        }

        const twitterKeys = Object.keys(
          metadata.twitter
        ) as (keyof typeof metadata.twitter)[];

        const twitter: any = {};

        for (const twitterKey of twitterKeys) {
          if (twitterKey === 'title') {
            twitter.title = metadata.twitter?.title;
          } else if (twitterKey === 'description') {
            twitter.description = metadata.twitter?.description;
          } else if (twitterKey === 'card') {
            if (metadata.twitter?.card) {
              twitter.card = metadata.twitter?.card;
            }
          } else if (twitterKey === 'image') {
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
          }
        }

        nextMetadata.twitter = twitter;
      } else if (key === 'noindex') {
        nextMetadata.robots = 'noindex,nofollow';
      } else if (key === 'customTags') {
        if (!metadata.customTags) {
          continue;
        }

        this.debug('Processing custom tags:', metadata.customTags.length);

        for (const tag of metadata.customTags) {
          if (!nextMetadata.other) {
            nextMetadata.other = {};
          }

          nextMetadata.other[tag.name] = tag.content;
        }
      }
    }

    if (response.metadataRevisionId) {
      if (!nextMetadata.other) {
        nextMetadata.other = {};
      }
      nextMetadata.other['generate-metadata:revision-id'] =
        response.metadataRevisionId;
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

        const result = this.mergeMetadata(fallback, nextMetadata, override);
        this.debug('Returning merged metadata');
        return result;
      } catch (error) {
        this.debug('Error generating metadata:', error);
        return fallback || {};
      }
    };
  }

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
      // biome-ignore lint/nursery/noUnnecessaryConditions: wrong
      const opts = factory ? await factory(props, parent) : {};
      return this.mergeMetadata(opts.fallback, {}, opts.override);
    };
  }

  protected async triggerRevalidation(path: string | null): Promise<void> {
    const normalizedPath = normalizePathname(path);
    if (normalizedPath !== null) {
      this.debug('Revalidating path:', normalizedPath);
      await revalidatePath(normalizedPath);
    } else {
      this.debug('Revalidating all paths (root layout)');
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
    const app = this.createRevalidateApp(options);

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

    const app = this.createWebhookApp({
      webhookHandler: async (data) => {
        if (data._type !== 'metadata_update') {
          this.debug('Ignoring webhook type:', data._type);
          return;
        }

        const { path: originalPath } = data;
        const path = normalizePathname(originalPath);
        this.debug(
          'Processing metadata_update webhook for path:',
          originalPath
        );

        const normalizedRevalidatePath = normalizePathname(
          options.revalidate?.pathRewrite?.(path) ?? path
        );

        if (path !== normalizedRevalidatePath) {
          this.debug('Path rewritten from', path, 'to', path);
        }

        this.clearCache(path);
        await this.triggerRevalidation(normalizedRevalidatePath);

        return { path, revalidated: true };
      },
      webhookSecret: options.webhookSecret,
    });

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
