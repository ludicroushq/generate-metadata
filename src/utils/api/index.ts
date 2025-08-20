import type { FetchOptions, FetchResponse } from 'openapi-fetch';
import type { paths } from '../../__generated__/api';

export const baseUrl =
  process.env.GENERATE_METADATA_NODE_ENV === 'local'
    ? 'http://localhost:3000/api/openapi'
    : 'https://www.generate-metadata.com/api/openapi';

export type MetadataGetLatestArgs = FetchOptions<
  paths['/v1/{dsn}/metadata/get-latest']['get']
>;
export type MetadataGetLatestResponse = Pick<
  FetchResponse<
    paths['/v1/{dsn}/metadata/get-latest']['get'],
    {},
    `${string}/${string}`
  >,
  'data' | 'error'
>;

export type BaseApiClient = {
  metadataGetLatest(
    args: MetadataGetLatestArgs
  ): Promise<MetadataGetLatestResponse>;
};
