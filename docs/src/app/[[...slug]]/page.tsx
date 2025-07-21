import { source } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { getMDXComponents } from "@/mdx-components";
import { Edit3 } from "lucide-react";
import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Cards, Card } from "fumadocs-ui/components/card";
import { metadataClient } from "@/generate-metadata";

export const generateMetadata = metadataClient.getMetadata(
  async (props: { params: Promise<{ slug?: string[] }> }) => {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    return {
      path: `/docs${page.url}`,
      fallback: {
        title: page.data.title,
        description: page.data.description,
      },
    };
  },
);

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            Tabs,
            Tab,
            Cards,
            Card,
          })}
        />

        <div className="mt-12 flex items-center justify-between border-t pt-8">
          <a
            href={`https://github.com/ludicroushq/generate-metadata/blob/main/docs/content/${page.file.path}`}
            rel="noreferrer noopener"
            target="_blank"
            className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground transition-all hover:text-fd-foreground"
          >
            <Edit3 className="h-4 w-4" />
            <span>Edit this page on GitHub</span>
          </a>
        </div>
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}
