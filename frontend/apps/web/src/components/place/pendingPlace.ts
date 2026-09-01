// ============================================================
// Pending place — the bridge across the sign-up wall.
//
// The signed-out preview is non-persistent (the §4 anti-leak rule), so
// when a stranger hits the wall we stash the resolved address in
// sessionStorage, send them to /register, and save it once they land
// back in the authed app. sessionStorage (not localStorage) keeps it
// to the tab and clears on close — nothing persists server-side until
// the account exists.
// ============================================================

export interface PendingPlace {
  /** Display label, e.g. "1421 SE Oak St, Portland, OR". */
  label: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
}

const KEY = 'pantopus_pending_place';

export function stashPendingPlace(place: PendingPlace): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(place));
  } catch {
    // Private mode / storage disabled — the funnel still works, the save
    // just won't auto-run (the user can claim their place later).
  }
}

/** Read and CONSUME the pending place (one-shot). */
export function takePendingPlace(): PendingPlace | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const p = JSON.parse(raw) as Partial<PendingPlace>;
    if (
      p &&
      typeof p.label === 'string' &&
      typeof p.latitude === 'number' &&
      Number.isFinite(p.latitude) &&
      typeof p.longitude === 'number' &&
      Number.isFinite(p.longitude)
    ) {
      return {
        label: p.label,
        latitude: p.latitude,
        longitude: p.longitude,
        city: p.city ?? null,
        state: p.state ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}
