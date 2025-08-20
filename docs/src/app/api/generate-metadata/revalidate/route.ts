import { env } from '@/config/env/server';
import { metadataClient } from '@/generate-metadata';

export const { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } =
  metadataClient.revalidateWebhookHandler({
    revalidate: {
      pathRewrite(path) {
        if (path === null) {
          return null;
        }
        const newPath = path.replace('/docs', '') || '/';
        return newPath;
      },
    },
    webhookSecret: env.GENERATE_METADATA_WEBHOOK_SECRET,
  });
