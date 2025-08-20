import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import { Edit3 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { metadataClient } from '@/generate-metadata';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';

export const generateMetadata = metadataClient.getMetadata(
  async (props: { params: Promise<{ slug?: string[] }> }) => {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) {
      notFound();
    }

    return {
      fallback: {
        description: page.data.description,
        title: page.data.title,
      },
      path: `/docs${page.url}`,
    };
  }
);

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const MDXContent = page.data.body;

  return (
    <DocsPage full={page.data.full} toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            Card,
            Cards,
            Tab,
            Tabs,
          })}
        />

        <div className="mt-12 flex items-center justify-between border-t pt-8">
          <a
            className="inline-flex items-center gap-2 text-fd-muted-foreground text-sm transition-all hover:text-fd-foreground"
            href={`https://github.com/ludicroushq/generate-metadata/blob/main/docs/content/${page.file.path}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            <Edit3 className="h-4 w-4" />
            <span>Edit this page on GitHub</span>
          </a>
        </div>
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}
