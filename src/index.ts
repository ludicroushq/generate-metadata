import { api } from "./utils/api";

export type GenerateMetadataClientBaseOptions = {
  apiKey?: string;
};
export class GenerateMetadataClientBase {
  apiKey: string | undefined;

  constructor(props: GenerateMetadataClientBaseOptions) {
    const { apiKey = process.env.GENERATE_METADATA_API_KEY } = props;

    if (process.env.NODE_ENV === "production" && !apiKey) {
      console.warn(
        "GenerateMetadata - API key was not passed in production mode.",
      );
    }

    this.apiKey = apiKey;
  }

  async getMetadata({
    path,
    opts = {},
  }: {
    path: string;
    opts?: { ai?: boolean };
  }) {
    if (!this.apiKey) {
      throw new Error("GenerateMetadata - API key is not set");
    }

    // TODO: opts + trigger scrape on build + caching

    try {
      const res = await api.GET("/api/v1/metadata", {
        params: {
          query: {
            path,
          },
          header: {
            authorization: `Bearer ${this.apiKey}`,
          },
        },
      });

      if (res.error) {
        return {
          ok: false,
          err: res.error,
        } as const;
      }

      return {
        ok: true,
        data: {
          ...res,
        },
      } as const;
    } catch (err) {
      return {
        ok: false,
        err,
      } as const;
    }
  }
}
