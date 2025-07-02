import createClient from "openapi-fetch";
import type { paths } from "../__generated__/api";

export const api = createClient<paths>({
  baseUrl:
    process.env.GENERATE_METADATA_BASE_URL === "local"
      ? "http://localhost:3000"
      : "https://www.generate-metadata.com",
});
