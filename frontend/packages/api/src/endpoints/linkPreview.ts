// ============================================================
// LINK PREVIEW ENDPOINTS
// Fetches Open Graph metadata for external URLs
// ============================================================

import { get } from '../client';

export interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
}

/**
 * Fetch Open Graph metadata for an external URL.
 * Results are cached server-side for 1 hour.
 */
export function getLinkPreview(url: string): Promise<LinkPreviewData> {
  return get(`/link-preview?url=${encodeURIComponent(url)}`);
}
