// Household member helpers for the W11 find-a-time / who's-free surfaces.
// The /occupants payload and the find-a-time/who's-free member arrays both key
// off the user id, so we normalise everything to a flat MemberView keyed by
// userId. Mirrors the read pattern the W1 onboarding wizard uses (we can't
// import across stream folders), plus avatar extraction these screens need.

import { absoluteMediaUrl } from "@/lib/publicShare";

export interface MemberView {
  userId: string;
  name: string;
  /** Role / relationship sub-label. */
  sub: string;
  avatarUrl: string | null;
}

function str(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Normalise a raw /occupants member list to MemberView[] (deduped by userId). */
export function readMembers(raw: unknown[]): MemberView[] {
  const seen = new Set<string>();
  const out: MemberView[] = [];
  for (const m of raw) {
    const o = (m ?? {}) as Record<string, unknown>;
    const user = (o.user ?? {}) as Record<string, unknown>;
    const userId = str(o.user_id, o.userId, user.id, o.id);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    out.push({
      userId,
      name:
        str(o.name, o.display_name, o.full_name, user.name, user.username) ||
        "Member",
      sub: str(o.role_base, o.role, o.relationship, o.title) || "Member",
      avatarUrl: absoluteMediaUrl(
        o.profile_picture_url ?? user.profile_picture_url,
      ),
    });
  }
  return out;
}

/** Two-letter initials for the avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Deterministic avatar tint from the userId so the same member always renders
// the same colour across the grid, slot dots and roster.
const AVATAR_TINTS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-pink-500",
];

export function tintForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

/** Short first-name label for compact rows ("Mom", "David"). */
export function shortName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
