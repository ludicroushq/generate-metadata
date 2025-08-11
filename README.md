<div align="center">

# generate-metadata

[![npm version](https://badge.fury.io/js/generate-metadata.svg)](https://badge.fury.io/js/generate-metadata)
[![npm downloads](https://img.shields.io/npm/dm/generate-metadata)](https://www.npmjs.com/package/generate-metadata)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

</div>

Stop writing SEO metadata by hand. Generate Metadata uses AI to automatically create optimized titles, descriptions, and social tags for every page of your website.

**Get started at [https://generate-metadata.com/](https://generate-metadata.com/)**

## Features

- 🤖 **AI-Powered** - Automatically generates optimized SEO metadata
- 🎯 **Framework Support** - Native adapters for Next.js and TanStack Start
- 🔒 **Type Safe** - Full TypeScript support with complete type safety
- ⚡ **Smart Caching** - Built-in caching with graceful fallback handling
- 🎨 **Social Ready** - OpenGraph and Twitter Card support out of the box
- 🛠️ **Override Control** - Can override when you need more control

## Installation

```bash
npm install generate-metadata
```

## Quick Start (Next.js)

### 1. Create metadata client

```ts
// lib/metadata.ts
import { GenerateMetadataClient } from "generate-metadata/next";

export const metadataClient = new GenerateMetadataClient({
  dsn: process.env.NEXT_PUBLIC_GENERATE_METADATA_DSN,
  apiKey: process.env.GENERATE_METADATA_API_KEY,
});
```

### 2. Use in your pages

```tsx
// app/page.tsx
import { metadataClient } from "@/lib/metadata";

export const generateMetadata = metadataClient.getMetadata(() => ({
  path: "/",
}));

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to My App</h1>
      <p>This page will have AI-optimized metadata!</p>
    </div>
  );
}
```

That's it! Your pages will now have AI-generated SEO metadata. 🎉

## Documentation

For complete documentation, examples, and API reference, visit:

**[https://generate-metadata.com/docs](https://generate-metadata.com/docs)**
