import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";
import { api } from "./utils/api";
import type { operations } from "./__generated__/api";

// Extract the metadata response type from the generated API types
export type MetadataApiResponse =
  operations["v1.metadata.getLatest"]["responses"]["200"]["content"]["application/json"];

export type GenerateMetadataOptions = {
  path: string;
};

export type GenerateMetadataClientBaseOptions = {
  dsn: string | undefined;
  apiKey?: string;
};

export abstract class GenerateMetadataClientBase {
  protected dsn: string | undefined;
  protected apiKey: string | undefined;
  protected cache: {
    latestMetadata: Map<string, MetadataApiResponse>;
  };

  constructor(props: GenerateMetadataClientBaseOptions) {
    const { dsn, apiKey } = props;

    this.dsn = dsn;
    this.apiKey = apiKey;
    this.cache = {
      latestMetadata: new Map(),
    };
  }
  protected abstract getFrameworkName(): "next" | "tanstack-start";

  protected async fetchMetadata(
    opts: GenerateMetadataOptions,
  ): Promise<MetadataApiResponse | null> {
    // If DSN is undefined, return empty metadata structure (development mode)
    if (this.dsn === undefined) {
      return {
        metadata: {},
      };
    }

    const cacheKey = opts.path;
    const cached = this.cache.latestMetadata.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const res = await api.GET("/v1/{dsn}/metadata/get-latest", {
        params: {
          path: {
            dsn: this.dsn,
          },
          query: {
            path: opts.path,
          },
        },
        ...(this.apiKey && {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }),
      });

      if (!res.data) {
        throw res.error;
      }

      this.cache.latestMetadata.set(cacheKey, res.data);

      return res.data;
    } catch (err) {
      console.warn(`Failed to fetch metadata for ${opts.path}:`, err);
      return null;
    }
  }

  protected clearCache(path: string | null): void {
    if (path !== null) {
      this.cache.latestMetadata.delete(path);
    } else {
      // If path is null, clear entire cache
      this.cache.latestMetadata.clear();
    }
  }

  // Abstract method to be implemented by framework adapters
  protected abstract revalidate(path: string | null): void;

  protected createRevalidateApp(options: {
    revalidateSecret: string;
    basePath?: string;
  }): Hono {
    const { revalidateSecret, basePath = "/api/generate-metadata" } = options;

    // Normalize basePath using URL constructor
    const normalizedBasePath = new URL(basePath, "http://example.com").pathname;

    // Create Hono app with basePath
    const app = new Hono().basePath(normalizedBasePath);

    // Add bearer auth middleware
    app.use("*", bearerAuth({ token: revalidateSecret }));

    // Define the request body schema
    const revalidateSchema = z.object({
      path: z.string().nullable(),
    });

    // Add POST /revalidate route
    app.post("/revalidate", async (c) => {
      try {
        const body = await c.req.json();

        // Validate the request body
        const validatedBody = revalidateSchema.parse(body);
        const { path } = validatedBody;

        // Call the revalidate function
        this.revalidate(path);

        return c.json({ success: true, revalidated: true, path }, 200);
      } catch (error) {
        console.error("[revalidateHandler] Error revalidating:", error);

        if (error instanceof z.ZodError) {
          return c.json(
            {
              error: "Invalid request body",
              details: error.errors,
            },
            400,
          );
        }

        return c.json(
          {
            error: "Failed to revalidate",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          500,
        );
      }
    });

    return app;
  }
}
