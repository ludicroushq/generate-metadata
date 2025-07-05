import type { Metadata } from "next";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";
import { generateBuildId } from "./utils/build-id";
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

  /**
   * Returns a Next.js API route handler for revalidating metadata.
   *
   * Usage (app/api/generate-metadata/revalidate/route.ts):
   *
   *   import { GenerateMetadataClient } from 'generate-metadata/next';
   *   const client = new GenerateMetadataClient({ apiKey: process.env.GENERATE_METADATA_API_KEY });
   *   export const POST = client.getRevalidateRouteHandler({ secret: process.env.REVALIDATE_SECRET });
   *
   * @param opts.secret Secret key to authorize revalidation requests
   * @param opts.onRevalidate Optional callback after revalidation
   * @returns Next.js route handler (POST)
   */
  public getRevalidateRouteHandler({
    secret,
    onRevalidate,
  }: {
    secret: string;
    onRevalidate?: (path: string) => Promise<void> | void;
  }): (req: NextRequest) => Promise<Response> {
    return async (req: NextRequest) => {
      // Accepts POST only
      if (req.method && req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
        });
      }
      // Check secret
      const auth =
        req.headers.get("authorization") || req.headers.get("Authorization");
      if (!auth || auth !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }
      let body: any;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
        });
      }
      const path = body?.path;
      if (!path || typeof path !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing or invalid path" }),
          { status: 400 },
        );
      }
      this.revalidateCache({ path });
      if (onRevalidate) await onRevalidate(path);
      return new Response(JSON.stringify({ revalidated: true }), {
        status: 200,
      });
    };
  }
}
