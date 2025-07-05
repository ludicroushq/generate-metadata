import type { Metadata, NextApiRequest, NextApiResponse } from "next";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { generateBuildId } from "./utils/build-id";

export type RevalidateRouteConfig = {
  /**
   * The path where the revalidation endpoint will be exposed.
   * @default "/api/generate-metadata/revalidate"
   */
  path?: string;
  /**
   * The secret key used to authenticate revalidation requests.
   * This should match the `REVALIDATION_SECRET` environment variable.
   */
  secret: string;
};

export type GenerateMetadataClientOptions = GenerateMetadataClientBaseOptions;

/**
 * Creates a Next.js API route handler for revalidating metadata.
 * This should be used in your `pages/api` or `app/api` directory.
 *
 * @example
 * // In pages/api/revalidate/route.ts or app/api/revalidate/route.ts
 * import { createRevalidationHandler } from "@your-package/next";
 *
 * export default createRevalidationHandler({
 *   secret: process.env.REVALIDATION_SECRET!,
 *   // Optional: path: "/api/custom-path/revalidate"
 * });
 */
export function createRevalidationHandler(config: RevalidateRouteConfig) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    // Verify the secret key
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1]; // Bearer <token>

    if (token !== config.secret) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ message: "Missing path parameter" });
    }

    try {
      // Revalidate the specific path
      await res.revalidate(path);
      return res.json({ revalidated: true });
    } catch (err) {
      console.error("Error revalidating:", err);
      return res.status(500).json({
        message: "Error revalidating",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };
}

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  constructor(opts: GenerateMetadataClientOptions = {}) {
    // Disable cache for Next.js since it has its own caching
    super({ ...opts, disableCache: true });
  }

  protected getBuildId(): string {
    return process.env.NEXT_BUILD_ID || generateBuildId();
  }

  protected getFrameworkName(): "next" {
    return "next";
  }

  private convertToNextMetadata(response: MetadataApiResponse): Metadata {
    if (!response.metadata) {
      return {};
    }

    const { metadata } = response;
    const nextMetadata: Metadata = {};

    if (metadata.title) {
      nextMetadata.title = metadata.title;
    }

    if (metadata.description) {
      nextMetadata.description = metadata.description;
    }

    if (metadata.openGraph) {
      nextMetadata.openGraph = {
        title: metadata.openGraph.title || undefined,
        description: metadata.openGraph.description || undefined,
        images: metadata.openGraph.images.map((img) => ({
          url: img.url,
          alt: img.alt || undefined,
          width: img.width || undefined,
          height: img.height || undefined,
        })),
      };
    }

    if (metadata.twitter) {
      nextMetadata.twitter = {
        title: metadata.twitter.title || undefined,
        description: metadata.twitter.description || undefined,
        ...(metadata.twitter.card && { card: metadata.twitter.card }),
        images: metadata.twitter.images.map((img) => ({
          url: img.url,
          alt: img.alt || undefined,
          width: img.width || undefined,
          height: img.height || undefined,
        })),
      };
    }

    return nextMetadata;
  }

  public generateMetadata(
    opts:
      | GenerateMetadataOptions
      | (() => GenerateMetadataOptions | Promise<GenerateMetadataOptions>),
  ) {
    return async (): Promise<Metadata> => {
      try {
        const resolvedOpts = typeof opts === "function" ? await opts() : opts;
        const response = await this.getMetadata(resolvedOpts);

        if (!response) {
          return {};
        }

        return this.convertToNextMetadata(response);
      } catch (error) {
        console.warn("Failed to generate metadata:", error);
        return {};
      }
    };
  }
}
