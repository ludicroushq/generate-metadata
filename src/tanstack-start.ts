import { promises as fs } from "fs";
import path from "path";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { generateBuildId } from "./utils/build-id";

export type RevalidateRouteConfig = {
  /**
   * The directory where the cache files are stored.
   * @default ".vercel/output/cache/generate-metadata"
   */
  cacheDir?: string;
  /**
   * The secret key used to authenticate revalidation requests.
   * This should match the `REVALIDATION_SECRET` environment variable.
   */
  secret: string;
};

/**
 * Creates a file-based API route handler for revalidating metadata in TanStack Start.
 * This should be used in your TanStack Start API routes.
 *
 * @example
 * // In your API route file (e.g., /api/revalidate/route.ts)
 * import { createRevalidationHandler } from "@your-package/tanstack-start";
 *
 * export const POST = createRevalidationHandler({
 *   secret: process.env.REVALIDATION_SECRET!,
 *   // Optional: cacheDir: "./custom-cache-dir"
 * });
 */
export function createRevalidationHandler(config: RevalidateRouteConfig) {
  const {
    cacheDir = path.join(
      process.cwd(),
      ".vercel",
      "output",
      "cache",
      "generate-metadata",
    ),
    secret,
  } = config;

  return async function handler(request: Request): Promise<Response> {
    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ message: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      // Verify the secret key
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.split(" ")[1]; // Bearer <token>

      if (token !== secret) {
        return new Response(JSON.stringify({ message: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = (await request.json()) as { path?: string };
      const pathToRevalidate = body.path;

      if (!pathToRevalidate) {
        return new Response(
          JSON.stringify({ message: "Missing path parameter" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Normalize the path
      const normalizedPath =
        pathToRevalidate.replace(/^\/+|\/+$/g, "") || "index";
      const cachePath = path.join(cacheDir, `${normalizedPath}.json`);

      try {
        // Delete the cache file if it exists
        await fs.unlink(cachePath);
        return new Response(
          JSON.stringify({
            revalidated: true,
            path: pathToRevalidate,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return new Response(
            JSON.stringify({
              revalidated: false,
              message: "Cache file not found",
              path: pathToRevalidate,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        throw error;
      }
    } catch (error) {
      console.error("Error revalidating:", error);
      return new Response(
        JSON.stringify({
          message: "Error revalidating",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  };
}

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
