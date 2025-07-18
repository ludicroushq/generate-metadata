import { GenerateMetadataClient } from "generate-metadata/next";

export const metadataClient = new GenerateMetadataClient({
  dsn: process.env.NEXT_PUBLIC_GENERATE_METADATA_DSN!,
  apiKey: process.env.GENERATE_METADATA_API_KEY!,
});
