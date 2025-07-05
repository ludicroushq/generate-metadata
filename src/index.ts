import { api } from "./utils/api";
import type { operations } from "./__generated__/api";

// Extract the metadata response type from the generated API types
export type MetadataApiResponse =
  operations["metadata.getLatest"]["responses"]["200"]["content"]["application/json"];

export type GenerateMetadataOptions = {
  path: string;
};

export type GenerateMetadataClientBaseOptions = {
  apiKey?: string;
  disableCache?: boolean;
};

export abstract class GenerateMetadataClientBase {
  apiKey: string | undefined;
  buildId: string;
  cache: Map<string, { cachedAt: Date; data: any }>;
  disableCache: boolean;
  private buildRegistered = false;

  constructor(props: GenerateMetadataClientBaseOptions) {
    const {
      apiKey = process.env.GENERATE_METADATA_API_KEY,
      disableCache = false,
    } = props;

    if (process.env.NODE_ENV === "production" && !apiKey) {
      console.warn(
        "GenerateMetadata - API key was not passed in production mode.",
      );
    }

    this.apiKey = apiKey;
    this.buildId = this.getBuildId();
    this.cache = new Map();
    this.disableCache = disableCache;
  }

  protected abstract getBuildId(): string;
  protected abstract getFrameworkName(): "next" | "tanstack-start";

  private async ensureBuildRegistered() {
    if (this.buildRegistered || !this.apiKey) {
      return;
    }

    try {
      await this.registerBuild({
        buildId: this.buildId,
        framework: this.getFrameworkName(),
      });
      this.buildRegistered = true;
    } catch (error) {
      console.warn("Failed to register build with generate-metadata:", error);
    }
  }

  async registerBuild({
    buildId,
    framework,
  }: {
    buildId: string;
    framework?: "next" | "tanstack-start";
  }) {
    if (!this.apiKey) {
      throw new Error("GenerateMetadata - API key is not set");
    }

    try {
      const res = await api.POST("/sites/register-build", {
        body: {
          buildId,
          framework,
        },
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!res.data || !res.data.success) {
        return {
          ok: false,
          err: new Error(res.data?.message || "Unknown error"),
        } as const;
      }

      return {
        ok: true,
        data: res.data,
      } as const;
    } catch (err) {
      return {
        ok: false,
        err,
      } as const;
    }
  }

  protected async getMetadata(
    opts: GenerateMetadataOptions,
  ): Promise<MetadataApiResponse | null> {
    // Check cache first if not disabled
    if (!this.disableCache) {
      const cacheKey = opts.path;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Ensure build is registered
    await this.ensureBuildRegistered();

    // Make API call
    if (!this.apiKey) {
      throw new Error("GenerateMetadata - API key is not set");
    }

    try {
      const res = await api.GET("/metadata/get-latest", {
        params: {
          query: {
            path: opts.path,
          },
        },
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!res.data) {
        console.warn(
          `Failed to fetch metadata for ${opts.path}: No response data`,
        );
        return null;
      }

      const response = res.data;

      // Cache the response if cache is enabled
      if (!this.disableCache) {
        const cacheKey = opts.path;
        this.cache.set(cacheKey, {
          cachedAt: new Date(),
          data: response,
        });
      }

      return response;
    } catch (err) {
      console.warn(`Failed to fetch metadata for ${opts.path}:`, err);
      return null;
    }
  }

  public revalidateCache(opts: GenerateMetadataOptions) {
    const cacheKey = opts.path;
    this.cache.delete(cacheKey);
  }
}
