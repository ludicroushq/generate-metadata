import { metadataClient } from "@/generate-metadata";

export const { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } =
  metadataClient.revalidateHandler({
    revalidateSecret: process.env.GENERATE_METADATA_REVALIDATE_SECRET!,
  });
