import assert from "assert";
import { api } from "./utils/api";

export type GenerateMetadataClientBaseOptions = {
  apiKey?: string;
  hostname: string;
};
export class GenerateMetadataClientBase {
  apiKey: string;
  hostname: string;

  constructor(props: GenerateMetadataClientBaseOptions) {
    const { apiKey = process.env.GENERATE_METADATA_API_KEY, hostname } = props;
    assert(apiKey, "apiKey is required");

    this.apiKey = apiKey;
    this.hostname = hostname;
  }

  async getMetadata({ path }: { path: string }) {
    try {
      const res = await api.GET("/api/v1/get-metadata", {
        params: {
          query: {
            path,
            hostname: this.hostname,
          },
        },
      });

      if (res.error) {
        return {
          ok: false,
          err: res,
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
