// A short-lived, device-local preview, addressed by an opaque id in the
// return URL. Exact addresses never enter auth URLs or verification emails.
// A separate tab opened by the verification email can recover the same draft.
export interface PendingPlace {
  label: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
}

interface PlaceDraft extends PendingPlace {
  id: string;
  expiresAt: number;
  userId: string | null;
}

const PREFIX = 'pantopus:place-preview:';
const TTL = 24 * 60 * 60_000;
const validId = (id: string) => /^[a-zA-Z0-9_-]{16,64}$/.test(id);

function remove(id: string): void {
  try { localStorage.removeItem(PREFIX + id); } catch { /* storage unavailable */ }
}

export function clearPendingPlaces(): void {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem('pantopus_pending_place'); // retire the old automatic-save draft
  } catch { /* storage unavailable */ }
}

export function readPendingPlace(id: string): PlaceDraft | null {
  if (!validId(id)) return null;
  try {
    const p = JSON.parse(localStorage.getItem(PREFIX + id) || 'null') as PlaceDraft | null;
    if (!p || p.id !== id || !Number.isFinite(p.expiresAt) || p.expiresAt <= Date.now() ||
      typeof p.label !== 'string' || !p.label.trim() || p.label.length > 500 ||
      !Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 ||
      !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 ||
      (p.userId !== null && typeof p.userId !== 'string')) {
      remove(id);
      return null;
    }
    return p;
  } catch { remove(id); return null; }
}

/** Returns null if storage is blocked; the caller must keep the preview visible. */
export function stashPendingPlace(place: PendingPlace): string | null {
  try {
    // One unfinished Home arrival per device. Cancelled/older previews cannot
    // unexpectedly appear after a later social signup.
    clearPendingPlaces();
    const id = crypto.randomUUID();
    const draft: PlaceDraft = { ...place, id, expiresAt: Date.now() + TTL, userId: null };
    localStorage.setItem(PREFIX + id, JSON.stringify(draft));
    return readPendingPlace(id) ? id : null;
  } catch { return null; }
}

/** Purge expired drafts on the next app visit, even without their return URL. */
export function purgeExpiredPlacePreviews(): void {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => readPendingPlace(key.slice(PREFIX.length)));
  } catch { /* storage unavailable */ }
}

export function clearPendingPlace(id: string): void { remove(id); }

/** Bind once after credential exchange; never move a draft between accounts. */
export function bindPendingPlace(id: string, userId: string): PlaceDraft | null {
  const draft = readPendingPlace(id);
  if (!draft) return null;
  if (draft.userId && draft.userId !== userId) { remove(id); return null; }
  try {
    const bound = { ...draft, userId };
    localStorage.setItem(PREFIX + id, JSON.stringify(bound));
    return bound;
  } catch { return null; }
}

export function bindPlaceArrival(redirectTo: string, userId: string | undefined): void {
  if (!userId) return;
  try {
    const url = new URL(redirectTo, 'https://pantopus.invalid');
    if (url.pathname !== '/app/place') return;
    const id = url.searchParams.get('preview');
    if (id) bindPendingPlace(id, userId);
  } catch { /* no draft in this arrival */ }
}
