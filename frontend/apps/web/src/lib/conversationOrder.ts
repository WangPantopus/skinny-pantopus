// The Messages list's page size and row order: shared by the browser's inbox
// reads (lib/conversations.ts) and the server's first content (lib/server).
// Keep this file dependency-free.

export const CONVERSATIONS_LIMIT = 50;

export function compareConversationTime(a?: string | null, b?: string | null): number {
  const milliseconds = Date.parse(a || '1970-01-01') - Date.parse(b || '1970-01-01');
  if (milliseconds) return milliseconds;
  const fraction = (value?: string | null) => (value?.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0');
  // Digits order the same either way, but a page's first localeCompare sets up the
  // browser's collator: 10-100 ms on the main thread while a cold inbox loads.
  const [x, y] = [fraction(a), fraction(b)];
  return x < y ? -1 : x > y ? 1 : 0;
}
