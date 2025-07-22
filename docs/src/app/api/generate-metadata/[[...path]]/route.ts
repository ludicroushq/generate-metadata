import { env } from "@/config/env/server";
import { metadataClient } from "@/generate-metadata";

export const { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } =
  metadataClient.revalidateHandler({
    revalidateSecret: env.GENERATE_METADATA_REVALIDATE_SECRET,
  });
