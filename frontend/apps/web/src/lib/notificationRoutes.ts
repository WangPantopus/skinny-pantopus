type NotificationTarget = { type?: string; metadata?: Record<string, unknown> | null };
const taskId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveWebNotificationPath(link: string | null | undefined, notification?: NotificationTarget): string | null {
  // The old dashboard link remains usable by older clients. Current clients
  // resolve task notifications through the exact current-permission detail page.
  if (notification?.type === 'task_assigned' || notification?.type === 'task_completed') {
    const home = notification.metadata?.home_id;
    const task = notification.metadata?.task_id;
    if (typeof home === 'string' && taskId.test(home) && typeof task === 'string' && taskId.test(task)) {
      return `/app/homes/${home.toLowerCase()}/tasks/${task.toLowerCase()}`;
    }
  }
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;

  const path = extractPath(trimmed);
  if (!path || !safeInternalPath(path)) return null;
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
  if (link.startsWith('/')) return safeInternalPath(link) ? link : null;
  try {
    const parsed = new URL(link);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function safeInternalPath(path: string): boolean {
  try {
    const decoded = decodeURIComponent(path);
    return decoded.startsWith('/') && !decoded.startsWith('//')
      && !/[\\\u0000-\u001f\u007f]/.test(decoded);
  } catch { return false; }
}
