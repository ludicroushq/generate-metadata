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

  private convertToTanstackHead(response: MetadataApiResponse): TanstackHead {
    if (!response.metadata) {
      return {};
    }

    const { metadata } = response;
    const meta: TanstackHead["meta"] = [];

    // Add title as meta tag
    if (metadata.title) {
      meta.push({ name: "title", content: metadata.title });
      meta.push({ title: metadata.title });
    }

    // Add description
    if (metadata.description) {
      meta.push({ name: "description", content: metadata.description });
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
      if (metadata.twitter.image) {
        meta.push({
          name: "twitter:image",
          content: metadata.twitter.image.url,
        });
      }
      metadata.twitter.images.forEach((img) => {
        meta.push({ name: "twitter:image", content: img.url });
      });
    }

    return { meta };
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
        const metadata = await this.getMetadata(opts);

        const tanstackHead = metadata
          ? this.convertToTanstackHead(metadata)
          : {};

        // Deep merge: override > generated > fallback
        const result = merge(
          {},
          opts.fallback || {},
          tanstackHead,
          opts.override || {},
        );

        return result;
      } catch (error) {
        console.warn("Failed to get head metadata:", error);
        return opts.fallback || {};
      }
    };
  }
}
