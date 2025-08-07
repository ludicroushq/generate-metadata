import { handle } from "hono/vercel";
import merge from "lodash.merge";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidatePath } from "next/cache";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";

export type GenerateMetadataClientOptions =
  GenerateMetadataClientBaseOptions & {
    apiKey: string | undefined;
  };

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(props: GenerateMetadataClientOptions) {
    super(props);
  }

  protected getFrameworkName(): "next" {
    return "next";
  }

  private mergeMetadata(
    fallback: Metadata | undefined,
    generated: Metadata,
    override: Metadata | undefined,
  ): Metadata {
    // Deep merge: override > generated > fallback
    return merge({}, fallback || {}, generated, override || {});
  }

  private convertToNextMetadata(response: MetadataApiResponse): Metadata {
    if (!response.metadata) {
      return {};
    }

    const { metadata } = response;
    const nextMetadata: Metadata = {};

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata,
    ) as (keyof typeof metadata)[];

    keys.forEach((key) => {
      match(key)
        .with("title", () => {
          nextMetadata.title = metadata.title;
        })
        .with("description", () => {
          nextMetadata.description = metadata.description;
        })
        .with("appleTouchIcon", () => {
          if (!nextMetadata.icons) {
            nextMetadata.icons = [];
          }

          if (!Array.isArray(nextMetadata.icons) || !metadata.appleTouchIcon) {
            return;
          }

          for (const icon of metadata.appleTouchIcon) {
            nextMetadata.icons.push({
              rel: "apple-touch-icon",
              url: icon.url,
              type: icon.mimeType,
              sizes: `${icon.width}x${icon.height}`,
            });
          }
        })
        .with("icon", () => {
          if (!nextMetadata.icons) {
            nextMetadata.icons = [];
          }

          if (!Array.isArray(nextMetadata.icons) || !metadata.icon) {
            return;
          }

          for (const icon of metadata.icon) {
            nextMetadata.icons.push({
              rel: "icon",
              url: icon.url,
              type: icon.mimeType,
              sizes: `${icon.width}x${icon.height}`,
            });
          }
        })
        .with("openGraph", () => {
          const { openGraph } = metadata;
          if (!openGraph) {
            return;
          }
          const ogKeys: (keyof typeof openGraph)[] = Object.keys(
            openGraph,
          ) as (keyof typeof openGraph)[];

          const result: Metadata["openGraph"] & { type?: string } = {};

          ogKeys.forEach((ogKey) => {
            match(ogKey)
              .with("title", () => {
                result.title = openGraph.title;
              })
              .with("description", () => {
                result.description = openGraph!.description;
              })
              .with("images", () => {
                if (openGraph.images) {
                  result.images = openGraph.images.map((img) => ({
                    url: img.url,
                    alt: img.alt || undefined,
                    width: img.width || undefined,
                    height: img.height || undefined,
                  }));
                }
              })
              .with("locale", () => {
                result.locale = openGraph.locale;
              })
              .with("siteName", () => {
                result.siteName = openGraph.siteName;
              })
              .with("type", () => {
                result.type = openGraph.type;
              })
              .with("image", () => {
                const ogImage = openGraph.image;
                if (ogImage) {
                  if (!result.images || !Array.isArray(result.images)) {
                    result.images = [];
                  }
                  result.images.push({
                    url: ogImage.url,
                    alt: ogImage.alt || undefined,
                    width: ogImage.width || undefined,
                    height: ogImage.height || undefined,
                  });
                }
              })
              .with("url", () => {
                result.url = openGraph.url;
              })
              .with("determiner", () => {
                result.determiner = openGraph.determiner;
              })
              .with("localeAlternate", () => {
                result.alternateLocale = openGraph.localeAlternate;
              })
              .exhaustive(() => {});
          });

          nextMetadata.openGraph = result;
        })
        .with("twitter", () => {
          if (!metadata.twitter) {
            return;
          }

          const twitterKeys: (keyof typeof metadata.twitter)[] = Object.keys(
            metadata.twitter,
          ) as (keyof typeof metadata.twitter)[];

          const twitter: any = {};

          twitterKeys.forEach((twitterKey) => {
            match(twitterKey)
              .with("title", () => {
                twitter.title = metadata.twitter!.title;
              })
              .with("description", () => {
                twitter.description = metadata.twitter!.description;
              })
              .with("card", () => {
                if (metadata.twitter!.card) {
                  twitter.card = metadata.twitter!.card;
                }
              })
              .with("image", () => {
                const twitterImage = metadata.twitter!.image;
                if (twitterImage) {
                  twitter.images = [
                    {
                      url: twitterImage.url,
                      alt: twitterImage.alt || undefined,
                      width: twitterImage.width || undefined,
                      height: twitterImage.height || undefined,
                    },
                  ];
                }
              })
              .exhaustive(() => {});
          });

          nextMetadata.twitter = twitter;
        })
        .with("noindex", () => {
          nextMetadata.robots = "noindex,nofollow";
        })
        .with("customTags", () => {
          // TODO: Handle custom tags
        })
        .exhaustive(() => {});
    });

    return nextMetadata;
  }

  public getMetadata<Props>(
    factory: (
      props: Props,
      parent: ResolvingMetadata,
    ) =>
      | (GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata })
      | Promise<
          GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata }
        >,
  ) {
    return async (
      props: Props,
      parent: ResolvingMetadata,
    ): Promise<Metadata> => {
      const opts = await factory(props, parent);
      try {
        const metadata = await this.fetchMetadata(opts);

        const nextMetadata = metadata
          ? this.convertToNextMetadata(metadata)
          : {};

        // Deep merge: override > generated > fallback
        return this.mergeMetadata(opts.fallback, nextMetadata, opts.override);
      } catch (error) {
        console.warn("Failed to generate metadata:", error);
        return opts.fallback || {};
      }
    };
  }

  public getRootMetadata<Props = {}>(
    factory?: (
      props: Props,
      parent: ResolvingMetadata,
    ) =>
      | { override?: Metadata; fallback?: Metadata }
      | Promise<{ override?: Metadata; fallback?: Metadata }>,
  ) {
    return async (
      props: Props,
      parent: ResolvingMetadata,
    ): Promise<Metadata> => {
      const opts = factory ? await factory(props, parent) : {};
      // Return empty metadata merged with fallback and override
      return this.mergeMetadata(opts.fallback, {}, opts.override);
    };
  }

  // Override to provide framework-specific revalidation
  protected async revalidatePath(
    path: string | null,
    revalidate?: {
      pathRewrite?: (path: string | null) => string;
    },
  ): Promise<void> {
    const newPath = revalidate?.pathRewrite
      ? await revalidate.pathRewrite(path)
      : path;
    if (newPath !== null) {
      await revalidatePath(newPath);
    } else {
      // Revalidate all paths by revalidating the root layout
      await revalidatePath("/", "layout");
    }
  }

  protected async revalidate(
    path: string | null,
    options: {
      pathRewrite?: (path: string | null) => string;
    },
  ): Promise<void> {
    // Clear the internal cache
    this.clearCache(path);

    await this.revalidatePath(path, options);
  }

  /**
   * @deprecated Use `webhookHandler`. To migrate, move the route handler to `app/api/generate-metadata/route.ts` and remove `/revalidate` from the end of your webhook URL in the dashboard
   */
  public revalidateHandler(options: {
    revalidateSecret: string | undefined;
    basePath?: string;
  }) {
    // Get the Hono app from base class
    const app = this.createWebhookApp(
      {
        ...options,
        webhookSecret: options.revalidateSecret,
        revalidate: {},
      },
      {
        isOldRevalidateWebhook: true,
      },
    );

    // Return Next.js compatible handlers using Hono's Vercel adapter
    const handler = handle(app);

    return {
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
      OPTIONS: handler,
      HEAD: handler,
    };
  }

  public webhookHandler(options: {
    webhookSecret: string | undefined;
    basePath?: string;
    revalidate?: {
      pathRewrite?: (path: string | null) => string;
    };
  }) {
    // Get the Hono app from base class
    const app = this.createWebhookApp(
      {
        ...options,
        revalidate: options.revalidate || {},
      },
      {
        isOldRevalidateWebhook: false,
      },
    );

    // Return Next.js compatible handlers using Hono's Vercel adapter
    const handler = handle(app);

    return {
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
      OPTIONS: handler,
      HEAD: handler,
    };
  }
}
