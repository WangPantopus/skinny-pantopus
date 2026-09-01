// ============================================================
// FEATURE FLAG ENDPOINT (P0.8)
// ============================================================
// One read endpoint. Returns ONLY { flagName, enabled } for the calling
// user — never the full flag row. The admin write endpoint is intentionally
// NOT exposed here; it's invoked manually via curl with admin auth.
//
// Audience Profile design v2 §19 acceptance criterion 15.

import { get } from '../client';

export interface FeatureFlagResponse {
  flagName: string;
  enabled: boolean;
}

export async function getFeatureFlag(flagName: string): Promise<FeatureFlagResponse> {
  // The backend mounts this under /api (app.js: app.use('/api', featureFlags)).
  // The bare /feature-flags path 404'd against the Next proxy, so every web
  // flag read silently fell back to its caller's default.
  return get<FeatureFlagResponse>(`/api/feature-flags/${encodeURIComponent(flagName)}`);
}
