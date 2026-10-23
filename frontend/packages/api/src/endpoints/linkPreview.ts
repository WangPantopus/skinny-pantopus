// ============================================================
// LINK PREVIEW ENDPOINTS
// Fetches Open Graph metadata for external URLs
// ============================================================

import { get } from '../client';

/** Text only: the linked page's image is never loaded (see backend/routes/linkPreview.js). */
export interface LinkPreviewData {
  title: string | null;
  description: string | null;
  siteName: string | null;
  url: string;
}

/**
 * Fetch Open Graph metadata for an external URL.
 * Results are cached server-side for 1 hour.
 */
export function getLinkPreview(url: string): Promise<LinkPreviewData> {
  // A link that can't preview is routine, not an error worth a dev overlay.
  return get(`/api/link-preview?url=${encodeURIComponent(url)}`, undefined, { suppressDevErrorOverlay: true });
}
