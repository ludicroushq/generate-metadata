import normalizeUrl from 'normalize-url';

export function normalizePathname(path: string): string;
export function normalizePathname(path: string | null): string | null;
export function normalizePathname(path: string | null): string | null {
  if (!path) {
    return null;
  }

  if (path.startsWith('//')) {
    // biome-ignore lint/style/noParameterAssign: ok
    path = path.substring(1);
  }

  const url = new URL(path, 'https://example.com');

  url.pathname = url.pathname.split('/').map(decodeURIComponent).join('/');

  // Use normalize-url with options that match our requirements
  const normalized = normalizeUrl(url.href, {
    removeTrailingSlash: true,
    sortQueryParameters: true,
    stripHash: true,
    stripWWW: false,
  });

  // Extract just the pathname from the normalized URL
  const normalizedUrl = new URL(normalized);
  return normalizedUrl.pathname;
}
