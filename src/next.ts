import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Metadata, ResolvingMetadata } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/dist/shared/lib/constants";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
} from ".";
import type { components } from "./__generated__/api";

type NextGenerateMetadata<Props> = (
  props: Props,
  parent: ResolvingMetadata,
) => Promise<Metadata>;

type GenerateMetadataOptions = {
  path: string;
};

type Status = {
  status: components["schemas"]["get-metadata-response"]["status"];
  message?: string;
};

type GenerateMetadataClientOptions = GenerateMetadataClientBaseOptions & {};

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex");
}

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  buildId: string;
  constructor(opts: GenerateMetadataClientOptions) {
    super(opts);
    this.buildId = this.getBuildId();
  }

  private getBuildId() {
    try {
      const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
      return fs.readFileSync(buildIdPath, "utf8").trim();
    } catch (err) {
      return crypto.randomUUID();
    }
  }

  private generateMetadataStatus(status: Status): Metadata["other"] {
    const metadata: Record<string, string> = {
      "generate-metadata:status": status.status,
      "generate-metadata:build-id": md5(this.buildId),
    };

    if (status.message) {
      metadata["generate-metadata:message"] = status.message;
    }

    return metadata;
  }

  public generateMetadata<Props>(
    generateMetadataOptions: GenerateMetadataOptions,
  ): NextGenerateMetadata<Props> {
    if (!this.apiKey) {
      return async (): Promise<Metadata> => ({
        title: `${generateMetadataOptions.path} - GenerateMetadata`,
        other: {
          ...this.generateMetadataStatus({
            status: "error",
            message: "GenerateMetadata - API key is not set",
          }),
        },
      });
    }

    const isProduction = process.env.NODE_ENV === "production";
    const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
    const isProductionBuild = isProduction && isBuildPhase;
    const isProductionLambda = isProduction && !isBuildPhase;

    return async (): Promise<Metadata> => {
      const path = generateMetadataOptions.path;
      const getMetadata = await this.getMetadata({ path });

      if (!getMetadata.ok) {
        console.error(
          "Failed to fetch metadata for path: /:",
          JSON.stringify(getMetadata.err),
        );
        return {
          other: {
            ...this.generateMetadataStatus({
              status: "error",
              message: "Failed to fetch metadata",
            }),
          },
        };
      }

      return match(getMetadata.data.data)
        .with({ status: "error" }, (data) => {
          console.error(
            "Failed to generate metadata for path: /:",
            data.message,
          );
          return {
            other: {
              ...this.generateMetadataStatus({
                status: "error",
                message: data.message,
              }),
            },
          };
        })
        .with(
          {
            status: "pending",
          },
          () => {
            return {
              other: {
                ...this.generateMetadataStatus({
                  status: "pending",
                }),
              },
            };
          },
        )
        .with(
          {
            status: "missing",
          },
          () => {
            return {
              other: {
                ...this.generateMetadataStatus({
                  status: "missing",
                }),
              },
            };
          },
        )
        .with(
          {
            status: "success",
          },
          {
            status: "revalidating",
          },
          (data): Metadata => {
            return {
              title: data.metadata.title,
              description: data.metadata.description,
              openGraph: {
                title: data.metadata.openGraph.title,
                description: data.metadata.openGraph.description,
              },
              alternates: {
                canonical: data.metadata.alternates.canonical,
              },
              other: {
                ...this.generateMetadataStatus({
                  status: data.status,
                }),
              },
            };
          },
        )
        .exhaustive();
    };
  }
}
