import type { OptionalFetcher } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  BaseApiClient,
  MetadataGetLatestArgs,
  MetadataGetLatestResponse,
} from '.';

export type ApiMethod = keyof BaseApiClient;

const schema = z.union([
  z.object({
    args: z.any() as z.ZodType<MetadataGetLatestArgs>,
    type: z.literal('metadataGetLatest'),
  }),
  z.object({
    type: z.literal('placeholder'),
  }),
]);
export const validator = (data: unknown) => schema.parse(data);

export type ServerFnType = OptionalFetcher<
  undefined,
  typeof validator,
  MetadataGetLatestResponse,
  'data'
>;

export class TanstackStartApiClient implements BaseApiClient {
  private readonly serverFn: ServerFnType;

  constructor(serverFn: ServerFnType) {
    this.serverFn = serverFn;
  }

  async metadataGetLatest(args: MetadataGetLatestArgs) {
    const result = await this.serverFn({
      data: {
        args,
        type: 'metadataGetLatest',
      },
    });
    return result as MetadataGetLatestResponse;
  }
}
