import createDebug from "debug";
import { handle } from "hono/vercel";
import merge from "lodash.merge";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidatePath } from "next/cache";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { normalizePathname } from "./utils/normalize-pathname";

const debug = createDebug("generate-metadata:next");

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  protected getFrameworkName(): "next" {
    return "next";
  }

  private mergeMetadata(
    fallback: Metadata | undefined,
    generated: Metadata,
    override: Metadata | undefined,
  ): Metadata {
    debug(
      "Merging metadata - fallback: %s, generated: %s, override: %s",
      fallback ? "present" : "absent",
      generated ? "present" : "absent",
      override ? "present" : "absent",
    );
    // Deep merge: override > generated > fallback
    return merge({}, fallback || {}, generated, override || {});
  }

  private convertToNextMetadata(response: MetadataApiResponse): Metadata {
    debug("Converting API response to Next.js metadata");

    if (!response.metadata) {
      debug("No metadata in response");
      return {};
    }

    const { metadata } = response;
    const nextMetadata: Metadata = {};

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata,
    ) as (keyof typeof metadata)[];

    debug("Processing metadata keys: %O", keys);

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
          if (!metadata.customTags) {
            return;
          }

          debug("Processing %d custom tags", metadata.customTags.length);

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
      debug("getMetadata called");
      const opts = await factory(props, parent);
      const { path: originalPath, fallback, override } = opts;
      const path = normalizePathname(originalPath);
      debug("Factory returned options with path: %s", path);

      try {
        const metadata = await this.fetchMetadata(opts);

        const nextMetadata = metadata
          ? this.convertToNextMetadata(metadata)
          : {};

        // Deep merge: override > generated > fallback
        const result = this.mergeMetadata(fallback, nextMetadata, override);
        debug("Returning merged metadata");
        return result;
      } catch (error) {
        debug("Error generating metadata: %O", error);
        console.warn("Failed to generate metadata:", error);
        return fallback || {};
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

  protected async revalidate(path: string | null): Promise<void> {
    const normalizedPath = normalizePathname(path);
    if (normalizedPath !== null) {
      debug("Revalidating path: %s", normalizedPath);
      await revalidatePath(normalizedPath);
    } else {
      debug("Revalidating all paths (root layout)");
      // Revalidate all paths by revalidating the root layout
      await revalidatePath("/", "layout");
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
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
      OPTIONS: handler,
      HEAD: handler,
    };
  }

  public revalidateWebhookHandler(options: {
    webhookSecret: string | undefined;
    revalidate?: {
      pathRewrite?: (path: string | null) => string | null;
    };
  }) {
    debug("Creating revalidate webhook handler");

    // Get the Hono app from base class
    const app = this.createWebhookApp({
      webhookSecret: options.webhookSecret,
      webhookHandler: async (data) => {
        if (data._type !== "metadata_update") {
          debug("Ignoring webhook type: %s", data._type);
          // Ignore other webhook types
          return;
        }

        const { path: originalPath } = data;
        const normalizedPath = normalizePathname(originalPath);
        debug("Processing metadata_update webhook for path: %s", originalPath);

        const path = normalizePathname(
          options.revalidate?.pathRewrite?.(normalizedPath) ?? normalizedPath,
        );

        if (path !== normalizedPath) {
          debug("Path rewritten from %s to %s", normalizedPath, path);
        }

        this.clearCache(path);
        await this.revalidate(path);

        return { revalidated: true, path };
      },
    });

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
