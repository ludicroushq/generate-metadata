import path from 'node:path';
import { remarkImage } from 'fumadocs-core/mdx-plugins';
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

// Options: https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  dir: 'content',
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [
      [remarkImage, { publicDir: path.join(process.cwd(), 'content') }],
    ],
    // MDX options
  },
});
