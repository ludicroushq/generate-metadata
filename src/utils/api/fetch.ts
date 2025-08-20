import createClient, { type Client } from 'openapi-fetch';
import type { paths } from '../../__generated__/api';
import { type BaseApiClient, baseUrl, type MetadataGetLatestArgs } from '.';

export class FetchApiClient implements BaseApiClient {
  client: Client<paths>;

  constructor() {
    this.client = createClient<paths>({
      baseUrl,
    });
  }

  metadataGetLatest(args: MetadataGetLatestArgs) {
    return this.client.GET('/v1/{dsn}/metadata/get-latest', args);
  }
}
