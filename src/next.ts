import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Metadata, ResolvingMetadata } from "next";
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
  opts?: {};
};

type Status = {
  status: components["schemas"]["metadata-response"]["status"];
  message?: string;
};

type GenerateMetadataClientOptions = GenerateMetadataClientBaseOptions & {};

// function md5(str: string): string {
//   return crypto.createHash("md5").update(str).digest("hex");
// }

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  buildId: string;
  cache: Record<
    string,
    {
      cachedAt: Date;
      data: components["schemas"]["metadata-response"];
    }
  > = {};
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
      // "generate-metadata:build-id": md5(this.buildId),
    };

    if (status.message) {
      metadata["generate-metadata:message"] = status.message;
    }

    return metadata;
  }

  private _generateMetadata<Props>(
    getGenerateMetadataOptions: (
      props: Props,
      parent: ResolvingMetadata,
    ) => Promise<GenerateMetadataOptions> | GenerateMetadataOptions,
  ): NextGenerateMetadata<Props> {
    const isProduction = process.env.NODE_ENV === "production";
    // const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
    // const isProductionBuild = isProduction && isBuildPhase;
    // const isProductionLambda = isProduction && !isBuildPhase;

    if (!this.apiKey) {
      const warnOrError = isProduction ? console.error : console.warn;
      warnOrError("GenerateMetadata - API key is not set.");

      return async (props, parent): Promise<Metadata> => {
        const generateMetadataOptions = await getGenerateMetadataOptions(
          props,
          parent,
        );
        return {
          title: `${generateMetadataOptions.path} - GenerateMetadata`,
          other: {
            ...this.generateMetadataStatus({
              status: "error",
              message: "GenerateMetadata - API key is not set",
            }),
          },
        };
      };
    }

    return async (props, parent): Promise<Metadata> => {
      const generateMetadataOptions = await getGenerateMetadataOptions(
        props,
        parent,
      );
      const { path, opts } = generateMetadataOptions;
      try {
        const getMetadata = await (async () => {
          const cached = this.cache[path];
          if (cached) {
            return cached.data;
          }
          const getMetadata = await this.getMetadata({ path, opts });
          if (!getMetadata.ok) {
            throw getMetadata.err;
          }

          this.cache[path] = {
            cachedAt: new Date(),
            data: getMetadata.data.data,
          };
          return getMetadata.data.data;
        })();

        return match(getMetadata)
          .with({ status: "error" }, (data) => {
            console.error(
              `Failed to generate metadata for path: ${path}:`,
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
                  title: data.metadata.openGraph?.title,
                  description: data.metadata.openGraph?.description,
                },
                alternates: {
                  canonical: data.metadata.alternates?.canonical,
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
      } catch (err) {
        console.error(
          "Failed to fetch metadata for path: /",
          err instanceof Error ? err.message : err,
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
    };
  }

  public generateMetadata<Props>(
    generateMetadataOptions: GenerateMetadataOptions,
  ): NextGenerateMetadata<Props>;
  public generateMetadata<Props>(
    generateMetadataFn: (
      props: Props,
      parent: ResolvingMetadata,
    ) => Promise<GenerateMetadataOptions> | GenerateMetadataOptions,
  ): NextGenerateMetadata<Props>;
  public generateMetadata<Props>(
    generateMetadataOptionsOrFn:
      | GenerateMetadataOptions
      | ((
          props: Props,
          parent: ResolvingMetadata,
        ) => Promise<GenerateMetadataOptions> | GenerateMetadataOptions),
  ): NextGenerateMetadata<Props> {
    return this._generateMetadata(
      typeof generateMetadataOptionsOrFn === "function"
        ? generateMetadataOptionsOrFn
        : () => generateMetadataOptionsOrFn,
    );
  }
}
