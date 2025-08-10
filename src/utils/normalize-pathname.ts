import normalizeUrl from "normalize-url";

export function normalizePathname(path: string): string;
export function normalizePathname(path: string | null): string | null;
export function normalizePathname(path: string | null): string | null {
  if (!path) return null;

  if (path.startsWith("//")) {
    path = path.substring(1);
  }

  const url = new URL(path, "https://example.com");

  url.pathname = url.pathname.split("/").map(decodeURIComponent).join("/");

  // Use normalize-url with options that match our requirements
  const normalized = normalizeUrl(url.href, {
    stripHash: true,
    stripWWW: false,
    removeTrailingSlash: true,
    sortQueryParameters: true,
  });

  // Extract just the pathname from the normalized URL
  const normalizedUrl = new URL(normalized);
  return normalizedUrl.pathname;
}
