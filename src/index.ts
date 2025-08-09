import { createHmac } from "crypto";
import createDebug from "debug";
import { Hono, type Context } from "hono";
import { logger } from "hono/logger";
import { validator } from "hono/validator";
import type { operations, webhooks } from "./__generated__/api";
import { api } from "./utils/api";

const debug = createDebug("generate-metadata");

// Extract the metadata response type from the generated API types
export type MetadataApiResponse =
  operations["v1.metadata.getLatest"]["responses"]["200"]["content"]["application/json"];

export type GenerateMetadataOptions = {
  path: string;
};

type WebhookResponse = {
  200: webhooks["webhook"]["post"]["responses"]["200"]["content"]["application/json"];
  401: webhooks["webhook"]["post"]["responses"]["401"]["content"]["application/json"];
  500: webhooks["webhook"]["post"]["responses"]["500"]["content"]["application/json"];
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

    debug(
      "Initialized client with DSN: %s, API key: %s",
      dsn,
      apiKey ? "provided" : "not provided",
    );
  }
  protected abstract getFrameworkName(): "next" | "tanstack-start";

  protected async fetchMetadata(
    opts: GenerateMetadataOptions,
  ): Promise<MetadataApiResponse | null> {
    debug("fetchMetadata called with path: %s", opts.path);

    // If DSN is undefined, return empty metadata structure (development mode)
    if (this.dsn === undefined) {
      debug("DSN is undefined, returning empty metadata (development mode)");
      return {
        metadata: {},
      };
    }

    const cacheKey = opts.path;
    const cached = this.cache.latestMetadata.get(cacheKey);
    if (cached) {
      debug("Found cached metadata for path: %s", opts.path);
      return cached;
    }

    debug(
      "No cached metadata found, fetching from API for path: %s",
      opts.path,
    );
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
        debug("API returned no data, error: %O", res.error);
        throw res.error;
      }

      debug("Successfully fetched metadata from API for path: %s", opts.path);
      this.cache.latestMetadata.set(cacheKey, res.data);

      return res.data;
    } catch (err) {
      debug("Failed to fetch metadata for path %s: %O", opts.path, err);
      console.warn(`Failed to fetch metadata for ${opts.path}:`, err);
      return null;
    }
  }

  protected clearCache(path: string | null): void {
    if (path !== null) {
      debug("Clearing cache for path: %s", path);
      this.cache.latestMetadata.delete(path);
    } else {
      debug("Clearing entire cache");
      // If path is null, clear entire cache
      this.cache.latestMetadata.clear();
    }
  }

  // Abstract method to be implemented by framework adapters
  protected abstract revalidate(path: string | null): void | Promise<void>;

  // HMAC signature verification
  private verifyHmacSignature(
    secret: string,
    signature: string,
    timestamp: string,
    rawBody: string,
  ): boolean {
    debug("Verifying HMAC signature");

    // Extract the actual signature from the sha256={signature} format
    const signatureMatch = signature.match(/^sha256=(.+)$/);
    if (!signatureMatch) {
      debug("Invalid signature format, expected sha256=...");
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
    const isValid = providedSignature === expectedSignature;
    debug(
      "HMAC signature verification result: %s",
      isValid ? "valid" : "invalid",
    );
    return isValid;
  }

  protected createWebhookApp(options: {
    webhookHandler: (
      data: webhooks["webhook"]["post"]["requestBody"]["content"]["application/json"],
    ) => Promise<void | Record<string, any>>;
    webhookSecret: string | undefined;
  }): Hono<any> {
    const { webhookSecret, webhookHandler } = options;

    debug(
      "Creating webhook app with secret: %s",
      webhookSecret ? "provided" : "not provided",
    );

    function respond<StatusCode extends 200 | 401 | 500>(
      c: Context,
      statusCode: StatusCode,
      body: WebhookResponse[StatusCode],
    ) {
      return c.json(body, statusCode);
    }

    const app = new Hono();
    app.use(logger());

    // If webhookSecret is undefined, return error for all routes
    if (webhookSecret === undefined) {
      debug("Webhook secret not configured, returning error handler");
      app.use("*", async (c) => {
        return respond(c, 500, {
          ok: false,
          error: "Webhook secret is not configured",
        });
      });
      return app;
    }

    app.use("*", async (c, next) => {
      // Check for HMAC signature verification
      const hmacSignature = c.req.header(
        "X-Webhook-Signature",
      ) as webhooks["webhook"]["post"]["parameters"]["header"]["X-Webhook-Signature"];
      const hmacTimestamp = c.req.header(
        "X-Webhook-Timestamp",
      ) as webhooks["webhook"]["post"]["parameters"]["header"]["X-Webhook-Timestamp"];
      const bearerToken = c.req.header(
        "Authorization",
      ) as webhooks["webhook"]["post"]["parameters"]["header"]["Authorization"];

      let isAuthenticated = false;

      debug(
        "Webhook auth check - HMAC: %s, Bearer: %s",
        hmacSignature ? "present" : "absent",
        bearerToken ? "present" : "absent",
      );

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
            debug("HMAC verification failed, checking bearer token");
            // HMAC headers present but invalid - still check bearer token as fallback
            if (bearerToken) {
              const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
              if (tokenMatch && tokenMatch[1] === webhookSecret) {
                debug("Bearer token authentication successful");
                isAuthenticated = true;
              }
            }
          }
        } catch (error) {
          console.error("Failed to verify HMAC:", error);
          debug("HMAC verification error: %O", error);
          // Fall back to bearer token if HMAC verification fails
          if (bearerToken) {
            const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
            if (tokenMatch && tokenMatch[1] === webhookSecret) {
              debug(
                "Bearer token authentication successful (after HMAC error)",
              );
              isAuthenticated = true;
            }
          }
        }
      } else {
        // No HMAC headers, fall back to bearer auth only
        if (bearerToken) {
          const tokenMatch = bearerToken.match(/^Bearer (.+)$/);
          if (tokenMatch && tokenMatch[1] === webhookSecret) {
            debug("Bearer token authentication successful (no HMAC headers)");
            isAuthenticated = true;
          }
        }
      }

      // If neither authentication method succeeds, return 401
      if (!isAuthenticated) {
        debug("Authentication failed, returning 401");
        return respond(c, 401, { ok: false, error: "Unauthorized" });
      }

      debug("Authentication successful");

      await next();
    });

    // Add POST route with validator
    app.post(
      "*",
      validator("json", (value) => {
        // Pass-through validator that just returns the value
        // This allows us to access both c.req.text() and the parsed JSON
        return value;
      }),
      async (c) => {
        try {
          // Get the validated JSON body
          const body: webhooks["webhook"]["post"]["requestBody"]["content"]["application/json"] =
            c.req.valid("json");

          debug("Webhook received with type: %s", body._type);

          const metadata = await webhookHandler(body);

          debug("Webhook handler completed successfully");

          return respond(c, 200, {
            ok: true,
            metadata: metadata ?? {},
          });
        } catch (error) {
          console.error("[webhook handler] Error handling webhook:", error);
          debug("Webhook handler error: %O", error);

          return respond(c, 500, {
            ok: false,
            error: "Failed to run webhook handler",
            metadata: {
              message: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      },
    );

    return app;
  }

  /**
   * @deprecated use createWebhookApp instead
   */
  protected createRevalidateApp(options: {
    revalidateSecret: string | undefined;
    basePath?: string;
    revalidatePath?: (path: string | null) => void | Promise<void>;
  }): Hono<any> {
    debug("Creating revalidate app (deprecated)");
    return this.createWebhookApp({
      webhookSecret: options.revalidateSecret,
      webhookHandler: async (data) => {
        if (data._type !== "metadata_update") {
          debug("Ignoring webhook type: %s", data._type);
          // Ignore other webhook types
          return;
        }

        const { path } = data;
        debug("Processing metadata_update for path: %s", path);

        this.clearCache(path);
        if (options.revalidatePath) {
          debug("Using custom revalidatePath function");
          await options.revalidatePath(path);
        } else {
          debug("Using framework revalidate method");
          await this.revalidate(path);
        }

        return { revalidated: true, path };
      },
    });
  }
}
