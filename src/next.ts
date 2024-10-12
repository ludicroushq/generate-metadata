import type { Metadata, ResolvingMetadata } from "next";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
} from ".";
import { generateMetadataStatus } from "./next/generate-metadata-status";

type NextGenerateMetadata<Props> = (
  props: Props,
  parent: ResolvingMetadata,
) => Promise<Metadata>;

type GenerateMetadataOptions = {
  path: string;
};

type GenerateMetadataClientOptions = GenerateMetadataClientBaseOptions & {};
export class GenerateMetadataClient extends GenerateMetadataClientBase {
  // biome-ignore lint/complexity/noUselessConstructor: <explanation>
  constructor(opts: GenerateMetadataClientOptions) {
    super(opts);
  }

  public generateMetadata<Props>(
    generateMetadataOptions: GenerateMetadataOptions,
  ): NextGenerateMetadata<Props> {
    return async (): Promise<Metadata> => {
      const path = generateMetadataOptions.path;
      const getMetadata = await this.getMetadata({ path });

      if (!getMetadata.ok) {
        console.error("Failed to fetch metadata for path: /:", getMetadata.err);
        return {
          other: {
            ...generateMetadataStatus({
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
              ...generateMetadataStatus({
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
                ...generateMetadataStatus({
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
                ...generateMetadataStatus({
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
                ...generateMetadataStatus({
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
