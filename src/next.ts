import type { Metadata } from "next";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { generateBuildId } from "./utils/build-id";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

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

export type CreateRevalidateRouteOptions = {
  secret?: string;
  path?: string;
  client?: GenerateMetadataClient;
};

export function createRevalidateRoute(
  options: CreateRevalidateRouteOptions = {},
): (request: NextRequest) => Promise<Response> {
  const { secret = process.env.GENERATE_METADATA_REVALIDATE_SECRET, client } =
    options;

  return async function handler(request: NextRequest): Promise<Response> {
    try {
      // Check if method is POST
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      // Verify secret if provided
      if (secret) {
        const authHeader = request.headers.get("authorization");
        const providedSecret = authHeader?.replace("Bearer ", "");

        if (!providedSecret || providedSecret !== secret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
      }

      // Parse request body
      const body = (await request.json()) as { path?: string };
      const { path: pathToRevalidate } = body;

      if (!pathToRevalidate || typeof pathToRevalidate !== "string") {
        return Response.json(
          { error: "Missing or invalid 'path' in request body" },
          { status: 400 },
        );
      }

      // Revalidate Next.js cache
      revalidatePath(pathToRevalidate);

      // Revalidate client cache if client is provided
      if (client) {
        client.revalidateCache({ path: pathToRevalidate });
      }

      return Response.json({
        success: true,
        message: `Revalidated ${pathToRevalidate}`,
      });
    } catch (error) {
      console.error("Error in revalidate route:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
