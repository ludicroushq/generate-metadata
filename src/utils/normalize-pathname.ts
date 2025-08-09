export function normalizePathname(path: string): string;
export function normalizePathname(path: string | null): string | null;
export function normalizePathname(path: string | null): string | null {
  if (!path) return null;

  const url = new URL(path, "https://example.com");
  let pathname = url.pathname;

  // Remove trailing slash unless it's the root path
  while (pathname.endsWith("/") && pathname !== "/") {
    pathname = pathname.slice(0, -1);
  }

  return pathname;
}
