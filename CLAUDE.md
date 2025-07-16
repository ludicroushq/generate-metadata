# CLAUDE.md - Project Documentation

> **Important**: This file should be kept up-to-date by all Claude agents working on this project. When making changes to the codebase, always update this documentation to reflect new functionality, architectural changes, or important implementation details.

## Project Overview

**generate-metadata** is a TypeScript library that provides framework-agnostic metadata generation for web applications by fetching metadata from a remote API service. It specializes in generating SEO-critical metadata (title, description, Open Graph, Twitter cards, favicons) for dynamic content.

### Key Value Proposition

- **Dynamic SEO**: Generate metadata from a remote API rather than static files
- **Framework Support**: Native adapters for Next.js and TanStack Start
- **Type Safety**: Complete OpenAPI-generated types for all interactions
- **Performance**: Built-in caching and graceful fallback handling
- **Developer Experience**: Clean, predictable API with comprehensive testing

## Architecture

### Core Components

```
src/
├── index.ts              # Base class and shared types
├── next.ts               # Next.js framework adapter
├── tanstack-start.ts     # TanStack Start framework adapter
├── utils/
│   └── api.ts           # OpenAPI client configuration
├── __generated__/
│   └── api.ts           # Auto-generated OpenAPI types
└── __tests__/
    ├── next.test.ts     # Next.js adapter tests
    └── tanstack-start.test.ts  # TanStack Start adapter tests
```

### Data Flow

1. **Client Init**: Developer creates client with DSN (identifies site/project) or `undefined` for development mode
2. **Metadata Request**: Call `getMetadata()` or `getHead()` with factory function
3. **Development Mode Check**: If DSN is undefined, skip to step 6 with empty metadata
4. **Caching Check**: Check in-memory cache for existing metadata
5. **API Call**: Fetch from `/v1/{dsn}/metadata/get-latest` if not cached
6. **Format Conversion**: Transform API response to framework-specific format
7. **Metadata Merging**: Apply priority: Override > Generated > Fallback

### Framework Adapters

#### Next.js (`src/next.ts`)

- **Methods**: `getMetadata(factory)`, `getRootMetadata(factory)`
- **Output**: Next.js `Metadata` object
- **Features**: Icons support, deep merging with lodash.merge
- **Usage**: Export from page/layout files

#### TanStack Start (`src/tanstack-start.ts`)

- **Methods**: `getHead(factory)`, `getRootHead(factory)`
- **Output**: HTML meta tags and link elements
- **Features**: Meta arrays with deduplication, link elements (favicon, etc.)
- **Usage**: Export as `head` function from routes

## API Schema

The library consumes a REST API with the following structure:

### Endpoint

```
GET /v1/{dsn}/metadata/get-latest?path={path}
```

### Response Schema

```typescript
{
  metadata: {
    title: string | null;
    description: string | null;
    favicon: {
      url: string;
      alt: string | null;
      width: number | null;
      height: number | null;
    } | null;
    openGraph: {
      title: string | null;
      description: string | null;
      image: ImageObject | null;
      images: ImageObject[];
    };
    twitter: {
      title: string | null;
      description: string | null;
      card: "summary" | "summary_large_image" | null;
      image: ImageObject | null;  // Single image only
    };
  }
}
```

**Note**: Twitter only supports single images, not arrays. This is per Twitter's current API specification.

## Development Workflow

### Commands

> **Important**: Use `npx` for all commands except `pnpm test`

```bash
# Install dependencies
pnpm install

# Development (with production API)
npx wireit dev

# Development (with local API)
npx wireit dev:local

# Build library
npx wireit build

# Generate types from OpenAPI (production)
npx wireit generate:production

# Generate types from OpenAPI (local)
npx wireit generate:local

# Run tests, linting, and type checking
pnpm test

# Run only unit tests
npx wireit test:vitest
```

### Build System

Uses **Wireit** for build orchestration and caching:

- **Parallel execution** of compatible tasks
- **Incremental builds** based on file changes
- **Dependency tracking** between build steps
- **Output caching** for faster rebuilds

### Code Generation

Types are automatically generated from OpenAPI specs:

- **Production**: `https://www.generate-metadata.com/api/openapi/spec.json`
- **Local**: `http://localhost:3000/api/openapi/spec.json`

## Testing

### Test Strategy

