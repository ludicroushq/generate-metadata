import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_GENERATE_METADATA_DSN: z.string().min(1).optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_GENERATE_METADATA_DSN:
      process.env.NEXT_PUBLIC_GENERATE_METADATA_DSN,
  },
});
