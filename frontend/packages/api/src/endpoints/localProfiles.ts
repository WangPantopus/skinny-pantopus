import { get, patch } from '../client';
import type { LocalProfile, Post } from '@pantopus/types';

/** What How neighbors see you changes: the name and photo (null: no photo). A new photo is uploaded with
 * upload.uploadLocalProfilePicture. The handle follows your username, the place your Neighborhood setting. */
export type UpdateLocalProfilePayload = Partial<{
  display_name: string;
  avatar_url: string | null;
}>;

/** Your own Local Profile, as How neighbors see you shows it. */
export interface OwnLocalProfile {
  profile: LocalProfile;
  /** Your account's name and photo, for "Use my account name" and "Use my account photo". */
  account: { displayName: string; avatarUrl: string | null };
  /** Whether each still follows your account's: true until you choose another one for neighbors. */
  followsAccount: { displayName: boolean; avatarUrl: boolean };
}

export async function getMyLocalProfile(): Promise<OwnLocalProfile> {
  return get('/api/local-profiles/me');
}

export async function updateMyLocalProfile(payload: UpdateLocalProfilePayload): Promise<OwnLocalProfile> {
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
