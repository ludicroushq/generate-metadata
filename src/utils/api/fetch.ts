import createClient, { type Client } from "openapi-fetch";
import { type BaseApiClient, baseUrl, type MetadataGetLatestArgs } from ".";
import type { paths } from "../../__generated__/api";

export class FetchApiClient implements BaseApiClient {
  client: Client<paths>;

  constructor() {
    this.client = createClient<paths>({
      baseUrl,
    });
  }

  async metadataGetLatest(args: MetadataGetLatestArgs) {
    return this.client.GET("/v1/{dsn}/metadata/get-latest", args);
  }
}
