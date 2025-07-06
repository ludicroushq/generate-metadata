import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { generateBuildId } from "./utils/build-id";

// TanStack Start's head function return type
type TanstackHeadResult = {
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
    name?: string;
    property?: string;
    content: string;
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
  protected getBuildId(): string {
    return generateBuildId();
  }

  protected getFrameworkName(): "tanstack-start" {
    return "tanstack-start";
  }

  private convertToTanstackHead(
    response: MetadataApiResponse,
  ): TanstackHeadResult {
    if (!response.metadata) {
      return {};
    }

    const { metadata } = response;
    const meta: Array<{ name?: string; property?: string; content: string }> =
      [];

    // Add title as meta tag
    if (metadata.title) {
      meta.push({ name: "title", content: metadata.title });
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

  protected async revalidate(opts: GenerateMetadataOptions) {
    this.revalidateCache(opts);

    return {
      ok: true,
      data: {
        success: true,
        message: `Cleared cache for path: ${opts.path}`,
      },
    } as const;
  }

  public getHead<T = any>(
    opts:
      | GenerateMetadataOptions
      | (() => GenerateMetadataOptions | Promise<GenerateMetadataOptions>),
    customizationFn?: (
      metadata: MetadataApiResponse | null,
      ctx: T,
    ) => TanstackHeadResult | Promise<TanstackHeadResult>,
  ) {
    return async (ctx: T): Promise<TanstackHeadResult> => {
      try {
        const resolvedOpts = typeof opts === "function" ? await opts() : opts;
        const response = await this.getMetadata(resolvedOpts);

        // If customization function is provided, use it
        if (customizationFn) {
          return await customizationFn(response, ctx);
        }

        // Otherwise, return the default conversion
        if (!response) {
          return {};
        }

        return this.convertToTanstackHead(response);
      } catch (error) {
        console.warn("Failed to get head metadata:", error);

        // If customization function is provided, call it with null
        if (customizationFn) {
          return await customizationFn(null, ctx);
        }

        return {};
      }
    };
  }
}