- **Unit Tests**: Comprehensive coverage for both framework adapters
- **Mocking**: API calls mocked using Vitest's mock system
- **Scenarios**: Success, failure, caching, partial responses, async functions

### Key Test Files

- `src/__tests__/next.test.ts` - Next.js adapter tests
- `src/__tests__/tanstack-start.test.ts` - TanStack Start adapter tests

### Test Patterns

```typescript
// Mock API responses
vi.mocked(api.GET).mockResolvedValue({
  data: mockApiResponse,
  error: undefined,
});

// Test framework-specific output
const metadataFn = client.getMetadata(() => ({ path: "/test" }));
const result = await metadataFn({}, {} as any);
expect(result).toEqual(expectedMetadata);
```

## Configuration Files

### Package Configuration

- **`package.json`**: Multi-export package with framework-specific entry points
- **`tsup.config.ts`**: Build configuration for dual CJS/ESM output
- **`tsconfig.json`**: TypeScript configuration with ESNext target
- **`vitest.config.ts`**: Test runner configuration
- **`eslint.config.ts`**: Linting rules using neostandard

### Quality Assurance

- **Husky**: Git hooks for pre-commit checks
- **lint-staged**: Runs linters only on staged files
- **Prettier**: Code formatting
- **ESLint**: Code linting with neostandard rules

## Usage Examples

### Next.js Integration

```typescript
// lib/metadata.ts
import { GenerateMetadataClient } from "generate-metadata/next";

export const metadataClient = new GenerateMetadataClient({
  // In production, provide the DSN
  dsn: process.env.NEXT_PUBLIC_GENERATE_METADATA_DSN,
  // In development, you can pass undefined to disable API calls
  // dsn: undefined, // This will skip API calls and use only fallback metadata
});

// app/page.tsx
import { metadataClient } from "@/lib/metadata";

export const getMetadata = metadataClient.getMetadata(() => ({
  path: "/",
  fallback: {
    title: "Default Home Title",
    description: "Default description",
  },
  override: {
    robots: "index,follow",
  },
}));

// For root layout metadata
export const getRootMetadata = metadataClient.getRootMetadata(() => ({
  path: "/",
  fallback: {
    title: "My App",
    description: "Default app description",
  },
  override: {
    viewport: "width=device-width, initial-scale=1",
  },
}));
```

### TanStack Start Integration

```typescript
// routes/index.tsx
import { GenerateMetadataClient } from "generate-metadata/tanstack-start";

const metadataClient = new GenerateMetadataClient({
  // In production, provide the DSN
  dsn: process.env.GENERATE_METADATA_DSN,
  // In development, you can pass undefined to disable API calls
  // dsn: undefined, // This will skip API calls and use only fallback metadata
});

export const head = metadataClient.getHead(() => ({
  path: "/",
  fallback: {
    meta: [{ name: "title", content: "Default Title" }],
  },
}));

// For root layout head metadata
export const rootHead = metadataClient.getRootHead(() => ({
  path: "/",
  fallback: {
    meta: [
      { name: "title", content: "My App" },
      { name: "description", content: "Default app description" },
    ],
  },
  override: {
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  },
}));
```

## Key Dependencies

### Production

- **`openapi-fetch`**: Type-safe API client from OpenAPI schemas
- **`lodash.merge`**: Deep object merging for metadata priority
- **`zod`**: Runtime type validation
- **`ts-pattern`**: Pattern matching utilities
- **`immer`**: Immutable state management

### Development

- **`tsup`**: Modern TypeScript bundler
- **`vitest`**: Fast unit testing framework
- **`openapi-typescript`**: Generates TypeScript types from OpenAPI
- **`wireit`**: Build orchestration and caching

## Important Implementation Details

### Caching Strategy

- **In-memory caching** using `Map<string, MetadataApiResponse>`
- **Cache key**: Based on the `path` parameter
- **Cache duration**: Lasts for the lifetime of the client instance
- **Cache behavior**: Same path = cached response, different paths = separate cache entries

### Metadata Priority System

Each framework adapter has its own merge behavior:

#### Next.js Merging

Uses `lodash.merge` for deep merging with priority order:

1. **Override** (highest priority - always wins)
2. **Generated** (from API response)
3. **Fallback** (lowest priority - fills gaps)

#### TanStack Start Merging

Uses custom merge logic with meta array deduplication:

