// ============================================================
// useLocalDraft — device-local persistence for the Band-C private
// inputs on the Place detail pages (mortgage balance, your rent, the
// emergency-readiness checklist).
//
// There is no server store for these yet, so they live in localStorage,
// keyed by home id. They are private to this device and never sent to
// neighbors or shown on a public place — the copy on each surface says
// so honestly. SSR-safe: starts from `initial`, hydrates on mount.
// ============================================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function read<T>(key: string, initial: T): T {
  if (typeof window === 'undefined') return initial;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return initial;
    return JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

export function useLocalDraft<T>(key: string | null, initial: T): [T, (next: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  // `hydrated` lets callers avoid flashing the prompt before we've read storage.
  const [hydrated, setHydrated] = useState(false);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!key) {
      setHydrated(true);
      return;
    }
    setValue(read(key, initial));
    setHydrated(true);
    // initial is intentionally excluded: it's a constant default per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback((next: T) => {
    setValue(next);
    const k = keyRef.current;
    if (!k || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(k, JSON.stringify(next));
    } catch {
      // Ignore quota / privacy-mode failures — the value still lives in state.
    }
  }, []);

  return [value, update, hydrated];
}
