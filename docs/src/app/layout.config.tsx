import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { GithubIcon, HomeIcon } from 'lucide-react';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  githubUrl: 'https://github.com/ludicroushq/generate-metadata',
  links: [
    {
      icon: <HomeIcon />,
      text: 'Home',
      url: 'https://www.generate-metadata.com',
    },
    {
      external: true,
      icon: <GithubIcon />,
      text: 'GitHub',
      url: 'https://github.com/ludicroushq/generate-metadata',
    },
    {
      external: true,
      text: 'npm',
      url: 'https://www.npmjs.com/package/generate-metadata',
    },
  ],
  nav: {
    title: <>Generate Metadata</>,
  },
  themeSwitch: {
    enabled: false,
  },
};
