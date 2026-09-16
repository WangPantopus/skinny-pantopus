// ============================================================
// PERSONAL BLOCK ENDPOINTS (`backend/routes/blocks.js`)
//
// The `UserBlock` contract: the rows `backend/services/blockService.js`
// reads to deny direct chat creation and message sending in BOTH
// directions. The router is mounted at `/api/users` (`backend/app.js:346`,
// before `userRoutes`, so `/blocked` is not captured by `/:username`).
//
// Deliberately separate from two other existing contracts, which this
// module does NOT touch:
//   • `UserProfileBlock` — the Identity Firewall's scoped profile blocks
//     (`./privacy`, `backend/routes/privacy.js`).
//   • `Relationship.status = 'blocked'` — the trust graph's connection
//     block (`./relationships`, `backend/routes/relationships.js`).
// ============================================================

import { get, post, del } from '../client';

// ============ TYPES ============

/** One `UserBlock` row, flattened by `blocks.js:145-155`. */
export interface BlockedUser {
  /** The `UserBlock` row id. */
  id: string;
  /** The blocked person's user id — what `unblockUser` takes. */
  user_id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  reason: string | null;
  created_at: string;
}

// ============ ENDPOINTS ============

/**
 * `POST /api/users/:userId/block` — block a user. Route
 * `backend/routes/blocks.js:13`. Denies direct messages both ways and
 * cascades one-way to the blocker's own personas.
 */
export async function blockUser(
  userId: string,
  reason?: string,
): Promise<{ success: boolean }> {
  return post(`/api/users/${userId}/block`, reason ? { reason } : {});
}

/**
 * `DELETE /api/users/:userId/block` — lift a personal block. Route
 * `backend/routes/blocks.js:101`. Idempotent: removing a block that is
 * not there still answers 200.
 */
export async function unblockUser(userId: string): Promise<{ success: boolean }> {
  return del(`/api/users/${userId}/block`);
}

/**
 * `GET /api/users/blocked` — the viewer's own personal blocks. Route
 * `backend/routes/blocks.js:138`.
 */
export async function getBlockedUsers(): Promise<{ blocked: BlockedUser[] }> {
  return get('/api/users/blocked');
}
