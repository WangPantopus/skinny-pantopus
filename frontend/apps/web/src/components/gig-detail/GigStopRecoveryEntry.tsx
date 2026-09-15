'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { GigStopRequest } from '@pantopus/api';
import GigStopDialog from './GigStopDialog';
import { GIG_STOP_RECOVERY_CHANGE, readStopRequest, sameStopRequest, stopId, stopRecoveryKey } from './gigStopRecovery';

/** Recovery does not depend on a live Gig projection or the current assignment. */
export default function GigStopRecoveryEntry({ gigId }: { gigId: string }) {
  const [saved, setSaved] = useState<GigStopRequest | null>(null);
  const [selected, setSelected] = useState<GigStopRequest | null>(null);
  const [error, setError] = useState('');
  const [retired, setRetired] = useState(false);
  const refresh = useRef<() => void>(() => {});
  const current = useRef<() => boolean>(() => false);
  const latestGig = useRef(gigId); latestGig.current = gigId;

  useEffect(() => {
    setSaved(null); setSelected(null); setError(''); setRetired(false);
    let mounted = true;
    let invalidated = false;
    let key: string | null = null;
    let actorId: string | null = null;
    let discovering = false;
    const token = api.getAuthToken();
    const origin = api.getApiBaseUrl();
    let marker: string | null | undefined;
    const retire = () => {
      invalidated = true;
      if (mounted) { setRetired(true); setSaved(null); setSelected(null); }
    };
    const fail = () => {
      if (mounted) {
        setSaved(null);
        setSelected(null);
        setError('Saved task recovery could not be read. Check again or contact support before starting another request.');
      }
    };
    const isCurrent = () => {
      if (!mounted || invalidated) return false;
      try {
        if (!token || api.getAuthToken() !== token || api.getApiBaseUrl() !== origin
          || localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) !== marker || latestGig.current !== gigId) {
          retire(); return false;
        }
      } catch { fail(); return false; }
      return true;
    };
    current.current = isCurrent;
    const refreshSaved = () => {
      if (!key || !actorId) { void discover(); return; }
      if (!isCurrent()) return;
      try { setSaved(readStopRequest(key, actorId, gigId)); setError(''); } catch { fail(); }
    };
    refresh.current = refreshSaved;
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) retire();
      else if (event.key === key) refreshSaved();
    };
    const localChanged = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) refreshSaved();
    };
    const unsubscribe = api.onTokenChange(retire);
    window.addEventListener('storage', changed);
    window.addEventListener('focus', refreshSaved);
    window.addEventListener(GIG_STOP_RECOVERY_CHANGE, localChanged);
    async function discover() {
      if (!mounted || invalidated || discovering) return;
      discovering = true;
      try {
        // Capture before the first await; a late profile must never rebind the screen.
        if (marker === undefined) marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
        if (!token || !stopId(gigId)) return;
        if (!isCurrent()) return;
        const profile = await api.users.getMyProfile();
        if (!isCurrent()) return;
        if (!stopId(profile.id)) { fail(); return; }
        actorId = profile.id;
        key = stopRecoveryKey(origin, actorId, gigId);
        refreshSaved();
      } catch { if (mounted && !invalidated) fail(); }
      finally { discovering = false; }
    }
    void discover();
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', refreshSaved);
      window.removeEventListener(GIG_STOP_RECOVERY_CHANGE, localChanged);
    };
  }, [gigId]);

  const open = () => {
    if (!current.current() || !saved) return;
    try {
      const latest = readStopRequest(stopRecoveryKey(api.getApiBaseUrl(), saved.actorId, gigId), saved.actorId, gigId);
      if (!latest || !sameStopRequest(saved, latest)) {
        setError('The saved task action changed. Check saved recovery again before continuing.');
        setSaved(null); return;
      }
      setSelected(latest);
    } catch {
      setSaved(null);
      setError('Saved task recovery could not be read. Check again or contact support before starting another request.');
    }
  };

  if (!saved && !selected && !error && !retired) return null;
  return <section aria-label="Saved task action" className="my-4 rounded-xl border border-app-border bg-app-surface p-4 text-left">
    {retired ? <p role="alert">Your session changed. Reload this page to recover saved task actions.</p> : <>
      {error && <p role="alert">{error}</p>}
      {saved && <>
        <p className="text-sm text-app-text-secondary">A task action is saved. Its status remains available after the task closes or your assignment ends.</p>
        <button type="button" className="mt-2 rounded-lg border px-3 py-2" onClick={open}>View saved action status</button>
      </>}
      {error && <button type="button" className="mt-2 rounded-lg border px-3 py-2" onClick={() => refresh.current()}>Check saved recovery</button>}
      {selected && <GigStopDialog key={selected.requestId} gigId={gigId} actorId={selected.actorId}
        action={selected.action} recoveryRequest={selected} isOwner={selected.actorId === selected.terms.ownerId}
        onClose={() => { setSelected(null); refresh.current(); }} />}
    </>}
  </section>;
}
