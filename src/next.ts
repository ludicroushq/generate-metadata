import type { Metadata, ResolvingMetadata } from "next";
import merge from "lodash.merge";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";

export type GenerateMetadataClientOptions = GenerateMetadataClientBaseOptions;

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  protected getFrameworkName(): "next" {
    return "next";
  }

  private mergeMetadata(
    fallback: Metadata | undefined,
    generated: Metadata,
    override: Metadata | undefined,
  ): Metadata {
    // Deep merge: override > generated > fallback
    return merge({}, fallback || {}, generated, override || {});
  }

  private convertToNextMetadata(response: MetadataApiResponse): Metadata {
    if (!response.metadata) {
      return {};
    }

    const { metadata } = response;
    const nextMetadata: Metadata = {};

    if (metadata.title) {
      nextMetadata.title = metadata.title;
    }

    if (metadata.description) {
      nextMetadata.description = metadata.description;
    }

    if (metadata.favicon) {
      nextMetadata.icons = {
        icon: {
          url: metadata.favicon.url,
          ...(metadata.favicon.width && { width: metadata.favicon.width }),
          ...(metadata.favicon.height && { height: metadata.favicon.height }),
        },
      };
    }

    if (metadata.openGraph) {
      nextMetadata.openGraph = {
        title: metadata.openGraph.title || undefined,
        description: metadata.openGraph.description || undefined,
        images: metadata.openGraph.images.map((img) => ({
          url: img.url,
          alt: img.alt || undefined,
          width: img.width || undefined,
          height: img.height || undefined,
        })),
      };
    }

    if (metadata.twitter) {
      // Twitter cards only support a single image
      const twitterImage = metadata.twitter.image;

      nextMetadata.twitter = {
        title: metadata.twitter.title || undefined,
        description: metadata.twitter.description || undefined,
        ...(metadata.twitter.card && { card: metadata.twitter.card }),
        ...(twitterImage && {
          images: [
            {
              url: twitterImage.url,
              alt: twitterImage.alt || undefined,
              width: twitterImage.width || undefined,
              height: twitterImage.height || undefined,
            },
          ],
        }),
      };
    }

    return nextMetadata;
  }

  public getMetadata<Props>(
    factory: (
      props: Props,
      parent: ResolvingMetadata,
    ) =>
      | (GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata })
      | Promise<
          GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata }
        >,
  ) {
    return async (
      props: Props,
      parent: ResolvingMetadata,
    ): Promise<Metadata> => {
      const opts = await factory(props, parent);
      try {
        const metadata = await this.fetchMetadata(opts);

        const nextMetadata = metadata
          ? this.convertToNextMetadata(metadata)
          : {};

        // Deep merge: override > generated > fallback
        return this.mergeMetadata(opts.fallback, nextMetadata, opts.override);
      } catch (error) {
        console.warn("Failed to generate metadata:", error);
        return opts.fallback || {};
      }
    };
  }

  public getRootMetadata<Props>(
    factory: (
      props: Props,
      parent: ResolvingMetadata,
    ) =>
      | (GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata })
      | Promise<
          GenerateMetadataOptions & { override?: Metadata; fallback?: Metadata }
        >,
  ) {
    return async (
      props: Props,
      parent: ResolvingMetadata,
    ): Promise<Metadata> => {
      const opts = await factory(props, parent);
      // For now, return empty metadata merged with fallback and override
      return this.mergeMetadata(opts.fallback, {}, opts.override);
    };
  }
}
