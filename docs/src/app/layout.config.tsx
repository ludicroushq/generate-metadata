import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { HomeIcon, GithubIcon } from "lucide-react";

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  themeSwitch: {
    enabled: false,
  },
  nav: {
    title: <>Generate Metadata</>,
  },
  links: [
    {
      text: "Home",
      url: "https://www.generate-metadata.com",
      icon: <HomeIcon />,
    },
    {
      text: "GitHub",
      url: "https://github.com/ludicroushq/generate-metadata",
      icon: <GithubIcon />,
      external: true,
    },
    {
      text: "npm",
      url: "https://www.npmjs.com/package/generate-metadata",
      external: true,
    },
  ],
  githubUrl: "https://github.com/ludicroushq/generate-metadata",
};
