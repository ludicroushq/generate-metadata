import merge from "lodash.merge";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { match } from "ts-pattern";
import {
  GenerateMetadataClientBase,
  type GenerateMetadataClientBaseOptions,
  type GenerateMetadataOptions,
  type MetadataApiResponse,
} from ".";

export type GenerateMetadataClientOptions =
  GenerateMetadataClientBaseOptions & {
    apiKey: string | undefined;
  };

export class GenerateMetadataClient extends GenerateMetadataClientBase {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(props: GenerateMetadataClientOptions) {
    super(props);
  }

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

    const keys: (keyof typeof metadata)[] = Object.keys(
      metadata,
    ) as (keyof typeof metadata)[];

    keys.forEach((key) => {
      match(key)
        .with("title", () => {
          nextMetadata.title = metadata.title;
        })
        .with("description", () => {
          nextMetadata.description = metadata.description;
        })
        .with("appleTouchIcon", () => {
          if (!nextMetadata.icons) {
            nextMetadata.icons = [];
          }

          if (!Array.isArray(nextMetadata.icons) || !metadata.appleTouchIcon) {
            return;
          }

          for (const icon of metadata.appleTouchIcon) {
            nextMetadata.icons.push({
              rel: "apple-touch-icon",
              url: icon.url,
              type: icon.mimeType,
              sizes: `${icon.width}x${icon.height}`,
            });
          }
        })
        .with("icon", () => {
          if (!nextMetadata.icons) {
            nextMetadata.icons = [];
          }

          if (!Array.isArray(nextMetadata.icons) || !metadata.icon) {
            return;
          }

          for (const icon of metadata.icon) {
            nextMetadata.icons.push({
              rel: "icon",
              url: icon.url,
              type: icon.mimeType,
              sizes: `${icon.width}x${icon.height}`,
            });
          }
        })
        .with("openGraph", () => {
          if (!metadata.openGraph) {
            return;
          }

          const ogKeys: (keyof typeof metadata.openGraph)[] = Object.keys(
            metadata.openGraph,
          ) as (keyof typeof metadata.openGraph)[];

          const openGraph: any = {};

          ogKeys.forEach((ogKey) => {
            match(ogKey)
              .with("title", () => {
                openGraph.title = metadata.openGraph!.title;
              })
              .with("description", () => {
                openGraph.description = metadata.openGraph!.description;
              })
              .with("images", () => {
                if (metadata.openGraph!.images) {
                  openGraph.images = metadata.openGraph!.images.map((img) => ({
                    url: img.url,
                    alt: img.alt || undefined,
                    width: img.width || undefined,
                    height: img.height || undefined,
                  }));
                }
              })
              .with("locale", () => {
                openGraph.locale = metadata.openGraph!.locale;
              })
              .with("siteName", () => {
                openGraph.siteName = metadata.openGraph!.siteName;
              })
              .with("type", () => {
                openGraph.type = metadata.openGraph!.type;
              })
              .with("image", () => {
                const ogImage = metadata.openGraph!.image;
                if (ogImage) {
                  if (!openGraph.images) {
                    openGraph.images = [];
                  }
                  openGraph.images.push({
                    url: ogImage.url,
                    alt: ogImage.alt || undefined,
                    width: ogImage.width || undefined,
                    height: ogImage.height || undefined,
                  });
                }
              })
              .exhaustive();
          });

          nextMetadata.openGraph = openGraph;
        })
        .with("twitter", () => {
          if (!metadata.twitter) {
            return;
          }

          const twitterKeys: (keyof typeof metadata.twitter)[] = Object.keys(
            metadata.twitter,
          ) as (keyof typeof metadata.twitter)[];

          const twitter: any = {};

          twitterKeys.forEach((twitterKey) => {
            match(twitterKey)
              .with("title", () => {
                twitter.title = metadata.twitter!.title;
              })
              .with("description", () => {
                twitter.description = metadata.twitter!.description;
              })
              .with("card", () => {
                if (metadata.twitter!.card) {
                  twitter.card = metadata.twitter!.card;
                }
              })
              .with("image", () => {
                const twitterImage = metadata.twitter!.image;
                if (twitterImage) {
                  twitter.images = [
                    {
                      url: twitterImage.url,
                      alt: twitterImage.alt || undefined,
                      width: twitterImage.width || undefined,
                      height: twitterImage.height || undefined,
                    },
                  ];
                }
              })
              .exhaustive();
          });

          nextMetadata.twitter = twitter;
        })
        .exhaustive();
    });

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

  public getRootMetadata<Props = {}>(
    factory?: (
      props: Props,
      parent: ResolvingMetadata,
    ) =>
      | { override?: Metadata; fallback?: Metadata }
      | Promise<{ override?: Metadata; fallback?: Metadata }>,
  ) {
    return async (
      props: Props,
      parent: ResolvingMetadata,
    ): Promise<Metadata> => {
      const opts = factory ? await factory(props, parent) : {};
      // Return empty metadata merged with fallback and override
      return this.mergeMetadata(opts.fallback, {}, opts.override);
    };
  }

  protected override revalidate(path: string | null): void {
    // Call base class revalidate to clear cache
    super.revalidate(path);

    // Also revalidate Next.js cache
    if (path !== null) {
      revalidatePath(path);
    } else {
      // Revalidate all paths
      revalidatePath("/", "layout");
    }
  }

  public revalidateHandler(options: {
    revalidateSecret: string;
    basePath?: string;
  }) {
    const { revalidateSecret, basePath = "/api/generate-metadata" } = options;

    // Normalize basePath using URL constructor
    const normalizedBasePath = new URL(basePath, "http://example.com").pathname;

    const handler = async (request: NextRequest): Promise<NextResponse> => {
      // Validate revalidate secret
      const authHeader = request.headers.get("authorization");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (bearerToken !== revalidateSecret) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing bearer token" },
          { status: 401 },
        );
      }

      const { pathname } = new URL(request.url);
      const method = request.method;

      // Extract route by removing basePath
      let route = pathname;
      if (pathname.startsWith(normalizedBasePath)) {
        route = pathname.slice(normalizedBasePath.length);
        // Ensure route starts with / or is empty
        if (route && !route.startsWith("/")) {
          route = "/" + route;
        }
      }

      console.log(
        `[revalidateHandler] ${method} ${pathname} -> route: ${route}`,
      );

      // Match routes using ts-pattern
      const response = await match({ method, route })
        .with({ method: "POST", route: "/revalidate" }, async () => {
          try {
            const body = (await request.json()) as { path: string | null };
            const { path } = body;

            // Call the revalidate function
            this.revalidate(path);

            return NextResponse.json(
              { success: true, revalidated: true, path },
              { status: 200 },
            );
          } catch (error) {
            console.error("[revalidateHandler] Error revalidating:", error);
            return NextResponse.json(
              {
                error: "Failed to revalidate",
                details:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 },
            );
          }
        })
        .otherwise(() => {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        });

      return response;
    };

    return {
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
      OPTIONS: handler,
      HEAD: handler,
    };
  }
}
