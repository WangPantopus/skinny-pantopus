import { get, patch } from '../client';
import type { IdentityCenterPayload, ViewAsPreview, ViewAsHomePreview } from '@pantopus/types';

export async function getIdentityCenter(): Promise<IdentityCenterPayload> {
  return get('/api/identity-center');
}

export async function getViewAsPreview(params: {
  surface: 'local' | 'persona' | 'audience';
  handle?: string;
  viewer?: string;
}): Promise<ViewAsPreview> {
  return get('/api/identity-center/view-as', params);
}

/** The privacy mirror: this home as a neighbor outside the household sees it. Members only. */
export async function getHomeMirror(homeId: string): Promise<ViewAsHomePreview> {
  return get('/api/identity-center/view-as', { surface: 'home', home_id: homeId });
}

export async function updateBridgeSettings(personaId: string, payload: {
  show_persona_on_local: boolean;
  show_local_on_persona: boolean;
  bridge_label?: string | null;
}): Promise<{ bridge: IdentityCenterPayload['bridges'] }> {
  return patch(`/api/identity-center/bridges/${encodeURIComponent(personaId)}`, payload);
}
