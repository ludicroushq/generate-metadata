import { createHmac } from "crypto";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { api } from "./utils/api";
import type { operations } from "./__generated__/api";
import { logger } from "hono/logger";

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
  protected abstract revalidate(
    path: string | null,
    options: {
      pathRewrite?: (path: string | null) => string;
    },
  ): void | Promise<void>;

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

  protected createWebhookApp(
    options: {
      webhookSecret: string | undefined;
      basePath?: string;
      revalidate: {
        pathRewrite?: (path: string | null) => string;
      };
    },
    backwardsCompat: { isOldRevalidateWebhook: boolean },
  ): Hono<any> {
    const {
      webhookSecret,
      basePath = "/api/generate-metadata",
      revalidate,
    } = options;

    // Normalize basePath using URL constructor
    const normalizedBasePath = new URL(basePath, "http://example.com").pathname;

    // Create Hono app with basePath
    const app = new Hono().basePath(normalizedBasePath);
    app.use(logger());

    // If revalidateSecret is undefined, return error for all routes
    if (webhookSecret === undefined) {
      app.use("*", async (c) => {
        return c.json({ error: "Revalidate secret is not configured" }, 500);
      });
      return app;
    }

    // Add authentication middleware for all requests
    app.use("*", async (c, next) => {
      // Check for HMAC signature verification
      const hmacSignature = c.req.header("X-Webhook-Signature");
      const hmacTimestamp = c.req.header("X-Webhook-Timestamp");
      const bearerToken = c.req.header("Authorization");

      let isAuthenticated = false;

      // Always try HMAC verification first if headers are present
      if (hmacSignature && hmacTimestamp) {
        try {
          // Get the raw body text for HMAC verification
          const rawBodyText = await c.req.text();

          // Use the raw body text for HMAC verification
          isAuthenticated = this.verifyHmacSignature(
            webhookSecret,
            hmacSignature,
            hmacTimestamp,
            rawBodyText,
          );

          // If HMAC headers are present and valid, we're done
          if (!isAuthenticated) {
            // HMAC headers present but invalid - still check bearer token as fallback
            if (bearerToken) {
              const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
              if (tokenMatch && tokenMatch[1] === webhookSecret) {
                isAuthenticated = true;
              }
            }
          }
        } catch (error) {
          console.error("Failed to verify HMAC:", error);
          // Fall back to bearer token if HMAC verification fails
          if (bearerToken) {
            const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
            if (tokenMatch && tokenMatch[1] === webhookSecret) {
              isAuthenticated = true;
            }
          }
        }
      } else {
        // No HMAC headers, fall back to bearer auth only
        if (bearerToken) {
          const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
          if (tokenMatch && tokenMatch[1] === webhookSecret) {
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

    // Add POST /revalidate route with validator
    app.post(
      backwardsCompat.isOldRevalidateWebhook ? "/revalidate" : "/",
      validator("json", (value) => {
        // Pass-through validator that just returns the value
        // This allows us to access both c.req.text() and the parsed JSON
        return value;
      }),
      async (c) => {
        try {
          // Get the validated JSON body
          const body = c.req.valid("json");

          // Validate the request body with Zod
          const validatedBody = revalidateSchema.parse(body);
          const { path } = validatedBody;

          // Call the revalidate function
          await this.revalidate(path, revalidate);

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
      },
    );

    return app;
  }
}