**Non-meta properties**: Standard `lodash.merge` behavior (Override > Generated > Fallback)

**Meta arrays**: Deduplication based on meta tag keys with priority order:

1. **Override** (highest priority - always wins)
2. **Generated** (from API response)
3. **Fallback** (lowest priority - fills gaps)

**Deduplication rules**:

- Meta tags with `name` attribute: Deduplicated by `name:${value}`
- Meta tags with `property` attribute: Deduplicated by `property:${value}`
- Meta tags with `title` attribute: Deduplicated by `title`
- Meta tags without identifiable keys: Not deduplicated (preserved as-is)

**Example**: If fallback has `{ name: "title", content: "Fallback" }` and override has `{ name: "title", content: "Override" }`, only the override version appears in the final meta array.

### Development Mode

When `dsn` is `undefined`, the library operates in development mode:

- **No API calls**: All requests to the metadata API are skipped
- **Fallback only**: Only fallback metadata is returned (if provided)
- **Performance**: Faster development builds with no network dependencies
- **Offline support**: Works without internet connection or API availability

This is particularly useful for:

- Local development environments
- CI/CD pipelines where metadata API access isn't needed
- Testing environments where you want predictable, static metadata

### Error Handling

- **API failures**: Gracefully fall back to provided fallback metadata
- **Network issues**: Return fallback metadata without throwing
- **Partial responses**: Handle missing fields gracefully
- **Development mode**: When DSN is undefined, skip API calls entirely
- **Logging**: Console warnings for failed API calls (preserves debugging info)

### Twitter Card Implementation

- **Single image only**: Twitter cards support only one image per spec
- **Priority**: Uses `twitter.image` from API response
- **Formats**: Supports both `summary` and `summary_large_image` cards
- **Alt text**: Includes `twitter:image:alt` for accessibility

### Favicon Support

- **Next.js**: Uses `icons.icon` metadata format
- **TanStack Start**: Generates `<link rel="icon">` elements
- **Size attributes**: Includes width/height when available
- **Format**: Standard favicon link with optional sizes attribute

## Maintenance Guidelines

### For Future Claude Agents

1. **Update this file** whenever you make architectural changes
2. **Maintain test coverage** when adding new features
3. **Update OpenAPI types** when API schema changes
4. **Follow the established patterns** for framework adapters
5. **Use `npx` for all commands** except `pnpm test`
6. **Test both frameworks** when making core changes
7. **Keep examples working** in the `examples/` directory
8. **Audit and update documentation** whenever code is changed - ensure docs in `docs/content/` reflect new behavior
9. **Follow "less is more" principle** - documentation should be concise and digestible, avoid verbosity and stating obvious things. Use minimum words needed to convey information clearly.

### Code Standards

- **TypeScript strict mode** - maintain type safety
- **ESLint neostandard** - follow established style
- **Test coverage** - maintain comprehensive test coverage
- **Documentation** - update comments and this file
- **Semantic versioning** - follow semver for releases

### Adding New Framework Support

1. Create new adapter file in `src/` (e.g., `src/remix.ts`)
2. Extend `GenerateMetadataClientBase`
3. Implement framework-specific conversion logic
4. Add comprehensive test suite
5. Update package.json exports
6. Add usage examples
7. Update this documentation

### API Schema Changes

1. Run `npx wireit generate:production` to update types
2. Update implementations to handle new/changed fields
3. Update test mocks to match new schema
4. Test both framework adapters
5. Update this documentation with schema changes

## Troubleshooting

### Common Issues

- **Type errors after schema updates**: Regenerate types with `npx wireit generate:production`
- **API connection issues**: Check environment variables and network connectivity
- **Cache issues**: Client instances maintain their own cache - create new instance to clear
- **Build failures**: Clear node_modules and reinstall, then run `npx wireit build`

### Development Environment

- **Node.js**: Use version specified in package.json engines
- **Package Manager**: pnpm (required for workspace and wireit features)
- **IDE**: TypeScript support recommended for best development experience

---

**Last Updated**: 2025-01-14 - Updated function names from `generateMetadata` to `getMetadata` and `generateRootMetadata` to `getRootMetadata`. Added documentation for TanStack Start meta array deduplication behavior. Added examples for root metadata functions. Updated merge behavior documentation to reflect framework-specific implementations.
