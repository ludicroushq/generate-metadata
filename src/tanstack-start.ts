import { handle } from "hono/vercel";
import type { ServerFnCtx } from "@tanstack/react-start";
import _, { merge } from "es-toolkit/compat";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { FetchApiClient } from "./utils/api/fetch";
import {
  TanstackStartApiClient,
  validator,
  type ServerFnType,
} from "./utils/api/tanstack-start";
import { normalizePathname } from "./utils/normalize-pathname";

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
  protected getFrameworkName(): "tanstack-start" {
    return "tanstack-start";
  }

  private mergeMetadata(
    fallback: TanstackHead | undefined,
    generated: TanstackHead,
    override: TanstackHead | undefined,
  ): TanstackHead {
    this.debug(
      "Merging metadata - fallback:",
      fallback ? "present" : "absent",
      "generated:",
      generated ? "present" : "absent",
      "override:",
      override ? "present" : "absent",
    );

    // Merge non-meta properties (destructure to exclude meta)
    const { meta: _1, ...fallbackBase } = fallback || {};
    const { meta: _2, ...generatedBase } = generated;
    const { meta: _3, ...overrideBase } = override || {};

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

    this.debug("Merged metadata has", finalMeta.length, "meta tags");

    return result;
  }

  private convertToTanstackHead(response: MetadataApiResponse): TanstackHead {
    this.debug("Converting API response to TanStack Start head");

    if (!response.metadata) {
      this.debug("No metadata in response");
      return {};
    }

    const { metadata } = response;
    const meta: TanstackHead["meta"] = [];
    const links: TanstackHead["links"] = [];

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata,
    ) as (keyof typeof metadata)[];

    this.debug("Processing metadata keys:", keys);

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

          this.debug("Processing custom tags:", metadata.customTags.length);

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

  public async getHead(
    opts: Omit<GenerateMetadataOptions, "path"> & {
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
    },
  ) {
    this.debug("getHead called");
    const { path: originalPath, fallback, override, ctx } = opts;
    const path = normalizePathname(
      originalPath ?? _.last(ctx.matches)?.pathname ?? ctx.match.pathname,
    );
    this.debug("Factory returned options with path:", path);

    const data: GenerateMetadataOptions = {
      path,
    };

    try {
      const metadata = await this.fetchMetadata({
        ...data,
      });

      const tanstackHead = metadata ? this.convertToTanstackHead(metadata) : {};

      // Deep merge: override > generated > fallback
      const result = this.mergeMetadata(fallback, tanstackHead, override);
      this.debug("Returning merged head metadata");
      return result;
    } catch (error) {
      this.debug("Error getting head metadata:", error);
      console.warn("Failed to get head metadata:", error);
      return fallback || {};
    }
  }

  // Static validator for serverFn input
  public static serverFnValidator = validator;

  public static async serverFnHandler(
    ctx: ServerFnCtx<unknown, "data", undefined, typeof validator>,
    options: { apiKey: string | undefined },
  ) {
    const { apiKey } = options;
    const fetchApiClient = new FetchApiClient();

    if (ctx.data.type === "metadataGetLatest") {
      const response = await fetchApiClient.metadataGetLatest({
        ...ctx.data.args,
        headers: {
          ...ctx.data.args?.headers,
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return _.omit(response, "response");
    }

    throw new Error(
      `generate metadata server function called with unknown type ${ctx.data.type}`,
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
        }>,
  ) {
    return async (ctx: Ctx): Promise<TanstackHead> => {
      const opts = factory ? await factory(ctx) : {};
      // Return empty metadata merged with fallback and override
      return this.mergeMetadata(opts.fallback, { meta: [] }, opts.override);
    };
  }

  protected async triggerRevalidation(_path: string | null): Promise<void> {
    this.debug(
      "Revalidate called with path:",
      _path,
      "(no-op for TanStack Start)",
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
    this.debug("Creating revalidate webhook handler");

    // Get the Hono app from base class
    const app = this.createWebhookApp({
      webhookSecret: options.webhookSecret,
      webhookHandler: async (data) => {
        if (data._type !== "metadata_update") {
          this.debug("Ignoring webhook type:", data._type);
          // Ignore other webhook types
          return;
        }

        const { path: originalPath } = data;
        const normalizedPath = normalizePathname(originalPath);
        this.debug(
          "Processing metadata_update webhook for path:",
          normalizedPath,
        );

        const path = normalizePathname(
          options.revalidate?.pathRewrite?.(normalizedPath) ?? normalizedPath,
        );

        if (path !== normalizedPath) {
          this.debug("Path rewritten from", normalizedPath, "to", path);
        }

        this.clearCache(path);
        await this.triggerRevalidation(path);

        return { revalidated: true, path };
      },
    });

    const handler = handle(app);
    function handlerWrapper(ctx: { request: Request }) {
      return handler(ctx.request);
    }

    return {
      GET: handlerWrapper,
      POST: handlerWrapper,
      PUT: handlerWrapper,
      PATCH: handlerWrapper,
      DELETE: handlerWrapper,
      OPTIONS: handlerWrapper,
      HEAD: handlerWrapper,
    };
  }
}
