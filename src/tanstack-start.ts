import merge from "lodash.merge";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";

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

    // Merge meta arrays with deduplication
    const allMeta = [
      ...(fallback?.meta || []),
      ...(generated.meta || []),
      ...(override?.meta || []),
    ];

    const metaMap = new Map();
    const nonIdentifiableMeta = [];

    for (const metaItem of allMeta) {
      if (metaItem.name) {
        metaMap.set(`name:${metaItem.name}`, metaItem);
      } else if (metaItem.property) {
        metaMap.set(`property:${metaItem.property}`, metaItem);
      } else if (metaItem.title) {
        metaMap.set("title", metaItem);
      } else {
        nonIdentifiableMeta.push(metaItem);
      }
    }

    if (metaMap.size > 0 || nonIdentifiableMeta.length > 0) {
      result.meta = [...Array.from(metaMap.values()), ...nonIdentifiableMeta];
    }

    return result;
  }

  private convertToTanstackHead(response: MetadataApiResponse): TanstackHead {
    if (!response.metadata) {
      return {};
    }

    const { metadata } = response;
    const meta: TanstackHead["meta"] = [];
    const links: TanstackHead["links"] = [];

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata,
    ) as (keyof typeof metadata)[];

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
              .exhaustive();
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
              .exhaustive();
          });
        })
        .exhaustive();
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
      const opts = await factory(ctx);
      try {
        const metadata = await this.fetchMetadata(opts);

        const tanstackHead = metadata
          ? this.convertToTanstackHead(metadata)
          : {};

        // Deep merge: override > generated > fallback
        return this.mergeMetadata(opts.fallback, tanstackHead, opts.override);
      } catch (error) {
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
}
