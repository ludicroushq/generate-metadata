import createDebug from "debug";
import merge from "lodash.merge";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";

const debug = createDebug("generate-metadata:tanstack-start");

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
  protected getFrameworkName(): "tanstack-start" {
    return "tanstack-start";
  }

  private mergeMetadata(
    fallback: TanstackHead | undefined,
    generated: TanstackHead,
    override: TanstackHead | undefined,
  ): TanstackHead {
    debug(
      "Merging metadata - fallback: %s, generated: %s, override: %s",
      fallback ? "present" : "absent",
      generated ? "present" : "absent",
      override ? "present" : "absent",
    );

    // Merge non-meta properties (destructure to exclude meta)
    const { meta: _, ...fallbackBase } = fallback || {};
    const { meta: __, ...generatedBase } = generated;
    const { meta: ___, ...overrideBase } = override || {};

    const result: TanstackHead = merge(
      {},
      fallbackBase,
      generatedBase,
      overrideBase,
    );

    // Helper function to get meta key for deduplication
    const getMetaKey = (metaItem: any): string | null => {
      if (metaItem.name) return `name:${metaItem.name}`;
      if (metaItem.property) return `property:${metaItem.property}`;
      if (metaItem.title) return "title";
      return null;
    };

    // Helper function to remove all occurrences of items with the given keys
    const removeByKeys = (items: any[], keysToRemove: Set<string>): any[] => {
      return items.filter((item) => {
        const key = getMetaKey(item);
        return !key || !keysToRemove.has(key);
      });
    };

    // Start with fallback meta
    let finalMeta = [...(fallback?.meta || [])];

    // Add generated meta, removing any duplicates from fallback first
    if (generated.meta) {
      const generatedKeys = new Set<string>();
      for (const metaItem of generated.meta) {
        const key = getMetaKey(metaItem);
        if (key) generatedKeys.add(key);
      }
      finalMeta = removeByKeys(finalMeta, generatedKeys);
      finalMeta.push(...generated.meta);
    }

    // Add override meta, removing any duplicates from existing meta first
    if (override?.meta) {
      const overrideKeys = new Set<string>();
      for (const metaItem of override.meta) {
        const key = getMetaKey(metaItem);
        if (key) overrideKeys.add(key);
      }
      finalMeta = removeByKeys(finalMeta, overrideKeys);
      finalMeta.push(...override.meta);
    }

    if (finalMeta.length > 0) {
      result.meta = finalMeta;
    }

    debug("Merged metadata has %d meta tags", finalMeta.length);

    return result;
  }

  private convertToTanstackHead(response: MetadataApiResponse): TanstackHead {
    debug("Converting API response to TanStack Start head");

    if (!response.metadata) {
      debug("No metadata in response");
      return {};
    }

    const { metadata } = response;
    const meta: TanstackHead["meta"] = [];
    const links: TanstackHead["links"] = [];

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata,
    ) as (keyof typeof metadata)[];

    debug("Processing metadata keys: %O", keys);

    keys.forEach((key) => {
      match(key)
        .with("title", () => {
          if (metadata.title) {
            meta.push({ name: "title", content: metadata.title });
            meta.push({ title: metadata.title });
          }
        })
        .with("description", () => {
          if (metadata.description) {
            meta.push({ name: "description", content: metadata.description });
          }
        })
        .with("icon", () => {
          if (metadata.icon) {
            for (const icon of metadata.icon) {
              links.push({
                rel: "icon",
                href: icon.url,
                type: icon.mimeType,
                sizes: `${icon.width}x${icon.height}`,
              });
            }
          }
        })
        .with("appleTouchIcon", () => {
          if (metadata.appleTouchIcon) {
            for (const icon of metadata.appleTouchIcon) {
              links.push({
                rel: "apple-touch-icon",
                href: icon.url,
                type: icon.mimeType,
                sizes: `${icon.width}x${icon.height}`,
              });
            }
          }
        })
        .with("openGraph", () => {
          if (!metadata.openGraph) {
            return;
          }

          const ogKeys: (keyof typeof metadata.openGraph)[] = Object.keys(
            metadata.openGraph,
          ) as (keyof typeof metadata.openGraph)[];

          const openGraph = metadata.openGraph;

          ogKeys.forEach((ogKey) => {
            match(ogKey)
              .with("title", () => {
                if (openGraph.title) {
                  meta.push({
                    property: "og:title",
                    content: openGraph.title,
                  });
                }
              })
              .with("description", () => {
                if (openGraph.description) {
                  meta.push({
                    property: "og:description",
                    content: openGraph.description,
                  });
                }
              })
              .with("locale", () => {
                if (openGraph.locale) {
                  meta.push({
                    property: "og:locale",
                    content: openGraph.locale,
                  });
                }
              })
              .with("siteName", () => {
                if (openGraph.siteName) {
                  meta.push({
                    property: "og:site_name",
                    content: openGraph.siteName,
                  });
                }
              })
              .with("type", () => {
                if (openGraph.type) {
                  meta.push({
                    property: "og:type",
                    content: openGraph.type,
                  });
                }
              })
              .with("image", () => {
                const ogImage = openGraph.image;
                if (ogImage) {
                  meta.push({
                    property: "og:image",
                    content: ogImage.url,
                  });
                  if (ogImage.alt) {
                    meta.push({
                      property: "og:image:alt",
                      content: ogImage.alt,
                    });
                  }
                }
              })
              .with("images", () => {
                if (openGraph.images) {
                  openGraph.images.forEach((img) => {
                    meta.push({ property: "og:image", content: img.url });
                    if (img.alt) {
                      meta.push({ property: "og:image:alt", content: img.alt });
                    }
                  });
                }
              })
              .with("url", () => {})
              .with("determiner", () => {})
              .with("localeAlternate", () => {})
              .exhaustive(() => {});
          });
        })
        .with("twitter", () => {
          if (!metadata.twitter) {
            return;
          }

          const twitterKeys: (keyof typeof metadata.twitter)[] = Object.keys(
            metadata.twitter,
          ) as (keyof typeof metadata.twitter)[];

          const twitter = metadata.twitter;

          twitterKeys.forEach((twitterKey) => {
            match(twitterKey)
              .with("title", () => {
                if (twitter.title) {
                  meta.push({
                    name: "twitter:title",
                    content: twitter.title,
                  });
                }
              })
              .with("description", () => {
                if (twitter.description) {
                  meta.push({
                    name: "twitter:description",
                    content: twitter.description,
                  });
                }
              })
              .with("card", () => {
                if (twitter.card) {
                  meta.push({
                    name: "twitter:card",
                    content: twitter.card,
                  });
                }
              })
              .with("image", () => {
                const twitterImage = twitter.image;
                if (twitterImage) {
                  meta.push({
                    name: "twitter:image",
                    content: twitterImage.url,
                  });
                  if (twitterImage.alt) {
                    meta.push({
                      name: "twitter:image:alt",
                      content: twitterImage.alt,
                    });
                  }
                }
              })
              .exhaustive(() => {});
          });
        })
        .with("noindex", () => {
          if (metadata.noindex) {
            meta.push({ name: "robots", content: "noindex,nofollow" });
          }
        })
        .with("customTags", () => {
          if (!metadata.customTags) {
            return;
          }

          debug("Processing %d custom tags", metadata.customTags.length);

          // Handle custom tags - convert to TanStack Start format
          for (const tag of metadata.customTags) {
            meta.push({
              name: tag.name,
              content: tag.content,
            });
          }
        })
        .exhaustive(() => {});
    });

    return {
      meta,
      ...(links.length > 0 && { links }),
    };
  }

  public getHead<Ctx = any>(
    factory: (ctx: Ctx) =>
      | (GenerateMetadataOptions & {
          override?: TanstackHead;
          fallback?: TanstackHead;
        })
      | Promise<
          GenerateMetadataOptions & {
            override?: TanstackHead;
            fallback?: TanstackHead;
          }
        >,
  ) {
    return async (ctx: Ctx): Promise<TanstackHead> => {
      debug("getHead called");
      const opts = await factory(ctx);
      debug("Factory returned options with path: %s", opts.path);

      try {
        const metadata = await this.fetchMetadata(opts);

        const tanstackHead = metadata
          ? this.convertToTanstackHead(metadata)
          : {};

        // Deep merge: override > generated > fallback
        const result = this.mergeMetadata(
          opts.fallback,
          tanstackHead,
          opts.override,
        );
        debug("Returning merged head metadata");
        return result;
      } catch (error) {
        debug("Error getting head metadata: %O", error);
        console.warn("Failed to get head metadata:", error);
        return opts.fallback || {};
      }
    };
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
        }>,
  ) {
    return async (ctx: Ctx): Promise<TanstackHead> => {
      const opts = factory ? await factory(ctx) : {};
      // Return empty metadata merged with fallback and override
      return this.mergeMetadata(opts.fallback, { meta: [] }, opts.override);
    };
  }

  protected async revalidate(_path: string | null): Promise<void> {
    debug("Revalidate called with path: %s (no-op for TanStack Start)", _path);
    // TanStack Start doesn't have a built-in revalidation mechanism
    // So we just return void
  }

  public revalidateWebhookHandler(options: {
    webhookSecret: string | undefined;
    revalidate?: {
      pathRewrite?: (path: string | null) => string;
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
        debug("Processing metadata_update webhook for path: %s", originalPath);

        const path =
          options.revalidate?.pathRewrite?.(originalPath) ?? originalPath;

        if (path !== originalPath) {
          debug("Path rewritten from %s to %s", originalPath, path);
        }

        this.clearCache(path);
        await this.revalidate(path);

        return { revalidated: true, path };
      },
    });

    // Return the Hono app directly for TanStack Start
    // TanStack Start can use Hono directly or users can wrap it as needed
    return app;
  }
}
