// ============================================================
// MAGIC TASK ENDPOINTS
// AI-powered task posting — one sentence to structured task
// ============================================================

import { get, post, del, put } from '../client';
import type {
  MagicDraftRequest,
  MagicDraftResponse,
  MagicPostRequest,
  MagicPostResponse,
  SmartTemplate,
  SavedTaskTemplate,
  MagicSettings,
} from '@pantopus/types';

/**
 * Generate an AI-powered structured draft from free text.
 * Falls back to deterministic-only draft if AI is unavailable.
 */
export async function getMagicDraft(data: MagicDraftRequest): Promise<MagicDraftResponse> {
  return post<MagicDraftResponse>('/api/gigs/magic-draft', data);
}

/**
 * Generate a basic (deterministic-only, no AI) draft from free text.
 */
export async function getBasicDraft(data: MagicDraftRequest): Promise<MagicDraftResponse> {
  return post<MagicDraftResponse>('/api/gigs/basic-draft', data);
}

/**
 * Post a magic task (with 10-second undo window).
 */
export async function magicPost(data: MagicPostRequest): Promise<MagicPostResponse> {
  return post<MagicPostResponse>('/api/gigs/magic-post', data);
}

/**
 * Undo a recently posted magic task (within undo window).
 */
export async function undoTask(gigId: string): Promise<{ message: string; gigId: string }> {
  return post<{ message: string; gigId: string }>(`/api/gigs/${gigId}/undo`, {});
}

/**
 * Get the smart templates library (static quick chips).
 */
export async function getTemplateLibrary(): Promise<{ templates: SmartTemplate[] }> {
  return get<{ templates: SmartTemplate[] }>('/api/gigs/templates/library');
}

/**
 * Get user's saved task templates.
 */
export async function getSavedTemplates(): Promise<{ templates: SavedTaskTemplate[] }> {
  return get<{ templates: SavedTaskTemplate[] }>('/api/gigs/templates/saved');
}

/**
 * Save a new task template.
 */
export async function saveTemplate(data: {
  label: string;
  home_id?: string | null;
  template: Partial<import('@pantopus/types').MagicTaskDraft>;
}): Promise<{ template: SavedTaskTemplate }> {
  return post<{ template: SavedTaskTemplate }>('/api/gigs/templates/saved', data);
}

/**
 * Delete a saved template.
 */
export async function deleteSavedTemplate(id: string): Promise<{ message: string }> {
  return del<{ message: string }>(`/api/gigs/templates/saved/${id}`);
}

/**
 * Record usage of a saved template (increments use_count).
 */
export async function useTemplate(id: string): Promise<{ template: SavedTaskTemplate }> {
  return post<{ template: SavedTaskTemplate }>(`/api/gigs/templates/saved/${id}/use`, {});
}

/**
 * Get user's magic task settings (instant post preferences).
 */
export async function getMagicSettings(): Promise<MagicSettings> {
  return get<MagicSettings>('/api/gigs/magic-settings');
}

/**
 * Update user's magic task settings.
 */
export async function updateMagicSettings(data: { instant_post: boolean }): Promise<{ instant_post: boolean }> {
  return put<{ instant_post: boolean }>('/api/gigs/magic-settings', data);
}
