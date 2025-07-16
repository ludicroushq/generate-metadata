import createClient from "openapi-fetch";
import type { paths } from "../__generated__/api";

const baseUrl =
  process.env.GENERATE_METADATA_NODE_ENV === "local"
    ? "http://localhost:3000/api/openapi"
    : "https://www.generate-metadata.com/api/openapi";

export const api = createClient<paths>({ baseUrl });
