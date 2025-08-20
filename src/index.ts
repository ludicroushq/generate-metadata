import { type Context, Hono } from 'hono';
import { logger } from 'hono/logger';
import { validator } from 'hono/validator';
import type { Client } from 'openapi-fetch';
import type { operations, paths, webhooks } from './__generated__/api';
import { getApi } from './utils/api';
import { verifyHmacSignature } from './utils/crypto';
import createDebug, { type DebugFunction } from './utils/debug';
import { normalizePathname } from './utils/normalize-pathname';

const bearerTokenRegex = /^Bearer (.+)$/;

// Extract the metadata response type from the generated API types
export type MetadataApiResponse =
  operations['v1.metadata.getLatest']['responses']['200']['content']['application/json'];

export type GenerateMetadataOptions = {
  path: string | undefined;
  apiKey?: string;
};

type WebhookResponse = {
  200: webhooks['webhook']['post']['responses']['200']['content']['application/json'];
  401: webhooks['webhook']['post']['responses']['401']['content']['application/json'];
  500: webhooks['webhook']['post']['responses']['500']['content']['application/json'];
};

export type GenerateMetadataClientBaseOptions = {
  dsn: string | undefined;
  apiKey?: string | undefined;
  debug?: boolean;
};

export abstract class GenerateMetadataClientBase {
  protected dsn: string | undefined;
  protected apiKey: string | undefined;
  protected debug: DebugFunction;
  protected cache: {
    latestMetadata: Map<string, MetadataApiResponse>;
  };
  protected api: Client<paths, `${string}/${string}`>;

  constructor(props: GenerateMetadataClientBaseOptions) {
    const { dsn, apiKey, debug: debugEnabled = false } = props;

    this.dsn = dsn;
    this.apiKey = apiKey;
    this.debug = createDebug('generate-metadata', debugEnabled);
    this.cache = {
      latestMetadata: new Map(),
    };
    this.api = getApi(this.getFrameworkName());

    this.debug(
      'Initialized client with DSN:',
      dsn,
      'API key:',
      apiKey ? 'provided' : 'not provided'
    );
  }
  protected abstract getFrameworkName(): 'next' | 'tanstack-start';

  protected async fetchMetadata(
    opts: GenerateMetadataOptions
  ): Promise<MetadataApiResponse | null> {
    const normalizedPath = opts.path ? normalizePathname(opts.path) : undefined;
    this.debug('fetchMetadata called with path:', normalizedPath);

    // If DSN is undefined, return empty metadata structure (development mode)
    if (this.dsn === undefined) {
      this.debug(
        'DSN is undefined, returning empty metadata (development mode)'
      );
      return {
        metadata: {},
      };
    }

    const apiKey = opts.apiKey ?? this.apiKey;

    const cached = this.cache.latestMetadata.get(normalizedPath ?? '__ROOT__');
    if (cached) {
      this.debug('Found cached metadata for path:', normalizedPath);
      return cached;
    }

    this.debug(
      'No cached metadata found, fetching from API for path:',
      normalizedPath
    );
    try {
      const res = await this.api.GET('/v1/{dsn}/metadata/get-latest', {
        params: {
          path: {
            dsn: this.dsn,
          },
          query: {
            path: normalizedPath
              ? normalizePathname(normalizedPath)
              : undefined,
          },
        },
        ...(apiKey && {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }),
      });

      if (!res.data) {
        this.debug('API returned no data, error:', res.error);
        throw res.error;
      }

      this.debug(
        'Successfully fetched metadata from API for path:',
        normalizedPath
      );
      this.cache.latestMetadata.set(normalizedPath ?? '__ROOT__', res.data);

      return res.data;
    } catch (err) {
      this.debug(
        'Failed to fetch metadata for path:',
        normalizedPath,
        'Error:',
        err
      );
      return null;
    }
  }

  protected clearCache(path: string | null): void {
    const normalizedPath = normalizePathname(path);
    if (normalizedPath !== null) {
      this.debug('Clearing cache for path:', normalizedPath);
      this.cache.latestMetadata.delete(normalizedPath);
    } else {
      this.debug('Clearing entire cache');
      // If path is null, clear entire cache
      this.cache.latestMetadata.clear();
    }
  }

  // Abstract method to be implemented by framework adapters
  protected abstract revalidate(path: string | null): void | Promise<void>;

  // HMAC signature verification
  private async verifyHmacSignature(
    secret: string,
    signature: string,
    timestamp: string,
    rawBody: string
  ): Promise<boolean> {
    this.debug('Verifying HMAC signature');

    const isValid = await verifyHmacSignature(
      secret,
      signature,
      timestamp,
      rawBody
    );

    this.debug(
      'HMAC signature verification result:',
      isValid ? 'valid' : 'invalid'
    );
    return isValid;
  }

