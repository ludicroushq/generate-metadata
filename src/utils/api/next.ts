import createClient from "openapi-fetch";
import { FetchApiClient } from "./fetch";
import { baseUrl } from ".";
import type { paths } from "../../__generated__/api";

export class NextApiClient extends FetchApiClient {
  constructor() {
    super();
    this.client = createClient<paths>({
      baseUrl,
      cache: "no-cache",
      next: { revalidate: 0 },
    });
  }
}
