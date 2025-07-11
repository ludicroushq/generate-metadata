import { api } from "./utils/api";
import type { operations } from "./__generated__/api";

// Extract the metadata response type from the generated API types
export type MetadataApiResponse =
  operations["v1.metadata.getLatest"]["responses"]["200"]["content"]["application/json"];

export type GenerateMetadataOptions = {
  path: string;
};

export type GenerateMetadataClientBaseOptions = {
  dsn: string;
};

export abstract class GenerateMetadataClientBase {
  protected dsn: string;
  protected cache: {
    latestMetadata: Map<string, MetadataApiResponse>;
  };

  constructor(props: GenerateMetadataClientBaseOptions) {
    const { dsn } = props;

    this.dsn = dsn;
    this.cache = {
      latestMetadata: new Map(),
    };
  }
  protected abstract getFrameworkName(): "next" | "tanstack-start";

  protected async getMetadata(
    opts: GenerateMetadataOptions,
  ): Promise<MetadataApiResponse | null> {
    const cacheKey = opts.path;
    const cached = this.cache.latestMetadata.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Make API call

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
}
