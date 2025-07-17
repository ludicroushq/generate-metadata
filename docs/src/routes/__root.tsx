import { type ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/base";
import appCss from "../app.css?url";
import { TanstackProvider } from "fumadocs-core/framework/tanstack";
import { getHeader } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start";

const getHost = createServerFn().handler(() => {
  return {
    host: getHeader("host"),
  };
});

export const Route = createRootRoute({
  async beforeLoad(ctx) {
    const { host } = await getHost();

    if (process.env.NODE_ENV === "development") {
      return;
    }

    if (host !== "generate-metadata.com") {
      throw redirect({
        href: "https://generate-metadata.com/docs",
      });
    }
  },
  head: async () => {
    const { host } = await getHost();

    return {
      meta: [
        ...(process.env.NODE_ENV === "production" &&
        host !== "generate-metadata.com"
          ? [
              {
                name: "x-robots-tag",
                content: "noindex",
              },
            ]
          : []),
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: "Fumadocs on TanStack Start",
        },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
    };
  },
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <TanstackProvider>
          <RootProvider
            theme={{
              enabled: false,
            }}
          >
            {children}
          </RootProvider>
        </TanstackProvider>
        <Scripts />
      </body>
    </html>
  );
}
