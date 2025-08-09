import createClient from "openapi-fetch";
import type { paths } from "../__generated__/api";
import { match } from "ts-pattern";

const baseUrl =
  process.env.GENERATE_METADATA_NODE_ENV === "local"
    ? "http://localhost:3000/api/openapi"
    : "https://www.generate-metadata.com/api/openapi";

export function getApi(framework: "next" | "tanstack-start") {
  return match(framework)
    .with("next", () =>
      createClient<paths>({
        baseUrl,
        fetch(input) {
          return fetch(input, {
            cache: "no-store",
            next: {
              revalidate: 0,
            },
          });
        },
      }),
    )
    .with("tanstack-start", () => createClient<paths>({ baseUrl }))
    .exhaustive();
}
