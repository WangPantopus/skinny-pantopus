// Pure slug helpers for the claim-your-link field (A2/A6). No deps — testable.
// Backend slug rule: /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/ (3–50 chars).

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}
