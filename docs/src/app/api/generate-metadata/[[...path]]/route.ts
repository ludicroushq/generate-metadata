import { env } from "@/config/env/server";
import { metadataClient } from "@/generate-metadata";
import { revalidatePath } from "next/cache";

export const { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } =
  metadataClient.revalidateHandler({
    revalidateSecret: env.GENERATE_METADATA_REVALIDATE_SECRET,
    revalidatePath: (path) => {
      console.log("Revalidating path:", path);
      if (path === null) {
        console.log("Path is null, revalidating root layout");
        revalidatePath("/", "layout");
        return;
      }
      const newPath = path.replace("/docs", "") || "/";
      console.log("Revalidating path:", newPath);
      revalidatePath(newPath);
    },
  });
