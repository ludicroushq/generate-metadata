import type { OptionalFetcher } from "@tanstack/react-start";
import type {
  BaseApiClient,
  MetadataGetLatestArgs,
  MetadataGetLatestResponse,
} from ".";
import { z } from "zod";

export type ApiMethod = keyof BaseApiClient;

const schema = z.union([
  z.object({
    type: z.literal("metadataGetLatest"),
    args: z.any() as z.ZodType<MetadataGetLatestArgs>,
  }),
  z.object({
    type: z.literal("placeholder"),
  }),
]);
export const validator = (data: unknown) => schema.parse(data);

export type ServerFnType = OptionalFetcher<
  undefined,
  typeof validator,
  MetadataGetLatestResponse,
  "data"
>;

export class TanstackStartApiClient implements BaseApiClient {
  private serverFn: ServerFnType;

  constructor(serverFn: ServerFnType) {
    this.serverFn = serverFn;
  }

  async metadataGetLatest(args: MetadataGetLatestArgs) {
    const result = await this.serverFn({
      data: {
        type: "metadataGetLatest",
        args,
      },
    });
    return result as MetadataGetLatestResponse;
  }
}
