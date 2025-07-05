import type { Metadata } from "next";
import type { NextRequest } from "next/server";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { generateBuildId } from "./utils/build-id";

export type GenerateMetadataClientOptions = GenerateMetadataClientBaseOptions;

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

export type CreateRevalidateHandlerOptions = {
  client: GenerateMetadataClient;
  secretKey: string;
  path?: string;
};

export function createRevalidateHandler(
  options: CreateRevalidateHandlerOptions,
): (request: NextRequest) => Promise<Response> {
  const {
    client,
    secretKey,
    path = "/api/generate-metadata/revalidate",
  } = options;

  return async function revalidateHandler(request: NextRequest) {
    try {
      // Check if the request path matches the configured path
      const url = new URL(request.url);
      if (url.pathname !== path) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      // Only allow POST requests
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      // Verify secret key
      const providedSecret = request.headers.get("x-secret-key");
      if (!providedSecret || providedSecret !== secretKey) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const body = (await request.json()) as { path?: string };
      const { path: pagePath } = body;

      if (!pagePath || typeof pagePath !== "string") {
        return Response.json(
          { error: "Invalid path parameter" },
          { status: 400 },
        );
      }

      // Revalidate the cache for the specified path
      client.revalidateCache({ path: pagePath });

      return Response.json({
        success: true,
        message: `Cache revalidated for path: ${pagePath}`,
      });
    } catch (error) {
      console.error("Revalidate handler error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
