import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  experimental__runtimeEnv: process.env,
  server: {
    GENERATE_METADATA_API_KEY: z.string().min(1).optional(),
    GENERATE_METADATA_WEBHOOK_SECRET: z.string().min(1).optional(),
  },
});
