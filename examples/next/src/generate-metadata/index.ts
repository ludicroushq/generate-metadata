import { GenerateMetadataClient } from 'generate-metadata/next';

export const metadataClient = new GenerateMetadataClient({
  apiKey: process.env.GENERATE_METADATA_API_KEY,
  dsn: process.env.NEXT_PUBLIC_GENERATE_METADATA_DSN,
});
