import { GenerateMetadataClient } from "generate-metadata/next";
import { env as serverEnv } from "@/config/env/server";
import { env as clientEnv } from "@/config/env/client";

export const metadataClient = new GenerateMetadataClient({
  apiKey: serverEnv.GENERATE_METADATA_API_KEY,
  dsn: clientEnv.NEXT_PUBLIC_GENERATE_METADATA_DSN,
});
