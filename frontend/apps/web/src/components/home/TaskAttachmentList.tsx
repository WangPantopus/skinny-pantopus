'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { HomeTaskMedia } from '@pantopus/api';

export default function TaskAttachmentList({ homeId, taskId, revision = 0, onAccess, openingScope }: {
  homeId: string; taskId: string; revision?: number; onAccess: (allowed: boolean) => void; openingScope: api.HomeTaskSessionScope;
}) {
  const [media, setMedia] = useState<HomeTaskMedia[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const opening = useRef({ ...openingScope });
  const [sessionChanged, setSessionChanged] = useState(false);
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true); setBusy(null); setError(''); setCanUpload(false); onAccess(false);
    inFlight.current = false;
    try {
      if (opening.current.home_id !== homeId || openingScope.session_scope !== opening.current.session_scope || openingScope.actor_id !== opening.current.actor_id) throw api.taskSessionChanged();
      await api.assertHomeTaskSession(opening.current, taskId);
      if (request !== generation.current) return;
      const result = await api.upload.getHomeTaskMedia(homeId, taskId, opening.current);
      await api.assertHomeTaskSession(opening.current, taskId);
      if (request !== generation.current) return;
      setMedia(result.media); setCanUpload(result.can_upload); onAccess(result.can_upload);
    } catch (err) {
      if (request !== generation.current) return;
      if ((err as { code?: string })?.code === 'SESSION_SCOPE_CHANGED') setSessionChanged(true);
      setMedia([]); setError(err instanceof Error ? err.message : 'Could not load attachments. Retry.');
    } finally { if (request === generation.current) setLoading(false); }
  }, [homeId, taskId, onAccess, openingScope.session_scope, openingScope.actor_id]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load, revision]);
  const act = async (item: HomeTaskMedia, remove: boolean) => {
    if (inFlight.current || sessionChanged) return;
    inFlight.current = true;
    const request = generation.current; setBusy(item.id); setError('');
    try {
      await api.assertHomeTaskSession(opening.current, taskId);
      if (request !== generation.current) return;
      if (remove) {
        await api.upload.deleteHomeTaskMedia(homeId, taskId, item.id, opening.current);
        await api.assertHomeTaskSession(opening.current, taskId);
        if (request !== generation.current) return;
        setMedia(previous => previous.filter(value => value.id !== item.id));
      } else {
        const blob = await api.upload.downloadHomeTaskMedia(homeId, taskId, item.id, opening.current);
        await api.assertHomeTaskSession(opening.current, taskId);
        if (request !== generation.current) return;
        const url = URL.createObjectURL(blob);
        try { const link = document.createElement('a'); link.href = url; link.download = item.file_name; link.click(); }
        finally { URL.revokeObjectURL(url); }
      }
    } catch (err) {
      if (request === generation.current) {
        if ((err as { code?: string })?.code === 'SESSION_SCOPE_CHANGED') { setSessionChanged(true); setMedia([]); onAccess(false); }
        setError(err instanceof Error ? err.message : 'The attachment request was not confirmed. Retry.');
      }
    } finally { if (request === generation.current) { inFlight.current = false; setBusy(null); } }
  };
  if (sessionChanged) return <p role="alert">Your signed-in session changed. Reopen this task before continuing.</p>;
  return <section aria-label="Saved task attachments" className="space-y-2">
    {loading && <p className="text-sm text-app-text-secondary">Loading attachments…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error} <button type="button" onClick={() => void load()} className="underline">Reload attachments</button></p>}
    {!loading && media.filter(item => item.state !== 'retired' || item.cleanup_pending).map(item => <div key={item.id} className="flex items-center justify-between gap-2 rounded border border-app-border p-2 text-sm">
      <span>{item.file_name}{item.state === 'legacy' ? ' — Re-upload required' : item.state === 'reserved' ? ' — Upload not confirmed' : item.cleanup_pending ? ' — Removal pending' : ''}</span>
      <span className="flex gap-2">
        {item.available && <button type="button" disabled={busy !== null} className="underline" onClick={() => void act(item, false)}>Download</button>}
        {canUpload && item.state !== 'legacy' && <button type="button" disabled={busy !== null} className="underline" onClick={() => void act(item, true)}>{item.cleanup_pending ? 'Retry removal' : 'Remove'}</button>}
      </span>
    </div>)}
  </section>;
}
