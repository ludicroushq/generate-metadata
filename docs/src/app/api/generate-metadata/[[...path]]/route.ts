import { env } from "@/config/env/server";
import { metadataClient } from "@/generate-metadata";
import { revalidatePath } from "next/cache";

export const { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } =
  metadataClient.revalidateHandler({
    revalidateSecret: env.GENERATE_METADATA_REVALIDATE_SECRET,
    revalidatePath: (path) => {
      if (path === null) {
        revalidatePath("/", "layout");
        return;
      }
      const newPath = path.replace("/docs", "") || "/";
      revalidatePath(newPath);
    },
  });