  protected createWebhookApp(options: {
    webhookHandler: (
      data: webhooks['webhook']['post']['requestBody']['content']['application/json']
    ) => Promise<undefined | Record<string, any>>;
    webhookSecret: string | undefined;
  }): Hono<any> {
    const { webhookSecret, webhookHandler } = options;

    this.debug(
      'Creating webhook app with secret:',
      webhookSecret ? 'provided' : 'not provided'
    );

    function respond<StatusCode extends 200 | 401 | 500>(
      c: Context,
      statusCode: StatusCode,
      body: WebhookResponse[StatusCode]
    ) {
      return c.json(body, statusCode);
    }

    const app = new Hono();
    app.use(logger());

    // If webhookSecret is undefined, return error for all routes
    if (webhookSecret === undefined) {
      this.debug('Webhook secret not configured, returning error handler');
      // biome-ignore lint/suspicious/useAwait: required
      app.use('*', async (c) => {
        return respond(c, 500, {
          error: 'Webhook secret is not configured',
          ok: false,
        });
      });
      return app;
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: easy
    app.use('*', async (c, next) => {
      // Check for HMAC signature verification
      const hmacSignature = c.req.header(
        'X-Webhook-Signature'
      ) as webhooks['webhook']['post']['parameters']['header']['X-Webhook-Signature'];
      const hmacTimestamp = c.req.header(
        'X-Webhook-Timestamp'
      ) as webhooks['webhook']['post']['parameters']['header']['X-Webhook-Timestamp'];
      const bearerToken = c.req.header(
        'Authorization'
      ) as webhooks['webhook']['post']['parameters']['header']['Authorization'];

      let isAuthenticated = false;

      this.debug(
        'Webhook auth check - HMAC:',
        hmacSignature ? 'present' : 'absent',
        'Bearer:',
        bearerToken ? 'present' : 'absent'
      );

      // Always try HMAC verification first if headers are present
      if (hmacSignature && hmacTimestamp) {
        try {
          // Get the raw body text for HMAC verification
          const rawBodyText = await c.req.text();

          // Use the raw body text for HMAC verification
          isAuthenticated = await this.verifyHmacSignature(
            webhookSecret,
            hmacSignature,
            hmacTimestamp,
            rawBodyText
          );

          // If HMAC headers are present and valid, we're done
          if (!isAuthenticated) {
            this.debug('HMAC verification failed, checking bearer token');
            // HMAC headers present but invalid - still check bearer token as fallback
            if (bearerToken) {
              const tokenMatch = bearerToken.match(bearerTokenRegex);
              if (tokenMatch && tokenMatch[1] === webhookSecret) {
                this.debug('Bearer token authentication successful');
                isAuthenticated = true;
              }
            }
          }
        } catch (error) {
          this.debug('HMAC verification error:', error);
          // Fall back to bearer token if HMAC verification fails
          if (bearerToken) {
            const tokenMatch = bearerToken.match(bearerTokenRegex);
            if (tokenMatch && tokenMatch[1] === webhookSecret) {
              this.debug(
                'Bearer token authentication successful (after HMAC error)'
              );
              isAuthenticated = true;
            }
          }
        }
      } else if (bearerToken) {
        // No HMAC headers, fall back to bearer auth only
        const tokenMatch = bearerToken.match(bearerTokenRegex);
        if (tokenMatch && tokenMatch[1] === webhookSecret) {
          this.debug(
            'Bearer token authentication successful (no HMAC headers)'
          );
          isAuthenticated = true;
        }
      }

      // If neither authentication method succeeds, return 401
      if (!isAuthenticated) {
        this.debug('Authentication failed, returning 401');
        return respond(c, 401, { error: 'Unauthorized', ok: false });
      }

      this.debug('Authentication successful');

      await next();
    });

    // Add POST route with validator
    app.post(
      '*',
      validator('json', (value) => {
        // Pass-through validator that just returns the value
        // This allows us to access both c.req.text() and the parsed JSON
        return value;
      }),
      async (c) => {
        try {
          // Get the validated JSON body
          const body: webhooks['webhook']['post']['requestBody']['content']['application/json'] =
            c.req.valid('json');

          this.debug('Webhook received with type:', body._type);

          const metadata = await webhookHandler(body);

          this.debug('Webhook handler completed successfully');

          return respond(c, 200, {
            metadata: metadata ?? {},
            ok: true,
          });
        } catch (error) {
          this.debug('Webhook handler error:', error);

          return respond(c, 500, {
            error: 'Failed to run webhook handler',
            metadata: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
            ok: false,
          });
        }
      }
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
    this.debug('Creating revalidate app (deprecated)');
    return this.createWebhookApp({
      webhookHandler: async (data) => {
        if (data._type !== 'metadata_update') {
          this.debug('Ignoring webhook type:', data._type);
          // Ignore other webhook types
          return;
        }

        const { path: originalPath } = data;
        const path = normalizePathname(originalPath);
        this.debug('Processing metadata_update for path:', path);

        this.clearCache(path);
        if (options.revalidatePath) {
          this.debug('Using custom revalidatePath function');
          await options.revalidatePath(path);
        } else {
          this.debug('Using framework revalidate method');
          await this.revalidate(path);
        }

        return { path, revalidated: true };
      },
      webhookSecret: options.revalidateSecret,
    });
  }
}
