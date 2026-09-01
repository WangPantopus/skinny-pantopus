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

  // Job links use the mobile deep-link vocabulary — bare hosts with no
  // /app prefix (the mobile routers discard an unknown `app` host).
  // Mail Day: '/mailbox' → the web mailbox surface.
  if (path === '/mailbox' || path.startsWith('/mailbox/') || path.startsWith('/mailbox?')) {
    return `/app${path}`;
  }
  // Place: '/place?section=money' → the web group-detail route.
  if (path === '/place' || path.startsWith('/place?')) {
    const section = path.match(/[?&]section=([a-z-]+)/i);
    return section ? `/app/place/${section[1]}` : '/app/place';
  }

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
