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

export type CreateRevalidateServerFnOptions = {
  secret?: string;
  client?: GenerateMetadataClient;
};

export function createRevalidateServerFn(
  options: CreateRevalidateServerFnOptions = {},
) {
  const { secret = process.env.GENERATE_METADATA_REVALIDATE_SECRET, client } =
    options;

  // Import createServerFn - this will be tree-shaken in environments where it's not available
  let createServerFn: any;
  try {
    createServerFn = require("@tanstack/react-start").createServerFn;
  } catch (error) {
    throw new Error(
      "createRevalidateServerFn requires @tanstack/react-start to be installed. " +
        "Please install it with: npm install @tanstack/react-start",
    );
  }

  return createServerFn({ method: "POST" })
    .validator((data: unknown) => {
      if (typeof data !== "object" || data === null) {
        throw new Error("Invalid request body");
      }

      const body = data as Record<string, unknown>;
      const { path, authorization } = body;

      if (typeof path !== "string" || !path) {
        throw new Error("Missing or invalid 'path' in request body");
      }

      if (secret && typeof authorization !== "string") {
        throw new Error("Missing authorization header");
      }

      if (secret && authorization !== `Bearer ${secret}`) {
        throw new Error("Invalid authorization token");
      }

      return { path };
    })
    .handler(async ({ data }: { data: { path: string } }) => {
      try {
        // Revalidate client cache if client is provided
        if (client) {
          client.revalidateCache({ path: data.path });
        }

        return {
          success: true,
          message: `Revalidated ${data.path}`,
        };
      } catch (error) {
        console.error("Error in revalidate server function:", error);
        throw new Error("Failed to revalidate cache");
      }
    });
}
