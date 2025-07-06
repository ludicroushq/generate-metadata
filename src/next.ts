import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { generateBuildId } from "./utils/build-id";

export type GenerateMetadataClientOptions =
  GenerateMetadataClientBaseOptions & {
    revalidateSecret?: string;
  };

const revalidateRequestSchema = z.object({
  path: z.string().min(1, "Path is required"),
});

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  private revalidateSecret?: string;

  constructor(opts: GenerateMetadataClientOptions = {}) {
    // Disable cache for Next.js since it has its own caching
    super({ ...opts, disableCache: true });
    this.revalidateSecret = opts.revalidateSecret;
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

  protected async revalidate(opts: GenerateMetadataOptions) {
    revalidatePath(opts.path);
    this.revalidateCache(opts);

    return {
      ok: true,
      data: {
        success: true,
        message: `Revalidated path: ${opts.path}`,
      },
    } as const;
  }

  /**
   * Creates a revalidation route for Next.js API routes that can be called
   * by your server to revalidate metadata for specific paths.
   *
   * @param customPath Optional custom path for the revalidation route (defaults to '/api/generate-metadata/revalidate')
   * @returns An object with all HTTP method handlers for the Next.js API route
   *
   * @example
   * ```typescript
   * // app/api/generate-metadata/revalidate/route.ts
   * import { GenerateMetadataClient } from "generate-metadata/next";
   *
   * const client = new GenerateMetadataClient({
   *   revalidateSecret: process.env.GENERATE_METADATA_REVALIDATE_SECRET!,
   * });
   *
   * export const { GET, POST, PUT, DELETE, PATCH } = client.createRevalidateRoute();
   * ```
   */
  public createRevalidateRoute(customPath?: string) {
    if (!this.revalidateSecret) {
      throw new Error(
        "GenerateMetadataClient: revalidateSecret is required to create a revalidation route",
      );
    }

    const secret = this.revalidateSecret;
    const routePath = customPath || "/api/generate-metadata/revalidate";

    const handler = async (request: NextRequest) => {
      try {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");

        if (!token || token !== secret) {
          return NextResponse.json(
            { error: "Invalid or missing authorization token" },
            { status: 401 },
          );
        }

        const rawBody = await request.json();
        const parseResult = revalidateRequestSchema.safeParse(rawBody);

        if (!parseResult.success) {
          return NextResponse.json(
            {
              error: "Invalid request body",
              details: parseResult.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
              })),
            },
            { status: 400 },
          );
        }

        const { path: pathToRevalidate } = parseResult.data;

        revalidatePath(pathToRevalidate);

        return NextResponse.json({
          success: true,
          message: `Revalidated path: ${pathToRevalidate}`,
          route: routePath,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Revalidation error:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    };

    return {
      GET: handler,
      POST: handler,
      PUT: handler,
      DELETE: handler,
      PATCH: handler,
    };
  }
}
