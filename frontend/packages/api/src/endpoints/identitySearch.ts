import { get } from '../client';
import type { ProfileDiscoverySearchResponse } from '@pantopus/types';

export type ProfileDiscoverySearchScope = 'all' | 'local_profiles' | 'public_profiles';

export async function searchProfiles(params: {
  q: string;
  scope?: ProfileDiscoverySearchScope;
  limit?: number;
}): Promise<ProfileDiscoverySearchResponse> {
  return get('/api/identity/search', params);
}
