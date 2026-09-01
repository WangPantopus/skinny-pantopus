export function resolveWebNotificationPath(link: string | null | undefined): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;

  const path = extractPath(trimmed);
  if (!path) return trimmed;
  if (path.startsWith('/app/')) return path;

  const postMatch = path.match(/^\/posts?\/([^/?#]+)/i);
  if (postMatch) {
    const suffix = path.slice(postMatch[0].length);
    return `/app/feed/post/${postMatch[1]}${suffix}`;
  }

  if (path.startsWith('/homes/')) return `/app${path}`;
  return path;
}

function extractPath(link: string) {
  if (link.startsWith('/')) return link;
  try {
    const parsed = new URL(link);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
