import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { remarkImage } from "fumadocs-core/mdx-plugins";
import path from "path";

// Options: https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  dir: "content",
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [
      [remarkImage, { publicDir: path.join(process.cwd(), "content") }],
    ],
    // MDX options
  },
});
