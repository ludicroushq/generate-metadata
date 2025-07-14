import merge from "lodash.merge";
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
    // Start with base structure
    const result: TanstackHead = {};

    // Merge non-meta properties normally using lodash.merge
    const nonMetaFallback = { ...fallback };
    const nonMetaGenerated = { ...generated };
    const nonMetaOverride = { ...override };

    delete nonMetaFallback?.meta;
    delete nonMetaGenerated?.meta;
    delete nonMetaOverride?.meta;

    const mergedBase = merge(
      {},
      nonMetaFallback || {},
      nonMetaGenerated,
      nonMetaOverride || {},
    );
    Object.assign(result, mergedBase);

    // Handle meta arrays with deduplication and priority
    const allMeta = [
      ...(fallback?.meta || []),
      ...(generated.meta || []),
      ...(override?.meta || []),
    ];

    if (allMeta.length > 0) {
      const metaMap = new Map<string, any>();

      // Process in priority order: fallback -> generated -> override
      for (const metaItem of allMeta) {
        const key = this.getMetaKey(metaItem);
        if (key) {
          metaMap.set(key, metaItem);
        }
      }

      result.meta = Array.from(metaMap.values());
    }

    return result;
  }

  private getMetaKey(metaItem: any): string | null {
    // Create a unique key for meta items to handle deduplication
    if (metaItem.name) {
      return `name:${metaItem.name}`;
    }
    if (metaItem.property) {
      return `property:${metaItem.property}`;
    }
    if (metaItem.title !== undefined) {
      return "title";
    }
    // For items without identifiable keys, return null (they won't be deduplicated)
    return null;
  }

  private convertToTanstackHead(response: MetadataApiResponse): TanstackHead {
    if (!response.metadata) {
      return {};
    }

    const { metadata } = response;
    const meta: TanstackHead["meta"] = [];
    const links: TanstackHead["links"] = [];

    // Add title as meta tag
    if (metadata.title) {
      meta.push({ name: "title", content: metadata.title });
      meta.push({ title: metadata.title });
    }

    // Add description
    if (metadata.description) {
      meta.push({ name: "description", content: metadata.description });
    }

    // Add favicon
    if (metadata.favicon) {
      links.push({
        rel: "icon",
        href: metadata.favicon.url,
        ...(metadata.favicon.width &&
          metadata.favicon.height && {
            sizes: `${metadata.favicon.width}x${metadata.favicon.height}`,
          }),
      });
    }

    // Add OpenGraph meta tags
    if (metadata.openGraph) {
      if (metadata.openGraph.title) {
        meta.push({ property: "og:title", content: metadata.openGraph.title });
      }
      if (metadata.openGraph.description) {
        meta.push({
          property: "og:description",
          content: metadata.openGraph.description,
        });
      }
      if (metadata.openGraph.image) {
        meta.push({
          property: "og:image",
          content: metadata.openGraph.image.url,
        });
        if (metadata.openGraph.image.alt) {
          meta.push({
            property: "og:image:alt",
            content: metadata.openGraph.image.alt,
          });
        }
      }
      metadata.openGraph.images.forEach((img) => {
        meta.push({ property: "og:image", content: img.url });
        if (img.alt) {
          meta.push({ property: "og:image:alt", content: img.alt });
        }
      });
    }

    // Add Twitter meta tags
    if (metadata.twitter) {
      if (metadata.twitter.card) {
        meta.push({ name: "twitter:card", content: metadata.twitter.card });
      }
      if (metadata.twitter.title) {
        meta.push({ name: "twitter:title", content: metadata.twitter.title });
      }
      if (metadata.twitter.description) {
        meta.push({
          name: "twitter:description",
          content: metadata.twitter.description,
        });
      }

      // Twitter cards only support a single image
      const twitterImage = metadata.twitter.image;
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
    }

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

  public getRootHead<Ctx = any>(
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
      // For now, return empty metadata merged with fallback and override
      return this.mergeMetadata(opts.fallback, { meta: [] }, opts.override);
    };
  }
}
