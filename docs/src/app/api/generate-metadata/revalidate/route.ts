import { env } from "@/config/env/server";
import { metadataClient } from "@/generate-metadata";

export const { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } =
  metadataClient.revalidateWebhookHandler({
    webhookSecret: env.GENERATE_METADATA_WEBHOOK_SECRET,
    revalidate: {
      pathRewrite(path) {
        console.log("Rewriting revalidate path:", path);
        if (path === null) {
          return null;
        }
        const newPath = path.replace("/docs", "") || "/";
        return newPath;
      },
    },
  });
