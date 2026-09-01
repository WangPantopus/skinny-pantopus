import type { BlockData } from '@/components/business/BlockPreview';
import type { BusinessPage } from '@pantopus/api';

// ─── Constants ──────────────────────────────────
export const MAX_UNDO = 50;

// ─── Undo/Redo History ──────────────────────────
export interface HistoryEntry {
  blocks: BlockData[];
  selectedBlockIndex: number | null;
}

// ─── Toast ──────────────────────────────────────
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ─── Page types (from API package) ──────────────
export type { BusinessPage };

export interface PageRevision {
  id: string;
  page_id: string;
  revision: number;
  published_at: string;
  notes?: string;
  publisher?: { id: string; username: string; name: string; profile_picture_url?: string };
}

// ─── Re-export BlockData for convenience ────────
export type { BlockData };
