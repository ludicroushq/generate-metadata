import type { Metadata } from "next";
import type { components } from "../__generated__/api";

type Status = {
  status: components["schemas"]["get-metadata-response"]["status"];
  message?: string;
};
export function generateMetadataStatus(status: Status): Metadata["other"] {
  const metadata: Record<string, string> = {
    "generate-metadata:status": status.status,
  };

  if (status.message) {
    metadata["generate-metadata:message"] = status.message;
  }

  return metadata;
}
