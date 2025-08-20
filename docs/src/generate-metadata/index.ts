import { GenerateMetadataClient } from 'generate-metadata/next';
import { env as clientEnv } from '@/config/env/client';
import { env as serverEnv } from '@/config/env/server';

export const metadataClient = new GenerateMetadataClient({
  apiKey: serverEnv.GENERATE_METADATA_API_KEY,
  debug: true,
  dsn: clientEnv.NEXT_PUBLIC_GENERATE_METADATA_DSN,
});
