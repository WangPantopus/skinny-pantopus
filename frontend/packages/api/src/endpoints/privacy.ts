// ============================================================
// PRIVACY ENDPOINTS — Identity Firewall
// Privacy settings and scoped profile blocks
// ============================================================

import { get, patch, post, del } from '../client';
import type {
  UserPrivacySettings,
  UpdatePrivacySettingsPayload,
  UserProfileBlock,
  CreateBlockPayload,
} from '@pantopus/types';

// ---- Privacy Settings ----

/**
 * Get the current user's privacy settings
 */
export async function getPrivacySettings(): Promise<{ settings: UserPrivacySettings }> {
  return get<{ settings: UserPrivacySettings }>('/api/privacy/settings');
}

/**
 * Update privacy settings
 */
export async function updatePrivacySettings(
  data: UpdatePrivacySettingsPayload,
): Promise<{ message: string; settings: UserPrivacySettings }> {
  return patch('/api/privacy/settings', data);
}

// ---- Profile Blocks ----

/**
 * List all scoped blocks for the current user
 */
export async function getBlocks(): Promise<{ blocks: UserProfileBlock[] }> {
  return get<{ blocks: UserProfileBlock[] }>('/api/privacy/blocks');
}

/**
 * Create a scoped block
 */
export async function createBlock(
  data: CreateBlockPayload,
): Promise<{ message: string; block: UserProfileBlock }> {
  return post('/api/privacy/blocks', data);
}

/**
 * Remove a block
 */
export async function removeBlock(blockId: string): Promise<{ message: string }> {
  return del(`/api/privacy/blocks/${blockId}`);
}
