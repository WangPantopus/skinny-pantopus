'use client';

/**
 * Previously handled migration from localStorage auth to cookie auth.
 * Now a no-op — the Next.js middleware handles session detection and
 * redirects via httpOnly cookies set by the backend (same-origin proxy).
 */
export default function RootSessionBootstrap() {
  return null;
}
