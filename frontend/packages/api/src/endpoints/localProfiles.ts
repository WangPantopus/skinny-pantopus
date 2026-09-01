import { get, patch } from '../client';
import type { LocalProfile, Post } from '@pantopus/types';

export type UpdateLocalProfilePayload = Partial<{
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  tagline: string | null;
  public_city: string | null;
  public_state: string | null;
  public_neighborhood: string | null;
  show_verified_resident_badge: boolean;
  show_home_affiliation: boolean;
  show_neighborhood: boolean;
  show_gig_history: boolean;
  profile_visibility: 'public' | 'followers' | 'connections' | 'private';
  search_visibility: 'everyone' | 'mutuals' | 'nobody';
}>;

export async function getMyLocalProfile(): Promise<{ profile: LocalProfile }> {
  return get('/api/local-profiles/me');
}

export async function updateMyLocalProfile(payload: UpdateLocalProfilePayload): Promise<{ profile: LocalProfile }> {
  return patch('/api/local-profiles/me', payload);
}

export async function getLocalProfile(handle: string): Promise<{ profile: LocalProfile }> {
  return get(`/api/local-profiles/${encodeURIComponent(handle)}`);
}

export async function getLocalProfileActivity(handle: string): Promise<{ posts: Post[] }> {
  return get(`/api/local-profiles/${encodeURIComponent(handle)}/activity`);
}

export async function getLocalProfileGigs(handle: string): Promise<{ gigs: any[] }> {
  return get(`/api/local-profiles/${encodeURIComponent(handle)}/gigs`);
}

export async function getLocalProfileListings(handle: string): Promise<{ listings: any[] }> {
  return get(`/api/local-profiles/${encodeURIComponent(handle)}/listings`);
}
