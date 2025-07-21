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

  protected revalidate(path: string | null): void {
    if (path !== null) {
      this.cache.latestMetadata.delete(path);
    } else {
      // If path is null, clear entire cache
      this.cache.latestMetadata.clear();
    }
  }
}
