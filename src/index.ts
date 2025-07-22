import { createHmac } from "crypto";
import { Hono } from "hono";
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

  // HMAC signature verification
  private verifyHmacSignature(
    secret: string,
    signature: string,
    timestamp: string,
    rawBody: string,
  ): boolean {
    // Extract the actual signature from the sha256={signature} format
    const signatureMatch = signature.match(/^sha256=(.+)$/);
    if (!signatureMatch) {
      return false;
    }
    const providedSignature = signatureMatch[1];

    // Create the message to sign: timestamp + "." + rawBody
    const message = `${timestamp}.${rawBody}`;

    // Generate the expected signature
    const expectedSignature = createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    // Compare signatures using timing-safe comparison
    return providedSignature === expectedSignature;
  }

  protected createRevalidateApp(options: {
    revalidateSecret: string | undefined;
    basePath?: string;
  }): Hono<any> {
    const { revalidateSecret, basePath = "/api/generate-metadata" } = options;

    // Normalize basePath using URL constructor
    const normalizedBasePath = new URL(basePath, "http://example.com").pathname;

    // Create Hono app with basePath and typed context
    const app = new Hono<{
      Variables: {
        parsedBody: unknown;
      };
    }>().basePath(normalizedBasePath);

    // If revalidateSecret is undefined, return error for all routes
    if (revalidateSecret === undefined) {
      app.use("*", async (c) => {
        return c.json({ error: "Revalidate secret is not configured" }, 500);
      });
      return app;
    }

    // Add authentication middleware for all routes
    app.use("*", async (c, next) => {
      // Check for HMAC signature verification
      const hmacSignature = c.req.header("X-Webhook-Signature");
      const hmacTimestamp = c.req.header("X-Webhook-Timestamp");
      const bearerToken = c.req.header("Authorization");

      // Get the body for HMAC verification
      let body: unknown;
      let rawBodyText: string;

      // Try to get the raw body text first
      try {
        // Clone the request to preserve the body stream
        const clonedRequest = c.req.raw.clone();
        rawBodyText = await clonedRequest.text();

        // If the body is empty, try to get it from the request's json() method
        if (!rawBodyText || rawBodyText.trim() === "") {
          try {
            body = await c.req.json();
            rawBodyText = JSON.stringify(body);
          } catch {
            return c.json({ error: "Invalid or missing request body" }, 400);
          }
        } else {
          // Parse the raw body text
          try {
            body = JSON.parse(rawBodyText);
          } catch {
            return c.json({ error: "Invalid JSON body" }, 400);
          }
        }
      } catch (error) {
        // If cloning fails, try the regular json() method
        try {
          body = await c.req.json();
          rawBodyText = JSON.stringify(body);
        } catch {
          return c.json({ error: "Invalid or missing request body" }, 400);
        }
      }

      // Store parsed body in context for route handlers
      c.set("parsedBody", body);

      let isAuthenticated = false;

      // Always try HMAC verification first if headers are present
      if (hmacSignature && hmacTimestamp) {
        // Use the raw body text for HMAC verification
        isAuthenticated = this.verifyHmacSignature(
          revalidateSecret,
          hmacSignature,
          hmacTimestamp,
          rawBodyText,
        );

        // If HMAC headers are present and valid, we're done
        if (isAuthenticated) {
          // Authentication successful via HMAC
        } else {
          // HMAC headers present but invalid - still check bearer token as fallback
          if (bearerToken) {
            const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
            if (tokenMatch && tokenMatch[1] === revalidateSecret) {
              isAuthenticated = true;
            }
          }
        }
      } else {
        // No HMAC headers, fall back to bearer auth only
        if (bearerToken) {
          const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
          if (tokenMatch && tokenMatch[1] === revalidateSecret) {
            isAuthenticated = true;
          }
        }
      }

      // If neither authentication method succeeds, return 401
      if (!isAuthenticated) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await next();
    });

    // Define the request body schema
    const revalidateSchema = z.object({
      path: z.string().nullable(),
    });

    // Add POST /revalidate route
    app.post("/revalidate", async (c) => {
      try {
        // Get the parsed body from context
        const body = c.get("parsedBody");

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
